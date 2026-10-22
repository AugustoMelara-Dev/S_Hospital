<?php

declare(strict_types=1);

namespace Tests\Unit\Backups;

use App\Actions\Backups\PortableMysqlDumpSanitizer;
use PHPUnit\Framework\TestCase;

class PortableMysqlDumpSanitizerTest extends TestCase
{
    public function test_it_removes_object_definers_without_changing_security_semantics(): void
    {
        $source = implode("\n", [
            '/*!50017 DEFINER=`old_admin`@`localhost`*/',
            '/*!50003 TRIGGER `audit_guard` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SIGNAL SQLSTATE \'45000\' */;;',
            '/*!50013 DEFINER=`legacy``name`@`10.%` SQL SECURITY DEFINER */',
            '/*!50003 CREATE*/ /*!50017 DEFINER=`trigger_owner`@`localhost`*/ /*!50003 TRIGGER `combined_guard` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SET @note = \'/*!50017 DEFINER=`literal`@`localhost`*/\' */;;',
            'CREATE DEFINER=`old_admin`@`localhost` PROCEDURE `refresh_totals`() SELECT 1;',
            'CREATE ALGORITHM=UNDEFINED DEFINER=`view_owner`@`localhost` SQL SECURITY DEFINER VIEW `daily_totals` AS SELECT 1;',
            'ALTER DEFINER = CURRENT_USER EVENT `nightly_event` ON SCHEDULE EVERY 1 DAY DO SELECT 1;',
            '',
        ]);

        $portable = (new PortableMysqlDumpSanitizer)->sanitize($source);

        self::assertSame(implode("\n", [
            '',
            '/*!50003 TRIGGER `audit_guard` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SIGNAL SQLSTATE \'45000\' */;;',
            '/*!50013 SQL SECURITY DEFINER */',
            '/*!50003 CREATE*/  /*!50003 TRIGGER `combined_guard` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SET @note = \'/*!50017 DEFINER=`literal`@`localhost`*/\' */;;',
            'CREATE PROCEDURE `refresh_totals`() SELECT 1;',
            'CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `daily_totals` AS SELECT 1;',
            'ALTER EVENT `nightly_event` ON SCHEDULE EVERY 1 DAY DO SELECT 1;',
            '',
        ]), $portable);
    }

    public function test_it_does_not_rewrite_definer_text_inside_data_or_comments(): void
    {
        $source = implode("\n", [
            "INSERT INTO `notes` VALUES (1,'CREATE DEFINER=`somebody`@`%` PROCEDURE p() SELECT 1;');",
            "INSERT INTO `notes` VALUES (2,'/*!50017 DEFINER=`literal`@`localhost`*/');",
            '-- CREATE DEFINER=`commented`@`localhost` VIEW v AS SELECT 1;',
            '# /*!50013 DEFINER=`commented`@`localhost` SQL SECURITY DEFINER */',
            '/* CREATE DEFINER=`commented`@`localhost` FUNCTION f() RETURNS INT RETURN 1; */',
            '',
        ]);

        self::assertSame($source, (new PortableMysqlDumpSanitizer)->sanitize($source));
    }

    public function test_it_sanitizes_a_dump_file_without_loading_or_rewriting_data_lines(): void
    {
        $source = tempnam(sys_get_temp_dir(), 'hospital-raw-dump-');
        $target = tempnam(sys_get_temp_dir(), 'hospital-portable-dump-');
        self::assertIsString($source);
        self::assertIsString($target);

        $sql = "/*!50017 DEFINER=`legacy`@`localhost`*/\n"
            . "/*!50003 TRIGGER `guard` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SET NEW.id = OLD.id */;;\n"
            . "INSERT INTO `notes` VALUES (1,'DEFINER=`literal`@`localhost`');\n";

        try {
            file_put_contents($source, $sql);
            (new PortableMysqlDumpSanitizer)->sanitizeFile($source, $target);

            self::assertSame(
                "\n/*!50003 TRIGGER `guard` BEFORE UPDATE ON `audit_logs` FOR EACH ROW SET NEW.id = OLD.id */;;\n"
                . "INSERT INTO `notes` VALUES (1,'DEFINER=`literal`@`localhost`');\n",
                file_get_contents($target),
            );
        } finally {
            @unlink($source);
            @unlink($target);
        }
    }
}
