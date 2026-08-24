<?php
declare(strict_types=1);
require __DIR__ . '/../bootstrap.php';
use App\Service\{LocaleDictionary, MovieGenerator};

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$dict = new LocaleDictionary(getenv('LOCALES_DIR') ?: __DIR__ . '/../../data/locales');
$gen  = new MovieGenerator($dict);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

try {
    if ($path === '/api/locales') {
        $out = [];
        foreach ($dict->availableLocales() as $code) {
            $out[] = ['code' => $code, 'name' => $dict->get($code)['name']];
        }
        echo json_encode(['locales' => $out], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($path === '/api/movies') {
        $seed    = (string)($_GET['seed'] ?? '1');
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $locale  = (string)($_GET['locale'] ?? 'en_US');
        $likes   = min(10.0, max(0.0, (float)($_GET['likes'] ?? 0)));
        $reviews = min(10.0, max(0.0, (float)($_GET['reviews'] ?? 0)));

        if (!$dict->has($locale)) {
            http_response_code(400);
            echo json_encode(['error' => 'Unknown locale: ' . $locale]);
            exit;
        }
        if (!preg_match('/^\d{1,15}$/', $seed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Seed must be a number up to 15 digits']);
            exit;
        }

        echo json_encode([
            'page'   => $page,
            'seed'   => $seed,
            'locale' => $locale,
            'movies' => $gen->page($seed, $page, $locale, $likes, $reviews),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
