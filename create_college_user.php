<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$config = require __DIR__ . '/config.php';
$dsn = 'mysql:host=' . $config['host'] . ';dbname=' . $config['database'] . ';charset=utf8mb4';

try {
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo 'College ID: ';
    $collegeId = trim((string)fgets(STDIN));
    echo 'Password (at least 8 characters): ';
    $password = trim((string)fgets(STDIN));

    if ($collegeId === '' || strlen($collegeId) > 50 || strlen($password) < 8) {
        fwrite(STDERR, "Enter a College ID (up to 50 characters) and a password of at least 8 characters.\n");
        exit(1);
    }

    $statement = $pdo->prepare(
        'INSERT INTO college_users (college_id, password_hash) VALUES (?, ?)'
    );
    $statement->execute([$collegeId, password_hash($password, PASSWORD_DEFAULT)]);
    echo "College user created.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Could not create college user: " . $error->getMessage() . "\n");
    exit(1);
}
