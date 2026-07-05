<?php

namespace Tests\Unit;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RegexIterator;
use SplFileInfo;
use Tests\TestCase;

class OfflineRuntimeAssetsTest extends TestCase
{
    public function test_blade_views_do_not_load_remote_runtime_assets(): void
    {
        $views = $this->bladeViews();

        $this->assertNotEmpty($views, 'Expected at least one Blade view to guard offline runtime assets.');

        $patterns = [
            '/<link\b[^>]+href=["\']https?:\/\//i',
            '/<script\b[^>]+src=["\']https?:\/\//i',
            '/<img\b[^>]+src=["\']https?:\/\//i',
            '/@import\s+url\(["\']?https?:\/\//i',
        ];

        foreach ($views as $view) {
            $contents = file_get_contents($view);

            $this->assertIsString($contents, "Could not read Blade view at {$view}");

            foreach ($patterns as $pattern) {
                $this->assertDoesNotMatchRegularExpression(
                    $pattern,
                    $contents,
                    "{$this->relativePath($view)} must not load remote runtime assets; production runs offline on LAN."
                );
            }
        }
    }

    /**
     * @return list<string>
     */
    private function bladeViews(): array
    {
        $iterator = new RegexIterator(
            new RecursiveIteratorIterator(new RecursiveDirectoryIterator(resource_path('views'))),
            '/\.blade\.php$/'
        );

        $views = [];

        foreach ($iterator as $file) {
            if ($file instanceof SplFileInfo && $file->isFile()) {
                $views[] = $file->getPathname();
            }
        }

        sort($views);

        return $views;
    }

    private function relativePath(string $path): string
    {
        return str_replace(base_path().DIRECTORY_SEPARATOR, '', $path);
    }
}
