<?php
/**
 * XIE XE HAT - RESTFUL API ENDPOINT (PHP NATIVE)
 * Dirancang khusus untuk kompatibilitas penuh dengan hosting InfinityFree
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/koneksi.php';

// Inisialisasi Tabel Otomatis jika belum ada di database InfinityFree
function initDatabaseTables($pdo) {
    // 1. Tabel User
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'owner',
        umkm VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");

    // 2. Tabel Skor 6 Faktor
    $pdo->exec("CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        demands INT DEFAULT 82,
        control_score INT DEFAULT 88,
        manager_support INT DEFAULT 90,
        peer_support INT DEFAULT 85,
        relationships INT DEFAULT 78,
        role_clarity INT DEFAULT 92,
        overall_score INT DEFAULT 86,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");

    // 3. Tabel UMKM
    $pdo->exec("CREATE TABLE IF NOT EXISTS umkm (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        sektor VARCHAR(60) NOT NULL,
        karyawan_count INT DEFAULT 1,
        skor INT DEFAULT 85,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");

    // 4. Tabel Karyawan
    $pdo->exec("CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(60) NOT NULL,
        status VARCHAR(30) DEFAULT 'Menunggu',
        assessment_date VARCHAR(30) DEFAULT '-',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");

    // Seed data awal jika tabel scores masih kosong
    $checkScores = $pdo->query("SELECT COUNT(*) FROM scores")->fetchColumn();
    if ($checkScores == 0) {
        $pdo->exec("INSERT INTO scores (demands, control_score, manager_support, peer_support, relationships, role_clarity, overall_score) 
                    VALUES (82, 88, 90, 85, 78, 92, 86)");
    }

    // Seed data awal UMKM jika kosong
    $checkUmkm = $pdo->query("SELECT COUNT(*) FROM umkm")->fetchColumn();
    if ($checkUmkm == 0) {
        $pdo->exec("INSERT INTO umkm (name, sektor, karyawan_count, skor) VALUES 
                    ('Kopi Kenangan Sehat', 'F&B', 8, 86),
                    ('Batik Lestari Mandiri', 'Kriya & Tekstil', 14, 79),
                    ('Catering Berkah Rasa', 'Kuliner', 6, 91)");
    }

    // Seed data awal Karyawan jika kosong
    $checkEmp = $pdo->query("SELECT COUNT(*) FROM employees")->fetchColumn();
    if ($checkEmp == 0) {
        $pdo->exec("INSERT INTO employees (name, role, status, assessment_date) VALUES 
                    ('Ahmad Fauzi', 'Barista / Operasional', 'Selesai', '04 Nov 2026'),
                    ('Siti Rahmawati', 'Kasir & Admin', 'Selesai', '04 Nov 2026'),
                    ('Dewi Lestari', 'Dapur & Logistik', 'Selesai', '05 Nov 2026'),
                    ('Rian Pratama', 'Staff Operasional', 'Menunggu', '-')");
    }
}

// Jalankan inisialisasi tabel
try {
    initDatabaseTables($pdo);
} catch (Exception $e) {
    // Abaikan error jika sudah dibuat
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {

    // 1. Ambil seluruh data aplikasi (Sinkronisasi awal ke app.js)
    case 'get_all':
        try {
            // Ambil skor terbaru
            $scoreStmt = $pdo->query("SELECT * FROM scores ORDER BY id DESC LIMIT 1");
            $scoreRow = $scoreStmt->fetch();

            $scores = [
                'demands'        => (int)($scoreRow['demands'] ?? 82),
                'control'        => (int)($scoreRow['control_score'] ?? 88),
                'managerSupport' => (int)($scoreRow['manager_support'] ?? 90),
                'peerSupport'    => (int)($scoreRow['peer_support'] ?? 85),
                'relationships'  => (int)($scoreRow['relationships'] ?? 78),
                'roleClarity'    => (int)($scoreRow['role_clarity'] ?? 92)
            ];

            // Ambil daftar UMKM
            $umkmStmt = $pdo->query("SELECT id, name, sektor, karyawan_count AS karyawanCount, skor FROM umkm ORDER BY id ASC");
            $umkmList = $umkmStmt->fetchAll();

            // Ambil daftar Karyawan
            $empStmt = $pdo->query("SELECT id, name, role, status, assessment_date AS date FROM employees ORDER BY id ASC");
            $employees = $empStmt->fetchAll();

            // Ambil user terakhir
            $userStmt = $pdo->query("SELECT name, email, role, umkm FROM users ORDER BY id DESC LIMIT 1");
            $user = $userStmt->fetch();
            if (!$user) {
                $user = [
                    'name'  => 'Budi Santoso',
                    'email' => 'owner@tokosehat.id',
                    'role'  => 'owner',
                    'umkm'  => 'Kopi Kenangan Sehat'
                ];
            }

            echo json_encode([
                'success'   => true,
                'data'      => [
                    'user'      => $user,
                    'scores'    => $scores,
                    'umkmList'  => $umkmList,
                    'employees' => $employees
                ]
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 2. Simpan hasil kuesioner asesmen
    case 'save_assessment':
        try {
            $demands = (int)($input['demands'] ?? 82);
            $control = (int)($input['control'] ?? 88);
            $manager = (int)($input['managerSupport'] ?? 90);
            $peer    = (int)($input['peerSupport'] ?? 85);
            $rel     = (int)($input['relationships'] ?? 78);
            $role    = (int)($input['roleClarity'] ?? 92);
            $overall = (int)round(($demands + $control + $manager + $peer + $rel + $role) / 6);

            $stmt = $pdo->prepare("INSERT INTO scores (demands, control_score, manager_support, peer_support, relationships, role_clarity, overall_score) 
                                   VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$demands, $control, $manager, $peer, $rel, $role, $overall]);

            echo json_encode([
                'success' => true,
                'message' => 'Asesmen berhasil disimpan ke database MySQL InfinityFree!',
                'overall' => $overall
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 3. Tambah UMKM
    case 'save_umkm':
        try {
            $name = trim($input['name'] ?? '');
            $sektor = trim($input['sektor'] ?? '');
            $karyawan = (int)($input['karyawanCount'] ?? 1);
            $skor = (int)($input['skor'] ?? 85);

            if (empty($name)) {
                throw new Exception('Nama UMKM tidak boleh kosong');
            }

            $stmt = $pdo->prepare("INSERT INTO umkm (name, sektor, karyawan_count, skor) VALUES (?, ?, ?, ?)");
            $stmt->execute([$name, $sektor, $karyawan, $skor]);

            echo json_encode([
                'success' => true,
                'id'      => $pdo->lastInsertId(),
                'message' => 'UMKM berhasil ditambahkan ke database'
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 4. Hapus UMKM
    case 'delete_umkm':
        try {
            $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM umkm WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode(['success' => true, 'message' => 'UMKM berhasil dihapus']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 5. Tambah Karyawan
    case 'save_employee':
        try {
            $name = trim($input['name'] ?? '');
            $role = trim($input['role'] ?? '');

            if (empty($name)) {
                throw new Exception('Nama karyawan tidak boleh kosong');
            }

            $stmt = $pdo->prepare("INSERT INTO employees (name, role, status, assessment_date) VALUES (?, ?, 'Menunggu', '-')");
            $stmt->execute([$name, $role]);

            echo json_encode([
                'success' => true,
                'id'      => $pdo->lastInsertId(),
                'message' => 'Karyawan berhasil didaftarkan ke database'
            ]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 6. Hapus Karyawan
    case 'delete_employee':
        try {
            $id = (int)($input['id'] ?? $_GET['id'] ?? 0);
            $stmt = $pdo->prepare("DELETE FROM employees WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode(['success' => true, 'message' => 'Karyawan berhasil dihapus']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // 7. Simpan Profile User (Login/Register)
    case 'save_user':
        try {
            $name  = trim($input['name'] ?? 'Pengguna');
            $email = trim($input['email'] ?? '');
            $role  = trim($input['role'] ?? 'owner');
            $umkm  = trim($input['umkm'] ?? '');

            $stmt = $pdo->prepare("INSERT INTO users (name, email, role, umkm) VALUES (?, ?, ?, ?)");
            $stmt->execute([$name, $email, $role, $umkm]);

            echo json_encode(['success' => true, 'message' => 'User berhasil disimpan']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    // Status Ping
    default:
        echo json_encode([
            'status'  => 'online',
            'message' => 'API Xie Xe Hat aktif dan terhubung ke database InfinityFree!'
        ]);
        break;
}

