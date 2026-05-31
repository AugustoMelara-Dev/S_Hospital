# Operational Support Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational support layer so Hospital San Isidro staff can diagnose, recover, train, and keep caja running without developer presence.

**Architecture:** Keep business truth in Laravel, expose sanitized operational checks through focused services/resources, and render a role-aware Support Center in React. Installation and recovery remain script-driven, non-destructive, and documented for non-technical operators.

**Tech Stack:** Laravel 12 API, MySQL/MariaDB, React 19 + TypeScript, TanStack Query, existing PowerShell scripts, Playwright, PHPUnit, Vitest.

---

## 1. Resumen Ejecutivo

This front is approved only as a planned, evidence-driven hardening track. No broad refactor starts until each phase is executed and reviewed independently.

The repository already has useful foundations: `SystemStatusController`, `BackupsView` operational cards, `HelpView`, backup scripts, production preflight scripts, manual documents, and prior QA screenshots. The gaps are operational cohesion and safety: support guidance is scattered, diagnostics are hidden under backups, the WPF installer still contains unsafe/destructive installation paths, direct `/about` refresh returns 404, and normal users get generic permission/network messages without next actions or support evidence capture.

## 2. Evidencia Base Leida y Capturada

- Docs/prompts read: `AGENTS.md`, `SYSTEM_REQUIREMENTS.md`, `prompts/00_PLAN_MODE_MASTER_PROMPT.md`, `prompts/01_PLAN_REVIEW_ORCHESTRATOR.md`, required references in `references/`, database schema, backup/install/release/manual docs, and `docs/00_Flujo_Agentic_Codex_Hospital_Billing_OS.docx`.
- System status: `docker compose ps` showed backend, frontend, and MariaDB containers running; MariaDB healthy; backend on `8000`, frontend on `5173`.
- Fresh screenshots and console evidence: `qa/screenshots/ops-hardening-audit-2026-05-31/`.
- Current automated check run: `docker compose exec backend php artisan test --filter=SystemStatusTest --colors=never` passed 6 tests; `npm.cmd run check:branding` passed.
- Captured console/network issues:
  - `GET /about` direct load returned `404` although React has an `/about` route.
  - Some authenticated module requests surfaced `403` console errors with generic UI copy: reports/users screens need clearer role/action messages.
  - Login probe initially produced a 422 invalid-credentials state; subsequent explicit probe succeeded with `admin.demo`, proving the UI needs better recovery wording and the audit script needs robust login diagnostics.
- Code evidence:
  - `scripts/install_hospital_os.ps1` runs `php artisan migrate:fresh --seed --force` in GUI and CLI paths. This is unsafe for installed hospital data.
  - `setup.bat` is closer to safe behavior but still initializes local Docker and depends on development containers.
  - `SystemStatusController` exposes useful data but no dedicated Support Center UI summarizes `Todo bien`, `Requiere revision`, or `Error` with an advanced admin/support detail mode.
  - `HelpView` has basic operational steps but lacks role-specific daily checklists, failure playbooks, and support request guidance.

## 3. Suposiciones Explicitas

- Production remains offline LAN with one server PC and browser clients.
- No destructive database reset is allowed outside disposable local/testing databases with explicit guard flags.
- Demo users and demo seeders are valid only in `local` or `testing`.
- Physical LAN, UPS, printer, and final restore proof cannot be honestly completed from this workstation; they remain physical pending items to document and gate.
- The system may support both institutional paper receipts and legacy 80mm/58mm thermal constraints until product owners explicitly retire one.

## 4. Preguntas Bloqueantes

None block planning. Two decisions must be confirmed before declaring final production ready:

- Whether the installed hospital receipt target is paper letter/half-letter/A5 only, or also 80mm/58mm thermal.
- Whether to build a true isolated practice mode now, or document training with a disposable/demo environment only.

## 5. Arquitectura Propuesta

- Backend:
  - Add focused operational services under `backend/app/Actions/System/` or `backend/app/Support/OperationalStatus/`.
  - Keep `SystemStatusController` thin and sanitize all responses through resources/DTO arrays.
  - Store support/client error events in a small audit table, without secrets, request bodies, stack traces, `.env` values, or local absolute paths.
  - Add idempotency to invoice/payment actions with request-scoped keys, unique DB constraints, and transaction-safe lookup.
- Frontend:
  - Add `SupportCenterView` as the main help/diagnostics/training surface.
  - Use shared components for support guides, status summary, advanced diagnostics, failure playbooks, and role checklists.
  - Keep normal-user diagnostics simple: `Todo bien`, `Requiere revision`, `Error`, with actions.
  - Gate advanced technical details behind admin/support permissions.
- Scripts:
  - Replace destructive installer steps with safe migrate-only flows and preflight validation.
  - Add a safe repair script that checks services, starts containers/services, waits for backend, opens the browser, and writes a diagnostic bundle.

## 6. Modelo de Datos y Migraciones

- Phase 1: no migrations.
- Phase 2: no migrations unless version metadata is stored in DB; prefer file/config first.
- Phase 3: no migrations.
- Phase 4: create `client_error_logs` with sanitized fields:
  - `id`, `user_id nullable`, `event_type`, `severity`, `safe_message`, `technical_code nullable`, `route nullable`, `status_code nullable`, `context_json nullable`, `occurred_at`, timestamps.
  - Indexes: `(occurred_at)`, `(severity, occurred_at)`, `(user_id, occurred_at)`.
- Phase 5: add idempotency support:
  - Preferred: `operation_idempotency_keys` table with `key`, `user_id`, `operation`, `resource_type`, `resource_id`, `request_hash`, timestamps, unique `(operation, key)`.
  - Avoid changing historical invoices/payments unless needed.
- Phase 6-8: no migrations expected.

## 7. Fases

### Fase 0 - Auditoria Base y Contrato de Ejecucion

**Alcance:** Preserve evidence, document current gaps, and prepare implementation without touching product code.

**Archivos esperados:**
- Create: `docs/superpowers/plans/2026-05-31-operational-support-hardening.md`
- Generated evidence: `qa/screenshots/ops-hardening-audit-2026-05-31/*`

**Migraciones:** none.

**Pruebas/comandos:**
- `docker compose ps`
- `docker compose exec backend php artisan test --filter=SystemStatusTest --colors=never`
- `npm.cmd run check:branding`

**Riesgos:** Evidence scripts may mutate screenshots; do not reset DB or create fake physical proof.

**Aceptacion:** Plan exists, evidence paths are named, blockers are explicit, and implementation waits for approval.

### Fase 1 - Instalador y Reparacion Segura

**Alcance:** Remove destructive install paths and add a safe repair script for non-technical recovery.

**Archivos esperados:**
- Modify: `setup.bat`
- Modify: `scripts/install_hospital_os.ps1`
- Modify: `scripts/start_hospital_services.ps1`
- Modify: `scripts/open_hospital_system.ps1`
- Create: `scripts/repair_hospital_system.ps1`
- Create: `scripts/validate_installer_safety.ps1`
- Modify: `docs/OFFLINE_LAN_INSTALL.md`
- Modify: `docs/manuales/GUIA_INSTALACION_OPERATIVA.md`
- Modify: `docs/DECISIONS.md`

**Migraciones:** none.

**Pruebas/comandos:**
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_installer_safety.ps1`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/repair_hospital_system.ps1 -WhatIf`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:8000 -AllowMissingPhysicalProof`

**Riesgos:** Accidentally preserving `migrate:fresh`, `db:wipe`, or demo seeders in production path.

**Aceptacion:** Production installer never runs `migrate:fresh`, never deletes volumes, never seeds demo users, writes readable logs, and documents how to repair startup.

### Fase 2 - Diagnostico Operativo Backend

**Alcance:** Convert `SystemStatusController` into a safer, clearer diagnostics API with normal and advanced detail levels.

**Archivos esperados:**
- Modify: `backend/app/Http/Controllers/SystemStatusController.php`
- Create: `backend/app/Actions/System/BuildOperationalStatusAction.php`
- Create: `backend/app/Support/System/OperationalCheck.php`
- Modify: `backend/routes/api.php`
- Modify/Test: `backend/tests/Feature/SystemStatusTest.php`

**Migraciones:** none.

**Pruebas/comandos:**
- `docker compose exec backend php artisan test --filter=SystemStatusTest --colors=never`
- `docker compose exec backend php artisan test --filter=BackupWorkflowTest --colors=never`
- `docker compose exec backend php artisan test --filter=AuthTest --colors=never`

**Riesgos:** Leaking paths, env names, command lines, or secrets to normal users.

**Aceptacion:** API reports backend, database, frontend build, last backup, queue/jobs, system time, disk space, LAN access status, installed version, and severity summary without secrets.

### Fase 3 - Centro de Soporte y Ayuda Institucional

**Alcance:** Create a visible support/help section with role-aware guides and diagnostic summary.

**Archivos esperados:**
- Create: `frontend/src/features/support/SupportCenterView.tsx`
- Create: `frontend/src/features/support/components/OperationalStatusSummary.tsx`
- Create: `frontend/src/features/support/components/SupportPlaybookList.tsx`
- Create: `frontend/src/features/support/components/RoleChecklist.tsx`
- Modify: `frontend/src/AppRoutes.tsx`
- Modify: `frontend/src/layout/Sidebar.tsx`
- Modify: `frontend/src/lib/api/system.ts`
- Modify/Test: `frontend/src/App.test.tsx`

**Migraciones:** none.

**Pruebas/comandos:**
- `npm.cmd run typecheck`
- `npm.cmd run test -- App.test.tsx`
- `npm.cmd run build`
- Fresh screenshots for `/help` or `/support`.

**Riesgos:** Adding a decorative help page instead of a practical support workflow.

**Aceptacion:** Staff can see how to open the system, log in, open caja, invoice, print, close caja, back up, and request support. Admin/support can expand advanced details.

### Fase 4 - Mensajes Humanos y Bitacora de Problemas

**Alcance:** Normalize user-facing error messages and capture sanitized technical evidence for support.

**Archivos esperados:**
- Modify: `frontend/src/lib/api/base.ts`
- Create: `frontend/src/lib/support/errorCatalog.ts`
- Create: `frontend/src/lib/support/clientIssueLogger.ts`
- Modify: `frontend/src/components/AppErrorBoundary.tsx`
- Create migration: `backend/database/migrations/*_create_client_error_logs_table.php`
- Create model/controller/request as needed: `ClientErrorLog`
- Modify: `backend/routes/api.php`
- Create/Test: `backend/tests/Feature/ClientErrorLogTest.php`
- Create/Test: `frontend/src/lib/support/errorCatalog.test.ts`

**Migraciones:** yes, additive.

**Pruebas/comandos:**
- `docker compose exec backend php artisan test --filter=ClientErrorLogTest --colors=never`
- `npm.cmd run test -- errorCatalog`
- Browser smoke for server unavailable, 403, 419, backup failed, and caja closed states.

**Riesgos:** Logging secrets, patient names, passwords, request bodies, or stack traces.

**Aceptacion:** Normal users see what happened and what to do; support can later inspect sanitized issue records.

### Fase 5 - Resiliencia de Factura, Pago y Recarga

**Alcance:** Reduce duplicate invoices/payments from double click, refresh, or LAN lag.

**Archivos esperados:**
- Modify: `backend/app/Actions/Billing/CreateInvoiceAction.php`
- Modify: `backend/app/Actions/Payments/RegisterPaymentAction.php`
- Modify requests/controllers for idempotency key handling.
- Create migration for idempotency keys.
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.tsx`
- Modify/Test: `backend/tests/Feature/BillingWorkflowTest.php` or create focused idempotency tests.
- Modify/Test: `frontend/src/features/invoices/NewInvoiceView.test.tsx`

**Migraciones:** yes, additive unique key table.

**Pruebas/comandos:**
- `docker compose exec backend php artisan test --filter=Invoice --colors=never`
- `docker compose exec backend php artisan test --filter=Payment --colors=never`
- `npm.cmd run test -- NewInvoiceView`
- Existing or new Playwright double-submit smoke.

**Riesgos:** Breaking transaction flow or fiscal sequence locking.

**Aceptacion:** Repeated submit with same idempotency key returns the same result or a safe conflict; no duplicate invoice/payment is created.

### Fase 6 - Capacitacion por Rol y Manuales No Tecnicos

**Alcance:** Make training part of the product and docs.

**Archivos esperados:**
- Modify: `frontend/src/features/support/SupportCenterView.tsx`
- Create: `frontend/src/features/support/trainingContent.ts`
- Modify: `docs/manuales/MANUAL_CAJERO.md`
- Modify: `docs/manuales/MANUAL_ADMINISTRADOR.md`
- Modify: `docs/manuales/CHECKLIST_CAPACITACION.md`
- Modify: `docs/TRAINING_CAJERO.md`
- Modify: `docs/TRAINING_ADMIN.md`

**Migraciones:** none.

**Pruebas/comandos:**
- `npm.cmd run test`
- `npm.cmd run build`
- Manual screenshot pass for cajero, supervisor/admin guidance.

**Riesgos:** Training text that tells staff to use demo data in production.

**Aceptacion:** Cajero, supervisor, and admin each have short instructions, daily checklist, warnings before delicate actions, and safe training guidance. If no true practice mode exists, docs say exactly how to train without touching real data.

### Fase 7 - Arranque, Backup, Restore y Smoke Final

**Alcance:** Run final non-destructive quality gates and document physical pending items honestly.

**Archivos esperados:**
- Modify: `qa/HOSPITAL_SAN_ISIDRO_OPS_HARDENING_GATE_2026-05-31.md`
- Modify: `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` only with true current results.
- No fake physical proof files.

**Migraciones:** run `php artisan migrate --force` only after backup in controlled environment; never `migrate:fresh` against active DB.

**Pruebas/comandos:**
- `docker compose exec backend composer validate`
- `docker compose exec backend php artisan test --colors=never`
- `docker compose exec backend vendor/bin/pint --test`
- `npm.cmd run check:branding`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- `npm.cmd run e2e`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/validate_installer_safety.ps1`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:8000 -AllowMissingPhysicalProof`

**Riesgos:** E2E or restore needing environment setup; physical hardware cannot be simulated honestly.

**Aceptacion:** Quality gates are recorded with pass/fail, screenshots before/after are linked, and physical risks remain explicit.

## 8. Plan de Commits

1. `docs(ops): capture operational hardening plan`
2. `fix(install): remove destructive production setup paths`
3. `feat(system): expose sanitized operational diagnostics`
4. `feat(support): add institutional support center`
5. `feat(support): log sanitized client issues`
6. `fix(billing): prevent duplicate invoice and payment submits`
7. `docs(training): add role checklists and recovery manuals`
8. `test(release): record operational hardening gate`

## 9. Revision del Plan con 8 Subagentes

**Decision:** APROBADO CON CAMBIOS, cambios integrados arriba.

| Subagente | Severidad | Hallazgo | Evidencia | Correccion integrada |
|---|---:|---|---|---|
| Arquitectura | ALTA | El soporte no debe mezclarse dentro de `BackupsView` solamente. | Diagnostico actual vive mayormente en respaldos. | Fase 2 crea servicio backend; Fase 3 crea Support Center. |
| DB/integridad | BLOQUEANTE | Duplicados por doble submit deben tratarse antes de cierre del frente. | Meta exige no duplicar facturas/pagos. | Fase 5 agrega idempotencia transaccional. |
| Seguridad/permisos | ALTA | Diagnostico avanzado puede exponer rutas/comandos. | API actual incluye comandos y metadatos runtime. | Fase 2 divide normal vs avanzado y sanitiza. |
| UI/UX caja | ALTA | Help actual es demasiado general para fallos reales. | `HelpView` no cubre servidor caido, impresora, permisos, red, sesion. | Fase 3 y 4 agregan playbooks y mensajes. |
| Rendimiento LAN | MEDIA | Diagnosticos no deben bloquear pantallas principales. | Backups/status cargan junto a una vista pesada. | Fase 3 usa carga separada y resumen. |
| Offline/instalacion | BLOQUEANTE | Instalador WPF usa `migrate:fresh --seed --force`. | `scripts/install_hospital_os.ps1`. | Fase 1 es primera fase de codigo. |
| Pruebas/QA | ALTA | Falta gate específico para seguridad del instalador. | No existe `validate_installer_safety.ps1`. | Fase 1 lo agrega. |
| Dominio/fiscal | MEDIA | Receipt target está dividido entre institucional papel y 80/58mm. | `SYSTEM_REQUIREMENTS.md` vs docs recientes. | Mantener compatibilidad hasta decisión explícita. |

## 10. Checklist de Entrada a Implementacion

- [ ] User approves this plan or selects the first phase to execute.
- [ ] Do not reset data, delete `.env`, push, or fake physical proof.
- [ ] Before migrations in Phase 4/5, create or confirm a local backup.
- [ ] Execute one phase at a time.
- [ ] Run phase tests and local quality gate.
- [ ] Commit per phase with Conventional Commits.
- [ ] Run `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md` mentally/with evidence against each diff.
- [ ] Document important decisions in `docs/DECISIONS.md`.
