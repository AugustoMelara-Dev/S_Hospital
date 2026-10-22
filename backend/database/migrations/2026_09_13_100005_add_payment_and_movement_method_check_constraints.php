<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F017 (T2-004/T2-014): dominio de metodos de pago y de movimientos de caja.
 *
 * - `payments.method` (NOT NULL): solo cash|transfer|card|other. La validacion
 *   de aplicacion esta en StorePaymentRequest (Rule::in(Payment::METHODS)),
 *   pero SQL directo podia introducir cualquier cadena.
 * - `cash_movements.method` (nullable): almacena tanto el metodo de pago
 *   (payment, payment_void) como el tipo de movimiento para apertura/cierre
 *   (opening/closing). El brazo NULL se conserva porque la columna es
 *   nullable por diseño; el valor NULL ya no se escribe en el flujo actual,
 *   pero no se prohibe para no romper filas historicas.
 *
 * Fail-closed: antes de agregar los CHECK se escanean los valores distintos
 * reales. Cualquier valor fuera del dominio aborta la migracion con la lista
 * exacta; no se reescriben datos.
 *
 * SQLite: guard por driver; la suite rapida no cambia y la cobertura corre en
 * MariaDB.
 *
 * Rollback: elimina exactamente los dos CHECK creados por esta migracion.
 */
return new class extends Migration
{
    private const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'other'];

    private const MOVEMENT_METHODS = ['cash', 'transfer', 'card', 'other', 'opening', 'closing'];

    private const PAYMENTS_CHECK = 'payments_method_valid';

    private const MOVEMENTS_CHECK = 'cash_movements_method_valid';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'method')) {
            $unknown = $this->unknownValues('payments', self::PAYMENT_METHODS, allowNull: false);

            if ($unknown !== []) {
                throw new RuntimeException(
                    'F017 fail-closed: `payments.method` contiene valores fuera del dominio ['.implode(', ', self::PAYMENT_METHODS).']: '.
                    implode(', ', $unknown).'. No se reescriben datos; documente el mapeo y vuelva a ejecutar.'
                );
            }

            if (! $this->checkExists(self::PAYMENTS_CHECK)) {
                DB::statement(
                    'ALTER TABLE `payments` ADD CONSTRAINT `'.self::PAYMENTS_CHECK.'` '.
                    "CHECK (`method` IN ('cash','transfer','card','other'))"
                );
            }
        }

        if (Schema::hasTable('cash_movements') && Schema::hasColumn('cash_movements', 'method')) {
            $unknown = $this->unknownValues('cash_movements', self::MOVEMENT_METHODS, allowNull: true);

            if ($unknown !== []) {
                throw new RuntimeException(
                    'F017 fail-closed: `cash_movements.method` contiene valores fuera del dominio ['.implode(', ', self::MOVEMENT_METHODS).'] (o NULL): '.
                    implode(', ', $unknown).'. No se reescriben datos; documente el mapeo y vuelva a ejecutar.'
                );
            }

            if (! $this->checkExists(self::MOVEMENTS_CHECK)) {
                DB::statement(
                    'ALTER TABLE `cash_movements` ADD CONSTRAINT `'.self::MOVEMENTS_CHECK.'` '.
                    "CHECK (`method` IS NULL OR `method` IN ('cash','transfer','card','other','opening','closing'))"
                );
            }
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $this->dropCheckIfExists('payments', self::PAYMENTS_CHECK);
        $this->dropCheckIfExists('cash_movements', self::MOVEMENTS_CHECK);
    }

    /**
     * @param  list<string>  $allowed
     * @return list<string>
     */
    private function unknownValues(string $table, array $allowed, bool $allowNull): array
    {
        $methods = DB::table($table)->select('method')->distinct()->pluck('method');

        $unknown = [];

        foreach ($methods as $method) {
            if ($method === null) {
                if (! $allowNull) {
                    $unknown[] = 'NULL';
                }

                continue;
            }

            if (! in_array($method, $allowed, true)) {
                $unknown[] = (string) $method;
            }
        }

        return $unknown;
    }

    private function checkExists(string $name): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
    }

    private function dropCheckIfExists(string $table, string $name): void
    {
        if (! Schema::hasTable($table) || ! $this->checkExists($name)) {
            return;
        }

        try {
            DB::statement("ALTER TABLE `{$table}` DROP CONSTRAINT `{$name}`");
        } catch (QueryException) {
        }
    }
};
