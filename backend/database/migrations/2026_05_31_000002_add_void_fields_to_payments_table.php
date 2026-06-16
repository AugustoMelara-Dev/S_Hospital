<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addColumnIfMissing('voided_by', fn (Blueprint $table) => $table->foreignId('voided_by')->nullable()->after('status'));
        $this->addColumnIfMissing('voided_at', fn (Blueprint $table) => $table->timestamp('voided_at')->nullable()->after('voided_by'));
        $this->addColumnIfMissing('void_reason', fn (Blueprint $table) => $table->text('void_reason')->nullable()->after('voided_at'));

        if (! $this->hasForeignKey('payments_voided_by_foreign')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->foreign('voided_by', 'payments_voided_by_foreign')->references('id')->on('users')->nullOnDelete();
            });
        }

        if (! $this->hasIndex('payments_status_voided_at_index')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->index(['status', 'voided_at'], 'payments_status_voided_at_index');
            });
        }
    }

    public function down(): void
    {
        if ($this->hasIndex('payments_status_voided_at_index')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->dropIndex('payments_status_voided_at_index');
            });
        }

        if ($this->hasForeignKey('payments_voided_by_foreign')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->dropForeign('payments_voided_by_foreign');
            });
        }

        Schema::table('payments', function (Blueprint $table): void {
            foreach (['voided_by', 'voided_at', 'void_reason'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function addColumnIfMissing(string $column, Closure $definition): void
    {
        if (Schema::hasColumn('payments', $column)) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) use ($definition): void {
            $definition($table);
        });
    }

    private function hasIndex(string $name): bool
    {
        return collect(Schema::getIndexes('payments'))
            ->contains(fn (array $index): bool => ($index['name'] ?? null) === $name);
    }

    private function hasForeignKey(string $name): bool
    {
        return collect(Schema::getForeignKeys('payments'))
            ->contains(fn (array $foreignKey): bool => ($foreignKey['name'] ?? null) === $name);
    }
};
