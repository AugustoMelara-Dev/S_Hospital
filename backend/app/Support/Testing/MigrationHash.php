<?php

declare(strict_types=1);

namespace App\Support\Testing;

final class MigrationHash
{
    /**
     * @param  array<int, string>  $files
     */
    public static function fromFiles(array $files, ?string $basePath = null): string
    {
        $basePath = $basePath === null ? null : str_replace('\\', '/', rtrim((string) realpath($basePath), '\\/')).'/';

        $fingerprint = collect($files)
            ->map(fn (string $file): string => realpath($file) ?: $file)
            ->filter(fn (string $file): bool => is_file($file))
            ->sort()
            ->map(function (string $file) use ($basePath): string {
                $normalizedPath = str_replace('\\', '/', $file);
                if ($basePath !== null && str_starts_with($normalizedPath, $basePath)) {
                    $normalizedPath = substr($normalizedPath, strlen($basePath));
                }

                return $normalizedPath."\n".hash_file('sha256', $file);
            })
            ->implode("\n");

        return hash('sha256', $fingerprint);
    }

    public static function forLaravelBase(?string $basePath = null): string
    {
        $basePath ??= base_path();

        $files = glob($basePath.'/database/migrations/*.php') ?: [];
        $files = array_merge($files, self::filesUnder($basePath.'/database/seeders'));
        $files = array_merge($files, self::releasePreparationFiles($basePath));

        return self::fromFiles($files, $basePath);
    }

    /**
     * @return array<int, string>
     */
    private static function releasePreparationFiles(string $basePath): array
    {
        return [
            $basePath.'/app/Console/Commands/PrepareE2eReleaseDataCommand.php',
            $basePath.'/app/Http/Controllers/AuthController.php',
            $basePath.'/bootstrap/app.php',
        ];
    }

    /**
     * @return array<int, string>
     */
    private static function filesUnder(string $directory): array
    {
        if (! is_dir($directory)) {
            return [];
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
        );

        $files = [];
        foreach ($iterator as $file) {
            if ($file instanceof \SplFileInfo && $file->isFile()) {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }
}
