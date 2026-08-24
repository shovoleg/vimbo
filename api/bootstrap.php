<?php

declare(strict_types=1);

$autoload = __DIR__ . '/vendor/autoload.php';

if (!is_file($autoload)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'error' => 'Зависимости не установлены. Выполните: composer install --no-dev',
    ], JSON_UNESCAPED_UNICODE);

    exit(1);
}

require $autoload;
