<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M-W2-DB-02 TAREA 2 (contrato en docs/print-profiles.md seccion 2).
 *
 * `receipt_print_profiles.paper_kind` nacio (2026_06_14_000002) como enum sin
 * valores verticales de carta ni A4. hs-receipts sembro `carta_vertical`
 * (215.90 x 279.40 mm = 612 x 792 pt) y `a4_vertical` (210 x 297 mm =
 * 595.28 x 841.89 pt) como `custom_mm` con sus milimetros exactos.
 *
 * Esta migracion:
 * 1. EXPANDE el enum agregando `letter_portrait` y `a4_portrait` (no reemplaza
 *    ningun valor existente). En MariaDB usa el ALTER del contrato; en SQLite
 *    Laravel recompila el CHECK preservando datos y el resto del esquema.
 * 2. Reapunta de forma IDEMPOTENTE los dos perfiles sembrados de `custom_mm` a
 *    su `paper_kind` nativo, SOLO si su codigo y su geometria exacta coinciden;
 *    si el perfil no existe, la geometria fue personalizada o el enum no admite
 *    el valor, no falla y no toca nada.
 * 3. No toca perfiles apaisados ni termicos, ni `profile_snapshot` de recibos
 *    historicos (los documentos guardan su propio snapshot y no dependen de
 *    este catalogo).
 *
 * `down()` es seguro: solo revierte el enum si NINGUNA fila usa los valores
 * nuevos; si existen, conserva el enum ampliado y los datos (no destruye).
 */
return new class extends Migration
{
    private const TABLE = 'receipt_print_profiles';

    private const COLUMN = 'paper_kind';

    /**
     * Orden exacto del contrato (docs/print-profiles.md). Se conservan los
     * valores historicos en su posicion original y se insertan los verticales
     * despues de `letter_landscape` para no alterar codigos existentes.
     *
     * @var list<string>
     */
    private const EXPANDED_KINDS = [
        'custom_mm',
        'half_letter_landscape',
        'a5_landscape',
        'letter_landscape',
        'letter_portrait',
        'a4_portrait',
        'thermal_80mm',
        'thermal_58mm',
    ];

    /**
     * @var list<string>
     */
    private const LEGACY_KINDS = [
        'custom_mm',
        'half_letter_landscape',
        'a5_landscape',
        'letter_landscape',
        'thermal_80mm',
        'thermal_58mm',
    ];

    /**
     * @var list<string>
     */
    private const NATIVE_KINDS = ['letter_portrait', 'a4_portrait'];

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $this->expandEnum();

        // Solo se reapunta si el enum realmente admite los valores nativos.
        if ($this->enumSupportsNativeKinds()) {
            $this->repointNativePortraitProfiles();
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        // No destruir datos: si algun perfil usa los valores nuevos, el enum
        // debe seguir admitiendolos. Se deja constancia y no se revierte.
        if ($this->nativeKindRowsExist()) {
            return;
        }

        $this->shrinkEnum();
    }

    private function expandEnum(): void
    {
        if ($this->enumSupportsNativeKinds()) {
            return; // Idempotente: el enum ya fue ampliado.
        }

        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` MODIFY `'.self::COLUMN.'` ENUM('
                .$this->quotedKinds(self::EXPANDED_KINDS).') NOT NULL'
            );

            return;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->enum(self::COLUMN, self::EXPANDED_KINDS)->change();
            });
        }
    }

    private function shrinkEnum(): void
    {
        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` MODIFY `'.self::COLUMN.'` ENUM('
                .$this->quotedKinds(self::LEGACY_KINDS).') NOT NULL'
            );

            return;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::table(self::TABLE, function (Blueprint $table): void {
                $table->enum(self::COLUMN, self::LEGACY_KINDS)->change();
            });
        }
    }

    /**
     * @param  list<string>  $kinds
     */
    private function quotedKinds(array $kinds): string
    {
        return implode(',', array_map(
            static fn (string $kind): string => "'".$kind."'",
            $kinds,
        ));
    }

    private function enumSupportsNativeKinds(): bool
    {
        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $columnType = (string) DB::table('information_schema.COLUMNS')
                ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
                ->where('TABLE_NAME', self::TABLE)
                ->where('COLUMN_NAME', self::COLUMN)
                ->value('COLUMN_TYPE');

            return str_contains($columnType, "'letter_portrait'")
                && str_contains($columnType, "'a4_portrait'");
        }

        if ($driver === 'sqlite') {
            $row = DB::selectOne(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
                [self::TABLE],
            );

            $sql = is_object($row) ? (string) ($row->sql ?? '') : '';

            return str_contains($sql, 'letter_portrait') && str_contains($sql, 'a4_portrait');
        }

        // Motor no contemplado: no intentar DDL del enum.
        return true;
    }

    private function nativeKindRowsExist(): bool
    {
        return DB::table(self::TABLE)
            ->whereIn(self::COLUMN, self::NATIVE_KINDS)
            ->exists();
    }

    /**
     * Reapunta UNICAMENTE los dos perfiles sembrados por ReceiptPrintProfileSeeder
     * cuando siguen siendo `custom_mm` y conservan su geometria exacta. Si el
     * codigo no existe, la geometria cambio o el perfil es otro, no se toca:
     * el migrate no debe fallar por datos que no siguen el contrato.
     */
    private function repointNativePortraitProfiles(): void
    {
        $targets = [
            ['code' => 'carta_vertical', 'kind' => 'letter_portrait', 'width_mm' => 215.90, 'height_mm' => 279.40],
            ['code' => 'a4_vertical', 'kind' => 'a4_portrait', 'width_mm' => 210.00, 'height_mm' => 297.00],
        ];

        foreach ($targets as $target) {
            DB::table(self::TABLE)
                ->where('code', $target['code'])
                ->where(self::COLUMN, 'custom_mm')
                ->whereBetween('width_mm', [$target['width_mm'] - 0.01, $target['width_mm'] + 0.01])
                ->whereBetween('height_mm', [$target['height_mm'] - 0.01, $target['height_mm'] + 0.01])
                ->update([self::COLUMN => $target['kind']]);
        }
    }
};
