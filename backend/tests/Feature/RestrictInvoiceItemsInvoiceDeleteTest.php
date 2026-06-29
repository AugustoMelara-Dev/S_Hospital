<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RestrictInvoiceItemsInvoiceDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            $this->markTestSkipped('Migration does not run on SQLite.');
        }
    }

    public function test_rollback_does_not_cascade_delete_items()
    {
        $user = User::factory()->create();

        Artisan::call('migrate', ['--path' => 'database/migrations/2026_05_18_000002_restrict_invoice_items_invoice_delete.php']);

        Artisan::call('migrate:rollback', ['--path' => 'database/migrations/2026_05_18_000002_restrict_invoice_items_invoice_delete.php']);

        $cashSessionId = DB::table('cash_register_sessions')->insertGetId([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => 0,
            'status' => 'open',
            'opened_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $invoiceId = DB::table('invoices')->insertGetId([
            'cash_session_id' => $cashSessionId,
            'number' => '000-000-01-00000001',
            'subtotal_cents' => 100,
            'tax_amount_cents' => 0,
            'discount_amount_cents' => 0,
            'total_cents' => 100,
            'paid_amount_cents' => 100,
            'balance_due_cents' => 0,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'General',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $serviceId = DB::table('services')->insertGetId([
            'name' => 'Consulta',
            'category_id' => $categoryId,
            'price' => 100,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('invoice_items')->insert([
            'invoice_id' => $invoiceId,
            'service_id' => $serviceId,
            'quantity_cents' => 100,
            'unit_price_cents' => 100,
            'line_subtotal_cents' => 100,
            'tax_amount_cents' => 0,
            'line_total_cents' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            DB::table('invoices')->where('id', $invoiceId)->delete();
            $this->fail('Delete should have been restricted.');
        } catch (QueryException $e) {
            $this->assertStringContainsString('foreign key constraint fails', strtolower($e->getMessage()));
        }

        DB::table('invoice_items')->where('invoice_id', $invoiceId)->delete();
        DB::table('invoices')->where('id', $invoiceId)->delete();

        Artisan::call('migrate', ['--path' => 'database/migrations/2026_05_18_000002_restrict_invoice_items_invoice_delete.php']);
    }
}
