<?php

declare(strict_types=1);

namespace App\Service;

final class LocaleDictionary
{
    private array $cache = [];

    private ?array $available = null;

    public function __construct(private readonly string $localesDir)
    {
    }

    public function availableLocales(): array
    {
        if ($this->available !== null) {
            return $this->available;
        }

        $found = [];
        foreach (glob($this->localesDir . '/*.json') ?: [] as $path) {
            $found[] = basename($path, '.json');
        }
        sort($found);

        return $this->available = $found;
    }

    public function has(string $locale): bool
    {
        return in_array($locale, $this->availableLocales(), true);
    }

    public function get(string $locale): array
    {
        if (isset($this->cache[$locale])) {
            return $this->cache[$locale];
        }

        if (!preg_match('/^[a-z]{2}_[A-Z]{2}$/', $locale)) {
            throw new \RuntimeException(sprintf('Некорректный код локали: %s', $locale));
        }

        $path = $this->localesDir . '/' . $locale . '.json';
        if (!is_file($path)) {
            throw new \RuntimeException(sprintf('Словарь не найден: %s', $locale));
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new \RuntimeException(sprintf('Не удалось прочитать словарь: %s', $locale));
        }

        try {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new \RuntimeException(
                sprintf('Повреждён JSON словаря %s: %s', $locale, $e->getMessage()),
                previous: $e
            );
        }

        $required = [
            'titlePatterns', 'adjectives', 'nouns', 'places', 'genres',
            'firstNames', 'lastNames', 'plots', 'reviews', 'companies', 'trailerTitles',
        ];
        foreach ($required as $key) {
            if (!isset($data[$key]) || !is_array($data[$key]) || $data[$key] === []) {
                throw new \RuntimeException(
                    sprintf('В словаре %s отсутствует или пуст ключ "%s"', $locale, $key)
                );
            }
        }

        return $this->cache[$locale] = $data;
    }
}
