<?php

namespace Tests\Unit;

use Tests\TestCase;

class ProductionDockerfileTest extends TestCase
{
    public function test_frontend_builder_uses_the_same_frozen_pnpm_lock_as_ci(): void
    {
        $dockerfile = file_get_contents(base_path('Dockerfile.prod'));
        $dockerignore = file_get_contents(base_path('../.dockerignore'));
        $workflow = file_get_contents(base_path('../.github/workflows/ci.yml'));

        $this->assertIsString($dockerfile);
        $this->assertIsString($dockerignore);
        $this->assertIsString($workflow);
        $this->assertSame(1, preg_match('/ARG PNPM_VERSION=(?<version>[0-9.]+)/', $dockerfile, $dockerPnpm));
        $this->assertSame(1, preg_match('/- name: Setup pnpm.*?version: (?<version>[0-9.]+)/s', $workflow, $ciPnpm));
        $this->assertSame('11.7.0', $dockerPnpm['version']);
        $this->assertSame($ciPnpm['version'], $dockerPnpm['version']);
        $this->assertStringContainsString(
            'COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./',
            $dockerfile,
        );
        $this->assertStringContainsString(
            'corepack prepare "pnpm@${PNPM_VERSION}" --activate',
            $dockerfile,
        );
        $this->assertStringContainsString('pnpm install --frozen-lockfile', $dockerfile);
        $this->assertStringContainsString('pnpm run build', $dockerfile);
        $this->assertStringNotContainsString('frontend/package*.json', $dockerfile);
        $this->assertStringNotContainsString('npm ci', $dockerfile);
        $this->assertMatchesRegularExpression('/^\*\*$/m', $dockerignore);
        $this->assertStringNotContainsString('!frontend/package-lock.json', $dockerignore);
    }

    public function test_docker_context_excludes_non_runtime_sources_and_artifacts(): void
    {
        $dockerignore = file_get_contents(base_path('../.dockerignore'));

        $this->assertIsString($dockerignore);

        foreach ([
            '.github',
            'docs',
            'scripts',
            'backend/tests',
            'frontend/artifacts',
            'frontend/e2e',
        ] as $excludedPath) {
            $this->assertStringNotContainsString(
                "!{$excludedPath}",
                $dockerignore,
                "{$excludedPath} is not used by Dockerfile.prod and must stay out of the production context.",
            );
        }

        $this->assertStringNotContainsString('!backend/**', $dockerignore);
        $this->assertStringNotContainsString('!frontend/**', $dockerignore);
        $this->assertMatchesRegularExpression('/^backend\/\*\*$/m', $dockerignore);
        $this->assertMatchesRegularExpression('/^frontend\/\*\*$/m', $dockerignore);

        foreach ([
            '!backend/app/**',
            '!backend/bootstrap/app.php',
            '!backend/bootstrap/providers.php',
            '!backend/config/**',
            '!backend/database/**',
            '!backend/docker/**',
            '!backend/public/**',
            '!backend/resources/**',
            '!backend/routes/**',
            '!backend/artisan',
            '!backend/composer.json',
            '!backend/composer.lock',
            '!frontend/public/**',
            '!frontend/src/**',
            '!frontend/vite-plugins/**',
            '!frontend/.env.production',
            '!frontend/index.html',
            '!frontend/package.json',
            '!frontend/pnpm-lock.yaml',
            '!frontend/pnpm-workspace.yaml',
            '!frontend/tsconfig.json',
            '!frontend/tsconfig.node.json',
            '!frontend/vite.config.ts',
            '!frontend/vitest.shims.d.ts',
        ] as $runtimePath) {
            $this->assertMatchesRegularExpression(
                '/^'.preg_quote($runtimePath, '/').'$/m',
                $dockerignore,
                "Production Docker context must include {$runtimePath}.",
            );
        }
    }

    public function test_composer_builder_validates_php_on_the_runtime_base(): void
    {
        $dockerfile = file_get_contents(base_path('Dockerfile.prod'));

        $this->assertIsString($dockerfile);
        $this->assertMatchesRegularExpression('/^FROM composer:2@\S+ AS composer-cli$/m', $dockerfile);
        $this->assertMatchesRegularExpression('/^FROM php:8\.3-fpm-alpine@\S+ AS composer-builder$/m', $dockerfile);
        $this->assertSame(2, substr_count($dockerfile, 'FROM php:8.3-fpm-alpine'));
        $this->assertStringContainsString(
            'COPY --from=composer-cli /usr/bin/composer /usr/bin/composer',
            $dockerfile,
        );
        $this->assertStringContainsString('apk add --no-cache unzip', $dockerfile);
        $this->assertStringContainsString("--ignore-platform-req='ext-*'", $dockerfile);
        $this->assertStringNotContainsString('--ignore-platform-reqs', $dockerfile);
    }

    public function test_every_production_build_stage_pins_its_image_digest(): void
    {
        $dockerfile = file_get_contents(base_path('Dockerfile.prod'));

        $this->assertIsString($dockerfile);
        $matched = preg_match_all('/^FROM (?<image>\S+)/m', $dockerfile, $stages, PREG_SET_ORDER);

        $this->assertSame(4, $matched);

        foreach ($stages as $stage) {
            $this->assertMatchesRegularExpression(
                '/@sha256:[a-f0-9]{64}$/',
                $stage['image'],
                "Production base {$stage['image']} must be immutable.",
            );
        }

        $phpStages = array_values(array_filter(
            array_column($stages, 'image'),
            static fn (string $image): bool => str_starts_with($image, 'php:8.3-fpm-alpine@'),
        ));

        $this->assertCount(2, $phpStages);
        $this->assertSame($phpStages[0], $phpStages[1]);
    }
}
