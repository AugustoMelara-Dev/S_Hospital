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

    public function test_rc1_screens_default_to_frontend_test_results(): void
    {
        $spec = file_get_contents(base_path('../frontend/e2e/rc1-screens.spec.ts'));

        $this->assertIsString($spec);
        $this->assertStringContainsString('E2E_CAPTURE_SCREENS_DIR', $spec);
        $this->assertStringContainsString("path.join(process.cwd(), 'test-results', 'rc1-screens')", $spec);
        $this->assertStringNotContainsString("path.resolve(process.cwd(), '..', 'qa', 'screenshots')", $spec);
    }
}
