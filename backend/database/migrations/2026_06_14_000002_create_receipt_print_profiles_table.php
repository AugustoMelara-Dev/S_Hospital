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
        Schema::create('receipt_print_profiles', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 80)->unique();
            $table->string('name', 120);
            $table->enum('paper_kind', [
                'custom_mm',
                'half_letter_landscape',
                'a5_landscape',
                'letter_landscape',
                'thermal_80mm',
                'thermal_58mm',
            ]);
            $table->decimal('width_mm', 8, 2);
            $table->decimal('height_mm', 8, 2);
            $table->decimal('margin_top_mm', 6, 2)->default(5);
            $table->decimal('margin_right_mm', 6, 2)->default(5);
            $table->decimal('margin_bottom_mm', 6, 2)->default(5);
            $table->decimal('margin_left_mm', 6, 2)->default(5);
            $table->enum('orientation', ['landscape', 'portrait'])->default('landscape');
            $table->string('template_code', 80)->default('institutional_classic');
            $table->string('font_family', 120)->nullable()->default('Arial, sans-serif');
            $table->decimal('font_scale', 4, 2)->default(1);
            $table->enum('copies_mode', ['original_only', 'original_first', 'original_first_second'])->default('original_only');
            $table->boolean('show_copy_legend')->default(true);
            $table->boolean('show_physical_seal_space')->default(true);
            $table->boolean('use_logo')->default(false);
            $table->boolean('show_technical_fields')->default(false);
            $table->boolean('active')->default(false);
            $table->boolean('is_global_default')->default(false);
            $table->timestamps();

            $table->index('paper_kind');
            $table->index('active');
            $table->index(['active', 'is_global_default']);
        });

        $this->addCheckConstraints();
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite' && Schema::hasTable('receipt_print_profiles')) {
            foreach ([
                'receipt_print_profiles_margin_left_mm_nonneg',
                'receipt_print_profiles_margin_bottom_mm_nonneg',
                'receipt_print_profiles_margin_right_mm_nonneg',
                'receipt_print_profiles_margin_top_mm_nonneg',
                'receipt_print_profiles_font_scale_positive',
                'receipt_print_profiles_height_mm_positive',
                'receipt_print_profiles_width_mm_positive',
            ] as $constraint) {
                try {
                    DB::statement("ALTER TABLE receipt_print_profiles DROP CONSTRAINT {$constraint}");
                } catch (QueryException) {
                    // Constraint may not exist on partially migrated databases.
                }
            }
        }

        Schema::dropIfExists('receipt_print_profiles');
    }

    private function addCheckConstraints(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $checks = [
            'receipt_print_profiles_width_mm_positive' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_width_mm_positive CHECK (width_mm > 0)',
            'receipt_print_profiles_height_mm_positive' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_height_mm_positive CHECK (height_mm > 0)',
            'receipt_print_profiles_font_scale_positive' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_font_scale_positive CHECK (font_scale > 0)',
            'receipt_print_profiles_margin_top_mm_nonneg' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_margin_top_mm_nonneg CHECK (margin_top_mm >= 0)',
            'receipt_print_profiles_margin_right_mm_nonneg' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_margin_right_mm_nonneg CHECK (margin_right_mm >= 0)',
            'receipt_print_profiles_margin_bottom_mm_nonneg' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_margin_bottom_mm_nonneg CHECK (margin_bottom_mm >= 0)',
            'receipt_print_profiles_margin_left_mm_nonneg' => 'ALTER TABLE receipt_print_profiles ADD CONSTRAINT receipt_print_profiles_margin_left_mm_nonneg CHECK (margin_left_mm >= 0)',
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
