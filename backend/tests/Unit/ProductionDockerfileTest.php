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
        $this->assertMatchesRegularExpression('/^frontend\/package-lock\.json$/m', $dockerignore);
    }
}
