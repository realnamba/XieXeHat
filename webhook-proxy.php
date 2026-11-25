<?php
/**
 * ==========================================================================
 * XIE XE HAT — WEBHOOK PROXY (PHP SERVER-SIDE RELAY)
 * Fungsi: Menyembunyikan URL Webhook n8n dari browser pengguna.
 *         Browser hanya memanggil file ini; file ini yang menghubungi n8n.
 * Deploy ke: InfinityFree (kompatibel PHP 7.4+)
 * ==========================================================================
 *
 * KONFIGURASI WAJIB:
 *   1. Ganti nilai WEBHOOK_SECRET dengan string acak yang panjang (min 32 karakter).
 *      String yang sama HARUS diisi di js/app.js pada konstanta CLIENT_HMAC_SECRET.
 *   2. Ganti nilai N8N_WEBHOOK_URL dengan URL endpoint Webhook n8n Anda.
 *      URL ini TIDAK PERNAH dikirim ke browser.
 */

// --- KONFIGURASI RAHASIA (hanya ada di server) ---
define('WEBHOOK_SECRET',   'GANTI_DENGAN_SECRET_ACAK_MIN_32_KARAKTER'); // ← Wajib diganti
define('N8N_WEBHOOK_URL',  'https://n8n.domainanda.com/webhook/xxh');    // ← Isi URL n8n asli
define('ALLOWED_ORIGIN',   'https://xiexehat.page.gd');
define('RATE_LIMIT_MAX',   5);   // maksimum request per window
define('RATE_LIMIT_WINDOW', 60); // dalam detik

// --- HEADERS KEAMANAN ---
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

// --- VALIDASI CORS / ORIGIN ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== ALLOWED_ORIGIN) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden_origin']);
    exit;
}
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-XXH-Signature, X-XXH-Timestamp');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Hanya terima POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

// --- VALIDASI HMAC SIGNATURE ---
$clientSig   = $_SERVER['HTTP_X_XXH_SIGNATURE'] ?? '';
$clientTs    = $_SERVER['HTTP_X_XXH_TIMESTAMP'] ?? '';
$rawBody     = file_get_contents('php://input');

// Tolak jika timestamp lebih dari 5 menit lalu (replay attack prevention)
if (!$clientTs || abs(time() - (int)$clientTs) > 300) {
    http_response_code(401);
    echo json_encode(['error' => 'timestamp_expired']);
    exit;
}

$expectedSig = hash_hmac('sha256', $clientTs . '.' . $rawBody, WEBHOOK_SECRET);
if (!hash_equals($expectedSig, $clientSig)) {
    http_response_code(401);
    echo json_encode(['error' => 'invalid_signature']);
    exit;
}

// --- DECODE DAN VALIDASI PAYLOAD ---
$payload = json_decode($rawBody, true);
if (!$payload || !is_array($payload)) {
    http_response_code(422);
    echo json_encode(['error' => 'invalid_json']);
    exit;
}

// Validasi field wajib
$email = $payload['owner']['email'] ?? '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    echo json_encode(['error' => 'invalid_email_in_payload']);
    exit;
}

$overallScore = $payload['assessment_summary']['overall_score'] ?? -1;
if (!is_numeric($overallScore) || $overallScore < 0 || $overallScore > 100) {
    http_response_code(422);
    echo json_encode(['error' => 'invalid_score_range']);
    exit;
}

if (($payload['platform'] ?? '') !== 'Xie Xe Hat') {
    http_response_code(422);
    echo json_encode(['error' => 'invalid_platform']);
    exit;
}

// --- RATE LIMITING (MySQL-based, per email, per window) ---
require_once __DIR__ . '/koneksi.php';

try {
    // Buat tabel rate_limits jika belum ada
    $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        hit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_time (email, hit_at)
    ) ENGINE=InnoDB");

    $windowStart = date('Y-m-d H:i:s', time() - RATE_LIMIT_WINDOW);

    // Hitung request dalam window
    $countStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM rate_limits WHERE email = ? AND hit_at >= ?"
    );
    $countStmt->execute([$email, $windowStart]);
    $hitCount = (int) $countStmt->fetchColumn();

    if ($hitCount >= RATE_LIMIT_MAX) {
        http_response_code(429);
        echo json_encode([
            'error'   => 'rate_limit_exceeded',
            'message' => 'Terlalu banyak permintaan. Coba lagi dalam ' . RATE_LIMIT_WINDOW . ' detik.'
        ]);
        exit;
    }

    // Catat request ini
    $insertStmt = $pdo->prepare("INSERT INTO rate_limits (email) VALUES (?)");
    $insertStmt->execute([$email]);

    // Bersihkan entri lama (housekeeping)
    $pdo->exec("DELETE FROM rate_limits WHERE hit_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");

} catch (Exception $e) {
    // Jika DB tidak tersedia, lanjutkan tanpa rate limit daripada memblokir sepenuhnya
    // (graceful degradation — log ke file jika diperlukan)
}

// --- RELAY PAYLOAD KE N8N VIA cURL ---
// Hanya teruskan field yang diizinkan (whitelist) agar tidak ada field injeksi
$safePayload = [
    'platform'           => 'Xie Xe Hat',
    'event'              => preg_replace('/[^a-z_]/', '', $payload['event'] ?? 'unknown'),
    'timestamp'          => $payload['timestamp'] ?? date('c'),
    'umkm'               => [
        'name'                 => htmlspecialchars((string)($payload['umkm']['name'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'total_umkm_units'     => (int)($payload['umkm']['total_umkm_units'] ?? 0),
        'total_employees'      => (int)($payload['umkm']['total_employees'] ?? 0),
        'total_submissions'    => (int)($payload['umkm']['total_submissions'] ?? 0),
        'participation_rate_percent' => (float)($payload['umkm']['participation_rate_percent'] ?? 0),
    ],
    'owner' => [
        'name'  => htmlspecialchars((string)($payload['owner']['name'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'email' => $email,
        'role'  => htmlspecialchars((string)($payload['owner']['role'] ?? ''), ENT_QUOTES, 'UTF-8'),
    ],
    'assessment_summary' => [
        'overall_score'  => (int)$overallScore,
        'category'       => htmlspecialchars((string)($payload['assessment_summary']['category'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'risk_level'     => htmlspecialchars((string)($payload['assessment_summary']['risk_level'] ?? ''), ENT_QUOTES, 'UTF-8'),
        'highest_factor' => [
            'name'  => htmlspecialchars((string)($payload['assessment_summary']['highest_factor']['name'] ?? ''), ENT_QUOTES, 'UTF-8'),
            'score' => (int)($payload['assessment_summary']['highest_factor']['score'] ?? 0),
        ],
        'lowest_factor'  => [
            'name'  => htmlspecialchars((string)($payload['assessment_summary']['lowest_factor']['name'] ?? ''), ENT_QUOTES, 'UTF-8'),
            'score' => (int)($payload['assessment_summary']['lowest_factor']['score'] ?? 0),
        ],
    ],
    'six_factors' => array_map('intval', (array)($payload['six_factors'] ?? [])),
];

$ch = curl_init(N8N_WEBHOOK_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($safePayload),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'X-XXH-Signature: ' . WEBHOOK_SECRET,  // shared secret ke n8n
        'User-Agent: XieXeHat-Proxy/2.0'
    ],
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$n8nResponse = curl_exec($ch);
$httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError   = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'upstream_unreachable', 'detail' => 'Gagal menghubungi n8n endpoint.']);
    exit;
}

http_response_code($httpCode >= 200 && $httpCode < 300 ? 200 : 502);
echo json_encode([
    'success'       => ($httpCode >= 200 && $httpCode < 300),
    'upstream_code' => $httpCode,
    'message'       => $httpCode >= 200 && $httpCode < 300
        ? 'Payload berhasil diteruskan ke n8n.'
        : 'n8n merespons dengan error.'
]);

