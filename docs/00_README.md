# S_Hospital documentation index

> **Nota 2026-09-17 (M-W1-REL-02).** La fuente canonica vigente de estado es
> [`../reports/CURRENT_RELEASE_TRUTH.md`](../reports/CURRENT_RELEASE_TRUTH.md)
> (refrescada con los hechos verificados de wave 2; su estado T2 anterior queda
> conservado bajo "Historico"). El handoff autocontenido de la campana vigente es
> [`../HANDOFF_ACTUAL_CHATGPT.md`](../HANDOFF_ACTUAL_CHATGPT.md) (incluye el
> procedimiento de congelacion en su seccion 17). La matriz §20 vigente es
> [`../hospital-ai/progreso/MATRIZ_ACEPTACION.md`](../hospital-ai/progreso/MATRIZ_ACEPTACION.md)
> y el tablero es
> [`../hospital-ai/progreso/TABLERO_MANDATO.md`](../hospital-ai/progreso/TABLERO_MANDATO.md).
>
> **Nota 2026-09-13 (T2-006).** Este indice cubre varias etapas del proyecto.
> Los documentos que ya no existen en el arbol actual se conservan listados y
> marcados como historicos o superseded para no perder trazabilidad.
>
> Documentos vigentes del paquete (los enlaces existen; cada archivo marca sus
> secciones historicas). No implica que todo su contenido este verificado:
>
> - [../README.md](../README.md) - alcance, desarrollo y operacion.
> - [OFFLINE_LAN_INSTALL.md](OFFLINE_LAN_INSTALL.md) - instalacion LAN (los
>   comandos de validacion de fase 11 estan marcados como historicos; usar los
>   helpers vigentes).
> - [GENERAR_INSTALADOR_WINDOWS.md](GENERAR_INSTALADOR_WINDOWS.md) - build del
>   instalador y entrega en USB.
> - [BACKUP_RESTORE.md](BACKUP_RESTORE.md) - respaldos, retencion y restore.
> - [SAFE_UPDATE_ROLLBACK.md](SAFE_UPDATE_ROLLBACK.md) - actualizacion y rollback.
> - [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) - escenarios de recuperacion.
> - [HTTPS_OPTIONAL.md](HTTPS_OPTIONAL.md) - modo TLS/WSS opt-in.
> - [CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md](CAMPANA_2026-09-13_DECISIONES_Y_DEUDA.md) -
>   decisiones canonicas y deuda diferida de la campana.

## Start here

- **[OFFLINE_LAN_INSTALL.md](OFFLINE_LAN_INSTALL.md)** - Full LAN
  install runbook (static IP, firewall, docker compose, scheduler,
  health checks, printer install, validation checklist).
- **TROUBLESHOOTING.md** _(historico; no incluido en este arbol)_ - Symptom →
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
- **DAILY_CLOSE_PROTOCOL.md** _(historico; no incluido en este arbol)_ -
  End-of-day close checklist.
- **[HTTPS_OPTIONAL.md](HTTPS_OPTIONAL.md)** - Optional self-signed
  CA + TLS termination in nginx.
- **[SAFE_UPDATE_ROLLBACK.md](SAFE_UPDATE_ROLLBACK.md)** - Update and
  rollback procedure aligned with the Docker package.

## Product

Los documentos de producto `01` a `12` pertenecian a la planificacion inicial y
no estan incluidos en este arbol; el alcance vigente es el de `AGENTS.md`,
`README.md` y `reports/CURRENT_RELEASE_TRUTH.md`.

- **01_FINAL_PRODUCT_REQUIREMENTS.md** _(historico; superseded)_ -
  What the system does, scope, non-goals.
- **02_UI_ARCHITECTURE.md** _(historico; superseded)_ - React feature
  layout, design tokens, accessibility rules.
- **03_POS_BILLING_UX_SPEC.md** _(historico; superseded)_ - The
  cashier POS flow (open box, scan, pay, print, close).
- **04_ADVANCED_REPORTS_SPEC.md** _(historico; superseded)_ -
  Reports catalog.
- **05_DESIGN_SYSTEM_AND_LIBRARIES.md** _(historico; superseded)_ -
  Tailwind/shadcn tokens, allowed libraries.
- **06_BARCODE_QR_WORKFLOW.md** _(historico; superseded)_ -
  Scanner-driven service entry.
- **07_FINAL_PHASES_ROADMAP.md** _(historico; superseded)_ -
  Phase-by-phase roadmap; current state lives in
  `reports/CURRENT_RELEASE_TRUTH.md`.
- **08_CRITICAL_ACCEPTANCE_CRITERIA.md** _(historico; superseded)_ -
  Acceptance criteria per release.
- **09_FINAL_EXECUTION_PACK_INDEX.md** _(historico; superseded)_ -
  Phase 12 documentation index.
- **12_CORRECTED_FINAL_PRODUCT_PLAN.md** _(historico; superseded)_ -
  Phase 12 corrected plan.

## Architecture

- **[API_CONTRACTS.md](API_CONTRACTS.md)** - Every endpoint, request
  shape, response shape, permission.
- **[FISCAL_RULES.md](FISCAL_RULES.md)** - CAI, RTN, correlativo,
  paper sizes, voiding, payment reversal.
- **PERMISSIONS_MATRIX.md** _(historico; no incluido en este arbol)_ -
  Roles × actions, 24 module/action combinations.
- **references/** _(historico; no incluido en este arbol)_ - Engineering
  reference docs used by earlier prompts/subagents.
- **prompts/** _(historico; no incluido en este arbol)_ - Plan-mode,
  plan-review, and commit-review orchestrator prompts.

## Engineering

- **[DECISIONS.md](DECISIONS.md)** - Architecture and business
  decision log (chronological).
- **IMPLEMENTATION_PLAN.md** _(historico; superseded)_ - Historical
  11-phase plan.
- **AUDIT_2026_06_02.md** _(historico; no incluido en este arbol)_ - The
  baseline audit (v1.0.0-rc.3) plus the 20-phase plan.
- **KNOWN_LIMITATIONS.md** _(historico; no incluido en este arbol)_ - What
  was closed in v1.0.0, what is deferred to v1.1.
- **OPERATIVE_NOTES_2026_06_02.md** _(historico; no incluido en este arbol)_ -
  Release snapshot (v1.0.0).
- **LOCAL_VALIDATION_SCRIPT.md** _(historico; no incluido en este arbol)_ -
  Local validation script for the 5 receipt paper sizes.
- **OPERATIVE_VALIDATION_FLOW.md** _(historico; no incluido en este arbol)_ -
  End-to-end operator validation runbook.
- **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** - Release validation
  checklist.
- **INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md** _(historico; no incluido en
  este arbol)_ - Receipt print validation.

## Operator training (Spanish)

El directorio `manuales/` no existe en este arbol; estos manuales pertenecen a
una etapa anterior y no viajan en el paquete offline.

- **manuales/INDICE_OPERADOR.md** _(historico)_ - Master operator index.
- **manuales/MANUAL_CAJERO.md** _(historico)_ - Cashier manual.
- **manuales/MANUAL_SUPERVISOR.md** _(historico)_ - Supervisor manual.
- **manuales/MANUAL_ADMINISTRADOR.md** _(historico)_ - Administrator manual.
- **manuales/GUIA_INSTALACION_OPERATIVA.md** _(historico)_ - Operational
  installation guide.
- **manuales/GUIA_RESPALDOS_Y_RESTAURACION.md** _(historico)_ - Backup &
  restore operator guide.
- **manuales/GUIA_SOPORTE_PRIMER_NIVEL.md** _(historico)_ - First-line support
  guide.
- **manuales/GUIA_CAPACITACION_SEGURA.md** _(historico)_ - Safe training guide.
- **manuales/CHECKLIST_CAPACITACION.md** _(historico)_ - Training checklist.

Los antiguos `docs/Manual_Usuario.md` y `docs/Manual_Usuario.html` **no existen
en este arbol** (tampoco el directorio `manuales/`). No hay manuales de operador
incluidos actualmente; si un manual impreso antiguo los referencia, ese material
no esta disponible en el paquete y no debe usarse como fuente de verdad.

## Quality evidence

Under `qa/`:

- **qa/FINAL_PRODUCTION_HANDOFF_RESULT.md** _(historico; no incluido en este
  arbol)_ - the final handoff doc.
- **qa/FINAL_RESTORE_PROOF.md** _(pendiente de ejecucion; usar la plantilla
  [qa/RECOVERY_CERTIFICATION.example.md](../qa/RECOVERY_CERTIFICATION.example.md))_.
- **qa/FINAL_CONCURRENCY_PROOF.md** _(pendiente de ejecucion; sin plantilla en
  este arbol)_.
- **[qa/LOCAL_SERVER_VALIDATION_PROOF.example.md](../qa/LOCAL_SERVER_VALIDATION_PROOF.example.md)** -
  local single-machine browser evidence; copy it to
  `qa/LOCAL_SERVER_VALIDATION_PROOF.md` when executed.
- **[qa/LAN_CLIENT_VALIDATION_PROOF.example.md](../qa/LAN_CLIENT_VALIDATION_PROOF.example.md)** -
  second-client LAN validation evidence; copy it to
  `qa/LAN_CLIENT_VALIDATION_PROOF.md` when executed.
- **[qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md](../qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md)** -
  printer evidence; copy it to
  `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` when executed.

The preflight script in `scripts/production_readiness_preflight.ps1`
fails the release if the required PROOF files for the selected mode are still
PENDING. Single-machine mode requires local browser evidence; multi-PC LAN mode requires second-client LAN evidence.

## Script inventory

`scripts/` contains the PowerShell and bash scripts. La lista autoritativa es
el contenido real del directorio; `package_manifest.json` ya no existe en este
arbol. Los comandos de calidad vigentes estan en `AGENTS.md` y `README.md`.
Scripts relevantes:

- `scripts/deploy_hospital_lan.ps1` - the production installer.
- `scripts/restore_hospital_windows.ps1` - the production restore.
- `scripts/maintenance_hospital_windows.ps1` - consola de mantenimiento
  (estado, respaldo, verificacion, restore descartable y recuperacion).
- `scripts/install_backup_tasks_windows.ps1` - registers the backup queue
  worker and the Laravel scheduler task (`schedule:run` every minute); the
  legacy direct daily backup task is retired on `-UpdateExisting`.
- **scripts/register_scheduler_cron.ps1** _(historico; no incluido en este
  arbol)_.
- `scripts/pre-commit-guard.ps1` - the secret-leak guard
  (see [SECRETS.md](SECRETS.md) for what it blocks).
- **scripts/quality_gate.sh** _(historico; no incluido en este arbol; usar los
  comandos Docker de `AGENTS.md`)_. 
