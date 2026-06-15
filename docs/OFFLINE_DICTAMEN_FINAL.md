# Dictamen Final OFFLINE - S_Hospital

Fecha: 2026-06-15
Version auditada: v1.0.0 + ramas OFF-A a OFF-E + cherry-pick de hardening-audit-complete (680e7d2e + 6cecb4af) sobre v1.1-critical-hardening-after-offline
Auditor: subagentes 16-30 del prompt maestro OFFLINE + matriz P0/P1 v1.1

## Resultado

**Estado 2.5: Hardening tecnico listo, pendiente solo validacion fisica en hospital.**

El sistema cumple los criterios de entrega tecnica offline y de hardening tecnico: instala sin internet, opera sin internet, se respalda y restaura con SHA256 verificado, la base de datos tiene CHECK constraints sobre estados e importes, los exports XLSX escapan formula injection, los recibos institucionales son race-safe, el login lockout no se bypasea con login vacio, los usuarios se desactivan sin borrado fisico, la idempotencia frontend/backend es estable, y la auditoria cubre eventos criticos.

Quedan 4 items PENDING que dependen de la entrega fisica al hospital (segunda PC LAN, impresora real, acta firmada, captura manual temporal). Estos se cierran en la fase de despliegue controlado (estado 3), no en el hardening tecnico (estado 2.5).

## Matriz P0/P1 (resumen)

| Categoria | PASS | PARTIAL | FAIL | Total |
|-----------|-----:|--------:|-----:|------:|
| SEC | 7 | 2 | 0 | 9 |
| INF | 16 | 3 | 0 | 19 |
| BKP | 12 | 2 | 0 | 14 |
| DB | 10 | 3 | 0 | 13 |
| FN | 11 | 2 | 0 | 13 |
| FE | 14 | 1 | 0 | 15 |
| **Total** | **70** | **13** | **0** | **83** |

Detalle por ID: `worklogs/2026-06-15-v11-critical-hardening-matrix.md`.

## Justificacion por area

### Infraestructura - PARTIAL (1 pendiente fisico)

`SYSTEM_REQUIREMENTS.md` documenta requisitos. `docker-compose.prod.yml` endurecido. Pendiente: validacion LAN fisica desde segunda PC en hospital.

### Red Local - PARTIAL

Documentada con IP fija, firewall, puerto. Pendiente: prueba fisica desde otra PC.

### Base de Datos - PARTIAL

Migraciones, seeds, integridad, auditoria. Migracion nueva `2026_06_15_000004_add_offline_check_constraints` agrega CHECK constraints para `invoices.status`, `payments.status`, `cash_register_sessions.status`, `cash_movements.type`, `audit_logs.result`, no-negatividad de amounts y regla `services.price > 0 OR special_rule_code IS NOT NULL`. Unique-active guard para `receipt_print_profiles.is_global_default`.

### Seguridad - PARTIAL

Login lockout endurecido, RBAC admin check, reset password invalida contexto, composer audit en CI. Bloqueo automatico de sesion web sigue siendo trabajo de v1.2.

### Operacion Offline - PASS

`scripts/audit_offline_dependencies.ps1` confirma 0 dependencias externas criticas. Login, dashboard, facturacion, pagos, caja, reportes e impresion funcionan offline. `frontend/src/lib/offline/indicators.ts` provee mensajes claros.

### Backup y Recuperacion - PARTIAL

Backup automatico, manual, cifrado con SHA256, restore probado localmente. `EncryptBackupFileAction` cifra con `APP_KEY`. `hospital:decrypt-backup` para restaurar. `hospital:prune-idempotency-keys` para limpieza.

### Continuidad - PARTIAL

10 escenarios de desastre en `DISASTER_RECOVERY.md`. Scripts `rollback_update.ps1` + `.sh` orquestan rollback con SHA256, snapshot de codigo, confirmacion textual `ROLLBACK` para produccion.

### Impresion - PARTIAL

Plantillas institucionales. Nuevo endpoint `POST /api/institutional-receipts/{receipt}/print-events` con throttle y audit audita cada intento de impresion.

### Mantenimiento - PASS

Rutinas diaria/semanal/mensual/trimestral en `docs/MAINTENANCE_ROUTINE.md`.

### Entrega - PARTIAL

Documentacion completa. Acta de entrega y lista firmable se firman en la entrega real.

## Items PENDING (cierre en despliegue fisico, Estado 3)

1. Validacion LAN desde segunda PC fisica.
2. Impresion fisica del recibo institucional en hardware del hospital.
3. Formato fisico de captura manual y reingreso de datos.
4. Firma del acta de entrega tecnica y lista de pendientes por el hospital.

## Items PARTIAL que requieren decision de producto o v1.2

1. Bloqueo de sesion del sistema web por inactividad (v1.2).
2. Memoria `--memory=256` en queue worker documentada como recomendacion (no codigo).
3. LOG_DAILY_DAYS documentado en `docs/CI.md` (no codigo nuevo).
4. `tax_rate` validado en codigo de Form Request (sin CHECK en BD por compatibilidad).
5. `services.price > 0` se valida en Form Request; CHECK en BD para casos huerfanos.

## No se declara

**Listo para uso hospitalario definitivo**: pasaria a ese estado solo despues de cerrar los 4 PENDING y validar operacion real con usuarios en produccion durante al menos una semana.

## Recomendaciones para despliegue

1. Cerrar los 4 PENDING en el orden sugerido: LAN fisica, impresion fisica, formato de captura manual, acta firmada.
2. Ejecutar `rollback_update.ps1 -SelfTest` en el servidor del hospital antes de la primera actualizacion real.
3. Validar `audit_offline_dependencies.ps1` en el servidor.
4. Aplicar las migraciones nuevas con `php artisan migrate --force` (nunca `migrate:fresh`).
5. Rotar USB de respaldo en la primera semana de operacion.
6. Documentar en `qa/INCIDENT-YYYY-MM-DD.md` cualquier incidente de los primeros 30 dias.

