<?php

declare(strict_types=1);

namespace App\Service;

final class SeedStream
{
    private int $state;

    public function __construct(
        string $userSeed,
        int $page,
        int $index,
        string $aspect,
        string $locale = '',
    ) {
        $key = $userSeed . '|' . $page . '|' . $index . '|' . $aspect . '|' . $locale;

        $this->state = crc32($key) & 0x7FFFFFFF;

        if ($this->state === 0) {
            $this->state = 0x2545F491;
        }
    }

    public function next(): int
    {
        $x = $this->state;
        $x ^= ($x << 13) & 0x7FFFFFFF;
        $x ^= ($x >> 17);
        $x ^= ($x << 5) & 0x7FFFFFFF;
        $this->state = $x & 0x7FFFFFFF;

        return $this->state;
    }

    public function float(): float
    {
        return $this->next() / 2147483648.0;
    }

    public function int(int $min, int $max): int
    {
        if ($min >= $max) {
            return $min;
        }

        return $min + ($this->next() % ($max - $min + 1));
    }

    public function pick(array $items): mixed
    {
        if ($items === []) {
            throw new \InvalidArgumentException('Пустой массив для выбора');
        }

        return $items[$this->next() % count($items)];
    }

    public function pickMany(array $items, int $count): array
    {
        $pool = array_values($items);
        $out = [];
        $count = min($count, count($pool));

        for ($i = 0; $i < $count; $i++) {
            $idx = $this->next() % count($pool);
            $out[] = $pool[$idx];
            array_splice($pool, $idx, 1);
        }

        return $out;
    }

    public function fractionalCount(float $average): int
    {
        $whole = (int) floor($average);
        $remainder = $average - $whole;

        return $this->float() < $remainder ? $whole + 1 : $whole;
    }
}
