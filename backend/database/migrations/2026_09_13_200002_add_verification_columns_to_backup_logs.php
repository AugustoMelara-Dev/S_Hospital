<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T2-025 / HS-BK-VERIFY (soporte de esquema para T2-010): recuperabilidad
 * verificada y key mismatch en `backup_logs`.
 *
 * Hoy "ultima copia" se deduce de `status='success'` + archivo/checksum, pero
 * un checksum correcto no demuestra que el respaldo se pueda descifrar ni que
 * la llave configurada siga siendo la misma (`encryption_key_id` se escribe al
 * crear pero nunca se compara; ver T1-006 HS-BK-VERIFY/HS-BK-KEY).
 *
 * Columnas nuevas (todas NULLABLE, sin backfill, sin valor por defecto):
 *   - `verified_at`   DATETIME: instante de la ultima verificacion EXITOSA.
 *   - `verify_status` VARCHAR(32): resultado de la ultima verificacion.
 *         NULL            = nunca verificado (estado de todo lo existente).
 *         'verified'      = archivo presente, tamano/sha256 correctos,
 *                           descifrado OK y key fingerprint coincidente.
 *         'key_mismatch'  = descifrado/identidad de llave no coincide con la
 *                           llave configurada (accion: recuperar/custodiar la
 *                           llave correcta; no es lo mismo que un archivo roto).
 *         'failed'        = cualquier otro fallo de verificacion (archivo
 *                           ausente, tamano/hash distinto, corrupcion).
 *   - `key_identifier` VARCHAR(64): fingerprint sha256 hex64 de la llave que
 *         verifico correctamente el archivo. Distinto de `encryption_key_id`
 *         (fingerprint de creacion): en respaldos legacy (APP_KEY) o tras una
 *         rotacion, este campo documenta que llave si descifra hoy. Nunca
 *         guarda la llave.
 *
 * Compatibilidad total:
 *   - Aditivo y nullable: los registros existentes quedan sin verificar.
 *   - No se normaliza, reescribe ni borra ningun dato historico.
 *   - CHECKs de dominio solo en MariaDB/MySQL; SQLite recibe las columnas
 *     (ALTER TABLE ADD COLUMN portable) y omite los CHECK, que no soporta.
 *
 * Uso previsto por T2-010 (contrato en hospital-ai/evidencia/T2-025):
 *   "ultima copia recuperable" =
 *     status='success' AND verify_status='verified' AND verified_at IS NOT NULL
 *   ordenando por verified_at DESC, id DESC.
 *
 * Rollback: elimina exactamente las 3 columnas y sus CHECK; conserva todas las
 * filas y el resto de columnas de `backup_logs`.
 */
return new class extends Migration
{
    private const TABLE = 'backup_logs';

    private const COLUMNS = ['verified_at', 'verify_status', 'key_identifier'];

    private const VERIFY_STATUS_CHECK = 'backup_logs_verify_status_valid';

    private const KEY_IDENTIFIER_CHECK = 'backup_logs_key_identifier_format';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            if (! Schema::hasColumn(self::TABLE, 'verified_at')) {
                $table->dateTime('verified_at')->nullable()->after('completed_at');
            }

            if (! Schema::hasColumn(self::TABLE, 'verify_status')) {
                $table->string('verify_status', 32)->nullable()->after('verified_at');
            }

            if (! Schema::hasColumn(self::TABLE, 'key_identifier')) {
                $table->string('key_identifier', 64)->nullable()->after('verify_status');
            }
        });

        if (! $this->supportsCheckConstraints()) {
            return;
        }

        if (! $this->checkExists(self::VERIFY_STATUS_CHECK)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::VERIFY_STATUS_CHECK.'` '
                ."CHECK (`verify_status` IS NULL OR `verify_status` IN ('verified','key_mismatch','failed'))"
            );
        }

        if (! $this->checkExists(self::KEY_IDENTIFIER_CHECK)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::KEY_IDENTIFIER_CHECK.'` '
                .'CHECK (`key_identifier` IS NULL OR (CHAR_LENGTH(`key_identifier`) = 64 '
                ."AND `key_identifier` REGEXP BINARY '^[0-9a-f]{64}$'))"
            );
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if ($this->supportsCheckConstraints()) {
            foreach ([self::VERIFY_STATUS_CHECK, self::KEY_IDENTIFIER_CHECK] as $check) {
                if ($this->checkExists($check)) {
                    DB::statement('ALTER TABLE `'.self::TABLE.'` DROP CONSTRAINT `'.$check.'`');
                }
            }
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            foreach (self::COLUMNS as $column) {
                if (Schema::hasColumn(self::TABLE, $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function supportsCheckConstraints(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function checkExists(string $name): bool
    {
        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
    }
};
