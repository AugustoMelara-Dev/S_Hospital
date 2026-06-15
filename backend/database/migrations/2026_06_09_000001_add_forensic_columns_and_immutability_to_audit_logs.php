<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('audit_logs', 'ip')) {
                $table->string('ip', 45)->nullable()->after('entity_id');
            }

            if (! Schema::hasColumn('audit_logs', 'user_agent')) {
                $table->string('user_agent', 191)->nullable()->after('ip');
            }

            if (! Schema::hasColumn('audit_logs', 'url')) {
                $table->string('url', 255)->nullable()->after('user_agent');
            }

            if (! Schema::hasColumn('audit_logs', 'http_method')) {
                $table->string('http_method', 10)->nullable()->after('url');
            }
        });

        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement(<<<'SQL'
CREATE TRIGGER trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
    IF COALESCE(@app_audit_admin_op, 0) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'audit_logs is append-only; updates are not permitted. See docs/SECRETS.md.';
    END IF;
END
SQL);

            DB::statement(<<<'SQL'
CREATE TRIGGER trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
    IF COALESCE(@app_audit_admin_op, 0) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'audit_logs is append-only; deletes are not permitted. Use hospital:prune-audit-logs (sets @app_audit_admin_op = 1).';
    END IF;
END
SQL);
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('DROP TRIGGER IF EXISTS trg_audit_logs_no_update');
            DB::statement('DROP TRIGGER IF EXISTS trg_audit_logs_no_delete');
        }

        Schema::table('audit_logs', function (Blueprint $table) {
            foreach (['ip', 'url', 'http_method'] as $column) {
                if (Schema::hasColumn('audit_logs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
