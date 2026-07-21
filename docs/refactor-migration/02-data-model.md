# Modelo de datos y estrategia de migración

## Modelo principal descubierto

| Dominio | Tablas principales | Integridad relevante |
|---|---|---|
| Identidad | `users`, `roles`, `permissions`, tablas pivote | email/usuario únicos, estado activo, RBAC |
| Catálogo | `areas`, `categories`, `services`, historial de precios | índices por estado, área y categoría; servicios usados no se borran |
| Fiscal | `fiscal_settings`, `fiscal_sequences` | prefijo/CAI/rango, secuencia activa única, validez |
| Facturación | `invoices`, `invoice_items` | número fiscal único, snapshots de nombre/precio, centavos enteros |
| Pagos | `payments` | monto en centavos, método, caja, usuario, reversos auditados |
| Caja | `cash_register_sessions`, `cash_movements` | una sesión abierta por usuario, snapshots de conciliación |
| Recibos | `institutional_receipts`, eventos de impresión y configuración | serie/número únicos, snapshot, PDF y SHA-256 |
| Operación | `settings`, `idempotency_keys`, scheduler/realtime | idempotencia por usuario+ruta+clave |
| Auditoría | `audit_logs`, intentos de login | actor, acción, entidad, contexto y request ID |
| Respaldo | `backup_logs` | estado, checksum, cifrado, tamaño y retención |

## Política monetaria

La fuente de verdad operativa son columnas enteras `*_cents` y `App\Support\Money`. Facturas, líneas, pagos, saldos, recibos y consultas de reporte ya exponen centavos. Las columnas DECIMAL heredadas continúan como compatibilidad durante la fase expandida; no deben usarse para nuevas sumas de dominio.

Reglas de migración:

1. **Expandir:** añadir columna/índice/constraint compatible y nullable cuando sea necesario.
2. **Migrar:** backfill idempotente por lotes, con dry-run, conteos y reporte de anomalías.
3. **Verificar:** comparar filas, hashes, sumas en centavos, claves foráneas y reconciliación factura-pago-caja-reporte.
4. **Contraer:** sólo tras una versión de compatibilidad, backup restaurado y evidencia de que ningún consumidor lee la representación antigua.

No se ejecutará una contracción destructiva en la base operativa de esta auditoría. Los esquemas históricos de validación y restore se preservan.

## Invariantes

- Nunca usar `float` o `double` para cálculo o persistencia monetaria.
- Una factura histórica conserva nombre, precio, impuesto y totales de sus snapshots.
- No borrar facturas; anular/revertir con permiso, motivo y auditoría.
- Toda factura pagada referencia caja, cajero, método y fecha.
- Asignar correlativos dentro de transacción y con bloqueo; no duplicarlos bajo concurrencia.
- El saldo es `total_cents - pagos válidos`; caja y reportes deben reconciliar el mismo conjunto y periodo.
- Eritropoyetina vale L 25.00 y sólo es gratuita cuando la regla de receta de diálisis se marca y valida.

## Verificaciones pendientes

- Capturar checksums y sumas antes/después de cualquier nueva migración.
- Ensayar `migrate`, rollback crítico y restore en una copia separada.
- Probar concurrencia real de correlativos y doble envío.
- Confirmar que PDF y Excel reproducen exactamente centavos persistidos.
- Medir índices con consultas representativas y `EXPLAIN`, sin añadir índices especulativos.

