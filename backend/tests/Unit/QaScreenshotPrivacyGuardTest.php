<?php

namespace Tests\Unit;

use Tests\TestCase;

class QaScreenshotPrivacyGuardTest extends TestCase
{
    public function test_new_qa_screenshot_artifacts_are_ignored_by_default(): void
    {
        $gitignore = file_get_contents(base_path('../.gitignore'));

        $this->assertIsString($gitignore);
        $this->assertStringContainsString('qa/financial-data-audit/screenshots/', $gitignore);
        $this->assertStringContainsString('qa/screenshots/**/*.png', $gitignore);
        $this->assertStringContainsString('qa/screenshots/**/*.jpg', $gitignore);
        $this->assertStringContainsString('qa/screenshots/**/*.jpeg', $gitignore);
        $this->assertStringContainsString('qa/screenshots/**/*.webp', $gitignore);
        $this->assertStringContainsString('qa/screenshots/**/*.json', $gitignore);
    }

    public function test_visual_capture_spec_is_mock_only_and_not_qa_screenshots(): void
    {
        $spec = file_get_contents(base_path('../frontend/e2e/visual-capture.spec.ts'));

        $this->assertIsString($spec);
        // Fixtures vigentes tras el renombro ledger -> admin (20/09): el spec
        // importa admin-e2e (sesion/API) y visual-surfaces (mocks de superficie).
        $this->assertStringContainsString('./fixtures/admin-e2e', $spec);
        $this->assertStringContainsString('./fixtures/visual-surfaces', $spec);
        $this->assertStringContainsString("'hospital-ai'", $spec);
        $this->assertStringNotContainsString("path.resolve(process.cwd(), '..', 'qa', 'screenshots')", $spec);
    }
}
