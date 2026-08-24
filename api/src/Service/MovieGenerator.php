<?php

declare(strict_types=1);

namespace App\Service;

final class MovieGenerator
{
    private const PAGE_SIZE = 10;

    public function __construct(
        private readonly LocaleDictionary $dictionaries,
        private readonly FakerNames $faker = new FakerNames(),
    ) {
    }

    public function page(
        string $seed,
        int $page,
        string $locale,
        float $likes,
        float $reviews,
        int $pageSize = self::PAGE_SIZE,
    ): array {
        $dict = $this->dictionaries->get($locale);
        $movies = [];

        $offset = ($page - 1) * $pageSize;

        for ($i = 1; $i <= $pageSize; $i++) {
            $movies[] = $this->one($seed, $offset + $i, $locale, $dict, $likes, $reviews);
        }

        return $movies;
    }

    public function one(
        string $seed,
        int $index,
        string $locale,
        array $dict,
        float $likes,
        float $reviews,
    ): array {
        $stream = fn (string $aspect): SeedStream => new SeedStream($seed, 0, $index, $aspect, $locale);

        $title = $this->buildTitle($stream('title'), $dict);

        $castStream = $stream('cast');
        $cast = $castStream->pickMany(
            $this->fullNames($castStream, $dict, $locale, 8),
            $castStream->int(2, 4)
        );

        $directorStream = $stream('director');
        $director = $this->personName($directorStream, $dict, $locale);

        $likeCount = $stream('likes')->fractionalCount($likes);

        $reviewsStream = $stream('reviews');
        $reviewCount = $reviewsStream->fractionalCount($reviews);

        $reviewList = [];
        for ($r = 0; $r < $reviewCount; $r++) {
            $rs = $stream('review_' . $r);

            $used = array_column($reviewList, 'text');
            $text = $rs->pick($dict['reviews']);

            $attempts = count($dict['reviews']) * 3;
            for ($try = 0; $try < $attempts && in_array($text, $used, true); $try++) {
                $text = $rs->pick($dict['reviews']);
            }

            $reviewList[] = [
                'text' => $text,
                'author' => $this->personName($rs, $dict, $locale),
                'company' => $this->faker->company($rs, $locale) ?? $rs->pick($dict['companies']),
            ];
        }

        $metaStream = $stream('meta');

        return [
            'index' => $index,
            'title' => $title,
            'genre' => $stream('genre')->pick($dict['genres']),
            'year' => $stream('year')->int(1985, 2026),
            'cast' => $cast,
            'director' => $director,
            'plot' => $stream('plot')->pick($dict['plots']),
            'duration' => $metaStream->int(78, 168),
            'rating' => $metaStream->pick(['G', '13+', '16+', '18+']),
            'top10' => $metaStream->float() < 0.22,
            'likes' => $likeCount,
            'reviews' => $reviewList,
            'trailerKey' => substr(sha1($seed . '|' . $index . '|' . $locale), 0, 16),
        ];
    }

    private function buildTitle(SeedStream $s, array $dict): string
    {
        $pattern = $s->pick($dict['titlePatterns']);

        $noun = $s->pick($dict['nouns']);
        $adj = $s->pick($dict['adjectives']);
        $gender = is_array($noun) ? (string) ($noun['g'] ?? 'm') : 'm';

        $result = preg_replace_callback(
            '/\{(\w+)(?::(\w+))?\}/u',
            function (array $m) use ($s, $dict, $noun, $adj, $gender): string {
                [$all, $key] = $m;
                $mod = $m[2] ?? '';

                return match ($key) {
                    'noun' => $this->wordForm($noun, $mod !== '' ? $mod : $gender, $gender),
                    'noun2' => $this->wordForm($this->pickOther($s, $dict['nouns'], $noun), $mod, 'm'),
                    'adj' => $this->wordForm($adj, $mod !== '' ? $mod : $gender, $gender),
                    'place' => $this->wordForm($s->pick($dict['places']), $mod, 'm'),
                    'name' => $this->wordForm($s->pick($dict['firstNames']), $mod, 'm'),
                    'num' => (string) $s->int(2, 9),
                    'w' => $this->wordForm($dict['words'][$mod] ?? '', $gender, $gender),
                    default => $all,
                };
            },
            $pattern
        );

        return $result ?? $pattern;
    }

    private function personName(SeedStream $s, array $dict, string $locale): string
    {
        $sex = $s->int(0, 1) === 1 ? 'f' : 'm';

        $fromLibrary = $this->faker->person($s, $locale, $sex);
        if ($fromLibrary !== null) {
            return $fromLibrary;
        }

        $pool = array_values(array_filter(
            $dict['firstNames'],
            static fn ($n) => !is_array($n) || ($n['s'] ?? 'm') === $sex
        ));
        $first = $s->pick($pool !== [] ? $pool : $dict['firstNames']);
        $last = $s->pick($dict['lastNames']);

        return $this->wordForm($first, 't', 't') . ' ' . $this->wordForm($last, $sex, 'm');
    }

    private function pickOther(SeedStream $s, array $pool, string|array $taken): string|array
    {
        $word = $s->pick($pool);
        for ($i = 0; $i < 4 && $word === $taken; $i++) {
            $word = $s->pick($pool);
        }

        return $word;
    }

    private function wordForm(string|array $word, string $form, string $fallback): string
    {
        if (is_string($word)) {
            return $word;
        }

        if ($form !== '' && isset($word[$form]) && is_string($word[$form])) {
            return $word[$form];
        }

        foreach ([$fallback, 'm', 't'] as $key) {
            if (isset($word[$key]) && is_string($word[$key])) {
                return $word[$key];
            }
        }

        return (string) reset($word);
    }

    private function fullNames(SeedStream $s, array $dict, string $locale, int $poolSize): array
    {
        $names = [];
        for ($i = 0; $i < $poolSize; $i++) {
            $names[] = $this->personName($s, $dict, $locale);
        }

        return array_values(array_unique($names));
    }
}
