<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('audit_logs')
            ->where('result', 'success')
            ->where(static function ($query): void {
                $query->where('action', 'like', '%.failed')
                    ->orWhere('action', 'like', '%.error');
            })
            ->update(['result' => 'failed']);
    }

    public function down(): void
    {
        // Data correction is intentionally irreversible: reverting every
        // matching action to success would corrupt legitimate failure records.
    }
};
