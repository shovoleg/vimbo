<?php

declare(strict_types=1);

namespace App\Service;

use Faker\Factory;
use Faker\Generator;

final class FakerNames
{
    private const PROVIDER_DIR = __DIR__ . '/../../vendor/fakerphp/faker/src/Faker/Provider/';

    private array $cache = [];

    public function forLocale(string $locale): ?Generator
    {
        if (array_key_exists($locale, $this->cache)) {
            return $this->cache[$locale];
        }

        $supported = is_file(self::PROVIDER_DIR . $locale . '/Person.php');

        return $this->cache[$locale] = $supported ? Factory::create($locale) : null;
    }

    public function supports(string $locale): bool
    {
        return $this->forLocale($locale) !== null;
    }

    public function person(SeedStream $s, string $locale, string $sex): ?string
    {
        $faker = $this->forLocale($locale);
        if ($faker === null) {
            return null;
        }

        $faker->seed($s->next());

        $female = $sex === 'f';

        $first = $female ? $faker->firstNameFemale() : $faker->firstNameMale();
        $last = $this->lastName($faker, $female);

        return $first . ' ' . $last;
    }

    public function company(SeedStream $s, string $locale): ?string
    {
        $faker = $this->forLocale($locale);
        if ($faker === null) {
            return null;
        }

        $faker->seed($s->next());

        return $faker->company();
    }

    private function lastName(Generator $faker, bool $female): string
    {
        $method = $female ? 'lastNameFemale' : 'lastNameMale';

        try {
            return (string) $faker->format($method);
        } catch (\InvalidArgumentException) {
            return (string) $faker->format('lastName');
        }
    }
}
