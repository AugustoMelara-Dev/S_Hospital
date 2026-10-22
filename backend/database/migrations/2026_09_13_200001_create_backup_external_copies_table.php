<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T2-025 / HS-BK-EXT (materializa F019): ledger de copias externas de respaldo.
 *
 * Contexto: T1-006 comprobo que los respaldos viven en el mismo host que la
 * base (`backup_data` + `mysql_prod_data` en el mismo Docker host) y que no
 * existia registro de copia externa, verificacion ni evidencia. Esta tabla es
 * el registro persistente que T2-010 (hs-backups) usara para:
 *   - declarar el destino externo por etiqueta (sin secretos),
 *   - registrar la ruta relativa y el sha256/bytes del archivo ya copiado,
 *   - seguir el ciclo pending -> copied -> verified / failed,
 *   - guardar metadatos acotados (manifiesto) sin credenciales ni datos clinicos.
 *
 * Decision de dominio (retention/poda):
 *   La FK a `backup_logs` usa ON DELETE RESTRICT. La poda existente
 *   (`PruneBackupsAction`) borra filas de `backup_logs` cuando elimina el
 *   archivo local; con RESTRICT, un respaldo con copias externas registradas
 *   NO puede desaparecer en silencio: el borrado falla de forma visible y la
 *   politica de poda de copias externas queda como decision explicita de
 *   T2-010 (p.ej. excluir de la poda los backup_logs con copias, o autorizar
 *   primero el retiro de la copia externa). No se implementa poda destructiva
 *   aqui y no se usa CASCADE: el ledger externo puede ser la ultima copia
 *   recuperable y no debe borrarse junto con el archivo local.
 *
 * Compatibilidad:
 *   - Tabla nueva aditiva; no toca datos existentes de `backup_logs`.
 *   - `status` CHECK: pending|copied|verified|failed.
 *   - `sha256` nullable con formato hex64 (minusculas) cuando existe.
 *   - `bytes` nullable con CHECK >= 0 (ademas del tipo UNSIGNED).
 *   - `metadata` JSON nullable; MariaDB valida json_valid automaticamente.
 *   - Indices por backup_log_id / status / verified_at.
 *
 * SQLite: la tabla y sus indices se crean igual (Blueprint portable). Los
 * CHECK de dominio no se agregan en SQLite (no soporta
 * `ALTER TABLE ADD CONSTRAINT`); la cobertura de constraints corre en MariaDB
 * via phpunit.mysql.xml y los tests declaran skip explicito en SQLite.
 *
 * Rollback: `down()` elimina la tabla completa (y con ella indices, FK y
 * CHECKs). No modifica `backup_logs` en ninguna direccion.
 */
return new class extends Migration
{
    private const TABLE = 'backup_external_copies';

    private const STATUS_CHECK = 'backup_external_copies_status_valid';

    private const SHA256_CHECK = 'backup_external_copies_sha256_format';

    private const BYTES_CHECK = 'backup_external_copies_bytes_nonnegative';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table): void {
                $table->id();

                $table->foreignId('backup_log_id')
                    ->constrained('backup_logs')
                    ->restrictOnDelete();

                $table->string('destination_label', 100);
                $table->string('relative_path', 512)->nullable();
                $table->char('sha256', 64)->nullable();
                $table->unsignedBigInteger('bytes')->nullable();
                $table->string('status', 16)->default('pending');
                $table->dateTime('copied_at')->nullable();
                $table->dateTime('verified_at')->nullable();
                $table->dateTime('failed_at')->nullable();
                $table->text('error_message')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index('backup_log_id', 'backup_external_copies_backup_log_id_index');
                $table->index('status', 'backup_external_copies_status_index');
                $table->index('verified_at', 'backup_external_copies_verified_at_index');
            });
        }

        if (! $this->supportsCheckConstraints()) {
            return;
        }

        if (! $this->checkExists(self::STATUS_CHECK)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::STATUS_CHECK.'` '
                ."CHECK (`status` IN ('pending','copied','verified','failed'))"
            );
        }

        if (! $this->checkExists(self::SHA256_CHECK)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::SHA256_CHECK.'` '
                .'CHECK (`sha256` IS NULL OR (CHAR_LENGTH(`sha256`) = 64 '
                ."AND `sha256` REGEXP BINARY '^[0-9a-f]{64}$'))"
            );
        }

        if (! $this->checkExists(self::BYTES_CHECK)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::BYTES_CHECK.'` '
                .'CHECK (`bytes` IS NULL OR `bytes` >= 0)'
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists(self::TABLE);
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
