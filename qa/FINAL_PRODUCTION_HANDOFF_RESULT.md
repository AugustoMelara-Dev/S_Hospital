# Final production handoff result

- Updated at: 2026-06-03
- Decision: `PRODUCTION_CANDIDATE`
- Current branch: `codex/production-readiness-preflight`
- Last local evidence check: 2026-06-03
- Final conclusion: the system has stronger operational support, diagnostics, backup/restore evidence and browser smoke evidence, but it must not be called `PRODUCTION_READY` until the final-server LAN, printer and Windows task evidence is completed.

## Evidence completed in this hardening front

| Area | Evidence | Result |
|---|---|---|
| Browser smoke | `qa/browser-smoke-2026-06-03/rc-e2e-mocked-report.json` and screenshots | Passed with `console_issues: []` |
| Real Laravel smoke | `npm.cmd run smoke:real` against `http://127.0.0.1:8000` | Passed read-only route/navigation smoke; mutating smoke intentionally skipped |
| CSP production serving | `b7d2ca72 fix(security): allow spa runtime styles in csp` | Real smoke no longer reports CSP style errors |
| Backup worker | `qa/BACKUP_WORKER_SMOKE_2026_06_03.md` | Manual backup moved from pending to `success`, checksum present |
| Restore | `qa/FINAL_RESTORE_PROOF.md` and `qa/FINAL_RESTORE_PROOF_2026_06_03.md` | Backup restored into disposable MariaDB database; active DB not overwritten |
| Concurrency | `qa/FINAL_CONCURRENCY_PROOF.md` | Double cash open `201 / 422`, unique invoice numbers, double payment `201 / 422` |
| Startup/repair | `qa/STARTUP_REPAIR_AUTOMATION_SMOKE_2026_06_03.md` | Startup, repair, open-system and backup task scripts validated in safe modes |
| Support packet | `qa/SUPPORT_PACKET_SAFETY_2026_06_03.md` | Disposable fixture confirmed no `.env`, secrets or real local paths are copied into support artifacts |
| Training safety | `qa/TRAINING_SAFETY_2026_06_03.md` | Manuals and in-app Help keep isolated-practice guidance and forbid training on production data |
| Evidence index | `qa/OPS_EVIDENCE_INDEX_2026_06_03.md` | Handoff evidence references exist under `qa/` and physical blockers remain listed before `PRODUCTION_READY` |
| Offline release guard | `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md` | Current local offline package is stale and correctly blocked until regenerated from the final commit |
| Handoff self-check | `qa/HANDOFF_EVIDENCE_INDEX_SMOKE_2026_06_03.md` | `final_production_handoff.ps1 -SkipPreflight` writes a report, runs evidence-index validation against it and keeps `PRODUCTION_CANDIDATE` |
| Preflight | `qa/PREFLIGHT_WITH_CONCURRENCY_2026_06_03.md` | Restore and concurrency evidence now pass preflight; production readiness still blocked |

## Tests and gates run locally

- Backend static/format: `docker compose exec -T backend ./vendor/bin/pint --test`
- Backend static analysis: `docker compose exec -T backend ./vendor/bin/phpstan analyse --memory-limit=1G`
- Backend full suite: `docker compose exec -T backend php artisan test` passed with 384 tests and 6 expected skips during this front.
- Focused backend tests: `SecurityHeadersTest`, `BackupWorkflowTest`, `DatabaseDumpWriterTest`, `CashPaymentsReceiptTest`, `ReportsTest`, `BroadcastingWiringTest`, `AuditLogTest`, `GenerateFiscalNumberActionTest`.
- Frontend gates: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test -- --run`, `npm.cmd run build`, `scripts\check-branding.ps1`.
- E2E/browser: mocked production readiness E2E with screenshots, real Laravel smoke without mutations.
- Operational scripts: backup worker smoke, restore into disposable DB, concurrency validation, startup/repair/task dry-runs, support packet safety validation, training safety validation, evidence index validation, handoff self-check, offline release guard, production preflight.

## Operator documentation and in-app support

- Master manual: `docs/manuales/INDICE_OPERADOR.md`
- Cashier manual: `docs/manuales/MANUAL_CAJERO.md`
- Supervisor manual: `docs/manuales/MANUAL_SUPERVISOR.md`
- Administrator manual: `docs/manuales/MANUAL_ADMINISTRADOR.md`
- First-level support: `docs/manuales/GUIA_SOPORTE_PRIMER_NIVEL.md`
- Safe training: `docs/manuales/GUIA_CAPACITACION_SEGURA.md`
- Training checklist: `docs/manuales/CHECKLIST_CAPACITACION.md`
- Backup and restore guide: `docs/manuales/GUIA_RESPALDOS_Y_RESTAURACION.md`
- In-app help: `frontend/src/features/help/HelpView.tsx`

The help screen covers opening the system, login, cashbox, invoicing, charging, printing, reprinting, reports, backups, shift close, support requests, incident responses, role checklists and delicate-action warnings.

## Remaining blockers before production handoff

The following items require the final installed hospital server, LAN client and printer hardware:

- Complete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a second PC on the hospital LAN.
- Complete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` by printing media carta, carta, A5, 80mm and 58mm receipts on the real cashier printer.
- Install or update `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` Windows scheduled tasks on the final server.
- Configure final production environment: `APP_ENV=production`, `APP_DEBUG=false`, final LAN `APP_URL`, random DB passwords and root password.
- Re-run backup worker smoke on the final server with the final dump binary/PATH.
- Re-run restore and concurrency evidence on the final server or explicitly approved disposable final target.
- Re-run `scripts/production_readiness_preflight.ps1 -BaseUrl http://SERVER_LAN_IP:8000` without `-AllowMissingPhysicalProof`; it must return 0.
- Regenerate and verify the offline release package from the final commit if this becomes an installable delivery.

## Current preflight status

The latest local preflight after restore and concurrency evidence still returned `PRODUCTION_READY: NO` with 10 blocking issues. This is correct for the local Docker development environment because it lacks final production settings, Windows scheduled tasks, second-client LAN proof and physical printer proof.

## Safety notes

- No `.env` file was deleted.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- Secrets were not printed in evidence files.
- Fiscal compliance was not invented; fiscal sequences/settings still require real administrative validation before production use.

## Decision

Keep the release state as `PRODUCTION_CANDIDATE`. Promote to `PRODUCTION_READY` only after the final-server evidence above is complete and the preflight passes without bypass flags.
