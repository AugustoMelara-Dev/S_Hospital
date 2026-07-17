<?php

namespace Tests\Unit;

use Tests\TestCase;

class BackendDependencyManifestTest extends TestCase
{
    public function test_unused_laravel_template_tools_are_not_installed(): void
    {
        $composer = json_decode(
            file_get_contents(base_path('composer.json')) ?: '',
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        $developmentDependencies = $composer['require-dev'] ?? [];

        $this->assertArrayNotHasKey(
            'laravel/pail',
            $developmentDependencies,
            'Logs are inspected through the hospital support flow and Docker; the unused Pail console expands the development dependency graph.',
        );
        $this->assertArrayNotHasKey(
            'laravel/sail',
            $developmentDependencies,
            'This repository owns explicit Docker Compose stacks and must not also maintain the unused Sail toolchain.',
        );
    }
}
