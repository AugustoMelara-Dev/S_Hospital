<?php

namespace Tests\Unit;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;
use Tests\TestCase;

class EnvironmentConfigurationBoundaryTest extends TestCase
{
    public function test_laravel_env_helper_is_only_used_in_configuration_files(): void
    {
        $violations = [];

        foreach ([app_path(), base_path('routes')] as $directory) {
            $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory));

            /** @var SplFileInfo $file */
            foreach ($files as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }

                $source = file_get_contents($file->getPathname());
                if ($source !== false && preg_match('/\benv\s*\(/', $source) === 1) {
                    $violations[] = str_replace(base_path().DIRECTORY_SEPARATOR, '', $file->getPathname());
                }
            }
        }

        $this->assertSame([], $violations, 'Use config() outside config/ so config:cache remains safe.');
    }
}
