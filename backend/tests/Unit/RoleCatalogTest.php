<?php

namespace Tests\Unit;

use App\Support\RoleCatalog;
use PHPUnit\Framework\TestCase;

class RoleCatalogTest extends TestCase
{
    public function test_operational_settings_update_is_an_elevated_permission(): void
    {
        $this->assertTrue(RoleCatalog::containsElevatedPermissions([
            'settings.operational.update',
        ]));
    }
}
