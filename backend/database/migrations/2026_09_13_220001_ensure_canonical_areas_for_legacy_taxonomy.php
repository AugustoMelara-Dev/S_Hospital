<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F016 fase 1 (T2-040): garantizar contraparte canonica en `areas` para cada
 * area legacy de `service_areas`, por slug (nunca por id: los ids divergen
 * entre taxonomias; ver hospital-ai/evidencia/T2-040/preflight-phase2-output.log:
 * `areas` 32-36 vs `service_areas` 37-42).
 *
 * Casos cubiertos:
 * - Instalacion existente: crea en `areas` las filas faltantes para los slugs
 *   presentes en `service_areas` (incluye `otros` si existe).
 * - Instalacion nueva: `otros` se garantiza aunque `service_areas` aun este
 *   vacia al momento de migrar, para que el seed posterior del ServiceCatalogSeeder
 *   (que crea `service_areas.otros`) encuentre contraparte canonica.
 *
 * Reglas:
 * - Aditiva: solo INSERT en `areas` y registro en la tabla de trazabilidad
 *   `legacy_area_backfill_map` (creada por esta migracion).
 * - Idempotente: si el slug ya existe en `areas`, no se sobrescribe (el nombre
 *   canonico gana) y no se registra.
 * - Fail-closed: un slug legacy vacio aborta la migracion.
 * - down(): elimina SOLO las areas creadas por esta migracion que ademas no
 *   esten referenciadas por `services` ni por snapshots `invoice_items`
 *   (nunca toca historia); luego elimina la tabla de trazabilidad.
 */
return new class extends Migration
{
    private const MAP_TABLE = 'legacy_area_backfill_map';

    private const FALLBACK_SLUG = 'otros';

    private const FALLBACK_NAME = 'Otros';

    public function up(): void
    {
        if (! Schema::hasTable('areas') || ! Schema::hasTable('service_areas')) {
            return;
        }

        if (! Schema::hasTable(self::MAP_TABLE)) {
            Schema::create(self::MAP_TABLE, function (Blueprint $table): void {
                $table->id();
                $table->string('slug', 160)->unique();
                $table->unsignedBigInteger('area_id');
                $table->timestamps();
            });
        }

        $legacyAreas = DB::table('service_areas')->select('slug', 'name', 'active')->get();

        /** @var array<string, object|null> $candidates */
        $candidates = [self::FALLBACK_SLUG => null];

        foreach ($legacyAreas as $legacy) {
            $slug = trim((string) $legacy->slug);

            if ($slug === '') {
                throw new RuntimeException(
                    'F016 fail-closed: existe una fila de `service_areas` con slug vacio; '.
                    'corrija el dato legacy antes de consolidar la taxonomia.'
                );
            }

            $candidates[$slug] = $legacy;
        }
        foreach ($candidates as $slug => $legacy) {
            $existing = DB::table('areas')->where('slug', $slug)->first();
            if ($existing !== null) {
                // El area canonica ya existe: no se sobrescribe ni se registra.
                continue;
            }

            $areaId = (int) DB::table('areas')->insertGetId([
                'name' => $legacy !== null && trim((string) $legacy->name) !== ''
                    ? (string) $legacy->name
                    : self::FALLBACK_NAME,
                'slug' => $slug,
                'active' => $legacy !== null ? (bool) $legacy->active : true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $marker = DB::table(self::MAP_TABLE)->where('slug', $slug)->first();

            if ($marker === null) {
                DB::table(self::MAP_TABLE)->insert([
                    'slug' => $slug,
                    'area_id' => $areaId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table(self::MAP_TABLE)->where('slug', $slug)->update([
                    'area_id' => $areaId,
                    'updated_at' => now(),
                ]);
            }
        }

        $pending = 0;

        foreach (array_keys($candidates) as $slug) {
            if (! DB::table('areas')->where('slug', $slug)->exists()) {
                $pending++;
            }
        }

        if ($pending > 0) {
            throw new RuntimeException(
                'F016 fail-closed: quedaron '.$pending.' slug(s) legacy sin contraparte canonica tras el backfill.'
            );
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::MAP_TABLE)) {
            return;
        }

        $markers = DB::table(self::MAP_TABLE)->get();

        foreach ($markers as $marker) {
            $referencedByServices = Schema::hasTable('services')
                && DB::table('services')->where('area_id', $marker->area_id)->exists();

            $referencedBySnapshots = Schema::hasTable('invoice_items')
                && DB::table('invoice_items')->where('area_id', $marker->area_id)->exists();

            if ($referencedByServices || $referencedBySnapshots) {
                // No se revierte una contraparte ya adoptada: borrarla perderia
                // la referencia del catalogo o de un snapshot historico.
                continue;
            }

            if (Schema::hasTable('areas')) {
                DB::table('areas')->where('id', $marker->area_id)->delete();
            }
        }

        Schema::dropIfExists(self::MAP_TABLE);
    }
};
