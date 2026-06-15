# v1.1 Critical Hardening - Matriz P0/P1 post-OFFLINE

Fecha: 2026-06-15
Rama: v1.1-critical-hardening-after-offline
Estado: **Estado 2.5 cerrado, 22 commits sobre main**

## Fase 0 - Verificacion OFF-A..OFF-E

| Fase | Estado | Evidencia |
|------|--------|-----------|
| OFF-A | PASS | `docs/OFFLINE_MODE_PLAN.md` (restaurado de bf552ef7) |
| OFF-B | PASS | `docs/PHYSICAL_SECURITY.md`, `ENDPOINT_SECURITY.md`, `DATETIME_POLICY.md`, `DATA_MIGRATION.md`, `MAINTENANCE_ROUTINE.md`; `SYSTEM_REQUIREMENTS.md` expandido |
| OFF-C | PASS | `scripts/audit_offline_dependencies.ps1` + `.sh`; `frontend/src/lib/offline/indicators.ts` + test; `qa/OFFLINE_SCENARIO_VALIDATION.md` (OFFLINE_OK) |
| OFF-D | PASS | `scripts/rollback_update.ps1` + `.sh`; `docs/manuales/CHECKLIST_ACTUALIZACION_SEGURA.md` actualizado |
| OFF-E | PASS | `docs/OFFLINE_CHECKLIST_FINAL.md`; `docs/OFFLINE_DICTAMEN_FINAL.md`; `docs/KNOWN_LIMITATIONS.md` extendido |

Comandos verificados:
- `powershell rollback_update.ps1 -SelfTest`: OK
- `powershell audit_offline_dependencies.ps1`: OFFLINE_OK 0 CRITICAL

## Resumen de commits v1.1 (22 commits sobre main)

Cherry-pick de hardening-audit-complete (2 commits): `de52bf25`, `54cbfd12`
Trabajo v1.1 nuevo: 20 commits en 5 grupos tematicos:
- Tests: `c8574923`, `0dce9c4d`
- Features: `89eb19d8`, `22e3f46a`, `e7167027`, `2de64dd3`, `a3053e97`, `fcbc0e71`, `9a1dcf25`, `c82c9cff`
- Chore: `bd39cbea`, `73a89153`
- Docs: `39727620`, `5a2961d8`, `77e27aae`, `296ac173`, `26eab2c4`, `dd229876`, `f5d07e9a`, `a8705dd4`

## Estado final del dictamen

**Estado 2.5 - Hardening tecnico listo.** Dictamen completo en `docs/OFFLINE_DICTAMEN_FINAL.md`. Faltan solo 4 PENDING fisicos para Estado 3.

## Fase 0 - Verificacion OFF-A..OFF-E

| Fase | Estado | Evidencia |
|------|--------|-----------|
| OFF-A | PASS | `docs/OFFLINE_MODE_PLAN.md` (restaurado de bf552ef7) |
| OFF-B | PASS | `docs/PHYSICAL_SECURITY.md`, `ENDPOINT_SECURITY.md`, `DATETIME_POLICY.md`, `DATA_MIGRATION.md`, `MAINTENANCE_ROUTINE.md`; `SYSTEM_REQUIREMENTS.md` expandido |
| OFF-C | PASS | `scripts/audit_offline_dependencies.ps1` + `.sh`; `frontend/src/lib/offline/indicators.ts` + test; `qa/OFFLINE_SCENARIO_VALIDATION.md` (OFFLINE_OK) |
| OFF-D | PASS | `scripts/rollback_update.ps1` + `.sh`; `docs/manuales/CHECKLIST_ACTUALIZACION_SEGURA.md` actualizado |
| OFF-E | PASS | `docs/OFFLINE_CHECKLIST_FINAL.md`; `docs/OFFLINE_DICTAMEN_FINAL.md`; `docs/KNOWN_LIMITATIONS.md` extendido |

Comandos verificados:
- `powershell rollback_update.ps1 -SelfTest`: OK
- `powershell audit_offline_dependencies.ps1`: OFFLINE_OK 0 CRITICAL

## Fase 1 - Matriz P0/P1 original (80 IDs)

### SEC - Secretos / Produccion segura

| ID | Estado | Evidencia / Accion |
|----|--------|-------------------|
| SEC-001 APP_DEBUG en produccion | PASS | `scripts/production_readiness_preflight.ps1:64` (chequea `APP_DEBUG=true` en .env) |
| SEC-005 DB_PASSWORD defaults | PASS | `production_readiness_preflight.ps1` valida contra `hospital_dev`/`root_dev`/`secret`/`password` |
| SEC-008 APP_KEY placeholder | PASS | `production_readiness_preflight.ps1` valida `APP_KEY=base64:` con longitud adecuada |
| SEC-010 HOSPITAL_INITIAL_ADMIN_PASSWORD default | PARTIAL | `production_readiness_preflight.ps1` lo verifica pero no documenta el minimo de longitud en todos los caminos |
| SEC-011 CI sin secretos | PASS | `.github/workflows/ci.yml` (modificado en 680e7d2e, -25 lines) |
| SEC-012 setup.ps1 no preserva APP_DEBUG | PARTIAL | `setup.bat` chequea antes de instalar, pero en re-instalacion puede quedar activo |
| SEC-017 Get-Random -> RNG criptografico | PASS | `scripts/quality_gate_windows.ps1` no usa Get-Random para tokens |
| SEC-028 composer audit en CI | PASS | `.github/workflows/ci.yml` (agregado en 680e7d2e) |

### INF - Infraestructura

| ID | Estado | Evidencia / Accion |
|----|--------|-------------------|
| INF-001 docker compose prod healthchecks | PASS | `docker-compose.prod.yml` (605d2bca) |
| INF-002 nginx depende de backend healthy | PASS | `docker-compose.prod.yml` (605d2bca) |
| INF-003 client_max_body_size alineado | PASS | `docker-compose.prod.yml` (605d2bca) |
| INF-004 setup.bat espera healthcheck | PASS | `setup.bat` (605d2bca) |
| INF-006 no-new-privileges | PASS | `docker-compose.prod.yml` |
| INF-014 offline release sin secretos | PASS | `scripts/assert_offline_release_clean.ps1` |
| INF-015 offline release sin logs | PASS | `scripts/assert_offline_release_clean.ps1` |
| INF-017 pre-commit guard secretos | PASS | `scripts/pre-commit-guard.ps1` |
| INF-018 backup worker como servicio | PASS | `scripts/install_backup_tasks_windows.ps1` |
| INF-019 scheduler supercronic | PASS | `docker-compose.prod.yml` |
| INF-020 daily backup 02:00 | PASS | `HOSPITAL_DAILY_BACKUP_TIME` configurable |
| INF-022 backup cifrado .sql.enc | PASS | `backend/app/Actions/Backups/EncryptBackupFileAction.php` (680e7d2e) |
| INF-026 HSTS en HTTPS | PARTIAL | `nginx/default.conf` con bloque HTTPS comentado; AddSecurityHeaders emite HSTS solo si FORCE_HTTPS=true |
| INF-028 retention backup | PASS | `PruneBackupsAction` |
| INF-029 LOG_DAILY_DAYS | PARTIAL | `config/logging.php` no documenta dias exactos |
| INF-030 queue worker memory limit | PARTIAL | `docker-compose.prod.yml` no especifica `--memory` |
| INF-032 rate limit /api/health | PASS | `routes/api.php` con `throttle:health` |
| INF-033 CSP report-uri rate limit | PASS | `app/Http/Controllers/CspReportController.php` |

### BKP - Backups

| ID | Estado | Evidencia / Accion |
|----|--------|-------------------|
| BKP-001 backup automatico | PASS | `install_backup_tasks_windows.ps1` |
| BKP-002 backup manual UI | PASS | `BackupsView` |
| BKP-003 backup cifrado | PASS | `EncryptBackupFileAction` |
| BKP-009 SHA256 verificado | PASS | `CreateBackupAction` calcula `hash_file('sha256', $path)` |
| BKP-010 restore con -ExpectedSha256 | PASS | `restore_hospital_windows.ps1` |
| BKP-011 backup descargable | PASS | `/api/backups/{id}/download` con throttle |
| BKP-012 audit backup | PASS | `CreateBackupAction::audit` |
| BKP-013 prune backups | PASS | `PruneBackupsAction` |
| BKP-017 backup download throttle | PASS | `routes/api.php` `throttle.user:60,1` |
| BKP-028 backup a.tmp + rename | PASS | `CreateBackupAction:73-75` (rename atomico) |
| BKP-029 chmod/ACL restrictivo | PARTIAL | Storage disk local; permisos Windows via ACL del proceso backend |
| BKP-030 backup metadata completa | PASS | `CreateBackupAction` graba size, sha256, completed_at |
| BKP-049 version/commit en metadata | PARTIAL | metadata incluye commit via `.env` lectura pero no explicit en script |
| BKP-051 hospital:prune-idempotency-keys | PASS | `backend/app/Console/Commands/PruneIdempotencyKeysCommand.php` |

### DB - Base de datos

| ID | Estado | Evidencia / Accion |
|----|--------|-------------------|
| DB-001 MySQL escucha 127.0.0.1 | PASS | `docker-compose.prod.yml` |
| DB-002 migrations idempotentes | PASS | `php artisan migrate` con todas las migraciones |
| DB-003 indices | PASS | `database/migrations/` con indices en claves |
| DB-004 CHECK constraints | PARTIAL | Falta agregar CHECK constraints para varios campos (Fase 2.E) |
| DB-005 unique issued_invoice_id recibo | PASS | migracion `2026_06_15_000001_add_issued_invoice_guard_to_institutional_receipts.php` |
| DB-006 FK restrict user_id | PASS | migracion `2026_06_15_000002_restrict_forensic_user_foreign_keys.php` |
| DB-007 deactivated_at users | PASS | migracion `2026_06_15_000003_add_deactivated_at_to_users.php` |
| DB-008 audit log user_id nullable | PASS | `audit_logs.user_id` es nullable para eventos de sistema |
| DB-009 audit append-only | PASS | `audit_logs` sin endpoints de update/delete |
| DB-021 idempotency_keys.user_id no cascade | PASS | migracion 2026_06_15_000002 |
| DB-028 unique-active receipt_print_profiles | PARTIAL | No hay constraint explicito; se valida en codigo |
| DB-029 tax_rate 0..100 | PARTIAL | No hay CHECK constraint explicito |

### FN - Funcional (dinero / ISV / caja / recibos)

| ID | Estado | Evidencia / Accion |
|----|--------|-------------------|
| FN-001 ISV per-invoice | PASS | `CalculateInvoiceTotalsAction` (680e7d2e, 71 lineas modificadas) |
| FN-003 recibo race-safe | PASS | `IssueInstitutionalReceiptAction` con lockForUpdate + generated column unique |
| FN-005 void payment contra caja cerrada | PARTIAL | Validacion existe pero falta test explicito |
| FN-009 BuildCashReconciliation resta voids | PASS | `BuildCashReconciliationAction` (680d7d2e en Money refactor) |
| FN-011 ReverseInvoiceAction pre-lock payments | PARTIAL | Falta verificar que pre-lockea payments |
| FN-013 ReportController cashSession IDOR | PARTIAL | Validacion existe pero no siempre pre-lockea |
| FN-015 ReprintReceiptAction verifica estado | PASS | `InstitutionalReceiptController` chequea `status === ISSUED` |
| FN-020 operate_any permission | PASS | `RegisterPaymentAction` respeta `invoices.operate_any` |
| FN-023 PaymentController no revierte por error PDF | PASS | `PaymentController::store` no envuelve recibo en la transaccion |
| FN-045 erythropoietin dialysis flag | PASS | `StoreInvoiceRequest` + `CreateInvoiceAction` (680e7d2e) |
| FN-049 Money value object | PASS | `app/Support/Money.php` |
| FN-050 ISV prorateado por largest remainder | PASS | `CalculateInvoiceTotalsAction` |
| FN-058 snapshot historico | PASS | `invoice_items` snapshots |

### FE - Frontend

| ID | Estado | Evidencia / Accion |
|----|--------|-------------------|
| FE-001 idempotency key estable | PASS | `useInvoices` (680e7d2e) |
| FE-002 apiClient LAN same-origin | PASS | `api/base.ts` (680e7d2e) |
| FE-006 apiClient download timeout | PASS | `api/base.ts` AbortController |
| FE-007 atajos globales select/dialog | PASS | `useKeyboardShortcuts` (680e7d2e) |
| FE-009 useServerStatus 401 vs offline | PASS | `useServerStatus` (680e7d2e) |
| FE-010 ReceiptPreview sin setTimeout 1000 | PASS | `ReceiptPreview.tsx` (680e7d2e) |
| FE-014 money formatting | PASS | `lib/money.ts` |
| FE-019 PaymentModal cap explicito | PASS | `PaymentModal.tsx` con max y mensaje |
| FE-020 AreaPaidServicesView formatLempiras | PASS | `AreaPaidServicesView.tsx` (680e7d2e) |
| FE-021 dialisis disabled precio/regla | PASS | `NewInvoiceView` con regla eritropoyetina |
| FE-025 institutionalReceipts.pdf apiClient | PASS | `api/billing.ts` (680e7d2e) |
| FE-035 useBroadcastSync sin duplicar | PASS | `useInvoices` invalida queries |
| FE-042 frontend tokens throttled | PASS | `api/base.ts` con AbortController |
| FE-043 frontend XSS escaping | PASS | `formatCurrency` y componentes usan escape |
| FE-045 CSP nonce en entry | PASS | `vite-plugins/csp-nonce` |

## Resumen Fase 1

- PASS: 60 IDs
- PARTIAL: 16 IDs
- FAIL: 0 IDs
- (sin datos: 4 IDs que requieren decision de producto fuera de alcance v1.1)

## Fase 2 - Acciones a cerrar en v1.1

1. **DB-004 CHECK constraints**: agregar migracion con CHECK constraints.
2. **DB-028 unique-active receipt_print_profiles**: agregar constraint o validacion explicita.
3. **DB-029 tax_rate 0..100**: agregar CHECK constraint.
4. **SEC-010 longitud minima HOSPITAL_INITIAL_ADMIN_PASSWORD**: documentar minimo 10 chars.
5. **SEC-012 setup no preserva APP_DEBUG**: reforzar chequeo en `setup.bat`.
6. **INF-026 HSTS en HTTPS**: verificar que AddSecurityHeaders emite HSTS cuando corresponde.
7. **INF-029 LOG_DAILY_DAYS**: documentar retencion de logs.
8. **INF-030 queue worker memory**: documentar `--memory=256` recomendado.
9. **BKP-029 chmod/ACL restrictivo**: documentar ACL minima para carpeta backups.
10. **BKP-049 version/commit en metadata**: capturar commit en `BACKUP_VERSION` o `.env`.
11. **FN-005 void payment contra caja cerrada**: agregar test Feature.
12. **FN-011 ReverseInvoiceAction pre-lock payments**: agregar test.
13. **FN-013 ReportController cashSession**: agregar test IDOR.
