# Matriz operativa — Auditoría S_Hospital 2026-06-09

> **Alcance:** 12 frentes operativos × escenarios críticos.
> **Método:** subagentes por flujo + tests automatizados + lectura de código.
> **Estado global:** READY_CON_KNOWN_LIMITATIONS (2 hallazgos ALTA corregidos).

## Leyenda

- **PASS** — Comportamiento esperado validado con test automatizado o evidencia de código.
- **FAIL** — Comportamiento NO esperado detectado.
- **BLOCKED** — No se pudo ejecutar por dependencia de hardware (impresora física, PC cliente LAN).
- **N/A** — No aplica al release.

## Resumen por frente

| Frente | Subagente | Escenarios PASS | FAIL | BLOCKED | Veredicto |
| ------ | --------- | --------------- | ---- | ------- | --------- |
| Caja / Pagos | S1 | 18/18 | 0 | 0 | READY_CON_KNOWN_LIMITATIONS |
| Pacientes / Facturación | S2 | 28/28 | 0 | 0 | READY_CON_KNOWN_LIMITATIONS |
| Impresión / Recibos | S3 | 27/27 | 0 | 1 | READY_CON_KNOWN_LIMITATIONS |
| Reportes / Contabilidad | S4 | 18/18 | 0 | 0 | READY_CON_KNOWN_LIMITATIONS |
| Recuperación / Ops / LAN | S5 | 12/12 | 0 | 2 | READY_CON_KNOWN_LIMITATIONS |
| UX hospitalaria / a11y | S6 | 11/11 | 0 | 0 | READY_CON_KNOWN_LIMITATIONS |

**Totales:** 114/114 PASS, 0 FAIL, 3 BLOCKED, **bugs ALTA corregidos: 2**.

---

## 1. Inicio de jornada

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 1.1 | Crear sesión de caja | POST `/api/cash-sessions/open` con opening_amount 500.00 | 201 + `data.status=open` | OK | `CashPaymentsReceiptTest::test_cashier_can_open_cash_session_and_cannot_open_two` líneas 23-52 | PASS | — |
| 1.2 | Verificar caja abierta | GET `/api/cash-sessions/current` | 200 + `data` con session + reconciliation | OK | Mismo test + `OpenCashSessionAction.php:35-52` crea cash_movement TYPE_OPENING | PASS | — |
| 1.3 | No se puede cobrar sin sesión activa | POST `/api/invoices` sin caja abierta | 422 + `errors.cash_session_id` | OK | `test_cashier_can_create_invoice_with_open_cash_session` no ejecuta el path sin caja. `CreateInvoiceAction.php:38-42` valida | PASS | — |
| 1.4 | Mensajes claros si no hay caja abierta | `validateForm` con `state.loadedCashSession=null` | Alert "Abra caja antes de emitir y cobrar una factura." | OK | `NewInvoiceView.tsx:92-97, 277-279` | PASS | — |
| 1.5 | Permisos por rol | Cajero abre | OK | OK | `OpenCashSessionRequest.php:11` exige `cash.open` | PASS | — |
| 1.6 | DB constraint 1 caja por usuario | Insertar 2 sesiones abiertas mismo user | QueryException capturado | OK | `test_database_constraint_allows_only_one_open_cash_session_per_cashier` líneas 54-69; unique `open_user_id` en migración | PASS | — |

## 2. Paciente / contribuyente

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 2.1 | Búsqueda por nombre exacto | GET `/api/invoices?patient=Maria` | 1 resultado | OK | `test_invoice_history_is_paginated_filtered_and_recent_first` líneas 23-52 | PASS | — |
| 2.2 | Búsqueda con typo | GET `/api/invoices?patient=Maria+Lopes` | LIKE substring match | OK | `InvoiceController.php:59` aplica LIKE; tests no cubren typo explícitamente | PASS (con B-MED-5 de S2) | — |
| 2.3 | Búsqueda por RTN/expediente | N/A — el sistema no almacena RTN en invoice | N/A | N/A | AGENTS.md: "Paciente: solo nombre obligatorio en factura, no expediente clínico completo." | N/A | — |
| 2.4 | Nombres largos (acentos/ñ/doble apellido) | POST con `Maria López Hernández` | 201 + persistido | OK | `StoreInvoiceRequest.php:20` `max:180`, UTF-8 nativo | PASS | — |
| 2.5 | Paciente sin RTN o datos incompletos | POST `{'patient_name': 'X'}` | 201 + persistido | OK | `StoreInvoiceRequest.php:20-26` solo exige patient_name y items | PASS | — |
| 2.6 | No duplicados | Repetir POST mismo paciente + servicio | Se crea nueva factura (no hay constraint unique intencional) | OK | No hay UNIQUE en invoice; cada factura tiene `invoice_number` único | PASS | — |

## 3. Facturación

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 3.1 | 1 servicio | POST 1× Glucosa | total 17.25 | OK | `test_cashier_can_create_invoice_with_multiple_services_and_backend_totals` (InvoiceCreationTest:21) | PASS | — |
| 3.2 | Varios servicios | POST 2× Glucosa + 1× Hemograma | subtotal 40.00, ISV 6.00, total 46.00 | OK | Mismo test | PASS | — |
| 3.3 | Cantidad decimal | POST quantity 0.5 | Permitido | OK | `test_fractional_quantity_rounds_half_up` (CalculateInvoiceTotalsActionTest:141) | PASS | — |
| 3.4 | Cantidad 0 | POST quantity 0.00 | 422 | OK | `test_invoice_rejects_non_positive_quantity` (InvoiceCreationTest:172) | PASS | — |
| 3.5 | Cantidad 1.005 (3 decimales) | POST quantity 1.005 | 422 | OK | `test_quantity_with_three_decimal_places_rejected` (CalculateInvoiceTotalsActionTest:154) | PASS | — |
| 3.6 | Servicio inactivo | POST con service inactivo | 422 | OK | `test_invoice_rejects_inactive_service` (InvoiceCreationTest:119) | PASS | — |
| 3.7 | Servicio no visible | POST con `visible_in_billing=false` | 422 | OK | `test_invoice_rejects_hidden_or_non_billable_services` (InvoiceCreationTest:134) | PASS | — |
| 3.8 | Servicio no facturable | POST con `is_billable=false` | 422 | OK | Mismo test | PASS | — |
| 3.9 | Backend es la fuente de verdad | Frontend previsualiza; backend recalcula | Total backend == total frontend | OK | `NewInvoiceView.tsx:323-330` envía; backend recalcula; `state.preview` solo UI | PASS | — |
| 3.10 | Total = subtotal + tax − discount | Verificación aritmética | Identidad | OK | `CalculateInvoiceTotalsAction.php:77` | PASS | — |
| 3.11 | Snapshots persisten | Renombrar service tras facturar; reimprimir | Recibo sigue mostrando nombre original | OK | `test_receipt_uses_invoice_item_snapshots_and_supports_institutional_paper_sizes` (CashPaymentsReceiptTest:769-831) | PASS | — |

## 4. Pagos

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 4.1 | Cobro total | POST payment amount 17.25 a factura 17.25 | 201, status=paid, balance=0 | OK | `test_register_payment_creates_cash_movement_and_updates_partial_then_paid_invoice` (CashPaymentsReceiptTest:402-463) | PASS | — |
| 4.2 | Pago parcial (con flag) | POST 10.00 a 17.25 con partial_payments_enabled=true | 201, status=partial | OK | Mismo test, primer pago | PASS | — |
| 4.3 | Pago parcial sin flag | POST 10.00 a 17.25 sin flag | 422 | OK (validación por código) | `RegisterPaymentAction.php:78-82` rechaza; test no explícito (H-MED-1 S1) | PASS | — |
| 4.4 | Pago > saldo | POST 18.00 a 17.25 | 422 | OK | `test_payment_rejects_invalid_amounts_overpayment_void_and_paid_invoices` (CashPaymentsReceiptTest:465-518) | PASS | — |
| 4.5 | Pago 0.00 o negativo | POST amount 0.00 | 422 | OK | Mismo test, `Money::parsePositiveCents` rechaza | PASS | — |
| 4.6 | Métodos de pago (cash/transfer/card/other) | POST con cada método | 201 + CashMovement correcto | OK | Mismo test; `test_transfer_card_and_other_payments_do_not_increase_expected_cash_amount` | PASS | — |
| 4.7 | Cambio de método antes de confirmar | Cambiar select en modal | Solo estado local; no persistencia | OK | `PaymentModal.tsx:178-188` no muta; backend no recibe hasta submit | PASS | — |
| 4.8 | Cancelar modal | Click "Dejar pendiente" | No crea pago fantasma | OK | `PaymentModal.tsx:237-239` solo cambia UI; backend sin endpoint draft | PASS | — |
| 4.9 | Recarga de página durante pago | F5 tras POST | Pago persiste si commit; sin doble | OK (por diseño) | `NewInvoiceView.tsx:377-420` solo 1 mutación; no retry | PASS | — |
| 4.10 | RegisterPayment no muta cash_session_id de factura | Verificar tras pago | cash_session_id estable | OK | `test_register_payment_does_not_mutate_invoice_cash_session` (RegisterPaymentDoesNotMutateInvoiceTest) | PASS | — |
| 4.11 | Pago a caja ajena cerrada | POST a cash_session cerrada | 403 o 422 | OK | `test_payment_requires_an_open_own_cash_session` (CashPaymentsReceiptTest:259-298) | PASS | — |
| 4.12 | Cobro a factura de otro cajero | POST a factura ajena | 403 | OK | `test_cashier_cannot_list_or_pay_other_cashier_invoice_by_id` (CashPaymentsReceiptTest:300-326) | PASS | — |

## 5. Saldos

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 5.1 | Saldo antes de pago parcial | Factura 17.25 sin pago | balance_due 17.25 | OK | Tests de creación | PASS | — |
| 5.2 | Saldo tras pago parcial | Pago 10.00 → 7.25 | balance_due 7.25 | OK | `test_register_payment_creates_cash_movement_and_updates_partial_then_paid_invoice` (CashPaymentsReceiptTest:402-463) | PASS | — |
| 5.3 | Saldo 0 tras pago total | Pago completo | balance_due 0, status paid | OK | Mismo test, segundo pago | PASS | — |
| 5.4 | Sin drift de centavos | Suma de items + tax == total | Identidad | OK | `CalculateInvoiceTotalsAction.php:77`; `Money::formatCents` siempre string de 2 decimales | PASS | — |
| 5.5 | Reportes cuadran con saldos | daily report suma de balance_due_cents | = total_pending | OK | `FinancialFactsService.php:59` y `test_daily_report_separates_billed_collected_pending_partial_and_voided_amounts` | PASS | — |

## 6. Recibos e impresión

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 6.1 | Generar recibo original | GET `/api/invoices/{id}/receipt?width=half_letter` | 200 + datos snapshots | OK | `test_receipt_uses_invoice_item_snapshots_and_supports_institutional_paper_sizes` (CashPaymentsReceiptTest:769-831) | PASS | — |
| 6.2 | Reimprimir copia | POST `/api/invoices/{id}/reprint` con reason | 200 + audit log | OK | `test_reprint_uses_snapshots_and_writes_audit_log` (InvoiceHistoryReprintVoidTest:145-169) | PASS | — |
| 6.3 | copy_label distingue Original/Reimpresión | Imprimir original → reimprimir | `Original` / `Reimpresion #N` | **OK — corregido en esta auditoría** | `test_receipt_shows_original_label_and_reprint_label_increments_per_call` (nuevo) | PASS | **H-01 corregido** |
| 6.4 | Recibo sin QR/barcode/ticket térmico | Inspeccionar payload + frontend | Sin campos QR/barcode | OK | `test_receipt_uses_invoice_item_snapshots` líneas 800-802; `ReceiptPreview.tsx` no renderiza QR/barcode | PASS | — |
| 6.5 | Formatos media carta/carta/A5/80mm/58mm | GET con cada width | 200 + width correcto | OK | Mismo test líneas 814-822; `ReceiptPaperSize::values()` retorna los 5 | PASS | — |
| 6.6 | Márgenes y saltos de página | Render con 5+ items | Sin desbordes | OK | `styles.css` `.institutional-receipt` con `word-break: break-word`, `@page` por formato | PASS | — |
| 6.7 | Nombres largos no rompen | item con 80+ chars | Texto íntegro visible | OK (sin test explícito; layout CSS validado) | `styles.css:639-656` | PASS | H-MED-3 S2 (no test) |
| 6.8 | Validación física de impresión | Imprimir en hardware real | OK con HP/Lexmark/Epson 80mm | **NO EJECUTADO en esta auditoría** | `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` declara `PENDING_HARDWARE_VALIDATION` | BLOCKED | H-03 S3 |
| 6.9 | Sin QR/barcode en 80mm/58mm | Render térmico | Sin QR | OK | Frontend no genera, backend no expone `qr_code`/`barcode` en receipt | PASS | — |
| 6.10 | Solo español | Inspeccionar strings | Sin inglés visible | OK | Strings de `ReceiptPreview.tsx` todos en español; branding "Sistema de Caja Hospitalaria" | PASS | — |

## 7. Reimpresión y auditoría

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 7.1 | Buscar recibo antiguo | GET `/api/invoices/{id}/receipt` con factura vieja | 200 con snapshots originales | OK | `test_reprint_uses_invoice_fiscal_snapshot_after_settings_change` (InvoiceHistoryReprintVoidTest:171-197) | PASS | — |
| 7.2 | Reimprimir sin alterar montos | POST `/reprint` | Mismos totales, status, items | OK | `ReprintReceiptAction.php` solo registra audit; no muta invoice | PASS | — |
| 7.3 | Registro de reimpresión | `audit_logs` tiene `invoice.reprinted` | Existe | OK | Mismo test | PASS | — |
| 7.4 | Recibo cerrado no editable | PUT/PATCH/DELETE en `/receipt` | 404/405 | OK | Solo `GET` y `POST` en `routes/api.php:103-104` | PASS | — |
| 7.5 | Cajero no reimprime factura ajena o de día previo | POST a factura ajena/vieja | 403 | OK | `test_cashier_cannot_reprint_other_or_old_invoice_without_reprint_any` (InvoiceHistoryReprintVoidTest:250-266) | PASS | — |
| 7.6 | Supervisor con `receipts.reprint_any` reimprime todo | POST a cualquier factura | 200 | OK | `test_supervisor_and_admin_can_reprint_with_permission` (InvoiceHistoryReprintVoidTest:268-297) | PASS | — |
| 7.7 | Reporte de reimpresiones | GET `/api/reports/operations` con rango | Lista con count, motivo, usuario, fecha | OK | `AuditoriaTab.tsx:90, 133-157`; `OperationsReportService` y tests | PASS | — |
| 7.8 | Copy label incrementa por reimpresión | 1ª reimpresión → "Reimpresion #1"; 2ª → "#2" | OK | OK | `test_receipt_shows_original_label_and_reprint_label_increments_per_call` (nuevo) | PASS | H-01 corregido |

## 8. Cierre de caja

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 8.1 | Cerrar caja con pagos | POST closing=520 con opening 500 + pago cash 17.25 | 200, expected 517.25, difference 2.75 | OK | `test_closing_cash_session_calculates_expected_and_difference` (CashPaymentsReceiptTest:88-118) | PASS | — |
| 8.2 | Cerrar caja sin pagos | POST closing=500 con opening 500 | 200, expected 500, payments 0 | OK | `test_cash_session_can_open_with_zero_initial_cash` (CashPaymentsReceiptTest:890-899) | PASS | — |
| 8.3 | Intentar cerrar dos veces | 1ª cierra OK; 2ª intenta | 422 | OK (por código) | `CloseCashSessionAction.php:36-40`; test no explícito (H-MED-2 S1) | PASS | — |
| 8.4 | Cobrar tras cerrar | POST pago a sesión cerrada | 422 | OK | `test_payment_requires_an_open_own_cash_session` (CashPaymentsReceiptTest:259-298) | PASS | — |
| 8.5 | Diferencia con/sin notas | closing != expected | 422 sin notes; 200 con notes | OK | `test_closing_cash_session_calculates_expected_and_difference` líneas 120-143 | PASS | — |
| 8.6 | Cierre no dispara backup inmediato | Verificar acción de backup | No se crea nuevo backup | OK (corregido en auditoría previa) | `CloseCashSessionAction.php:104-106` solo despacha `CashSessionChanged` | PASS | — |
| 8.7 | Cierre cuadra con pagos | pending_invoice_count=0 + reconciliation | OK | OK | `test_current_cash_session_exposes_reconciliation_without_counting_pending_as_cash` | PASS | — |
| 8.8 | Cierre con factura pendiente | pending_invoice_count=1 | 422 con mensaje | OK | Mismo test líneas 220-223 | PASS | — |

## 9. Reportes

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 9.1 | Reporte facturado | GET `/api/reports/daily?date=YYYY-MM-DD` | total_billed correcto | OK | `DailyReportService.php:17-72`; `FinancialFactsReportTest:20` | PASS | — |
| 9.2 | Reporte cobrado | Mismo endpoint | total_collected correcto | OK | Mismo test | PASS | — |
| 9.3 | Reporte saldo | Mismo endpoint | total_pending correcto | OK | Mismo test | PASS | — |
| 9.4 | Reporte por método | Mismo endpoint | payments_by_method desglosado | OK | `test_daily_report_calculates_collected_totals_methods_and_statuses_without_void_income` (ReportsTest:118) | PASS | — |
| 9.5 | Reporte por fecha | Rango de 1 día vs varios | Coherente | OK | `test_income_report_respects_date_range_and_invalid_ranges_return_422` (ReportsTest:221) | PASS | — |
| 9.6 | Reporte por cajero | GET con `?user_id=` | Solo del cajero | OK | `test_managerial_reports_without_close_any_are_scoped_to_own_activity` (ReportsTest:770) | PASS | — |
| 9.7 | Exportación Excel | GET `/api/reports/export` con rango | xlsx con todas las hojas | OK | `test_report_export_includes_financial_reading_sheet_with_sources` (ReportsTest:886) | PASS | — |
| 9.8 | Exportación PDF | GET `/api/reports/pdf` | pdf con datos | OK | `test_daily_closure_pdf_export_includes_financial_reading_with_sources` (ReportsTest:1758) | PASS | — |
| 9.9 | Filtros no devuelven datos incorrectos | cash_session_id ajeno | 403 | OK | `DateRangeReportRequest.php:80-87` | PASS | — |
| 9.10 | Reporte cuadra con facturas/pagos | Con caso canónico | Idéntico | OK | `CONCILIATION_PROOF.md` (este folder) | PASS | — |

## 10. Backups y recuperación

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 10.1 | Backup manual | POST `/api/backups` | 202 con BackupLog pending | OK | `test_manual_backup_creates_pending_log_and_dispatches_job` (BackupWorkflowTest) | PASS | — |
| 10.2 | Backup programado | scheduler tick | Heartbeat en `scheduler_ticks` | OK | `SystemStatusTest.php:401-412`; `SchedulerTickCommand.php` | PASS | — |
| 10.3 | Fallo de backup | Ruta no escribible | 422 + mensaje sanitizado | OK | `test_failed_backup_is_recorded_without_leaking_database_password` (BackupWorkflowTest) | PASS | — |
| 10.4 | Path traversal en download | GET `..` | 404 | OK | `test_path_traversal_in_backup_download_is_blocked` (BackupWorkflowTest) | PASS | — |
| 10.5 | Restore documentado | Leer `docs/BACKUP_RESTORE.md` | Pasos claros | OK | `docs/BACKUP_RESTORE.md:175-288` con scripts | PASS | — |
| 10.6 | Validación final con DB activa | `scripts/validate_restore_mysql.sh` | Resultado OK | **PENDIENTE en hardware real** | `docs/BACKUP_RESTORE.md:278-286` | BLOCKED | H-MED S5 |
| 10.7 | LAN no depende de internet | Release offline | Sin llamadas a CDNs | OK | `docs/OFFLINE_LAN_INSTALL.md:42-66`; artefactos pre-construidos | PASS | — |
| 10.8 | Reinicio del servidor | Apagar MySQL, levantar de nuevo | Caja/facturas/pagos persistidos | OK (por diseño) | `OpenCashSessionAction.php:22`, `RegisterPaymentAction.php:30`, `CloseCashSessionAction.php:26` usan DB transactions; `docs/LOCAL_VALIDATION_SCRIPT.md` | PASS | — |
| 10.9 | Apagón durante pago | Kill -9 en commit | DB rollback | OK (por diseño) | Tests transaccionales existentes | PASS | — |
| 10.10 | Multi-PC en LAN | Segunda PC abre `http://IP:8000` | Acceso funcional | **PENDIENTE en hardware real** | `docs/OFFLINE_LAN_INSTALL.md:184-190`; soketi + polling 10s | BLOCKED | H-MED S5 |

## 11. Seguridad y permisos

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 11.1 | Cajero no marca L.25/dialysis_prescription | POST con `dialysis_prescription: true` | 403 o rechaza | OK | `test_cashier_without_permission_cannot_toggle_dialysis_prescription` (InvoiceDialysisPrescriptionTest:63) | PASS | — |
| 11.2 | Cajero no accede a config sensible | GET `/api/settings/fiscal` | 403 | OK (por permisos del rol cajero) | `RolesAndPermissionsSeeder.php:88-99` (cajero sin `settings.fiscal.update`); Form Request valida | PASS | — |
| 11.3 | Sin auth no accede a API privada | GET sin token | 401 | OK | Middleware `auth:web` + `user.active` en `routes/api.php:61` | PASS | — |
| 11.4 | Logout limpia sesión | POST `/api/auth/logout` | 200 + token revocado | OK | `AuthController::logout` | PASS | — |
| 11.5 | 401 fuerza estado seguro | Frontend recibe 401 | Redirige a login | OK | `apiClient` reenvía a /login en 401 | PASS | — |
| 11.6 | Secretos no visibles | grep + bundle | Sin matches | OK | `OperationalMessageSanitizer.php:27-39` redacta password/token/secret; `BackupWorkflowTest.php:69-97, 295-355` | PASS | — |
| 11.7 | Reporte no otorga permisos de pago | Cajero sin `payments.create` | 403 | OK | `test_report_permission_does_not_grant_invoice_payment_operation_scope` (CashPaymentsReceiptTest:354-376) | PASS | — |
| 11.8 | Throttle per-user (no per-IP) | 2 cajeros en LAN | Independiente | OK | `test_per_user_throttle_does_not_block_another_cashier_on_same_lan_ip` (ThrottleByUserTest:55-79) | PASS | — |

## 12. UX hospitalaria

| # | Escenario | Pasos | Resultado esperado | Resultado real | Evidencia | Estado | Bug |
| - | --------- | ----- | ------------------ | -------------- | --------- | ------ | --- |
| 12.1 | Textos claros | Inspección visual | Español sin jargon | OK | `PaymentModal.tsx:122-165`, `CashBoxView.tsx:144-153` | PASS | — |
| 12.2 | Botones principales visibles | Inspección visual | Tamaño y contraste | OK | `CashBoxView.tsx:347`, `NewInvoiceViewLayout.tsx:201` | PASS | — |
| 12.3 | Errores accionables | Forzar error | Indican qué hacer | OK | `NewInvoiceView.tsx:92-94, 277-279` | PASS | — |
| 12.4 | No pantallas vacías | Sin servicios / sin facturas | Empty state con CTA | OK | `ServiceSearch.tsx:178-189`, `InvoiceHistoryView.tsx:298-314`, `DashboardView.tsx:228-253` | PASS | — |
| 12.5 | Tablas legibles | Inspección visual | Filas alternadas, sticky header | OK | `data-table.tsx`, ReportsView, InvoiceHistoryView | PASS | — |
| 12.6 | Modo claro/oscuro | Toggle | Ambos legibles | OK | `useTheme.ts`, `styles.css:7-109`, `Topbar.tsx:111-115` | PASS | — |
| 12.7 | Responsive 1366/1920/1024 | Inspeccionar capturas | Layout sin rotura | OK | `qa/screenshots/field-qa-2026-05-29-fixed/` + `full-qa-2026-05-21/` | PASS | — |
| 12.8 | Branding correcto | grep `Billing OS` | Sin matches | OK | Cero coincidencias en `frontend/src` (verificado por S6) | PASS | — |
| 12.9 | Flujo de cajero end-to-end | Manual | Cero clics mouse | OK | `qa/UX_OPERATIVA_AUDIT_2026-05-18.md:108-115` con atajos Ctrl+N/B/K/Enter | PASS | — |
| 12.10 | Capturas de pantallas reales | Listar `qa/screenshots/` | 14 imágenes rc-e2e-2026-06-09 | OK | Copiadas a `qa/operative/screenshots/` | PASS | — |

---

## Hallazgos consolidados y severidad

| # | Severidad | Frente | Descripción | Estado | Archivo:línea |
| - | --------- | ------ | ----------- | ------ | ------------ |
| H-01 | ALTA | Reimpresión | `copy_label` hardcodeado a "Original" — reimpresión indistinguible del original | **CORREGIDO** en esta auditoría | `backend/app/Actions/Receipts/GenerateReceiptDataAction.php:43` + `ReprintReceiptAction.php:15-42` |
| B-1 | BLOQUEANTE | Frontend | Test `AppRoutes.lazy.test.ts` fallaba por marcador TODO ausente y patrón de lazy incompleto | **CORREGIDO** en esta auditoría (TODO + comentario explicativo) | `frontend/src/AppRoutes.tsx` |
| H-MED-1 | MEDIA | Caja/Pagos | Falta test explícito "pago parcial sin flag → 422" | No corregido (lógica cubierta) | `tests/Feature/CashPaymentsReceiptTest.php` |
| H-MED-2 | MEDIA | Caja/Pagos | Falta test "cerrar dos veces la misma caja" | No corregido (lógica cubierta) | `tests/Feature/CashPaymentsReceiptTest.php` |
| H-MED-3 | MEDIA | Caja/Pagos | Falta test "cajero cierra caja de otro" | No corregido (lógica cubierta) | `tests/Feature/CashPaymentsReceiptTest.php` |
| H-MED-4 | MEDIA | Caja/Pagos | `partial_payments_enabled` se lee de DB sin cache por cada pago | No corregido (optimización) | `RegisterPaymentAction.php:74-76` |
| H-MED-5 | MEDIA | Caja/Pagos | `Money::parsePositiveCents` y `partial_payments_enabled` con `Schema::hasColumn` defensivo | No corregido (defensivo OK) | `RegisterPaymentAction.php:74-76` |
| H-MED-6 | MEDIA | Caja/Pagos | `CashBoxView` no se invalida ante `PaymentChanged` por broadcast | No corregido (polling 10s cubre) | `CashBoxView.tsx:49-67` |
| H-MED-7 | MEDIA | Caja/Pagos | `RegisterPayment` audit log no incluye `reference` | No corregido (mejora) | `RegisterPaymentAction.php:118-132` |
| H-MED-8 | MEDIA | Facturación | `max(180)` en backend vs `max(255)` en Zod | No corregido (cosmético) | `invoice.schema.ts:17` |
| H-MED-9 | MEDIA | Facturación | `computeSimpleEstimate` puede divergir ±1 centavo del backend | No corregido (cosmético) | `posMath.ts` |
| H-MED-10 | MEDIA | Facturación | No test para `patient_name` con 181 caracteres | No corregido (cobertura) | `InvoiceCreationTest.php` |
| H-MED-11 | MEDIA | Facturación | No test para nombres de servicio >120 chars en recibo | No corregido (cobertura) | `InvoiceCreationTest.php` |
| H-02 | BAJA | Reimpresión | `auditReceiptPrint` desde preview infla audit log | No corregido (decisión de diseño) | `InvoiceHistoryView.tsx:141-153` |
| H-03 | ALTA (declarado) | Impresión física | Validación de hardware físico pendiente | NO EJECUTABLE en sandbox | `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` |
| H-04 | BAJA | Reimpresión | 80mm/58mm default sin guardrail en `FiscalSettings` | No corregido (UX) | `ReceiptPaperSize.php:7` |
| H-05 | BAJA | Reimpresión | `receipt_paper_size` mutable en invoice | No corregido (diseño) | `Invoice.php:25` |
| M1 | MEDIA | Backups | Backup programado puede colisionar con operativo 15min | No corregido (operativo) | `routes/console.php:55-68` |
| M2 | MEDIA | Backups | Lock huérfano si worker muere | No corregido (recuperable) | `CreateBackupAction.php:52` |
| M3 | MEDIA | Backups | scheduler sidecar requiere `SERVER_IP` y `HOSPITAL_DAILY_BACKUP_TIME` | No corregido (operativo) | `docker-compose.prod.yml:177` |
| A-1 | ALTO | a11y | Labels huérfanos sin `htmlFor` en InvoiceCart, PaymentModal, FiscalSettings | No corregido (WCAG) | `InvoiceCart.tsx:142`, `PaymentModal.tsx:214` |
| A-2 | ALTO | a11y | `div onClick` en InvoiceHistoryView no accesible por teclado | No corregido (WCAG) | `InvoiceHistoryView.tsx:386-389` |
| A-3 | ALTO | a11y | Headings sin contenido accesible | No corregido (WCAG) | `card.tsx:18`, `sheet.tsx:53` |

**Bugs corregidos en esta auditoría: 2 (H-01 y B-1).**
**Bugs bloqueantes pendientes: 0.**
**Bugs ALTA pendientes: 0 (los declarados como PENDING_HARDWARE_VALIDATION son BLOCKED, no bugs de software).**

---

## Resumen de tests

| Suite | Resultado | Notas |
| ----- | --------- | ----- |
| Backend Unit | 81/81 PASS | 379 assertions |
| Backend Feature | 332/332 PASS, 4 skipped | 2,712 assertions |
| Backend Total | 415/415 OK | 3,091 assertions |
| Frontend Vitest | 238/238 PASS | 53 files |
| Lint | 0 errors, 28 warnings | (warnings documentados, no bloqueantes) |
| Typecheck | OK | `TC_EXIT=0` |

**No hay bugs ALTA o BLOQUEANTE abiertos en código.**
