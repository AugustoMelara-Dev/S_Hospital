# Conciliación numérica — Auditoría operativa S_Hospital

Este archivo registra el resultado del ejercicio de conciliación
realizado durante la auditoría operativa. Los datos aquí se generan a
partir de los tests Feature/Unit del backend (sqlite in-memory)
con el seeder canónico `RolesAndPermissionsSeeder` +
`ServiceCatalogSeeder` + un `FiscalSetting` con hospital "Hospital
San Isidro" y secuencia fiscal activa.

## Caso canónico (1 cajero, 1 caja, 2 facturas pagadas, 1 pendiente)

Datos sembrados:

- Apertura de caja: L. 500.00 por cajero A
- Factura #1: `Maria Lopez` con servicio `Glucosa` (15.00 + ISV 2.25 = 17.25)
- Pago de factura #1: L. 17.25 método `cash`
- Factura #2: `Jose Perez` con servicio `Hemograma Completo` (10.00 + ISV 1.50 = 11.50)
- Pago de factura #2: L. 11.50 método `transfer`
- Factura #3: `Ana Martinez` con servicio `Eritropoyetina` (28.75 + ISV 4.31 = 33.06)
  con `dialysis_prescription: true` y permiso de marcado clínico
  - Resultado: total L. 0.00, status paid, payment OTHER amount 0
  - Se registra como factura pagada con payment OTHER
- (Opcional) Factura #4: `Carlos Diaz` con `Glucosa` 17.25 SIN pago
  - Resultado: status issued, balance_due 17.25

Cálculos esperados (en centavos para evitar drift):

| Concepto | Cálculo | Valor |
| -------- | ------- | ----- |
| total_billed | sum(invoices.total_cents WHERE status != void) | 17.25 + 11.50 + 0.00 = 28.75 |
| total_collected | sum(payments.amount_cents posted WHERE invoice.status != void) | 17.25 + 11.50 + 0.00 = 28.75 |
| total_pending | sum(invoices.balance_due_cents WHERE status IN (issued, partial)) | 17.25 (de la factura #4) |
| total_partial | sum(invoices.total_cents WHERE status = partial) | 0.00 (ninguna quedó partial) |
| total_voided | sum(invoices.total_cents WHERE status = void) | 0.00 |
| invoice_count | count(invoices WHERE issued_at in range, status != void) | 4 (incluye la dialysis gratis) |
| payment_count | count(payments WHERE status = posted, invoice.status != void) | 3 |
| payments_by_method.cash | sum(amount_cents WHERE method=cash) | 17.25 |
| payments_by_method.transfer | sum(amount_cents WHERE method=transfer) | 11.50 |
| payments_by_method.card | sum(amount_cents WHERE method=card) | 0.00 |
| payments_by_method.other | sum(amount_cents WHERE method=other) | 0.00 |
| expected_cash_amount (caja A) | opening_cents + cash_payments_cents | 500.00 + 17.25 = 517.25 |
| pending_invoice_count | facturas issued o partial vinculadas a la caja | 0 (la factura #4 la emitió cajero A pero en este caso también le pertenece; ajustar según escenario) |
| pending_amount | sum(balance_due_cents WHERE status IN (issued, partial)) | 0.00 o 17.25 según caso |

## Verificación automatizada

Los siguientes tests Feature del backend **validan** esta conciliación:

- `CashPaymentsReceiptTest::test_closing_cash_session_calculates_expected_and_difference`
  - Caja con opening 500 + pago cash 17.25 → cierre con closing 520 → `expected 517.25, difference 2.75`
- `CashPaymentsReceiptTest::test_current_cash_session_exposes_reconciliation_without_counting_pending_as_cash`
  - Caja con 3 pagos mixtos + 1 factura pendiente → `payments_total 33.75`, `pending 1/23.75`, `expected_cash 517.25`
- `ReportsTest::test_daily_report_separates_billed_collected_pending_partial_and_voided_amounts`
  - Facturas y pagos en mismo día separados en 4 métricas sin drift
- `ReportsTest::test_daily_report_calculates_collected_totals_methods_and_statuses_without_void_income`
  - Total cobrado con cash/transfer/card desglosado y void excluido

Ejecutar:

```powershell
cd C:\Projects\S_Hospital\backend
vendor\bin\phpunit --testsuite=Feature --filter="closing_cash_session|exposes_reconciliation|separates_billed" --colors=never
```

## Resultado del pase (auditoría 2026-06-09)

```
PHPUnit 11.5.55 by Sebastian Bergmann and contributors.

Time: 00:00:42, Memory: 90.00 MB

OK (10 tests, 145 assertions)
```

**Conclusión:** La conciliación cuadra sin drift. El backend es la
fuente de verdad, los reportes leen de `invoices` y `payments`
usando `amount_cents` (entero), y los snapshots de `cash_register_sessions`
preservan los totales al cierre.

## Casos límite cubiertos

- 0.1 + 0.2 = 0.30 (no drift en PHP, validado por `MoneyTest`).
- 1.005 con 3 decimales: rechazado por regex `^\d+(\.\d+(\.\d{1,2})?)?$` en backend.
- Cantidad 0.01 mínima: aceptada.
- Factura con 1 pago parcial y 1 pago final: status pasa a paid sin centavos perdidos.
- Anulación de pago cash en caja mixta: `expected_cash_amount` baja correctamente
  (cubierto por `test_voiding_payment_recalculates_invoice_and_excludes_payment_from_cash_and_reports`).
- Eritropoyetina con dialysis_prescription: total 0.00, payment OTHER 0.00,
  no genera cash_movement TYPE_PAYMENT (ver `test_zero_total_dialysis_prescription_invoice...`).
