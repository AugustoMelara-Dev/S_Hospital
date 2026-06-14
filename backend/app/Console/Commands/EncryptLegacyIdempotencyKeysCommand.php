<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Encryption\DecryptException;

class EncryptLegacyIdempotencyKeysCommand extends Command
{
    protected $signature = 'idempotency:encrypt-legacy';
    protected $description = 'Encrypt legacy plaintext idempotency keys response bodies';

    public function handle(): int
    {
        $this->info('Starting legacy idempotency keys encryption...');
        
        $keys = DB::table('idempotency_keys')
            ->whereNotNull('response_body')
            ->where('response_body', 'not like', 'eyJpdiI6%') // basic check to ignore obviously encrypted payloads
            ->get();

        $count = 0;
        foreach ($keys as $key) {
            // Check if it's already encrypted correctly by trying to decrypt it
            $isEncrypted = false;
            try {
                Crypt::decryptString($key->response_body);
                $isEncrypted = true;
            } catch (DecryptException) {
                // It's plaintext or malformed
            }

            if (!$isEncrypted) {
                DB::table('idempotency_keys')
                    ->where('id', $key->id)
                    ->update([
                        'response_body' => Crypt::encryptString($key->response_body)
                    ]);
                $count++;
            }
        }

        $this->info("Encrypted {$count} legacy keys.");
        return 0;
    }
}
