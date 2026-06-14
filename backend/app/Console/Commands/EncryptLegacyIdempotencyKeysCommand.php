<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class EncryptLegacyIdempotencyKeysCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'idempotency:encrypt-legacy 
                            {--dry-run : Only show what would be done without modifying the database}
                            {--force : Force the operation to run in production}
                            {--chunk=100 : The number of records to process per chunk}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Encrypt legacy plaintext idempotency keys to protect PII';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = $this->option('dry-run');
        $force = $this->option('force');
        $chunkSize = (int) $this->option('chunk');

        if (app()->environment('production') && ! $isDryRun && ! $force) {
            $this->error('In production, you must use --force to modify data (or --dry-run to test).');

            return Command::FAILURE;
        }

        if ($isDryRun) {
            $this->info('Running in DRY-RUN mode. No data will be modified.');
        }

        $this->info('Starting legacy idempotency keys encryption...');

        $processed = 0;
        $encrypted = 0;
        $skipped = 0;
        $failed = 0;

        DB::table('idempotency_keys')
            ->orderBy('id')
            ->chunkById($chunkSize, function ($keys) use (&$processed, &$encrypted, &$skipped, &$failed, $isDryRun) {
                foreach ($keys as $key) {
                    $processed++;

                    $rawValue = $key->response_body;

                    if ($rawValue === null || $rawValue === '') {
                        $skipped++;

                        continue;
                    }

                    $isAlreadyEncrypted = false;
                    try {
                        // If it can be decrypted, it's already encrypted
                        Crypt::decryptString($rawValue);
                        $isAlreadyEncrypted = true;
                    } catch (DecryptException $e) {
                        // It's plaintext
                        $isAlreadyEncrypted = false;
                    }

                    if ($isAlreadyEncrypted) {
                        $skipped++;

                        continue;
                    }

                    // Proceed to encrypt the raw plaintext
                    try {
                        $newEncryptedValue = Crypt::encryptString($rawValue);

                        if (! $isDryRun) {
                            DB::table('idempotency_keys')
                                ->where('id', $key->id)
                                ->update(['response_body' => $newEncryptedValue]);
                        }
                        $encrypted++;
                    } catch (\Exception $e) {
                        $failed++;
                        $this->error("Failed to encrypt record ID {$key->id}: {$e->getMessage()}");
                    }
                }
            });

        $this->newLine();
        $this->info('Encryption process completed'.($isDryRun ? ' (DRY-RUN)' : ''));
        $this->table(
            ['Total Processed', 'Encrypted', 'Skipped (Already Encrypted or Empty)', 'Failed'],
            [[$processed, $encrypted, $skipped, $failed]]
        );

        return $failed > 0 ? Command::FAILURE : Command::SUCCESS;
    }
}
