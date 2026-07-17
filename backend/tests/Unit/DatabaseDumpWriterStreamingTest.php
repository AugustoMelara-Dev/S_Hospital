<?php

namespace Tests\Unit;

use Tests\TestCase;

class DatabaseDumpWriterStreamingTest extends TestCase
{
    public function test_sqlite_dump_streams_rows_and_output_instead_of_buffering_tables(): void
    {
        $source = file_get_contents(app_path('Actions/Backups/DatabaseDumpWriter.php'));

        $this->assertIsString($source);
        $this->assertStringContainsString('DB::table($name)->cursor()', $source);
        $this->assertStringContainsString("fopen(\$absolutePath, 'wb')", $source);
        $this->assertStringContainsString('writeDumpLine(', $source);
        $this->assertStringNotContainsString('DB::table($name)->get()', $source);
        $this->assertStringNotContainsString('implode(PHP_EOL, $lines)', $source);
    }
}
