# S_Hospital documentation index

This is the top-level entry point for the S_Hospital documentation.
Every doc in `docs/` is referenced from here. New readers should
start at **[OFFLINE_LAN_INSTALL.md](OFFLINE_LAN_INSTALL.md)** for
deployment, then jump to the appropriate section below.

## Start here

- **[OFFLINE_LAN_INSTALL.md](OFFLINE_LAN_INSTALL.md)** - Full LAN
  install runbook (static IP, firewall, docker compose, scheduler,
  health checks, printer install, validation checklist).
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Symptom →
  cause → fix for the recurring operator failures (port 8000 in
  use, "sesión vencida", "el servidor LAN no pudo completar la
  operación", backup pending forever, etc).
- **[SECRETS.md](SECRETS.md)** - APP_KEY, DB_PASSWORD, the
  pre-commit guard, the rotation log.
- **[CI.md](CI.md)** - What the GitHub Actions workflow checks and
  the local equivalent.

## Operations (runbooks)

- **[BACKUP_RESTORE.md](BACKUP_RESTORE.md)** - Daily backup policy,
  retention, restore steps, validation.
- **[DISASTER_RECOVERY.md](DISASTER_RECOVERY.md)** - 10 disaster
  scenarios and the recovery runbook.
- **[DAILY_CLOSE_PROTOCOL.md](DAILY_CLOSE_PROTOCOL.md)** - End-of-day
  close checklist.
- **[HTTPS_OPTIONAL.md](HTTPS_OPTIONAL.md)** - Optional self-signed
  CA + TLS termination in nginx.

## Product

- **[01_FINAL_PRODUCT_REQUIREMENTS.md](01_FINAL_PRODUCT_REQUIREMENTS.md)** -
  What the system does, scope, non-goals.
- **[02_UI_ARCHITECTURE.md](02_UI_ARCHITECTURE.md)** - React feature
  layout, design tokens, accessibility rules.
- **[03_POS_BILLING_UX_SPEC.md](03_POS_BILLING_UX_SPEC.md)** - The
  cashier POS flow (open box, scan, pay, print, close).
- **[04_ADVANCED_REPORTS_SPEC.md](04_ADVANCED_REPORTS_SPEC.md)** -
  Reports catalog.
- **[05_DESIGN_SYSTEM_AND_LIBRARIES.md](05_DESIGN_SYSTEM_AND_LIBRARIES.md)** -
  Tailwind/shadcn tokens, allowed libraries.
- **[06_BARCODE_QR_WORKFLOW.md](06_BARCODE_QR_WORKFLOW.md)** -
  Scanner-driven service entry.
- **[07_FINAL_PHASES_ROADMAP.md](07_FINAL_PHASES_ROADMAP.md)** -
  Phase-by-phase roadmap (historical; current state in
  AUDIT_2026_06_02.md and KNOWN_LIMITATIONS.md).
- **[08_CRITICAL_ACCEPTANCE_CRITERIA.md](08_CRITICAL_ACCEPTANCE_CRITERIA.md)** -
  Acceptance criteria per release.
- **[09_FINAL_EXECUTION_PACK_INDEX.md](09_FINAL_EXECUTION_PACK_INDEX.md)** -
  Phase 12 documentation index.
- **[12_CORRECTED_FINAL_PRODUCT_PLAN.md](12_CORRECTED_FINAL_PRODUCT_PLAN.md)** -
  Phase 12 corrected plan.

## Architecture

- **[API_CONTRACTS.md](API_CONTRACTS.md)** - Every endpoint, request
  shape, response shape, permission.
- **[FISCAL_RULES.md](FISCAL_RULES.md)** - CAI, RTN, correlativo,
  paper sizes, voiding, payment reversal.
- **[PERMISSIONS_MATRIX.md](PERMISSIONS_MATRIX.md)** - Roles ×
  actions, 24 module/action combinations.
- **[references/](../references/)** - Engineering reference docs
  used by the prompts/ subagents.
- **[prompts/](../prompts/)** - Plan-mode, plan-review, and
  commit-review orchestrator prompts.

## Engineering

- **[DECISIONS.md](DECISIONS.md)** - Architecture and business
  decision log (chronological).
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Historical
  11-phase plan; superseded by AUDIT_2026_06_02.md and
  KNOWN_LIMITATIONS.md.
- **[AUDIT_2026_06_02.md](AUDIT_2026_06_02.md)** - The current
  baseline audit (v1.0.0-rc.3) plus the 20-phase plan to v1.0.0
  production-ready.
- **[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)** - What is closed
  in v1.0.0, what is deferred to v1.1, what needs physical
  hardware (FASE G).
- **[OPERATIVE_NOTES_2026_06_02.md](OPERATIVE_NOTES_2026_06_02.md)** -
  Current release snapshot (v1.0.0) with the CRITICAL and
  audit items closed in this branch.
- **[LOCAL_VALIDATION_SCRIPT.md](LOCAL_VALIDATION_SCRIPT.md)** -
  Local validation script for the 5 receipt paper sizes.
- **[OPERATIVE_VALIDATION_FLOW.md](OPERATIVE_VALIDATION_FLOW.md)** -
  End-to-end operator validation runbook.
- **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** - 267-line
  release validation checklist.
- **[INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md](INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md)** -
  Receipt print validation.

## Operator training (Spanish)

Under `manuales/`:

- **[manuales/INDICE_OPERADOR.md](manuales/INDICE_OPERADOR.md)** -
  Master operator index v1.0.0.
- **[manuales/MANUAL_CAJERO.md](manuales/MANUAL_CAJERO.md)** -
  Cashier manual.
- **[manuales/MANUAL_SUPERVISOR.md](manuales/MANUAL_SUPERVISOR.md)** -
  Supervisor manual.
- **[manuales/MANUAL_ADMINISTRADOR.md](manuales/MANUAL_ADMINISTRADOR.md)** -
  Administrator manual.
- **[manuales/GUIA_INSTALACION_OPERATIVA.md](manuales/GUIA_INSTALACION_OPERATIVA.md)** -
  Operational installation guide.
- **[manuales/GUIA_RESPALDOS_Y_RESTAURACION.md](manuales/GUIA_RESPALDOS_Y_RESTAURACION.md)** -
  Backup & restore operator guide.
- **[manuales/GUIA_SOPORTE_PRIMER_NIVEL.md](manuales/GUIA_SOPORTE_PRIMER_NIVEL.md)** -
  First-line support guide.
- **[manuales/GUIA_CAPACITACION_SEGURA.md](manuales/GUIA_CAPACITACION_SEGURA.md)** -
  Safe training guide.
- **[manuales/CHECKLIST_CAPACITACION.md](manuales/CHECKLIST_CAPACITACION.md)** -
  Training checklist.

The legacy `docs/Manual_Usuario.md` and `docs/Manual_Usuario.html`
at the repo root are superseded by the `manuales/` set and
should be removed in v1.1. They are retained for now so that any
old printed handouts still resolve.

## Quality evidence

Under `qa/`:

- **[qa/FINAL_PRODUCTION_HANDOFF_RESULT.md](../qa/FINAL_PRODUCTION_HANDOFF_RESULT.md)** -
  the final handoff doc. Current expected state is `PRODUCTION_READY=NO`
  until selected-mode browser, printer, restore, concurrency, backup-worker,
  production-env and offline-package evidence is complete.
- **[qa/FINAL_RESTORE_PROOF.md](../qa/FINAL_RESTORE_PROOF.md)** -
  restore evidence (PENDING until physical hardware).
- **[qa/FINAL_CONCURRENCY_PROOF.md](../qa/FINAL_CONCURRENCY_PROOF.md)** -
  concurrency evidence (PENDING).
- **[qa/LOCAL_SERVER_VALIDATION_PROOF.md](../qa/LOCAL_SERVER_VALIDATION_PROOF.md)** -
  local single-machine browser evidence when `APP_URL` is loopback (PENDING).
- **[qa/LAN_CLIENT_VALIDATION_PROOF.md](../qa/LAN_CLIENT_VALIDATION_PROOF.md)** -
  second-client LAN validation evidence for multi-PC deployments (PENDING).
- **[qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md](../qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md)** -
  printer evidence (PENDING).

The preflight script in `scripts/production_readiness_preflight.ps1`
fails the release if the required PROOF files for the selected mode are still
PENDING. Single-machine mode requires local browser evidence; multi-PC LAN mode requires second-client LAN evidence.

## Script inventory

`scripts/` contains the PowerShell and bash scripts. The
authoritative list is `package_manifest.json` at the repo root.
Most-relevant new and hardened scripts in v1.0.0:

- `scripts/deploy_hospital_lan.ps1` - the production installer.
- `scripts/restore_hospital_windows.ps1` - the production restore.
- `scripts/install_backup_tasks_windows.ps1` - registers the
  daily backup and queue worker as Windows scheduled tasks.
- `scripts/register_scheduler_cron.ps1` - registers the Laravel
  scheduler as a Windows scheduled task.
- `scripts/pre-commit-guard.ps1` - the secret-leak guard
  (see [SECRETS.md](SECRETS.md) for what it blocks).
- `scripts/quality_gate.sh` - the local equivalent of the CI
  pipeline (PHPUnit + Pint + PHPStan + Vitest + typecheck + build).
