<?php

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('idempotency_keys')
            ->whereNotNull('response_body')
            ->where('response_body', '!=', '')
            ->orderBy('id')
            ->chunkById(500, function ($keys) {
                foreach ($keys as $key) {
                    try {
                        Crypt::decryptString($key->response_body);
                    } catch (DecryptException) {
                        DB::table('idempotency_keys')
                            ->where('id', $key->id)
                            ->update([
                                'response_body' => Crypt::encryptString($key->response_body),
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Las llaves idempotentes en BD deben permanecer encriptadas.
    }
};
