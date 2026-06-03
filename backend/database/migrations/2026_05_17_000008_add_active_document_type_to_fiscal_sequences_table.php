<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The unique index on active_document_type enforces that at most one
     * FiscalSequence row is "active" per document_type. The column is
     * populated by App\Models\FiscalSequence::saving() only when active=true
     * (so inactive rows keep NULL, which MySQL/MariaDB allow many of in
     * a unique index).
     *
     * Application-level guards exist in:
     * - App\Http\Requests\Fiscal\StoreFiscalSequenceRequest::after() (creation)
     * - App\Http\Requests\Fiscal\UpdateFiscalSequenceRequest::after() (update)
     * - App\Actions\Billing\GenerateFiscalNumberAction (read-side assertion)
     *
     * The DB-level index is the last line of defense against a race between
     * two admins activating the same document_type concurrently.
     */
    public function up(): void
    {
        Schema::table('fiscal_sequences', function (Blueprint $table) {
            $table->string('active_document_type', 32)
                ->nullable()
                ->after('active');

            $table->unique('active_document_type', 'fiscal_sequences_active_document_type_unique');
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_sequences', function (Blueprint $table) {
            $table->dropUnique('fiscal_sequences_active_document_type_unique');
            $table->dropColumn('active_document_type');
        });
    }
};
