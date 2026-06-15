<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institutional_receipt_series', function (Blueprint $table): void {
            $table->id();
            $table->string('document_type', 32)->default('institutional_receipt');
            $table->string('series', 32);
            $table->string('prefix', 32);
            $table->string('number_format', 80)->default('{series}-{number:08}');
            $table->unsignedBigInteger('min_number');
            $table->unsignedBigInteger('max_number');
            $table->unsignedBigInteger('current_number')->default(0);
            $table->string('range_authorization', 128)->nullable();
            $table->text('legal_text')->nullable();
            $table->string('receipt_number_color', 16)->default('#b91c1c');
            $table->boolean('active')->default(false);
            $table->string('active_document_type', 32)->nullable();
            $table->enum('reprint_behavior', ['audit_only', 'require_reason'])->default('audit_only');
            $table->enum('void_behavior', ['permission_reason_audit'])->default('permission_reason_audit');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('active_document_type', 'institutional_receipt_series_active_document_type_unique');
            $table->index('series');
            $table->index('active');
            $table->index(['document_type', 'active']);
        });

        $this->addCheckConstraints();
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite' && Schema::hasTable('institutional_receipt_series')) {
            foreach ([
                'institutional_receipt_series_current_nonneg',
                'institutional_receipt_series_min_le_max',
            ] as $constraint) {
                try {
                    DB::statement("ALTER TABLE institutional_receipt_series DROP CONSTRAINT {$constraint}");
                } catch (QueryException) {
                    // Constraint may not exist on partially migrated databases.
                }
            }
        }

        Schema::dropIfExists('institutional_receipt_series');
    }

    private function addCheckConstraints(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $checks = [
            'institutional_receipt_series_min_le_max' => 'ALTER TABLE institutional_receipt_series ADD CONSTRAINT institutional_receipt_series_min_le_max CHECK (min_number <= max_number)',
            'institutional_receipt_series_current_nonneg' => 'ALTER TABLE institutional_receipt_series ADD CONSTRAINT institutional_receipt_series_current_nonneg CHECK (current_number >= 0)',
        ];

        foreach ($checks as $statement) {
            try {
                DB::statement($statement);
            } catch (QueryException $exception) {
                $errorCode = $exception->errorInfo[1] ?? null;

                if (in_array($errorCode, [1061, 1826, 3821], true)) {
                    continue;
                }

                throw $exception;
            }
        }
    }
};
