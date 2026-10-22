<?php

namespace Database\Seeders;

use App\Models\CashRegister;
use Illuminate\Database\Seeder;

/**
 * M-W2-DB-01 (mandato §7): caja inicial del modo simple.
 *
 * `firstOrCreate` por `code`: no sobrescribe configuracion existente. Si un
 * administrador ya renombro o desactivo la caja `principal`, re-ejecutar el
 * seeder no revierte esa decision.
 */
class CashRegisterSeeder extends Seeder
{
    public function run(): void
    {
        CashRegister::query()->firstOrCreate(
            ['code' => 'principal'],
            ['name' => 'Caja principal', 'active' => true],
        );
    }
}
