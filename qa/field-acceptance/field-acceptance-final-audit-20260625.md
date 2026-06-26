# S_Hospital V1.1 - Final Field Acceptance Audit

Date/time: 2026-06-25 22:44:07 -06:00 America/Tegucigalpa
Branch: `codex/field-acceptance-final-audit`
SHA tested: `4286887cf7f7e51b56ee27aecdb1b3a6b7d9691f`
Production physical approval: NO
Production tag created: NO

## Scope

This audit was executed as a safe assisted field-acceptance pass from the server PC. It did not refactor, redesign, change product code, change migrations, change fiscal configuration, restore over production, modify firewall rules, create a tag, or use real patient data.

The mission was to close as much field acceptance as physically possible and record honest blockers for gates that require external hardware, a hospital operator, a second physical PC, real paper, or a real LAN load window.

## Repository verification

Before creating the audit branch:

- Current branch: `main`.
- Git status: clean.
- `main`: `4286887cf7f7e51b56ee27aecdb1b3a6b7d9691f`.
- `origin/main`: `4286887cf7f7e51b56ee27aecdb1b3a6b7d9691f`.

Audit branch created from `origin/main`:

- `codex/field-acceptance-final-audit`.

## Server and LAN

- Server hostname: `AugustoMelara`.
- LAN IPv4 selected for S_Hospital: `192.168.1.10` on Wi-Fi.
- Preferred LAN URL: `http://192.168.1.10:8081`.
- Alternate LAN URL also responding: `http://192.168.1.10:8080`.
- Docker stacks observed:
  - `shospital_offlinetest-*`: healthy, nginx exposed on `8081`.
  - `shospital_prodtest-*`: healthy, nginx exposed on `8080`.
  - `s_hospital_f7_verify-*`: healthy, nginx exposed on `18080`.

Safe GET checks from the server PC:

| URL | Result |
| --- | --- |
| `http://192.168.1.10:8081` | PASS for `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status` |
| `http://192.168.1.10:8080` | PASS for `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status` |

Measured `8081` safe GET timings:

| Path | HTTP | Approx ms |
| --- | ---: | ---: |
| `/` | 200 | 105 |
| `/login` | 200 | 47 |
| `/api/health` | 200 | 85 |
| `/api/system/health` | 200 | 102 |
| `/api/system/setup-status` | 200 | 75 |

Health summary from `8081`:

- MySQL connected: YES.
- Recent errors: none reported.
- Failed backups last 24h: 0.
- Known operational issue: `backup_worker_idle`.

This is SELF-CHECK PASS from the server PC. It does not substitute the second physical PC LAN gate.

## Printer and paper audit

Windows printer inventory observed:

| Printer | Driver | Port | Status |
| --- | --- | --- | --- |
| `L15150 Series(Network)` | `EPSON L15150 Series` | `EP8AFB63:L15150 SERIES` | Normal |
| `Epson L15150 Directa` | `EPSON L15150 Series` | `IP_192.168.1.34_RAW9100` | Normal |
| `EPSON8AFB63 (L15150 Series)` | `EPSON L15150 Series` | WSD port | Offline |
| `Microsoft Print to PDF` | Microsoft Print To PDF | `PORTPROMPT:` | Normal |
| `OneNote (Desktop)` | Send to Microsoft OneNote 16 Driver | `nul:` | Normal |

Observed Epson configuration:

- `PaperSize=A4`.
- `DuplexingMode=OneSided`.
- `Color=True`.
- No Windows default printer was reported.

Physical output was not executed. No operator confirmed paper loaded, tray, scale, browser print settings, or actual physical receipt/factura output.

Generated checklist:

- `qa/field-acceptance/print-proof-checklist-final-audit-20260625.txt`.

Print decisions:

| Format | Result | Reason |
| --- | --- | --- |
| Carta | PENDIENTE | Epson L15150 detected, but physical Letter paper/profile/output was not confirmed. |
| Media carta | PENDIENTE | Requires driver profile, paper loaded, and physical output proof. |
| A5 | PENDIENTE | Requires driver profile, paper loaded, and physical output proof. |
| 80mm | HARDWARE NO DISPONIBLE | No compatible thermal printer was detected in this session. |
| 58mm | HARDWARE NO DISPONIBLE | No compatible thermal printer was detected in this session. |

## Gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| Second PC LAN | PENDIENTE | No second physical PC was available. Server self-check passed only. |
| PC1/PC2 synchronization | PENDIENTE | No two-client real cashier/supervisor workflow was executed. |
| Physical printing | PENDIENTE | Epson printer detected but no physical receipt/factura was printed. |
| Disposable backup/restore local | PASS local descartable | Existing evidence: `qa/field-acceptance/restore-validation-local-20260625213129.md`. |
| Disposable restore final on site | PENDIENTE | Requires operator-run disposable restore in the hospital environment. |
| Local disposable load/concurrency | PASS local descartable | Existing evidence: `qa/field-acceptance/concurrency-load-local-20260625220353.md`. |
| Real LAN load/concurrency | PENDIENTE | Requires two physical clients and a real LAN load window. |

## Errors, duplicates, and bugs

- Unexpected 500s in safe GET checks: none observed.
- White screen: not observed in safe GET checks.
- Duplicates: none observed in inherited local disposable concurrency evidence; real LAN duplicate check remains pending.
- Bugs found in this assisted pass: no product P0/P1 found.
- Known issue carried forward: `backup_worker_idle` from health endpoint, operational status only.
- QA-SCRIPT-003: corrected later in `codex/field-acceptance-finalize` by replacing the non-portable encrypted-restore `mktemp` suffix template with a `mktemp -d` directory, fixed temp filenames, and `trap` cleanup. Syntax validation with `C:\Program Files\Git\bin\bash.exe -n scripts/validate_restore_mysql.sh`: PASS. Runtime restore validation of the operative script remains PENDIENTE until an explicit disposable restore target is prepared.

## Final decision

Production physical approval remains NO.

Reason: required physical gates are still missing:

- Second physical PC LAN.
- PC1/PC2 synchronization.
- Physical printing with correct paper/profile/output.
- Final disposable restore in the hospital/site environment.
- Real LAN load/concurrency with physical clients.

No production tag was created.

## Handoff

HANDOFF - FINAL FIELD ACCEPTANCE AUDIT

* Estado: PARCIAL.
* SHA probado: `4286887cf7f7e51b56ee27aecdb1b3a6b7d9691f`.
* Segunda PC LAN: PENDIENTE.
* Sincronizacion PC1/PC2: PENDIENTE.
* Impresion fisica: PENDIENTE.
* Papel/configuracion: Epson L15150 detectada, configuracion observada A4, salida fisica no ejecutada.
* Restore descartable: PASS local descartable; final en sitio PENDIENTE.
* Script restore QA: CORREGIDO Y VALIDADO EN SINTAXIS; runtime restore PENDIENTE en entorno descartable.
* Carga/concurrencia LAN: PASS local descartable; LAN real PENDIENTE.
* Bugs P0/P1: NINGUNO CONOCIDO.
* Evidencia: `docs/qa/FIELD_ACCEPTANCE_EXECUTION_LOG.md`, `docs/qa/FIELD_ACCEPTANCE_SITE_RUN_SHEET.md`, `qa/field-acceptance/field-acceptance-final-audit-20260625.md`, `qa/field-acceptance/print-proof-checklist-final-audit-20260625.txt`.
* Produccion fisica aprobada: NO.
* Tag creado: NO.
* Proximo paso: ejecutar pruebas fisicas en hospital con segunda PC, operador, papel correcto, impresora real y ventana LAN real.
