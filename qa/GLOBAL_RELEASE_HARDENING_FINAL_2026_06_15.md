# Global release hardening final report - 2026-06-15

- Branch: hardening/global-release-candidate-2026-06-15
- Base expected: main @ 6508418d62ec25f0cea37221bfce7295977b7629
- HEAD before final report commit: b7bf78fb6ee0594c06f73f7efa7dd52a207a2234
- Previous status: TECHNICAL_MERGED / FIELD_PRINT_VALIDATION_PENDING
- Final verdict: TECHNICAL_RELEASE_CANDIDATE_PENDING_FIELD_VALIDATION
- PRODUCTION_READY: not declared

## Commits created

1. 1c22d460 docs(update): add safe update manual and checklist
2. d0f9d3c8 fix(docs): align erythropoietin and zero-total manuals
3. e70190de test(release): make quality gates reproducible on Windows
4. 0c722b36 fix(receipts): demote legacy receipt preview
5. 35c28856 test(visual): recapture settled operational screens
6. b7bf78fb ops(update): add guarded release updater preflight
7. docs(release): record global hardening report (this commit)

## Files touched

- Update/manuals: docs/manuales/MANUAL_ACTUALIZACION_SEGURA.md, CHECKLIST_ACTUALIZACION_SEGURA.md, MANUAL_CAJERO.md, MANUAL_ADMINISTRADOR.md, CHECKLIST_CAPACITACION.md, INDICE_OPERADOR.md, GUIA_INSTALACION_OPERATIVA.md.
- Technical/release docs: docs/QUALITY_GATES_WINDOWS.md, docs/RELEASE_CHECKLIST.md, docs/CI.md, docs/FISCAL_RULES.md, docs/OPERATIVE_NOTES_2026_06_02.md, docs/DECISIONS.md.
- Release scripts: scripts/update_release_preflight.ps1, scripts/quality_gate_windows.ps1.
- Frontend receipts/tests: ReceiptPreview, NewInvoiceViewLayout, InvoiceHistoryView and focused tests.
- QA evidence: qa/screenshots/global-release-candidate-2026-06-15, qa/BACKUP_RESTORE_UPDATE_HARDENING_2026_06_15.md, qa/UPDATE_PREFLIGHT_HARDENING_2026_06_15.md.

## Tests and validation executed

- powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\quality_gate_windows.ps1 -CriticalOnly: passed.
- Backend focal tests passed: InvoiceDialysisPrescriptionTest, CashPaymentsReceiptTest, InstitutionalReceiptPaymentIntegrationTest, InstitutionalReceiptPdfTest, BackupWorkflowTest, AuthorizationStrategyTest.
- Backend static gates passed: Pint, PHPStan.
- Frontend gates passed: npm run test:critical, npm run typecheck, npm run lint, npm run build.
- git diff --check: passed in phase gates.
- Visual smoke: node qa\visual-smoke\global-release-candidate-screens.mjs, 15 settled captures, 0 console/page/HTTP blockers.
- Backup real on disposable SQLite: hospital:backup created non-zero backup with SHA256 00EF65B324F78CD54186CF200D6D52633F17CB56E82B873E5F0307F85D726AFB.
- Disposable restore proof: copied backup to C:\tmp\s-hospital-restore-proof.sqlite and matched critical counts.
- Safe scripts: restore_hospital_windows.ps1 -SelfTest, install_backup_tasks_windows.ps1 -WhatIfOnly, run_scheduled_backup.cmd --check, run_backup_worker.cmd --check, update_release_preflight.ps1.

## Findings corrected

- P1/P2 update risk: added dedicated safe update manual, checklist and read-only preflight protecting .env, storage, backups, PDFs/receipts, local config and incremental migrations.
- P1 docs contradiction: cashier/admin/technical docs now match real erythropoietin and zero-total flow. Patient name is enough; dialysis prescription flag is invoice-level; zero-total does not require artificial L.0 payment.
- P1/P2 quality gate reproducibility: Windows critical and full gate commands are documented and scripted with serial frontend workers and separated suites.
- P2 receipt fallback: legacy preview is demoted to compatibility comprobante, no longer presented as final institutional receipt, and patient-facing technical fiscal fields were removed from that fallback.
- P2 visual evidence: main operational screens were recaptured in loaded or clear empty states, including login, dashboard, POS, caja, historial, reportes, fiscal settings, institutional receipt settings, backups, users, help, about/server status, mobile POS and tablet dashboard.
- P1/P2 backup/update evidence: disposable backup/restore proof and guarded preflight evidence are recorded under qa/.

## Pending findings and accepted limits

- No confirmed P0 remains.
- Physical printer validation remains pending in the hospital: paper size, copies, official text, stamp/signature and real thermal behavior.
- LAN/concurrency validation on hospital hardware remains pending if no second workstation/server LAN is available.
- MySQL disposable restore validation remains the preferred production-style restore proof when a real MySQL/MariaDB server is available; this phase used SQLite disposable proof to avoid touching real data.

## Current subsystem state

- Manuals: consistent with implemented cashier/admin flows and update safety.
- Backup/restore: backup creation, hash, disposable restore comparison and restore guards evidenced; production MySQL restore still needs real target validation before field handoff.
- Update safety: preflight passed with one expected source-worktree warning: no real .env exists in this code worktree. Installed servers must have .env verified before update.
- Institutional receipts: module remains TECHNICAL_MERGED / FIELD_PRINT_VALIDATION_PENDING. New flow still prefers institutional PDF; legacy /api/invoices/{id}/receipt remains fallback/compatibility.
- Design/UX: no new redesign introduced; captured screens show institutional layout, clear empty states and no visible loading blockers in final evidence.

## Decisions required from hospital/user

- Final paper/profile policy: 80mm/58mm/media carta/carta/A5, number of copies, wording, footer, stamp/signature.
- Field printer validation with real device and physical paper.
- LAN validation window with server PC and at least one client workstation.
- Whether to run MySQL disposable restore validation on available hospital-like infrastructure before handoff.
