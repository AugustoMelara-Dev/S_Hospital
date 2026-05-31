<?php

namespace App\Support;

use App\Models\Service;
use Illuminate\Support\Str;

class ServiceSearch
{
    public static function matches(Service $service, string $search): bool
    {
        $needle = self::normalize($search);

        if ($needle === '') {
            return true;
        }

        $haystack = self::normalize(implode(' ', array_filter([
            $service->name,
            $service->scan_code,
            $service->barcode,
            $service->qr_code,
            $service->internal_code,
            ...($service->aliases ?? []),
            $service->category?->name,
            $service->area?->name,
        ])));

        if (str_contains($haystack, $needle)) {
            return true;
        }

        $haystackTokens = self::tokens($haystack);

        foreach (self::tokens($needle) as $needleToken) {
            if (! self::tokenMatches($needleToken, $haystackTokens)) {
                return false;
            }
        }

        return true;
    }

    public static function normalize(string $value): string
    {
        return trim((string) Str::of($value)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->replaceMatches('/\s+/', ' '));
    }

    /**
     * @return list<string>
     */
    private static function tokens(string $value): array
    {
        return array_values(array_filter(explode(' ', $value), fn (string $token): bool => $token !== ''));
    }

    /**
     * @param  list<string>  $haystackTokens
     */
    private static function tokenMatches(string $needleToken, array $haystackTokens): bool
    {
        foreach ($haystackTokens as $token) {
            if (str_contains($token, $needleToken)) {
                return true;
            }

            if (strlen($needleToken) < 4 || strlen($token) < 4) {
                continue;
            }

            if (str_contains($needleToken, $token)) {
                return true;
            }

            $maxDistance = strlen($needleToken) <= 7 ? 1 : 2;

            if (levenshtein($needleToken, $token) <= $maxDistance) {
                return true;
            }
        }

        return false;
    }
}
