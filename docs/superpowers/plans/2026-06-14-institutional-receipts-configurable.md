# Institutional Receipts Configurable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable institutional receipt module for Hospital San Isidro that produces formal PDF receipts for normal printers, with fiscal/control settings, real paper sizes, copies, auditability, and no fake digital seals by default.

**Architecture:** Extend the current Laravel Actions/Form Requests/React feature structure instead of replacing it. Keep the current invoice receipt endpoints as compatibility adapters, but introduce an explicit `institutional_receipts` domain with its own series, snapshots, PDF generation, print profiles, copy labels, reprint logs, and void audit flow. Use DomPDF already present in `backend/composer.json`; no internet-required runtime dependency is added.

**Tech Stack:** Laravel 12, MySQL/MariaDB, DomPDF, React + TypeScript, TanStack Query, React Hook Form/Zod where the existing settings UI supports it, current local UI primitives, Playwright/Vitest/PHPUnit.

---

## 1. Resumen Ejecutivo

El sistema ya tiene recibo institucional MVP derivado de factura, con `GenerateReceiptDataAction`, `ReprintReceiptAction`, `ReceiptPaperSize`, snapshots en `invoices` y CSS de impresion aislado por `body[data-printing-receipt="true"]`. Eso es una base util, pero no cumple la nueva necesidad: el recibo institucional debe ser documento configurable propio, con serie/rango/correlativo de recibo, perfiles de impresion reales, PDF guardado o regenerable desde snapshot, copias automaticas y pantalla de Ajustes con vista previa/prueba.

La implementacion se divide en fases pequenas y commiteables. La prioridad es no romper facturacion/caja/pagos actuales y no mezclar ticket termico como formato principal. `80mm` y `58mm` se conservan solo como compatibilidad opcional futura o heredada; el flujo principal pasa a `recibo_pequeno_personalizado`, `media_carta_horizontal`, `a5_horizontal` y `carta_horizontal`.

## 2. Suposiciones Explicitas

- El recibo institucional se emite despues de una venta/cobro. Para facturas con pago parcial, el sistema no debe emitir recibo final por defecto salvo que una configuracion futura permita recibos parciales.
- Se mantiene factura fiscal actual como entidad existente; el nuevo recibo institucional puede referenciar factura, pago/caja y usuario, pero guarda su propio snapshot.
- La serie del recibo institucional no reutiliza automaticamente la serie de factura. Se crea control propio de recibos para evitar mezclar reglas de factura CAI con talonario/recibo institucional.
- El sello y firma digital autorizados se dejan como campos/configuracion futura segura, apagada por defecto. La primera entrega solo renderiza espacios fisicos.
- DomPDF es suficiente para la primera implementacion porque ya esta instalado y se usa para reportes PDF. Si validacion fisica demuestra problemas con papel personalizado, se documenta decision futura para Snappy/wkhtmltopdf.
- El tamanio exacto de `recibo_pequeno_personalizado` queda bloqueado por validacion en milimetros; no se infiere desde la foto.

## 3. Preguntas No Bloqueantes

- Medidas reales del recibo fisico: se asume configurable y se puede operar inicialmente con media carta/A5.
- Texto legal exacto final: se almacena configurable; se siembra una frase neutra editable, no una autorizacion fiscal inventada.
- Requisito de copias fisicas: se implementa modo configurable con default `solo_original`.

## 4. Arquitectura Propuesta

Backend:

- Crear dominio `App\Actions\InstitutionalReceipts`.
- Crear modelos `InstitutionalReceipt`, `InstitutionalReceiptSeries`, `ReceiptPrintProfile`, `InstitutionalReceiptPrintEvent`.
- Reusar `FiscalSetting` para datos institucionales generales, pero mover configuracion especifica de recibos a tablas dedicadas para no sobrecargar `fiscal_settings`.
- Crear `ReserveInstitutionalReceiptNumberAction` con `lockForUpdate()` sobre la serie activa.
- Crear `IssueInstitutionalReceiptAction` que corre en transaccion: valida factura/pago/caja, reserva numero, arma snapshot, crea recibo, genera o agenda PDF deterministico, registra auditoria.
- Crear `InstitutionalReceiptPdfService` y `InstitutionalReceiptHtmlBuilder` con escaping explicito.
- Mantener `/api/invoices/{invoice}/receipt` como compatibilidad de preview, pero el camino nuevo debe ser `/api/institutional-receipts`.

Frontend:

- Crear `frontend/src/features/receipt-settings` para Ajustes de recibos.
- Crear `frontend/src/features/receipts/institutional` para vista previa formal y PDF/print actions.
- Reemplazar en POS/historial el camino obligatorio de ticket por recibo institucional emitido.
- Mantener selector heredado de ancho solo donde se reimprime recibo viejo sin entidad `institutional_receipts`.

PDF/impresion:

- Perfiles minimos:
  - `recibo_pequeno_personalizado`: ancho/alto mm configurables.
  - `media_carta_horizontal`: 8.5in x 5.5in.
  - `a5_horizontal`: 210mm x 148mm.
  - `carta_horizontal`: 11in x 8.5in.
- Usar PDF con dimensiones reales y documentar impresion a 100%, tamanio real, sin ajustar a pagina.
- Copias fisicas se generan como paginas PDF separadas con etiqueta `ORIGINAL`, `PRIMERA COPIA`, `SEGUNDA COPIA`.

## 5. Modelo de Datos y Migraciones

### Nueva tabla `institutional_receipt_series`

Responsabilidad: controlar serie/rango/correlativo de recibos institucionales.

Campos:

- `id`
- `document_type` default `institutional_receipt`
- `series`
- `prefix`
- `number_format` default `{series}-{number:08}`
- `min_number`, `max_number`, `current_number`
- `range_authorization` nullable
- `legal_text` text nullable
- `receipt_number_color` default `#b91c1c`
- `active` boolean
- `active_document_type` nullable unique, igual al patron actual de `fiscal_sequences`
- `reprint_behavior` enum `audit_only`, `require_reason`
- `void_behavior` enum `permission_reason_audit`
- `created_by`, `updated_by`, timestamps

Indices/constraints:

- unique active document type.
- check `min_number <= max_number`.
- check `current_number >= 0`.
- index `series`, `active`.

### Nueva tabla `receipt_print_profiles`

Responsabilidad: perfiles configurables de papel/layout.

Campos:

- `id`, `code`, `name`
- `paper_kind` enum `custom_mm`, `half_letter_landscape`, `a5_landscape`, `letter_landscape`, `thermal_80mm`, `thermal_58mm`
- `width_mm`, `height_mm`
- `margin_top_mm`, `margin_right_mm`, `margin_bottom_mm`, `margin_left_mm`
- `orientation` enum `landscape`, `portrait`
- `template_code` default `institutional_classic`
- `font_family`, `font_scale`
- `copies_mode` enum `original_only`, `original_first`, `original_first_second`
- `show_copy_legend`, `show_physical_seal_space`, `use_logo`, `show_technical_fields`
- `active`, `is_global_default`
- timestamps

Seed inicial:

- `recibo_pequeno_personalizado`: inactive until size is configured, optional initial 180mm x 95mm value that the administrator must confirm or replace before using it.
- `media_carta_horizontal`: active, global default, 215.9mm x 139.7mm.
- `a5_horizontal`: active, 210mm x 148mm.
- `carta_horizontal`: active, 279.4mm x 215.9mm.
- keep optional `thermal_80mm` and `thermal_58mm` only as legacy inactive/future profiles if current tests need compatibility.

### Nueva tabla `institutional_receipts`

Responsabilidad: evidencia historica del recibo emitido.

Campos:

- `id`
- `invoice_id` nullable indexed
- `payment_id` nullable indexed
- `cash_session_id` indexed
- `series_id`
- `receipt_number`
- `receipt_number_full` unique
- `status` enum `issued`, `void`
- `amount`, `amount_cents`
- `issued_at`, `issued_by`
- `payer_name`
- `concept`
- `amount_words`
- `template_code`
- `print_profile_code`
- `copy_mode`
- `institution_snapshot` json
- `series_snapshot` json
- `profile_snapshot` json
- `invoice_snapshot` json nullable
- `payment_snapshot` json nullable
- `items_snapshot` json
- `pdf_disk`, `pdf_path`, `pdf_sha256` nullable
- `reprint_count` default 0
- `voided_by`, `voided_at`, `void_reason`
- timestamps

### Nueva tabla `institutional_receipt_print_events`

Responsabilidad: trazabilidad de impresion/reimpresion/prueba.

Campos:

- `id`
- `institutional_receipt_id` nullable for test prints
- `event_type` enum `issued_print`, `reprint`, `test_print`, `pdf_generated`
- `copy_label`
- `profile_snapshot` json
- `reason` nullable
- `user_id`
- `created_at`

### Perfil por caja/equipo

Primera version segura:

- Crear `receipt_profile_assignments` con `scope_type` enum `global`, `user`, `cash_session`, `cash_register` and `scope_id` nullable.
- Si el proyecto introduce tabla maestra `cash_registers` en otra fase, `scope_type='cash_register'` queda listo sin migracion destructiva.
- Resolucion: caja/sesion actual > usuario/cajero > global.
- No se debe cambiar el flujo de apertura de caja hasta que exista UI de cajas fisicas; para esta fase, Ajustes permite asignar perfil por usuario/cajero como aproximacion operativa.

## 6. Modulos y Fases

### Fase 1: Contratos, migraciones y seeders de configuracion

**Alcance:** Crear tablas de series, perfiles, recibos, eventos e insertar perfiles base. No conectar aun al POS.

**Archivos:**

- Create: `backend/database/migrations/2026_06_14_000001_create_institutional_receipt_series_table.php`
- Create: `backend/database/migrations/2026_06_14_000002_create_receipt_print_profiles_table.php`
- Create: `backend/database/migrations/2026_06_14_000003_create_institutional_receipts_table.php`
- Create: `backend/database/migrations/2026_06_14_000004_create_institutional_receipt_print_events_table.php`
- Create: `backend/database/migrations/2026_06_14_000005_create_receipt_profile_assignments_table.php`
- Create: `backend/app/Models/InstitutionalReceiptSeries.php`
- Create: `backend/app/Models/ReceiptPrintProfile.php`
- Create: `backend/app/Models/InstitutionalReceipt.php`
- Create: `backend/app/Models/InstitutionalReceiptPrintEvent.php`
- Create: `backend/app/Models/ReceiptProfileAssignment.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Create: `backend/database/seeders/ReceiptPrintProfileSeeder.php`
- Test: `backend/tests/Feature/InstitutionalReceiptSettingsMigrationTest.php`

**Steps:**

- [ ] Write migration tests asserting profiles exist after seeding and no profile uses thermal as global default.
- [ ] Add migrations with non-destructive `up()` and reversible `down()`.
- [ ] Add Eloquent models with fillable/casts/relations.
- [ ] Add seeder for four required profiles and one inactive legacy thermal compatibility row only if needed by old tests.
- [ ] Run `cd backend && php artisan migrate:fresh --seed && php artisan test --filter=InstitutionalReceiptSettingsMigrationTest`.
- [ ] Commit: `feat(receipts): add institutional receipt configuration schema`.

**Risks:** Migracion destructiva o default incorrecto a 80mm. Mitigacion: tests de seed y default.

**Acceptance:** Base limpia crea perfiles, serie puede crearse, recibos/eventos referencian factura/caja/usuario sin romper migraciones existentes.

### Fase 2: Backend de Ajustes para recibos institucionales

**Alcance:** API protegida para configurar datos institucionales de recibo, serie/rango/correlativo, perfiles, copias y asignaciones.

**Archivos:**

- Create: `backend/app/Http/Controllers/InstitutionalReceiptSettingsController.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/UpdateReceiptInstitutionRequest.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/StoreReceiptSeriesRequest.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/UpdateReceiptSeriesRequest.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/UpdateReceiptPrintProfileRequest.php`
- Create: `backend/app/Actions/InstitutionalReceipts/ResolveReceiptPrintProfileAction.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/database/seeders/RolesAndPermissionsSeeder.php`
- Test: `backend/tests/Feature/InstitutionalReceiptSettingsTest.php`
- Test: `backend/tests/Feature/ReceiptProfileAssignmentTest.php`

**API propuesta:**

- `GET /api/settings/institutional-receipts`
- `PUT /api/settings/institutional-receipts/institution`
- `GET /api/settings/institutional-receipts/series`
- `POST /api/settings/institutional-receipts/series`
- `PATCH /api/settings/institutional-receipts/series/{series}`
- `GET /api/settings/institutional-receipts/print-profiles`
- `PATCH /api/settings/institutional-receipts/print-profiles/{profile}`
- `PUT /api/settings/institutional-receipts/assignments`
- `POST /api/settings/institutional-receipts/test-preview`

**Steps:**

- [ ] Add permissions `receipt_settings.view`, `receipt_settings.update`, `receipts.void`, `receipts.print_test`.
- [ ] Write failing Feature tests for unauthorized cajero update, admin update, invalid custom mm, active series range validation, and assignment fallback global.
- [ ] Implement Form Requests; prohibit lowering `current_number` below emitted max.
- [ ] Implement controller methods as thin adapters.
- [ ] Implement profile resolver with precedence session > user > global.
- [ ] Audit every update to settings/series/profile/assignment in `audit_logs`.
- [ ] Run `cd backend && php artisan test --filter=InstitutionalReceiptSettingsTest --filter=ReceiptProfileAssignmentTest`.
- [ ] Commit: `feat(receipts): add configurable institutional receipt settings api`.

**Risks:** Permitir cambios fiscales sin auditoria. Mitigacion: tests `audit_logs`.

**Acceptance:** Admin puede configurar institucion, serie, rango, texto legal, color de numero, perfiles y asignaciones; cajero no.

### Fase 3: Reserva transaccional y emision de recibo institucional

**Alcance:** Emitir recibo institucional formal desde factura pagada/cobro, con correlativo propio, snapshot completo y estados consistentes.

**Archivos:**

- Create: `backend/app/Actions/InstitutionalReceipts/ReserveInstitutionalReceiptNumberAction.php`
- Create: `backend/app/Actions/InstitutionalReceipts/BuildInstitutionalReceiptSnapshotAction.php`
- Create: `backend/app/Actions/InstitutionalReceipts/IssueInstitutionalReceiptAction.php`
- Create: `backend/app/Actions/InstitutionalReceipts/AmountToSpanishWords.php`
- Create: `backend/app/Http/Controllers/InstitutionalReceiptController.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/IssueInstitutionalReceiptRequest.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Actions/Payments/RegisterPaymentAction.php` only if automatic issue-on-full-payment is chosen in settings; otherwise POS calls issue endpoint after payment success.
- Test: `backend/tests/Feature/InstitutionalReceiptIssueTest.php`
- Test: `backend/tests/Feature/InstitutionalReceiptConcurrentNumberTest.php`
- Test: `backend/tests/Unit/AmountToSpanishWordsTest.php`

**Rules:**

- `IssueInstitutionalReceiptAction` must `lockForUpdate()` invoice, active series, and relevant cash session.
- Reject void invoices.
- Reject unpaid/partial invoice unless explicit setting later allows partial receipt.
- Reject no active receipt series or exhausted range.
- Snapshot must include patient/enterante, amount, amount words, concept/services, institution, series, profile, invoice items, payment summary, user, cash.
- Receipt patient PDF must not expose internal ids, audit details, technical status, scanner/barcode/QR fields, or fake seal image.

**Steps:**

- [ ] Write failing tests for first receipt number, exhausted range, duplicate issue for same invoice, unpaid invoice rejection, and no barcode/QR/internal ids in snapshot.
- [ ] Write failing unit tests for Spanish lempira wording: `L.0.00`, `L.1.00`, `L.25.00`, `L.1234.56`.
- [ ] Implement number reservation with `lockForUpdate()` and unique `receipt_number_full`.
- [ ] Implement snapshot builder from invoice items/payments posted only.
- [ ] Implement issue action inside one DB transaction.
- [ ] Register audit events `institutional_receipt.issued` and `institutional_receipt.issue_failed_after_number` only if a non-rollback external failure occurs.
- [ ] Run backend tests for issue/concurrency/words.
- [ ] Commit: `feat(receipts): issue institutional receipts with atomic numbering`.

**Risks:** Consumir numero si falla PDF. Mitigacion: numero se reserva en la misma transaccion que crea el recibo; PDF generation can happen after commit and failed PDF leaves receipt issued with `pdf_path=null` plus audit event, not ambiguous numbering.

**Acceptance:** Dos cajeros no duplican recibo; rango agotado bloquea; cada recibo guarda snapshot y no depende de settings futuros.

### Fase 4: PDF institucional clasico y perfiles de papel reales

**Alcance:** Generar PDF institucional clasico con tamanio real, copias configurables y marca de prueba.

**Archivos:**

- Create: `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptHtmlBuilder.php`
- Create: `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptPdfService.php`
- Create: `backend/resources/views/pdf/institutional-receipts/classic.blade.php`
- Create: `backend/app/Support/PaperSize.php`
- Create: `backend/tests/Unit/ReceiptPaperProfileTest.php`
- Create: `backend/tests/Feature/InstitutionalReceiptPdfTest.php`
- Modify: `backend/app/Actions/InstitutionalReceipts/IssueInstitutionalReceiptAction.php`
- Modify: `backend/app/Http/Controllers/InstitutionalReceiptController.php`

**Template `Recibo institucional clasico`:**

- Header centered: gobierno/dependencia/contaduria/hospital/ciudad.
- Receipt number at left, red if configured.
- Series/monto/fecha at right.
- Fields: `El`, `Que`, amount in words, `Por`, multiline concept.
- Signature line for enterante.
- Blank space for physical seal/official signature.
- Copy legend at bottom.
- No dashboard badges, cards, shadows, QR, barcode, fake stamps, internal ids, system user by default.

**PDF dimensions:**

- custom: `[0, 0, width_mm * 72 / 25.4, height_mm * 72 / 25.4]`.
- half letter: `[0, 0, 612, 396]`.
- A5 landscape: `[0, 0, 595.28, 419.53]`.
- letter landscape: `[0, 0, 792, 612]`.

**Steps:**

- [ ] Write tests asserting profile-to-points conversions.
- [ ] Write HTML snapshot test that verifies labels `El`, `Que`, `Por`, copy labels and absence of `CAI`, `audit`, `user_id`, `barcode`, `qr_code`, `Estado`.
- [ ] Implement Blade template with escaped variables only.
- [ ] Implement PDF service and `GET /api/institutional-receipts/{receipt}/pdf`.
- [ ] Implement `POST /api/settings/institutional-receipts/test-print` returning draft/test PDF with visible `PRUEBA - SIN VALIDEZ`.
- [ ] Add print events for issued PDF, reprint PDF, and test print.
- [ ] Run `cd backend && php artisan test --filter=InstitutionalReceiptPdfTest --filter=ReceiptPaperProfileTest`.
- [ ] Commit: `feat(receipts): render institutional receipt pdf profiles`.

**Risks:** DomPDF ignores custom size or clips content. Mitigacion: unit conversion tests, manual validation doc, and fallback recommendation to media carta/A5.

**Acceptance:** PDF usa tamanio real del perfil y copias como paginas separadas. Prueba siempre lleva marca visible.

### Fase 5: Ajustes UI con vista previa y prueba

**Alcance:** Pantalla en Ajustes para configurar institucion, serie, perfil, copias, color de numero, margenes, fuente/escala y vista previa.

**Archivos:**

- Create: `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`
- Create: `frontend/src/features/receipt-settings/components/InstitutionForm.tsx`
- Create: `frontend/src/features/receipt-settings/components/ReceiptSeriesForm.tsx`
- Create: `frontend/src/features/receipt-settings/components/PrintProfilesPanel.tsx`
- Create: `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`
- Create: `frontend/src/features/receipt-settings/receiptSettings.schema.ts`
- Create: `frontend/src/lib/api/institutionalReceipts.ts`
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/routes.ts`
- Modify: `frontend/src/navigation/appNavigation.ts`
- Modify: `frontend/src/features/settings/FiscalSettingsView.tsx` to link or split receipt settings, without duplicating old controls.
- Test: `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx`
- Test: `frontend/src/features/receipt-settings/ReceiptSettingsPreview.test.tsx`

**UI rules:**

- Keep operational design sober; no modern certificate/card look for receipt preview.
- Settings page can use existing app cards, but the preview itself must look like the paper receipt.
- Default recommendation in form: `solo original + copia digital`.
- `recibo_pequeno_personalizado` exposes width/height mm inputs only for that profile.
- "Imprimir prueba" calls backend test PDF endpoint; it cannot reserve a real number.

**Steps:**

- [ ] Add API types for profiles, series, assignments, receipt preview payload.
- [ ] Write UI tests for rendering four required profiles and default `solo original`.
- [ ] Implement settings view with permission guard.
- [ ] Implement live sample preview using backend sample data or deterministic frontend sample from API contract.
- [ ] Implement print test button that downloads/opens draft PDF.
- [ ] Remove thermal-first wording from settings.
- [ ] Run `cd frontend && npm.cmd run test -- InstitutionalReceiptSettingsView ReceiptSettingsPreview --run`.
- [ ] Commit: `feat(settings): add institutional receipt print configuration`.

**Risks:** Form grows too large. Mitigacion: tabs/sections: Institucion, Serie, Papel, Copias, Vista previa.

**Acceptance:** Admin can configure all required receipt settings without code changes.

### Fase 6: POS, historial, reimpresion y anulacion integrados

**Alcance:** Desde venta/cobro se emite recibo institucional, se imprime original/copia digital, se reimprime con auditoria y se anula con permiso/motivo.

**Archivos:**

- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceSuccess.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Create: `frontend/src/features/receipts/institutional/InstitutionalReceiptViewer.tsx`
- Create: `backend/app/Actions/InstitutionalReceipts/ReprintInstitutionalReceiptAction.php`
- Create: `backend/app/Actions/InstitutionalReceipts/VoidInstitutionalReceiptAction.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/ReprintInstitutionalReceiptRequest.php`
- Create: `backend/app/Http/Requests/InstitutionalReceipts/VoidInstitutionalReceiptRequest.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/InstitutionalReceiptReprintVoidTest.php`
- Test: `frontend/src/features/invoices/InstitutionalReceiptFlow.test.tsx`

**Rules:**

- Reprint requires reason and increments `reprint_count`.
- Void requires `receipts.void`, reason, audit; does not delete receipt or invoice.
- Old invoice receipt endpoint remains readable for backwards compatibility.
- Patient-facing receipt view uses receipt entity when available.

**Steps:**

- [ ] Write backend tests for reprint count, reason required, void permission, void reason, no delete.
- [ ] Implement actions and routes.
- [ ] Update POS payment success flow to issue receipt if full payment succeeds.
- [ ] Update history actions to prefer institutional receipt PDF/reprint.
- [ ] Add fallback for invoices created before this module.
- [ ] Run backend and frontend focused tests.
- [ ] Commit: `feat(receipts): integrate institutional receipts with billing flow`.

**Risks:** Auto-issue after payment could create receipts unexpectedly on partial payments. Mitigacion: only issue when invoice status is `paid`.

**Acceptance:** Cobro pagado produce recibo institucional PDF, guarda copia digital, registra evento, permite reimpresion controlada.

### Fase 7: Documentacion operativa y validacion fisica

**Alcance:** Documentar configuracion de impresora Windows/PDF, escala 100%, perfiles, fallback a media carta/A5 y evidencia pendiente de hardware.

**Archivos:**

- Modify: `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`
- Create: `docs/INSTITUTIONAL_RECEIPT_CONFIGURATION.md`
- Modify: `docs/manuales/Manual_Administrador.md` if present, otherwise relevant manual under `docs/manuales/`.
- Modify: `docs/DECISIONS.md`
- Create: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF_TEMPLATE.md`
- Test/QA: Playwright smoke screenshot if dev server available.

**Steps:**

- [ ] Document print instructions: real size, 100%, no fit-to-page, driver paper size.
- [ ] Document what to do if custom paper is unsupported: switch profile to media carta or A5.
- [ ] Document copies mode and default recommendation.
- [ ] Document no fake stamp/signature default.
- [ ] Add decision record for receipt entity vs invoice-derived view.
- [ ] Run docs lint/check if available, otherwise `git diff --check`.
- [ ] Commit: `docs(receipts): document institutional receipt printing operations`.

**Risks:** Declaring hardware validation complete without proof. Mitigacion: keep `PENDING_HARDWARE_VALIDATION` until physical printer evidence exists.

**Acceptance:** Operator/admin docs explain exact print setup and fallback without requiring manual cutting.

## 7. Plan de TDD y Pruebas por Fase

Backend PHPUnit:

- `InstitutionalReceiptSettingsMigrationTest`: migrations/seeders/defaults.
- `InstitutionalReceiptSettingsTest`: permissions, validation, audit.
- `ReceiptProfileAssignmentTest`: profile fallback.
- `InstitutionalReceiptIssueTest`: issue flow, snapshots, no technical fields.
- `InstitutionalReceiptConcurrentNumberTest`: duplicate prevention and monotonic numbers.
- `AmountToSpanishWordsTest`: lempira wording.
- `InstitutionalReceiptPdfTest`: HTML fields, copy pages, draft watermark, no fake stamp.
- `InstitutionalReceiptReprintVoidTest`: reprint/void audit.

Frontend Vitest/RTL:

- `InstitutionalReceiptSettingsView.test.tsx`: form controls, permissions, four profiles.
- `ReceiptSettingsPreview.test.tsx`: classic layout labels and no technical fields.
- `InstitutionalReceiptFlow.test.tsx`: POS/history use institutional receipt path.
- Update existing `ReceiptPreview.test.tsx` only for compatibility, not as main flow.

E2E:

- Extend release E2E to create invoice, pay, issue institutional receipt, download/open PDF response, reprint with reason, view operations report.

Manual/physical:

- Test media carta horizontal, A5 horizontal, carta horizontal and custom mm on the hospital printer/driver.
- Validate 100% scale and no fit-to-page.

## 8. Plan de Commits

1. `feat(receipts): add institutional receipt configuration schema`
2. `feat(receipts): add configurable institutional receipt settings api`
3. `feat(receipts): issue institutional receipts with atomic numbering`
4. `feat(receipts): render institutional receipt pdf profiles`
5. `feat(settings): add institutional receipt print configuration`
6. `feat(receipts): integrate institutional receipts with billing flow`
7. `docs(receipts): document institutional receipt printing operations`

Each commit must run focused tests before commit and then `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md` against the diff.

## 9. Riesgos Tecnicos y Mitigaciones

- Duplicate receipt numbers: lock active series row, unique `receipt_number_full`, transaction around issue.
- Ambiguous number after PDF failure: persist receipt first in transaction, generate PDF after commit or in controlled service; failure leaves auditable missing PDF state, not lost number.
- Fake official seal: default is blank physical seal/signature space; authorized image rendering is not enabled in this plan.
- Settings mutation altering old receipts: all emitted receipts store snapshots.
- DomPDF custom paper clipping: test point conversion and document fallback to media carta/A5.
- Technical fields leaking to patient receipt: snapshot/PDF tests assert absence.
- Overbuilding cash boxes: first phase supports global/user/session assignment; real `cash_registers` table can be future phase if hospital defines physical caja catalog.
- Breaking old receipt tests: keep old endpoint as compatibility adapter until all flows migrate.

## 10. Criterios de Aceptacion por Fase

Fase 1:

- Tables migrate from fresh DB.
- Required profiles are seeded.
- No thermal profile is the global default.

Fase 2:

- Admin can configure institution, receipt series, range, current number rules, profile, copies and assignments.
- Unauthorized users cannot update.
- Updates are audited.

Fase 3:

- Paid invoice/cobro can issue a receipt with atomic number.
- Exhausted/inactive/missing series blocks issue.
- Snapshot contains receipt evidence and excludes technical fields.

Fase 4:

- PDF generated in selected real paper size.
- Test print has visible draft watermark.
- Copies are separate pages with proper labels.
- No fake stamp/signature image appears by default.

Fase 5:

- Settings UI exposes template, paper profile, custom dimensions, margins, copies, number color, font/scale, logo toggle and preview.
- Print test works without consuming series.

Fase 6:

- POS full payment generates institutional receipt.
- History reprint requires reason and audit.
- Receipt void requires permission and reason.
- Existing invoice receipts/reporting do not break.

Fase 7:

- Docs explain Windows/PDF scale 100%, paper sizes, fallback, copies, and physical validation.
- Hardware proof remains pending unless actual printer test is documented.

## 11. Comandos de Verificacion

Backend focused:

```powershell
cd C:\Projects\S_Hospital\backend
php artisan migrate:fresh --seed
php artisan test --filter=InstitutionalReceipt
php artisan test --filter=ReceiptProfile
php artisan test --filter=AmountToSpanishWords
vendor/bin/pint --test
vendor/bin/phpstan analyse --memory-limit=1G
```

Frontend focused:

```powershell
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- InstitutionalReceiptSettingsView ReceiptSettingsPreview InstitutionalReceiptFlow --run
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Full quality gate before final merge:

```powershell
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
docker compose exec frontend npm run e2e
```

## 12. Lista de Archivos Esperados por Fase

Fase 1:

- `backend/database/migrations/2026_06_14_000001_create_institutional_receipt_series_table.php`
- `backend/database/migrations/2026_06_14_000002_create_receipt_print_profiles_table.php`
- `backend/database/migrations/2026_06_14_000003_create_institutional_receipts_table.php`
- `backend/database/migrations/2026_06_14_000004_create_institutional_receipt_print_events_table.php`
- `backend/database/migrations/2026_06_14_000005_create_receipt_profile_assignments_table.php`
- `backend/app/Models/InstitutionalReceiptSeries.php`
- `backend/app/Models/ReceiptPrintProfile.php`
- `backend/app/Models/InstitutionalReceipt.php`
- `backend/app/Models/InstitutionalReceiptPrintEvent.php`
- `backend/app/Models/ReceiptProfileAssignment.php`
- `backend/database/seeders/ReceiptPrintProfileSeeder.php`

Fase 2:

- `backend/app/Http/Controllers/InstitutionalReceiptSettingsController.php`
- `backend/app/Http/Requests/InstitutionalReceipts/*`
- `backend/app/Actions/InstitutionalReceipts/ResolveReceiptPrintProfileAction.php`
- `backend/tests/Feature/InstitutionalReceiptSettingsTest.php`
- `backend/tests/Feature/ReceiptProfileAssignmentTest.php`

Fase 3:

- `backend/app/Actions/InstitutionalReceipts/ReserveInstitutionalReceiptNumberAction.php`
- `backend/app/Actions/InstitutionalReceipts/BuildInstitutionalReceiptSnapshotAction.php`
- `backend/app/Actions/InstitutionalReceipts/IssueInstitutionalReceiptAction.php`
- `backend/app/Actions/InstitutionalReceipts/AmountToSpanishWords.php`
- `backend/app/Http/Controllers/InstitutionalReceiptController.php`
- `backend/tests/Feature/InstitutionalReceiptIssueTest.php`
- `backend/tests/Feature/InstitutionalReceiptConcurrentNumberTest.php`
- `backend/tests/Unit/AmountToSpanishWordsTest.php`

Fase 4:

- `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptHtmlBuilder.php`
- `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptPdfService.php`
- `backend/resources/views/pdf/institutional-receipts/classic.blade.php`
- `backend/app/Support/PaperSize.php`
- `backend/tests/Unit/ReceiptPaperProfileTest.php`
- `backend/tests/Feature/InstitutionalReceiptPdfTest.php`

Fase 5:

- `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`
- `frontend/src/features/receipt-settings/components/InstitutionForm.tsx`
- `frontend/src/features/receipt-settings/components/ReceiptSeriesForm.tsx`
- `frontend/src/features/receipt-settings/components/PrintProfilesPanel.tsx`
- `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`
- `frontend/src/features/receipt-settings/receiptSettings.schema.ts`
- `frontend/src/lib/api/institutionalReceipts.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/routes.ts`
- `frontend/src/navigation/appNavigation.ts`

Fase 6:

- `frontend/src/features/receipts/institutional/InstitutionalReceiptViewer.tsx`
- `backend/app/Actions/InstitutionalReceipts/ReprintInstitutionalReceiptAction.php`
- `backend/app/Actions/InstitutionalReceipts/VoidInstitutionalReceiptAction.php`
- `backend/app/Http/Requests/InstitutionalReceipts/ReprintInstitutionalReceiptRequest.php`
- `backend/app/Http/Requests/InstitutionalReceipts/VoidInstitutionalReceiptRequest.php`
- `backend/tests/Feature/InstitutionalReceiptReprintVoidTest.php`
- `frontend/src/features/invoices/InstitutionalReceiptFlow.test.tsx`

Fase 7:

- `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`
- `docs/INSTITUTIONAL_RECEIPT_CONFIGURATION.md`
- `docs/DECISIONS.md`
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF_TEMPLATE.md`

## 13. Revision del Plan con 8 Subagentes

Decision inicial: APROBADO CON CAMBIOS.

| Subagente | Severidad | Hallazgo | Correccion aplicada |
| --- | --- | --- | --- |
| Arquitectura y mantenibilidad | ALTA | El recibo no debe seguir siendo solo una vista derivada de factura. | Se agrega entidad `institutional_receipts`, Actions dedicadas y endpoint nuevo. |
| Base de datos e integridad transaccional | BLOQUEANTE | Serie/correlativo de recibo requiere lock y unique propio. | Se agrega `institutional_receipt_series` y `ReserveInstitutionalReceiptNumberAction`. |
| Seguridad, privacidad y permisos | ALTA | Ajustes fiscales/operativos y anulacion/reimpresion requieren permisos separados. | Se agregan permisos `receipt_settings.*`, `receipts.void`, auditoria en cada mutacion. |
| UI/UX caja hospitalaria | MEDIA | Pantalla actual muestra campos tecnicos y recibo tipo resumen. | Se crea template clasico con campos `El`, `Que`, `Por` y ausencia de campos tecnicos por defecto. |
| Rendimiento y escalabilidad local | MEDIA | PDFs regenerados sin snapshot pueden cambiar o hacer consultas pesadas. | Snapshot JSON completo y PDF path/hash evitan depender de catalogo/settings actuales. |
| Offline LAN, instalacion y respaldos | MEDIA | Impresoras Windows pueden no soportar custom paper. | Docs y UI recomiendan fallback media carta/A5 sin romper flujo. |
| Pruebas, TDD y QA | ALTA | Faltaban pruebas de custom sizes, copias y draft/test print. | Se agregan tests de profiles, PDF, no technical fields, copy pages y watermark. |
| Dominio hospitalario/fiscal | BLOQUEANTE | No se debe renderizar sello/firma falsa ni hardcodear textos oficiales. | Defaults solo espacios fisicos; textos/series/rangos se configuran desde Ajustes. |

Decision final despues de correcciones: APROBADO PARA IMPLEMENTAR FASE 1, siempre una fase por commit y con revision de diff antes de avanzar.

## 14. Checklist de Entrada a Implementacion

- [ ] Usuario aprueba este plan.
- [ ] Crear o cambiar a rama `codex/institutional-receipts-configurable`.
- [ ] Ejecutar Fase 1 solamente.
- [ ] Correr pruebas focales de Fase 1.
- [ ] Commit convencional de Fase 1.
- [ ] Ejecutar `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md` contra el diff.
- [ ] Corregir criticos/altos antes de Fase 2.
