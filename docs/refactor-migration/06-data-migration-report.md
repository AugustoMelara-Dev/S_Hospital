# Informe de migración de datos

Fecha de verificación: 2026-07-21.

## Estrategia aplicada

No fue necesario introducir una migración destructiva nueva para este refactor. Se conservaron las 81 migraciones existentes, sus claves foráneas, constraints, columnas monetarias en centavos y snapshots históricos. El cambio de `Money` elimina la API pública basada en `float` sin transformar valores persistidos.

La instalación desde cero se ejecutó sobre una MariaDB aislada con `php artisan migrate --seed --force`: 81 migraciones aplicadas y seeders reproducibles. El E2E de producción creó una factura pagada de 1.725 centavos, asociada a cajero, sesión, pago y recibo.

## Reconciliación y rollback

- Backup previo: dump SQL comprimido y cifrado, checksum SHA-256 verificado.
- Restauración: base separada `hospital_restore_audit`.
- Conteos críticos origen/restaurada: users 4/4, invoices 1/1, payments 1/1, institutional_receipts 1/1.
- Reconciliación financiera: factura pagada de 1.725 centavos en ambos lados.
- Rollback ensayado sobre la copia restaurada: `migrate:rollback --step=1 --force` revirtió `2026_07_16_000005_add_operational_log_prune_indexes`; `migrate --force` la reaplicó con código 0.

La diferencia 208/205 en `audit_logs` corresponde a tres eventos creados en origen después del instante del dump. No hubo filas omitidas, truncadas ni corregidas durante el restore.

## Alcance

No se modificaron datos de la base compartida de desarrollo. Una base vacía temporal creada durante la preparación del ensayo fue eliminada después de confirmar que no contenía tablas; era desechable y no es recuperable.
