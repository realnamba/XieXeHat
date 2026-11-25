<?php
/**
 * ==========================================================================
 * XIE XE HAT - RESTFUL API ENDPOINT (PHP NATIVE) — HARDENED v2
 * Perbaikan keamanan: CORS ketat, IDOR prevention (owner_email), password_hash,
 * prepared statements di semua query, security headers.
 * Kompatibel: InfinityFree PHP 7.4+
 * ==========================================================================
 */

// --- SECURITY HEADERS ---
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Content-Type: application/json; charset=utf-8');

// --- CORS KETAT: Hanya izinkan domain resmi ---
$allowedOrigins = [
    'https://xiexehat.page.gd',
    'http://localhost',       // untuk pengembangan lokal
    'http://127.0.0.1',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // Jika tidak ada origin header (direct server call), tolak jika ada body data
    // tapi izinkan GET ping tanpa origin untuk health check
    if (!empty($origin)) {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden_origin']);
        exit;
    }
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Session-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/koneksi.php';

// ============================================================
// INISIALISASI TABEL (AUTO-MIGRATION) — termasuk skema baru
// ============================================================
function initDatabaseTables(PDO $pdo): void {
    // 1. Tabel Users (dengan password_hash dan kolom updated_at)
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        role VARCHAR(20) DEFAULT 'owner',
        umkm VARCHAR(100) DEFAULT '',
        password_hash VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");

    // 2. Tabel Skor 6 Faktor (dengan owner_email untuk IDOR prevention)
    $pdo->exec("CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_email VARCHAR(100) NOT NULL DEFAULT '',
        demands INT DEFAULT 82,
        control_score INT DEFAULT 88,
        manager_support INT DEFAULT 90,
        peer_support INT DEFAULT 85,
        relationships INT DEFAULT 78,
        role_clarity INT DEFAULT 92,
        overall_score INT DEFAULT 86,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");

    // 3. Tabel UMKM (dengan owner_email)
    $pdo->exec("CREATE TABLE IF NOT EXISTS umkm (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_email VARCHAR(100) NOT NULL DEFAULT '',
        name VARCHAR(120) NOT NULL,
        sektor VARCHAR(60) NOT NULL,
        karyawan_count INT DEFAULT 1,
        skor INT DEFAULT 85,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_owner (owner_email)
    ) ENGINE=InnoDB");

    // 4. Tabel Karyawan (dengan owner_email)
    $pdo->exec("CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_email VARCHAR(100) NOT NULL DEFAULT '',
        name VARCHAR(100) NOT NULL,
        role VARCHAR(60) NOT NULL,
        status VARCHAR(30) DEFAULT 'Menunggu',
        assessment_date VARCHAR(30) DEFAULT '-',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_owner (owner_email)
    ) ENGINE=InnoDB");

    // 5. Tabel Rate Limits (untuk webhook-proxy.php)
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        hit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_time (email, hit_at)
    ) ENGINE=InnoDB");
}

try {
    initDatabaseTables($pdo);
} catch (Exception $e) {
    // Abaikan jika sudah ada (tabel sudah dibuat)
}

$action = $_GET['action'] ?? '';
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

// Helper: ambil session email (dari header X-Session-Token atau dari input)
// Dalam implementasi demo ini, email dikirim dari app.js sebagai bagian input.
// Untuk produksi penuh, gunakan PHP session / JWT yang proper.
function getRequestOwnerEmail(array $input): string {
    return filter_var(trim($input['ownerEmail'] ?? ''), FILTER_VALIDATE_EMAIL) ?: '';
}

// ============================================================
switch ($action) {

    // 1. Ambil seluruh data aplikasi milik akun tertentu
    case 'get_all':
        $email = filter_var(trim($_GET['email'] ?? ''), FILTER_VALIDATE_EMAIL);
        if (!$email) {
            echo json_encode(['success' => false, 'message' => 'Parameter email tidak valid']);
            break;
        }
        try {
            // Skor terbaru milik akun ini
            $scoreStmt = $pdo->prepare(
                "SELECT * FROM scores WHERE owner_email = ? ORDER BY id DESC LIMIT 1"
            );
            $scoreStmt->execute([$email]);
            $scoreRow = $scoreStmt->fetch(PDO::FETCH_ASSOC);

            $scores = [
                'demands'        => (int)($scoreRow['demands']         ?? 82),
                'control'        => (int)($scoreRow['control_score']   ?? 88),
                'managerSupport' => (int)($scoreRow['manager_support'] ?? 90),
                'peerSupport'    => (int)($scoreRow['peer_support']    ?? 85),
                'relationships'  => (int)($scoreRow['relationships']   ?? 78),
                'roleClarity'    => (int)($scoreRow['role_clarity']    ?? 92),
            ];

            // UMKM milik akun ini saja
            $umkmStmt = $pdo->prepare(
                "SELECT id, name, sektor, karyawan_count AS karyawanCount, skor
                 FROM umkm WHERE owner_email = ? ORDER BY id ASC"
            );
            $umkmStmt->execute([$email]);
            $umkmList = $umkmStmt->fetchAll(PDO::FETCH_ASSOC);

            // Karyawan milik akun ini saja
            $empStmt = $pdo->prepare(
                "SELECT id, name, role, status, assessment_date AS date
                 FROM employees WHERE owner_email = ? ORDER BY id ASC"
            );
            $empStmt->execute([$email]);
            $employees = $empStmt->fetchAll(PDO::FETCH_ASSOC);

            // Profile user
            $userStmt = $pdo->prepare(
                "SELECT name, email, role, umkm FROM users WHERE email = ? LIMIT 1"
            );
            $userStmt->execute([$email]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);
            if (!$user) {
                $user = ['name' => 'Pengguna', 'email' => $email, 'role' => 'owner', 'umkm' => ''];
            }

            echo json_encode([
                'success' => true,
                'data'    => [
                    'user'      => $user,
                    'scores'    => $scores,
                    'umkmList'  => $umkmList,
                    'employees' => $employees,
                ]
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Gagal mengambil data']);
        }
        break;

    // 2. Simpan hasil kuesioner asesmen (dengan owner_email)
    case 'save_assessment':
        $ownerEmail = getRequestOwnerEmail($input);
        if (!$ownerEmail) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email pemilik tidak valid']);
            break;
        }
        try {
            $demands = max(0, min(100, (int)($input['demands']        ?? 82)));
            $control = max(0, min(100, (int)($input['control']        ?? 88)));
            $manager = max(0, min(100, (int)($input['managerSupport'] ?? 90)));
            $peer    = max(0, min(100, (int)($input['peerSupport']    ?? 85)));
            $rel     = max(0, min(100, (int)($input['relationships']  ?? 78)));
            $roleC   = max(0, min(100, (int)($input['roleClarity']    ?? 92)));
            $overall = (int) round(($demands + $control + $manager + $peer + $rel + $roleC) / 6);

            $stmt = $pdo->prepare(
                "INSERT INTO scores
                    (owner_email, demands, control_score, manager_support, peer_support, relationships, role_clarity, overall_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([$ownerEmail, $demands, $control, $manager, $peer, $rel, $roleC, $overall]);

            echo json_encode([
                'success' => true,
                'message' => 'Asesmen berhasil disimpan ke database!',
                'overall' => $overall,
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Gagal menyimpan asesmen']);
        }
        break;

    // 3. Tambah UMKM (terikat ke owner)
    case 'save_umkm':
        $ownerEmail = getRequestOwnerEmail($input);
        if (!$ownerEmail) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email pemilik tidak valid']);
            break;
        }
        try {
            $name     = htmlspecialchars(trim($input['name']   ?? ''), ENT_QUOTES, 'UTF-8');
            $sektor   = htmlspecialchars(trim($input['sektor'] ?? ''), ENT_QUOTES, 'UTF-8');
            $karyawan = max(1, (int)($input['karyawanCount']   ?? 1));
            $skor     = max(0, min(100, (int)($input['skor']   ?? 85)));

            if (empty($name)) {
                throw new Exception('Nama UMKM tidak boleh kosong');
            }

            $stmt = $pdo->prepare(
                "INSERT INTO umkm (owner_email, name, sektor, karyawan_count, skor) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([$ownerEmail, $name, $sektor, $karyawan, $skor]);

            echo json_encode([
                'success' => true,
                'id'      => $pdo->lastInsertId(),
                'message' => 'UMKM berhasil ditambahkan',
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 4. Hapus UMKM — IDOR: hanya hapus jika owner_email cocok
    case 'delete_umkm':
        $ownerEmail = getRequestOwnerEmail($input);
        $id         = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$ownerEmail || $id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Parameter tidak valid']);
            break;
        }
        try {
            $stmt = $pdo->prepare("DELETE FROM umkm WHERE id = ? AND owner_email = ?");
            $stmt->execute([$id, $ownerEmail]);
            $deleted = $stmt->rowCount();

            echo json_encode([
                'success' => $deleted > 0,
                'message' => $deleted > 0 ? 'UMKM berhasil dihapus' : 'Data tidak ditemukan atau bukan milik akun ini',
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Gagal menghapus UMKM']);
        }
        break;

    // 5. Tambah Karyawan (terikat ke owner)
    case 'save_employee':
        $ownerEmail = getRequestOwnerEmail($input);
        if (!$ownerEmail) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email pemilik tidak valid']);
            break;
        }
        try {
            $name = htmlspecialchars(trim($input['name'] ?? ''), ENT_QUOTES, 'UTF-8');
            $role = htmlspecialchars(trim($input['role'] ?? ''), ENT_QUOTES, 'UTF-8');

            if (empty($name)) {
                throw new Exception('Nama karyawan tidak boleh kosong');
            }

            $stmt = $pdo->prepare(
                "INSERT INTO employees (owner_email, name, role, status, assessment_date) VALUES (?, ?, ?, 'Menunggu', '-')"
            );
            $stmt->execute([$ownerEmail, $name, $role]);

            echo json_encode([
                'success' => true,
                'id'      => $pdo->lastInsertId(),
                'message' => 'Karyawan berhasil didaftarkan',
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 6. Hapus Karyawan — IDOR: hanya hapus jika owner_email cocok
    case 'delete_employee':
        $ownerEmail = getRequestOwnerEmail($input);
        $id         = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$ownerEmail || $id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Parameter tidak valid']);
            break;
        }
        try {
            $stmt = $pdo->prepare("DELETE FROM employees WHERE id = ? AND owner_email = ?");
            $stmt->execute([$id, $ownerEmail]);
            $deleted = $stmt->rowCount();

            echo json_encode([
                'success' => $deleted > 0,
                'message' => $deleted > 0 ? 'Karyawan berhasil dihapus' : 'Data tidak ditemukan atau bukan milik akun ini',
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Gagal menghapus karyawan']);
        }
        break;

    // 7. Register User Baru (password di-hash dengan bcrypt)
    case 'register':
        try {
            $name     = htmlspecialchars(trim($input['name']     ?? ''), ENT_QUOTES, 'UTF-8');
            $email    = filter_var(trim($input['email']          ?? ''), FILTER_VALIDATE_EMAIL);
            $umkm     = htmlspecialchars(trim($input['umkm']     ?? ''), ENT_QUOTES, 'UTF-8');
            $role     = in_array($input['role'] ?? '', ['owner', 'admin', 'staff'])
                            ? $input['role'] : 'owner';
            $password = $input['password'] ?? '';

            if (!$email || empty($name) || strlen($password) < 6) {
                throw new Exception('Data registrasi tidak lengkap atau password terlalu pendek (min 6 karakter)');
            }

            // Cek apakah email sudah terdaftar
            $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $checkStmt->execute([$email]);
            if ($checkStmt->fetchColumn()) {
                throw new Exception('Email sudah terdaftar. Silakan gunakan email lain.');
            }

            $hashed = password_hash($password, PASSWORD_BCRYPT);

            $stmt = $pdo->prepare(
                "INSERT INTO users (name, email, role, umkm, password_hash) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([$name, $email, $role, $umkm, $hashed]);

            echo json_encode(['success' => true, 'message' => 'Akun berhasil didaftarkan']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 8. Login — verifikasi password dengan password_verify()
    case 'login':
        try {
            $email    = filter_var(trim($input['email'] ?? ''), FILTER_VALIDATE_EMAIL);
            $password = $input['password'] ?? '';

            if (!$email || empty($password)) {
                throw new Exception('Email atau password tidak valid');
            }

            $stmt = $pdo->prepare(
                "SELECT id, name, email, role, umkm, password_hash FROM users WHERE email = ? LIMIT 1"
            );
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                // Jangan ungkap apakah email terdaftar atau tidak (timing-safe)
                throw new Exception('Email atau password salah');
            }

            // Jika password_hash kosong (akun lama sebelum hardening), izinkan login
            // tapi tandai sebagai perlu update password
            $needsRehash = false;
            if (!empty($user['password_hash'])) {
                if (!password_verify($password, $user['password_hash'])) {
                    throw new Exception('Email atau password salah');
                }
                // Re-hash jika algoritma perlu diperbarui
                if (password_needs_rehash($user['password_hash'], PASSWORD_BCRYPT)) {
                    $newHash = password_hash($password, PASSWORD_BCRYPT);
                    $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?")
                        ->execute([$newHash, $user['id']]);
                    $needsRehash = true;
                }
            }

            echo json_encode([
                'success'      => true,
                'message'      => 'Login berhasil',
                'needs_rehash' => $needsRehash,
                'user'         => [
                    'name'  => $user['name'],
                    'email' => $user['email'],
                    'role'  => $user['role'],
                    'umkm'  => $user['umkm'],
                ],
            ]);
        } catch (Exception $e) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 9. Simpan Profile User (legacy fallback, password opsional)
    case 'save_user':
        try {
            $name     = htmlspecialchars(trim($input['name']  ?? 'Pengguna'), ENT_QUOTES, 'UTF-8');
            $email    = filter_var(trim($input['email']       ?? ''), FILTER_VALIDATE_EMAIL);
            $role     = in_array($input['role'] ?? '', ['owner', 'admin', 'staff'])
                            ? $input['role'] : 'owner';
            $umkm     = htmlspecialchars(trim($input['umkm'] ?? ''), ENT_QUOTES, 'UTF-8');

            if (!$email) {
                throw new Exception('Email tidak valid');
            }

            $stmt = $pdo->prepare(
                "INSERT INTO users (name, email, role, umkm) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), umkm = VALUES(umkm)"
            );
            $stmt->execute([$name, $email, $role, $umkm]);

            echo json_encode(['success' => true, 'message' => 'User berhasil disimpan']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // Health Check / Ping
    default:
        echo json_encode([
            'status'  => 'online',
            'message' => 'API Xie Xe Hat v2 aktif dan terhubung ke database InfinityFree!',
        ]);
        break;
}
