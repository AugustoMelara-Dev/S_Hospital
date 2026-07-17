<?php

namespace Tests\Unit;

use Tests\TestCase;

class BackendFrontendBoundaryTest extends TestCase
{
    public function test_backend_does_not_maintain_a_second_javascript_toolchain(): void
    {
        foreach ([
            'package.json',
            'package-lock.json',
            'vite.config.js',
            'resources/css/app.css',
            'resources/js/app.js',
            'resources/js/bootstrap.js',
            'resources/views/welcome.blade.php',
        ] as $relativePath) {
            $this->assertFileDoesNotExist(
                base_path($relativePath),
                "The React application is built from frontend/; backend/ must not carry a second JavaScript toolchain ({$relativePath}).",
            );
        }
    }

    public function test_composer_scripts_do_not_bootstrap_node_or_sqlite(): void
    {
        $composer = json_decode(
            file_get_contents(base_path('composer.json')) ?: '',
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        $scripts = $composer['scripts'] ?? [];

        $this->assertArrayNotHasKey('setup', $scripts);
        $this->assertArrayNotHasKey('dev', $scripts);
        $this->assertArrayNotHasKey('post-create-project-cmd', $scripts);

        $serializedScripts = json_encode($scripts, JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('npm ', $serializedScripts);
        $this->assertStringNotContainsString('npx ', $serializedScripts);
        $this->assertStringNotContainsString('database.sqlite', $serializedScripts);
    }
}
