<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecurityAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_audit_logs_table_has_forensic_columns(): void
    {
        $columns = \Illuminate\Support\Facades\Schema::getColumnListing('audit_logs');
        $this->assertContains('ip', $columns);
        $this->assertContains('user_agent', $columns);
        $this->assertContains('url', $columns);
        $this->assertContains('http_method', $columns);
    }
}