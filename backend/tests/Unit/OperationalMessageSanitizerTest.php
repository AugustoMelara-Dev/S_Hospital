<?php

namespace Tests\Unit;

use App\Support\OperationalMessageSanitizer;
use PHPUnit\Framework\TestCase;

class OperationalMessageSanitizerTest extends TestCase
{
    public function test_message_removes_url_credentials_without_hiding_host(): void
    {
        $message = OperationalMessageSanitizer::message(
            'No se pudo contactar http://soporte:clave-secreta@192.168.1.10:8000/api/system/status'
        );

        $this->assertSame(
            'No se pudo contactar http://192.168.1.10:8000/api/system/status',
            $message,
        );
        $this->assertStringNotContainsString('soporte', (string) $message);
        $this->assertStringNotContainsString('clave-secreta', (string) $message);
    }

    public function test_message_redacts_legacy_database_user_host_trace(): void
    {
        $message = OperationalMessageSanitizer::message(
            "Access denied for user 'hospital_app'@'172.18.0.1' during login"
        );

        $this->assertSame(
            'Access denied for user [db-user-host] during login',
            $message,
        );
        $this->assertStringNotContainsString('hospital_app', (string) $message);
        $this->assertStringNotContainsString('172.18.0.1', (string) $message);
    }
}
