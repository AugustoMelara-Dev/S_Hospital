<?php

namespace Tests\Unit;

use Tests\TestCase;

class NginxPrivacyConfigTest extends TestCase
{
    public function test_api_location_disables_access_log_to_avoid_query_string_pii(): void
    {
        $config = file_get_contents(base_path('../nginx/default.conf'));

        $this->assertIsString($config);
        $this->assertMatchesRegularExpression('/location\s+\/api\/\s*\{(?:(?!\n\s*location\s).)*access_log\s+off\s*;/s', $config);
    }
}
