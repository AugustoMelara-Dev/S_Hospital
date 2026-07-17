<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Cash\OpenCashSessionAction;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class PrepareE2eReleaseDataCommand extends Command
{
    protected $signature = 'hospital:prepare-e2e-release-data {--password= : The E2E users password} {--json : Emit machine-readable setup details}';

    protected $description = 'Prepara datos idempotentes no productivos para el gate E2E de release.';

    public function handle(OpenCashSessionAction $openCashSession): int
    {
        if ($this->laravel->environment('production')) {
            $this->error('Refusing to prepare E2E data while APP_ENV=production.');

            return self::FAILURE;
        }

        $this->callSilent('db:seed', [
            '--class' => RolesAndPermissionsSeeder::class,
            '--force' => true,
        ]);
        $this->callSilent('db:seed', [
            '--class' => ServiceCatalogSeeder::class,
            '--force' => true,
        ]);

        $password = $this->option('password') ?: getenv('E2E_SEED_PASSWORD');

        if (empty($password)) {
            $this->error('The E2E seed password must be provided via --password or E2E_SEED_PASSWORD.');

            return self::FAILURE;
        }

        $admin = $this->upsertUser('admin.e2e', 'Administrador E2E', 'admin', (string) $password);
        $supervisor = $this->upsertUser('supervisor.e2e', 'Supervisor E2E', 'supervisor', (string) $password);
        $cashier = $this->upsertUser('cajero.e2e', 'Cajero E2E', 'cajero', (string) $password);

        FiscalSetting::query()->updateOrCreate(
            ['id' => 1],
            [
                'hospital_name' => 'Hospital General San Isidro',
                'rtn' => '08011999123456',
                'default_tax_rate' => '15.00',
                'receipt_paper_size' => 'half_letter',
                'receipt_template_mode' => 'institutional',
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaria de Salud Publica',
                'receipt_location' => 'Tocoa, Colón, Honduras',
                'phone' => '2444-0000',
                'receipt_footer_text' => 'Datos de prueba E2E no productivos.',
                'scanner_enabled' => false,
                'partial_payments_enabled' => false,
                'created_by' => $admin->id,
                'updated_by' => $admin->id,
            ],
        );

        $sequence = FiscalSequence::query()
            ->where('document_type', 'invoice')
            ->where('active', true)
            ->first() ?? new FiscalSequence([
                'document_type' => 'invoice',
                'prefix' => '999-001-99',
                'cai' => 'E2E-RELEASE-CAI',
                'active' => true,
            ]);

        $maxIssuedNumber = Invoice::query()
            ->where('fiscal_prefix', $sequence->prefix)
            ->pluck('invoice_number')
            ->map(function (string $invoiceNumber): int {
                $parts = explode('-', $invoiceNumber);

                return (int) end($parts);
            })
            ->max();

        $sequence->fill([
            'document_type' => 'invoice',
            'active_document_type' => 'invoice',
            'prefix' => $sequence->prefix ?: '999-001-99',
            'cai' => $sequence->cai ?: 'E2E-RELEASE-CAI',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => max((int) $sequence->current_number, (int) $maxIssuedNumber),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
            'created_by' => $sequence->created_by ?? $admin->id,
            'updated_by' => $admin->id,
        ])->save();

        $service = $this->ensureBillableService('Glucosa');
        $erythropoietin = $this->ensureBillableService('Eritropoyetina');

        $cashSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->latest('opened_at')
            ->first();

        if ($cashSession === null) {
            $cashSession = $openCashSession->execute([
                'opening_amount' => '100.00',
                'notes' => 'Caja abierta por gate E2E no productivo.',
            ], $cashier);
        }

        $payload = [
            'environment' => app()->environment(),
            'users' => [
                'admin' => $admin->username,
                'supervisor' => $supervisor->username,
                'cashier' => $cashier->username,
                'password' => $password,
            ],
            'fiscal_sequence' => [
                'id' => $sequence->id,
                'prefix' => $sequence->prefix,
                'current_number' => $sequence->current_number,
                'valid_until' => $sequence->valid_until->toDateString(),
            ],
            'cash_session' => [
                'id' => $cashSession->id,
                'status' => $cashSession->status,
                'user_id' => $cashSession->user_id,
            ],
            'services' => [
                'billing' => ['id' => $service->id, 'name' => $service->name, 'price' => $service->price],
                'erythropoietin' => [
                    'id' => $erythropoietin->id,
                    'name' => $erythropoietin->name,
                    'price' => $erythropoietin->price,
                    'special_rule_code' => $erythropoietin->special_rule_code,
                ],
            ],
        ];

        if ($this->option('json')) {
            $this->line(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        } else {
            $this->info('E2E release data ready for user cajero.e2e.');
            $this->line('Use the provided password in a non-production E2E environment only.');
        }

        return self::SUCCESS;
    }

    private function upsertUser(string $username, string $name, string $role, string $password): User
    {
        $user = User::query()->updateOrCreate(
            ['username' => $username],
            [
                'name' => $name,
                'email' => "{$username}@hospital-san-isidro.local",
                'password' => Hash::make($password),
                'active' => true,
                'must_change_password' => false,
            ],
        );

        $user->syncRoles([$role]);

        return $user;
    }

    private function ensureBillableService(string $name): Service
    {
        $service = Service::query()
            ->where('name', $name)
            ->first();

        if ($service === null) {
            $this->error("Required E2E service [{$name}] is missing after catalog seeding.");
            throw new \RuntimeException("Missing required E2E service [{$name}].");
        }

        $service->forceFill([
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ])->save();

        return $service->refresh();
    }
}
