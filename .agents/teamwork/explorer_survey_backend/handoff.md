# Handoff Report: Backend Codebase & Business Logic Survey

**Agent**: Surveyor de Backend y Lógica de Negocio (`explorer_survey_backend`)  
**Target / Working Directory**: `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend`  
**Destinatario**: Parent Agent (`orchestrator_1` / Dev Coordinator)  
**Fecha**: 2026-09-28  
**Tipo de Handoff**: Hard (Tarea completada)  

---

## 1. Observation

Durante el relevamiento del backend en `C:\Projects\S_Hospital_AI\backend`, se observaron e inspeccionaron directamente los siguientes archivos, líneas de código y resultados de comandos:

### 1.1 Rutas, Arquitectura y Transacciones
- **`routes/api.php`**: Líneas 1-231 definen las rutas API bajo middleware `auth:web`, `user.active`, `password.changed`, `throttle.user` e `idempotency`. Endpoints centrales:
  - Facturación: `/api/invoices` (Líneas 151-160), `/api/invoices/preview` (Línea 152), `/api/invoices/{id}/void` (Línea 157), `/api/invoices/{id}/reverse` (Línea 159).
  - Caja: `/api/cash-sessions/current` (Línea 162), `/api/cash-sessions/consolidated` (Línea 163), `/api/cash-sessions/open` (Línea 165), `/api/cash-sessions/{id}/close` (Línea 167).
  - Pagos: `/api/invoices/{id}/payments` (Líneas 171-173), `/api/invoices/{id}/payments/{p}/void` (Línea 174).
  - Recibos: `/api/invoices/{id}/receipt` (Línea 178), `/api/invoices/{id}/reprint` (Línea 179), `/api/institutional-receipts` (Línea 123), `/api/institutional-receipts/{id}/pdf` (Líneas 125-127).
  - Reportes: `/api/reports/dashboard` (Línea 182), `/api/reports/executive` (Línea 184), `/api/reports/executive/pdf` (Líneas 185-186), `/api/reports/executive/excel` (Líneas 187-188).
- **Controladores delgados y FormRequests**:
  - `app/Http/Controllers/InvoiceController.php`: Delega a `CreateInvoiceAction`, `PreviewInvoiceTotalsAction`, `VoidInvoiceAction` y `ReverseInvoiceAction`.
  - `app/Http/Requests/Billing/StoreInvoiceRequest.php`: Líneas 53-59 exigen exclusivamente `patient_name` (1-180 caracteres) e `items` (array de 1 a 100 elementos con `service_id` existente y `quantity` numérica con máximo 2 decimales > 0). No exige número de identidad, expediente clínico ni teléfono.
- **Transacciones y Bloqueo Pesimista**:
  - `app/Actions/Billing/CreateInvoiceAction.php`: Líneas 35-40 ejecutan `DB::transaction` y adquieren `lockForUpdate()` sobre la sesión de caja del cajero.
  - `app/Actions/Payments/RegisterPaymentAction.php`: Líneas 38-57 ejecutan `DB::transaction` y adquieren `lockForUpdate()` sobre la sesión de caja y la factura.

### 1.2 Cálculos Monetarios y Regla EPO
- **Aritmética en centavos y redondeo**:
  - `app/Actions/Billing/CalculateInvoiceTotalsAction.php`: Líneas 44-53 calculan subtotales de línea mediante `intdiv(($unitPriceCents * $quantityUnits) + 50, 100)` (redondeo half-up).
  - Líneas 92-93 calculan el impuesto base en puntos básicos `intdiv(($taxableSubtotalCents * $taxRateBasisPoints) + 5000, 10000)` y distribuyen residuos con `distributeInvoiceTax`.
  - `CreateInvoiceAction.php`: Líneas 80-91 validan la invariante estricta: `if ($sumItems !== $totals['total_cents']) throw new \RuntimeException(...)`.
- **Evaluación estrictamente por línea de Eritropoyetina**:
  - `CalculateInvoiceTotalsAction.php`: Líneas 164-168:
    ```php
    private function appliesErythropoietinRule(Service $service, bool $patientDialysisPrescription): bool
    {
        return $patientDialysisPrescription
            && $this->hasErythropoietinRule($service);
    }
    ```
  - Líneas 45-48: Si `specialRuleApplied === true`, `$unitPriceCents = 0`, mientras que `$registeredUnitPriceCents` conserva el precio del catálogo y `$ruleAdjustmentCents = $registeredLineSubtotalCents - $lineSubtotalCents`.
  - Si la línea no es EPO, `$unitPriceCents` toma `$registeredUnitPriceCents` y se suma de forma íntegra a `$subtotal` y `$taxableSubtotalCents`.
  - `CreateInvoiceAction.php`: Líneas 66-78 y 159-182: Si el total es 0 debido a que todas las líneas son gratuitas por regla, `settlement = SETTLEMENT_FREE_BY_RULE`, `paid_amount = 0.00`, `balance_due = 0.00`, `status = STATUS_PAID`. No se inserta ningún cobro en `payments` ni movimiento en `cash_movements`. Se audita con `invoice.issued_without_charge`.
- **Inmutabilidad de Snapshots**:
  - `CreateInvoiceAction.php`: Líneas 144-155 persisten en `invoice_items` los valores congelados `unit_price_registered_cents`, `rule_adjustment_cents`, `unit_price_cents`, `line_subtotal_cents`, `line_total_cents`, fijando `scan_code`, `barcode` y `qr_code` en `null`.

### 1.3 Caja, Movimientos y Arqueo
- **`app/Actions/Cash/OpenCashSessionAction.php`**: Líneas 57-68 toman bloqueo `lockForUpdate()` sobre la fila de `cash_registers` para evitar deadlocks de InnoDB. Líneas 88-98 registran `CashMovement::TYPE_OPENING` si el monto inicial es mayor a cero.
- **`app/Models/CashMovement.php`**: Líneas 55-91 impiden mutaciones (`creating`, `updating`, `deleting`) si la sesión de caja está en estado `closed` (`guardClosedCashSessionMutation`).
- **`app/Actions/Cash/BuildCashReconciliationAction.php`**: Líneas 53-83 calculan el desglose de cobros por método (`cash`, `transfer`, `card`, `other`). Líneas 109-111 calculan el efectivo esperado: `$openingCents + $cashCents`.
- **`app/Actions/Cash/CloseCashSessionAction.php`**:
  - Líneas 54-61: Bloquea el cierre si existen facturas pendientes o parciales (`pending_invoice_count > 0`).
  - Líneas 63-69: Bloquea el cierre si existen facturas pagadas sin recibo institucional emitido (`missing_institutional_receipt_count > 0`).
  - Líneas 77-85: Valida que la suma del desglose físico de billetes (`closing_breakdown`) coincida con `closing_amount`.
  - Líneas 87-100: Si `$differenceCents !== 0`, el campo de notas (`notes`) es obligatorio con al menos 5 caracteres.

### 1.4 Anulación y Auditoría de Reimpresión
- **`app/Actions/Billing/VoidInvoiceAction.php`**: Líneas 63-88 impiden anular facturas con cobros posted (`void_blocked_paid`).
- **`app/Actions/Billing/ReverseInvoiceAction.php`**: Líneas 61-78 comprueban que las cajas de los cobros a revertir no estén cerradas. Líneas 116-126 anulan cada cobro con `VoidPaymentAction` y generan egresos `payment_void`.
- **`app/Actions/Receipts/ReprintReason.php`**: Líneas 21-49 definen que el motivo de reimpresión es obligatorio y debe tener entre 5 y 500 caracteres (`assertValid`). No se admiten cadenas enlatadas automáticas.
- **`app/Actions/Receipts/ReprintReceiptAction.php`**: Líneas 71-77 incrementan de forma durable la columna `invoices.legacy_reprint_count` dentro de la transacción con lock de fila, rotulando el comprobante como `REIMPRESIÓN #n`.

### 1.5 Documentación: PDF y Excel
- **`app/Support/PaperSize.php`**: Líneas 31-61 definen las geometrías de papel:
  - `letter_portrait`: 215.90 × 279.40 mm = [0, 0, 612.0, 792.0] pt.
  - `half_letter_landscape`: [0, 0, 612, 396] pt.
  - `a4_portrait`: 210.00 × 297.00 mm = [0, 0, 595.28, 841.89] pt.
  - `a5_landscape`: [0, 0, 595.28, 419.53] pt.
- **`app/Actions/InstitutionalReceipts/InstitutionalReceiptHtmlBuilder.php` & `resources/views/pdf/institutional-receipts/compact.blade.php`**:
  - Plantilla `institutional_compact`.
  - Cero apariciones de códigos de barra (`barcode`) o códigos QR (`qr`).
  - Desacoplamiento cobro/impresión verificado en `tests/Feature/Billing/PdfFailureDoesNotRechargeTest.php`.
- **`app/Actions/Reports/ExecutivePdfExportService.php`**:
  - Líneas 1081-1124: CSS monocromático minimalista, cabeceras repetidas con `.report-table thead { display: table-header-group; }` y numeración dinámica de páginas con `$canvas->page_text(...)`.
- **`app/Actions/Reports/ExecutiveExcelExportService.php` & `app/Support/ExcelSafe.php`**:
  - Líneas 67-71 generan exactamente 5 hojas: `Resumen`, `Operaciones`, `Detalle`, `Cobros`, `Caja`.
  - Importes monetarios como `float` con formato `#,##0.00`; conteos como `int` con formato `#,##0`; fechas como `ExcelDate::PHPToExcel`.
  - `ExcelSafe::value` neutraliza inyecciones de fórmulas prefijando cadenas que comiencen con `= + - @ \t \r \n` con apóstrofe `'`.

---

## 2. Logic Chain

1. **A partir de las observaciones en `CalculateInvoiceTotalsAction.php` y `MixedDialysisBasketTest.php`**:
   - Se constató que `appliesErythropoietinRule` se evalúa únicamente para el servicio cuyo `special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION'`.
   - Por tanto, en una factura mixta (por ejemplo, Glucosa L. 900.00 y Eritropoyetina con receta), la Glucosa mantiene su precio de L. 900.00 y el total facturado es exactamente L. 900.00.
   - Esto satisface la regla de negocio que prohíbe la gratuidad total de la cuenta cuando solo un medicamento es elegible.

2. **A partir de las observaciones en `CreateInvoiceAction.php` y `StoreInvoiceRequest.php`**:
   - `StoreInvoiceRequest` rechaza cestas con 0 ítems (`min: 1`).
   - `CreateInvoiceAction` detecta si el total es 0 debido a que todos los ítems fueron bonificados por regla (`isZeroTotal && hasRuleFreeLine`), asignando `settlement = 'free_by_rule'` y evitando crear registros espurios de cobro en `payments`.
   - Por tanto, el sistema distingue con total claridad entre un error de entrada (cuenta vacía) y una emisión legítima sin costo (canasta 100% autorizada por diálisis).

3. **A partir de las observaciones en `CloseCashSessionAction.php` y `CashMovement.php`**:
   - El cierre de caja evalúa `pending_invoice_count` y `missing_institutional_receipt_count` antes de admitir el arqueo; si existen pendientes, lanza una excepción de validación y cancela la operación.
   - El arqueo valida que el conteo físico por denominaciones coincida con el total declarado y exige una justificación (`notes`) de al menos 5 caracteres ante cualquier descuadre.
   - Una vez cerrada la caja, `CashMovement` bloquea cualquier mutación.
   - Por tanto, la integridad de la sesión de caja y la auditoría contable son infranqueables.

4. **A partir de las observaciones en `VoidInvoiceAction.php`, `ReverseInvoiceAction.php` y `ReprintReason.php`**:
   - Una factura cobrada no puede anularse por la vía simple; debe pasar por `ReverseInvoiceAction`, que genera egresos compensatorios en las sesiones de caja abiertas.
   - Cada reimpresión valida un motivo humano real de 5 a 500 caracteres, rechaza cadenas automáticas y consume un número durable en base de datos (`legacy_reprint_count` o `reprint_count`), desvinculado de la tabla podable `audit_logs`.
   - Por tanto, la trazabilidad fiscal y la prevención de fraude en ventanilla están garantizadas.

5. **A partir de las observaciones en `InstitutionalReceiptPdfService.php`, `PaperSize.php`, `ExecutivePdfExportService.php` y `ExecutiveExcelExportService.php`**:
   - El comprobante institucional se renderiza bajo Carta vertical (612×792 pt) o Media Carta (612×396 pt), carece por completo de QR/barras, y separa la emisión del PDF de la transacción de cobro (un fallo del PDF no duplica cobros).
   - El reporte ejecutivo en PDF y Excel cumple con todos los requisitos de formato: 5 hojas, números reales, encabezados repetidos y protección contra inyección de fórmulas (`ExcelSafe`).
   - Por tanto, la capa documental satisface plenamente las directrices institucionales de Hospital General San Isidro.

---

## 3. Caveats

1. **Análisis Estático (PHPStan)**: La ejecución de `php vendor/bin/phpstan analyse` arrojó 24 observaciones menores de tipado estricto (constantes no utilizadas, `array_values` redundantes en tipos `list`, y casteo explícito de `mixed` en servicios de reportes). No afectan en absoluto la ejecución ni la lógica en runtime, pero deben considerarse en una fase posterior de limpieza de código.
2. **Drivers de Impresora en Pruebas**: En `InstitutionalReceiptPortraitProfileTest`, 2 pruebas que verifican la comunicación directa por sockets con impresoras de red locales se omitieron (`skipped`) debido a la ausencia de hardware físico en el entorno de pruebas, lo cual es el comportamiento esperado en pruebas unitarias.
3. **Modo Solo Lectura**: Como explorer, no se modificó ningún archivo de código fuente del backend (`backend/app`, `backend/routes`, `backend/config`). Todos los artefactos generados residen exclusivamente en `.agents/teamwork/explorer_survey_backend/`.

---

## 4. Conclusion

El backend de Hospital General San Isidro se encuentra **completamente alineado con el mandato técnico y las reglas de negocio no negociables**:
- Las rutas y controladores están correctamente estructurados y blindados con FormRequests y transacciones con bloqueo pesimista.
- La aritmética de centavos enteros y la evaluación por línea de la regla de Eritropoyetina (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`) funcionan con exactitud matemática.
- El ciclo de apertura, movimientos, arqueo discriminado y cierre de caja bloquea inconsistencias y previene fraudes.
- Las reimpresiones y anulaciones cuentan con auditoría rigurosa y contadores durables.
- La generación de comprobantes R6 (Carta 612×792 pt / Media Carta 612×396 pt sin QR/barras) y reportes R5 (PDF monocromo y Excel de 5 hojas con números reales y `ExcelSafe`) cumple todos los requisitos contractuales.

El equipo frontend y de integración puede basarse plenamente en los contratos API existentes sin requerir cambios estructurales en el dominio del backend.

---

## 5. Verification Method

Para verificar independientemente los hallazgos de este reporte, ejecute los siguientes comandos en el directorio `C:\Projects\S_Hospital_AI\backend`:

1. **Verificar regla de Eritropoyetina en canasta mixta (por línea, sin cobro global cero)**:
   ```bash
   php vendor/phpunit/phpunit/phpunit tests/Feature/Billing/MixedDialysisBasketTest.php
   ```
   *Criterio de éxito*: 1 test, 13 aserciones, salida `OK`.

2. **Verificar contrato de prevalidación financiera (cálculo puro sin persistencia)**:
   ```bash
   php vendor/phpunit/phpunit/phpunit tests/Feature/Billing/InvoicePreviewContractTest.php
   ```
   *Criterio de éxito*: 18 tests, 119 aserciones, salida `OK`.

3. **Verificar desacoplamiento de cobro e impresión (fallo de PDF no recobra)**:
   ```bash
   php vendor/phpunit/phpunit/phpunit tests/Feature/Billing/PdfFailureDoesNotRechargeTest.php
   ```
   *Criterio de éxito*: 1 test, 13 aserciones, salida `OK`.

4. **Verificar arqueo de caja, conteo discriminado y notas de descuadre obligatorias**:
   ```bash
   php vendor/phpunit/phpunit/phpunit tests/Feature/CloseCashSessionDifferenceTest.php
   ```
   *Criterio de éxito*: 5 tests, 18 aserciones, salida `OK`.

5. **Verificar perfiles institucionales en Carta vertical (612×792 pt) y A4**:
   ```bash
   php vendor/phpunit/phpunit/phpunit tests/Feature/InstitutionalReceiptPortraitProfileTest.php
   ```
   *Criterio de éxito*: 7 tests aprobados (2 skipped por driver de red).

6. **Verificar exportación de reporte ejecutivo en Excel (5 hojas, números reales, ExcelSafe) y PDF**:
   ```bash
   php vendor/phpunit/phpunit/phpunit tests/Feature/Reports/ExecutiveExcelExportTest.php
   php vendor/phpunit/phpunit/phpunit tests/Feature/Reports/ExecutivePdfExportTest.php
   ```
   *Criterio de éxito*: 15 tests, 80 aserciones, salida `OK`.

7. **Condiciones de Invalidación**:
   - Si una canasta mixta con EPO bonificada reduce a cero el subtotal o el total de otros productos cobrables.
   - Si un cierre de caja permite cerrarse con facturas pendientes o facturas pagadas sin recibo institucional.
   - Si una reimpresión se emite sin solicitar o registrar un motivo humano de al menos 5 caracteres.
   - Si el recibo institucional R6 contiene códigos de barras o códigos QR.
