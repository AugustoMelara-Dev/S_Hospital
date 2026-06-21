<?php

namespace Tests\Unit;

use Tests\TestCase;

class SessionSecurityConfigTest extends TestCase
{
    public function test_default_session_lifetime_is_not_two_hours(): void
    {
        $source = file_get_contents(base_path('config/session.php'));

        $this->assertStringContainsString("env('SESSION_LIFETIME', 60)", $source);
        $this->assertStringNotContainsString("env('SESSION_LIFETIME', 120)", $source);
    }
}
