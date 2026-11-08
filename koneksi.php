<?php
/**
 * XIE XE HAT - KONEKSI DATABASE MYSQL INFINITYFREE
 */

$db_host = 'sql108.infinityfree.com';
$db_name = 'if0_43351411_xiexehat';
$db_user = 'if0_43351411';
$db_pass = 'yzr4OhGhX81it';

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_pass,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Gagal terhubung ke database InfinityFree: ' . $e->getMessage()
    ]);
    exit;
}

