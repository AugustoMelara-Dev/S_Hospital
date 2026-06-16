<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addColumnIfMissing('result', fn (Blueprint $table) => $table->string('result', 20)->default('success')->after('action'));
        $this->addColumnIfMissing('reason', fn (Blueprint $table) => $table->text('reason')->nullable()->after('new_values'));
        $this->addColumnIfMissing('ip_address', fn (Blueprint $table) => $table->string('ip_address', 64)->nullable()->after('reason'));
        $this->addColumnIfMissing('user_agent', fn (Blueprint $table) => $table->text('user_agent')->nullable()->after('ip_address'));

        $this->addIndexIfMissing('audit_logs_result_created_at_index', ['result', 'created_at']);
        $this->addIndexIfMissing('audit_logs_user_id_created_at_index', ['user_id', 'created_at']);
    }

    public function down(): void
    {
        if ($this->hasIndex('audit_logs_result_created_at_index')) {
            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->dropIndex('audit_logs_result_created_at_index');
            });
        }

        if ($this->hasIndex('audit_logs_user_id_created_at_index')) {
            Schema::table('audit_logs', function (Blueprint $table): void {
                $table->dropIndex('audit_logs_user_id_created_at_index');
            });
        }

        Schema::table('audit_logs', function (Blueprint $table): void {
            foreach (['result', 'reason', 'ip_address', 'user_agent'] as $column) {
                if (Schema::hasColumn('audit_logs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function addColumnIfMissing(string $column, Closure $definition): void
    {
        if (Schema::hasColumn('audit_logs', $column)) {
            return;
        }

        Schema::table('audit_logs', function (Blueprint $table) use ($definition): void {
            $definition($table);
        });
    }

    /**
     * @param  array<int, string>  $columns
     */
    private function addIndexIfMissing(string $name, array $columns): void
    {
        if ($this->hasIndex($name)) {
            return;
        }

        Schema::table('audit_logs', function (Blueprint $table) use ($columns, $name): void {
            $table->index($columns, $name);
        });
    }

    private function hasIndex(string $name): bool
    {
        return collect(Schema::getIndexes('audit_logs'))
            ->contains(fn (array $index): bool => ($index['name'] ?? null) === $name);
    }
};
