# Informe de Relevamiento de Código Backend y Lógica de Negocio
**Proyecto**: Sistema de Caja - Hospital General San Isidro  
**Misión**: Reconstrucción y Levantamiento Integral de la Operación y Backend  
**Fecha**: 2026-09-28  
**Autor / Rol**: Surveyor de Backend y Lógica de Negocio (`explorer_survey_backend`)  
**Directorio de trabajo**: `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend`  
**Directorio de código inspeccionado**: `C:\Projects\S_Hospital_AI\backend`  

---

## 1. Resumen Ejecutivo

El backend de **S_Hospital** está construido sobre **Laravel 12** con **PHP 8.2+**, diseñado específicamente para operar en un entorno de red de área local (**LAN offline**) sin dependencias en la nube ni conexión a internet en producción. 

El análisis exhaustivo de la arquitectura, rutas, controladores, acciones de dominio, modelos y pruebas automatizadas revela un sistema con un estándar de ingeniería sumamente riguroso:
- **Separación de responsabilidades limpia**: controladores ultradelgados (`Controllers`), peticiones con validación y autorización integradas (`FormRequests`), orquestación de reglas de negocio en acciones de dominio de responsabilidad única (`Actions`), y persistencia atómica respaldada por transacciones de base de datos con bloqueos pesimistas (`SELECT ... FOR UPDATE`).
- **Aritmética monetaria exacta**: el sistema opera enteramente en centavos enteros (`int` / `amount_cents`), previniendo errores de redondeo de punto flotante en subtotales, ISV, pagos y saldos.
- **Regla de Eritropoyetina (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`) estricta**: la gratuidad por diálisis/receta se evalúa exclusivamente a nivel de línea para el medicamento elegible. Los demás productos y servicios de la cuenta conservan su precio de catálogo íntegro; la cuenta no se convierte en gratuita de forma global.
- **Control de caja y arqueo sin fisuras**: las sesiones de caja garantizan unicidad por cajero y por terminal física; el cierre valida previamente que no existan facturas pendientes ni facturas pagadas sin recibo institucional emitido; el arqueo soporta conteo por denominaciones de billetes y exige justificación obligatoria de al menos 5 caracteres si hay descuadre.
- **Auditoría inmutable de reimpresiones y anulaciones**: las reimpresiones exigen un motivo humano no automático de 5 a 500 caracteres (`ReprintReason`) y gestionan contadores durables en base de datos; las anulaciones de facturas pagadas exigen reverso de cobro y egreso compensatorio de caja.
- **Generación documental de alta precisión**: comprobantes institucionales (R6) en Carta vertical (612×792 pt), Media Carta horizontal (612×396 pt), A4 y A5 sin códigos de barras ni QR; reportes ejecutivos (R5) en PDF con cabeceras repetidas en saltos de página y en Excel (.xlsx) estructurado en 5 hojas con tipos numéricos reales y desinfección contra inyección de fórmulas.

---

## 2. Arquitectura, Rutas, Controladores, FormRequests, Políticas y Transacciones

### 2.1 Estructura Arquitectónica
El backend implementa un patrón **Action-Domain-Responder** adaptado a Laravel:
- **Rutas (`routes/api.php`)**: endpoints RESTful agrupados por dominio bajo middleware de sesión con estado (`Sanctum`), control de acceso activo (`user.active`), verificación de cambio de clave inicial (`password.changed`) y limitación de tasa por usuario (`throttle.user`). Las rutas mutantes críticas (`POST`, `PATCH`, `DELETE`) integran el middleware `idempotency`.
- **Controladores (`app/Http/Controllers`)**: actúan como adaptadores HTTP delgados. No contienen lógica de cálculo ni persistencia directa; delegan la orquestación a clases `Action` o `Service` e inyectan FormRequests tipados.
- **FormRequests (`app/Http/Requests`)**: centralizan la autorización (`authorize()`) y las reglas de validación (`rules()`), además de normalizar entradas (p. ej. colapso de espacios en blanco de nombres de pacientes con `normalizePatientName`).
- **Políticas y Permisos (`app/Policies`)**: integración con `Spatie\Permission`. Cada entidad crítica (`Invoice`, `CashRegisterSession`, `Payment`, `Service`, `User`) tiene su correspondiente Policy verificando permisos explícitos (`invoices.create`, `invoices.void`, `invoices.reverse`, `cash.open`, `cash.close`, `cash.close_any`, `patients.mark_dialysis_prescription`, `receipts.reprint`, etc.).
- **Transacciones de Base de Datos**: todas las operaciones de escritura en facturación, caja, pagos, anulaciones y comprobantes están envueltas en `DB::transaction(...)`.

### 2.2 Inventario de Endpoints Principales

| Dominio | Método y Ruta | Controlador y Acción | Middleware Clave | Descripción |
|---|---|---|---|---|
| **Autenticación** | `POST /api/auth/login` | `AuthController@login` | `LoginLockout`, `throttle:auth-login` | Inicio de sesión seguro con protección de fuerza bruta. |
| | `GET /api/auth/session` | `AuthController@session` | `throttle.user:30,1` | Consulta de estado de sesión. |
| | `GET /api/auth/me` | `AuthController@me` | `auth:web`, `user.active` | Perfil y permisos del usuario autenticado. |
| | `POST /api/auth/logout` | `AuthController@logout` | `auth:web` | Cierre de sesión e invalidación de token. |
| **Facturación** | `GET /api/invoices` | `InvoiceController@index` | `auth:web`, `password.changed` | Historial paginado con filtros por fecha, estado, paciente, caja y correlativo. |
| | `POST /api/invoices/preview` | `InvoiceController@preview` | `invoices.create`, `throttle:120,1` | **Prevalidación financiera**: cálculo puro en centavos sin persistencia ni consumo fiscal. |
| | `POST /api/invoices` | `InvoiceController@store` | `idempotency`, `invoices.create` | Emisión fiscal de factura, consumo de correlativo, cálculo y snapshot. |
| | `GET /api/invoices/{id}` | `InvoiceController@show` | `invoices.view` | Detalle completo de factura, ítems, pagos y recibo institucional. |
| | `POST /api/invoices/{id}/void` | `InvoiceController@void` | `idempotency`, `invoices.void` | Anulación de factura sin pagos registrados; anula recibos vinculados. |
| | `POST /api/invoices/{id}/reverse` | `InvoiceController@reverse` | `idempotency`, `invoices.reverse` | Reverso de factura con pagos; anula pagos y genera egresos en caja. |
| **Caja** | `GET /api/cash-sessions/current` | `CashSessionController@current` | `auth:web` | Sesión activa del cajero o consultable para cierre autorizado (`closable`). |
| | `GET /api/cash-sessions/consolidated` | `CashSessionController@consolidated` | `throttle:30,1` | Conciliación consolidada por caja física dentro del día operativo. |
| | `POST /api/cash-sessions/open` | `CashSessionController@open` | `idempotency`, `cash.open` | Apertura de turno con fondo inicial y lock de caja física. |
| | `POST /api/cash-sessions/{id}/close` | `CashSessionController@close` | `idempotency`, `cash.close` | Cierre de caja, verificación de pendientes/recibos y arqueo discriminado. |
| | `GET /api/cash-sessions` | `CashSessionController@index` | `auth:web` | Listado histórico de turnos de caja. |
| **Pagos** | `POST /api/invoices/{id}/payments` | `PaymentController@store` | `idempotency`, `payments.create` | Registro de cobro (Efectivo, Tarjeta, Transferencia) y movimiento de caja. |
| | `GET /api/invoices/{id}/payments` | `PaymentController@index` | `payments.view` | Lista de cobros de una factura. |
| | `POST /api/invoices/{id}/payments/{p}/void` | `PaymentController@void` | `idempotency`, `payments.void` | Anulación individual de cobro con egreso compensatorio. |
| **Recibos y Reimpresión** | `GET /api/invoices/{id}/receipt` | `ReceiptController@show` | `auth:web` | Vista de recibo simple legacy (etiqueta "Original"). |
| | `POST /api/invoices/{id}/reprint` | `ReceiptController@reprint` | `idempotency`, `receipts.reprint` | Reimpresión legacy con motivo humano obligatorio (5-500 chars). |
| | `POST /api/institutional-receipts` | `InstitutionalReceiptController@store` | `idempotency`, `receipts.create` | Emisión formal de recibo institucional correlativo para factura pagada. |
| | `GET/POST /api/institutional-receipts/{id}/pdf` | `InstitutionalReceiptController@pdf` | `auth:web`, `receipts.reprint` | Descarga/stream de PDF o solicitud formal de reimpresión numerada. |
| | `POST /api/institutional-receipts/{id}/print-events`| `InstitutionalReceiptController@printEvent`| `idempotency` | Registro de evento físico de impresión (`issued_print` o `reprint`). |
| **Reportes** | `GET /api/reports/dashboard` | `ReportController@dashboard` | `reports.view` | Resumen operativo rápido. |
| | `GET /api/reports/today` | `ReportController@today` | `reports.view` | Métricas del día para el cajero o administrador. |
| | `GET /api/reports/executive` | `ReportController@executive` | `reports.view` | Reporte ejecutivo multidimensional (emisión vs cobro vs corte). |
| | `GET /api/reports/executive/pdf` | `ReportController@executivePdf` | `reports.view`, `throttle:20,1` | Exportación a PDF ejecutivo formal monocromo. |
| | `GET /api/reports/executive/excel` | `ReportController@executiveExcel` | `reports.view`, `throttle:20,1` | Exportación a Excel (.xlsx) estructurado en 5 hojas. |
| **Catálogo y Ajustes** | `/api/services`, `/api/categories`, `/api/areas` | `ServiceController`, etc. | `catalog.manage` | Gestión del catálogo de prestaciones, tarifas e impuestos. |
| | `/api/settings/fiscal`, `/api/fiscal-sequences` | `FiscalSettingsController`, etc. | `fiscal.manage` | Configuración institucional, RTN, CAI y rangos fiscales. |
| | `/api/settings/institutional-receipts/*` | `InstitutionalReceiptSettingsController` | `receipts.manage` | Series institucionales y perfiles de impresión (Carta, A4, Media Carta). |
| **Sistema y Respaldos**| `/api/backups/*`, `/api/system/*` | `BackupController`, `AuditLogController` | `admin` | Resguardos locales y registro inmutable de auditoría. |

### 2.3 Manejo de Concurrencia y Bloqueos Pesimistas
1. **Facturas y Pagos**: Durante la emisión (`CreateInvoiceAction`), cobro (`RegisterPaymentAction`), anulación (`VoidInvoiceAction`) y reverso (`ReverseInvoiceAction`), la fila de la factura y la fila de la sesión de caja se bloquean mediante `lockForUpdate()`. Esto previene condiciones de carrera en cobros simultáneos o doble facturación con el mismo correlativo.
2. **Apertura de Caja**: `OpenCashSessionAction` bloquea la fila existente en `cash_registers` para evitar *gap locks* de InnoDB que podrían provocar *deadlocks* (error 1213) cuando dos cajeros abren cajas diferentes al mismo tiempo. Además, la base de datos impone restricciones de unicidad compuestas: `(cash_register_id, open_marker)` y `(open_user_id)`.
3. **WebSockets seguros tras commit**: Todos los eventos de broadcast (`InvoiceChanged`, `CashSessionChanged`, `PaymentChanged`) se despachan dentro de callbacks `DB::afterCommit(...)`. Si la transacción de base de datos falla o se revierte, nunca se emite una notificación a las terminales clientes.

---

## 3. Cálculos Monetarios, Creación de Factura, Snapshots y Regla EPO

### 3.1 Arquitectura del Dinero (`App\Support\Money`)
- Todas las columnas de dinero en base de datos cuentan con una representación en centavos enteros: `subtotal_cents`, `tax_amount_cents`, `discount_amount_cents`, `total_cents`, `paid_amount_cents`, `balance_due_cents`, `amount_cents`, `quantity_cents`.
- Las operaciones aritméticas se ejecutan con división y multiplicación entera (`intdiv`), eliminando imprecisiones por representación de coma flotante IEEE 754.
- Redondeo monetario estándar hondureño: *half-up* (mitad hacia arriba) en centavos: `intdiv(($unitPriceCents * $quantityUnits) + 50, 100)`.

### 3.2 Cálculo de Impuestos y Distribución entre Líneas
- El cálculo del ISV toma la base imponible acumulada en centavos y la tasa en puntos básicos (p. ej. 15.00% = 1500 pb):
  $$\text{tax\_cents} = \text{intdiv}((\text{taxable\_subtotal\_cents} \times \text{tax\_rate\_basis\_points}) + 5000, 10000)$$
- **Algoritmo del mayor residuo (`distributeInvoiceTax`)**: para evitar discrepancias de 1 centavo entre la suma de las líneas y el total de la factura, el sistema calcula el impuesto base de cada línea y reparte los centavos de residuo sobrantes ordenando las líneas por el tamaño del resto matemático.
- **Invariante fiscal verificada**: el backend comprueba en cada factura que:
  $$\sum \text{line\_total\_cents} === \text{total\_cents}$$
  Si la suma discrepa por 1 solo centavo, lanza una excepción de tiempo de ejecución y cancela la transacción.

### 3.3 Regla de Eritropoyetina (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`)
La evaluación de gratuidad por receta de diálisis es uno de los requisitos más críticos del hospital:
1. **Evaluación estrictamente por línea (`CalculateInvoiceTotalsAction`)**:
   ```php
   private function appliesErythropoietinRule(Service $service, bool $patientDialysisPrescription): bool
   {
       return $patientDialysisPrescription
           && $this->hasErythropoietinRule($service);
   }
   ```
   Donde `hasErythropoietinRule` verifica que `special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION'`.
2. **Impacto en los precios**:
   - Para el ítem de Eritropoyetina elegible con receta autorizada:
     - `unit_price_cents = 0`
     - `unit_price_registered_cents = 2500` (o el precio de catálogo vigente, p. ej. L. 25.00)
     - `rule_adjustment_cents = 2500` (el descuento exacto de catálogo)
     - `special_rule_applied = true`
     - `line_total_cents = 0`
   - Para las demás líneas de la cuenta (medicamentos, gasas, glucosa, consultas, laboratorio):
     - `special_rule_applied = false`
     - Conservan su precio de catálogo íntegro.
     - Se suman de forma normal al subtotal, base gravable e importe final.
     - **Nunca se vuelve gratuita la factura entera** (verificado y blindado en `MixedDialysisBasketTest`).
3. **Autorización y Seguridad**:
   - La bandera `dialysis_prescription` requiere el permiso `patients.mark_dialysis_prescription`.
   - Si un usuario no autorizado intenta enviar la bandera, `ResolveInvoiceDialysisPrescriptionAction` bloquea la petición con un error de validación 422 y genera un registro de auditoría `invoice.dialysis_prescription_denied`.
4. **Distinción entre Cuenta Vacía y Total Cero Autorizado**:
   - **Cuenta vacía**: `StoreInvoiceRequest` exige `items: required, array, min: 1`. Enviar una cuenta sin ítems es rechazado en HTTP 422; no existe la emisión de cuentas vacías.
   - **Total Cero Autorizado**: Cuando una cuenta contiene exclusivamente ítems gratuitos por regla de diálisis:
     - Se emite con `total = 0.00` (`total_cents = 0`).
     - Se marca como `status = 'paid'`, `settlement = 'free_by_rule'`, `zero_reason = 'all_lines_free_by_rule'`.
     - `paid_amount = 0.00`, `balance_due = 0.00`.
     - **No se crea ningún pago ficticio** (sin cobros falsos en `other`) **ni movimiento de caja espurio**.
     - Se registra en auditoría como `invoice.issued_without_charge`.

### 3.4 Inmutabilidad y Persistencia de Snapshots
- **En `invoice_items`**: se congelan de forma definitiva los datos del catálogo en el momento de la emisión: `service_name`, `category_name`, `area_name`, `unit_price_registered_cents`, `rule_adjustment_cents`, `unit_price_cents`, `quantity_cents`, `tax_rate`, `tax_amount_cents`, `line_subtotal_cents`, `line_total_cents`.
- Los campos legados de códigos técnicos (`scan_code`, `barcode`, `qr_code`) se persisten explícitamente como `null`.
- **En `invoices`**: se congelan el membrete institucional (`hospital_name`, `hospital_rtn`, `hospital_address`, `hospital_phone`), los datos fiscales vigentes (`fiscal_cai`, `fiscal_range_from`, `fiscal_range_to`, `fiscal_valid_until`, `fiscal_prefix`), el tamaño de papel predeterminado y la tasa de impuesto.
- Las consultas históricas leen directamente los snapshots; el sistema **nunca recalcula facturas pasadas** a partir del catálogo actual.

---

## 4. Lógica de Caja, Movimientos y Arqueo

### 4.1 Ciclo de Vida de la Sesión (`CashRegisterSession`)
1. **Apertura (`OpenCashSessionAction`)**:
   - Valida que el usuario no tenga otra caja abierta (`open_user_id`).
   - Valida que la caja física seleccionada no esté en uso (`open_marker`).
   - Registra el monto inicial de apertura (`opening_amount`).
   - Si el monto inicial es mayor a 0, genera de inmediato un `CashMovement::TYPE_OPENING`.
   - Registra en auditoría `cash_session.opened`.
2. **Movimientos de Caja (`CashMovement`)**:
   - Modela los flujos de efectivo con cuatro tipos canónicos:
     - `opening`: fondo inicial de apertura.
     - `payment`: ingreso por cobro de factura en efectivo.
     - `payment_void`: egreso compensatorio por anulación/reverso de pago en efectivo.
     - `closing`: registro del arqueo final.
   - **Inmutabilidad absoluta**: el modelo `CashMovement` incorpora ganchos Eloquent (`creating`, `updating`, `deleting`) que impiden cualquier modificación o borrado si la sesión asociada está en estado `closed` (`guardClosedCashSessionMutation`).
3. **Cierre y Arqueo de Caja (`CloseCashSessionAction`)**:
   - Bloquea la sesión de caja bajo transacción.
   - **Condiciones previas obligatorias de cierre**:
     1. Si existen facturas emitidas en estado `issued` o `partial` (`pending_invoice_count > 0`), **el cierre es rechazado**:
        > *"No se puede cerrar la caja con X factura(s) pendientes o parciales por L. Y. Revise los cobros antes de cerrar."*
     2. Si existen facturas pagadas que no tienen su correspondiente recibo institucional emitido (`missing_institutional_receipt_count > 0`), **el cierre es rechazado**:
        > *"No se puede cerrar la caja con X factura(s) pagadas sin recibo institucional emitido. Genere el recibo institucional pendiente antes de cerrar."*
   - **Conteo y Arqueo**:
     - Admite el monto contado general (`closing_amount`) o el desglose físico por billetes (`closing_breakdown` con denominaciones de 500, 200, 100, 50, 20, 10, 5, 2, 1 y fracción).
     - Si se envía desglose, valida que la suma de billetes equivalga con exactitud a `closing_amount`.
     - Calcula la diferencia contra el saldo esperado:
       $$\text{expected\_cents} = \text{opening\_cents} + \text{cash\_payments\_cents}$$
       $$\text{difference\_cents} = \text{closing\_cents} - \text{expected\_cents}$$
     - **Regla de justificación**: Si `difference_cents !== 0`, el campo de notas (`notes`) es **estrictamente obligatorio** y debe tener un mínimo de 5 caracteres (*"Explique la diferencia de caja antes de cerrar"*).
   - Al completar el cierre:
     - Genera el movimiento `CashMovement::TYPE_CLOSING`.
     - Guarda snapshots de totales por método (`method_totals_snapshot`), cantidad y monto de cobros, y métricas de pendientes.
     - Libera `open_marker` y `open_user_id` para permitir turnos futuros.
     - Registra `cash_session.closed` en `AuditLog`.

---

## 5. Recibos, Anulación y Auditoría de Reimpresiones

### 5.1 Anulación Simple (`VoidInvoiceAction`) vs Reverso de Pagos (`ReverseInvoiceAction`)
El backend distingue claramente entre anular un documento emitido sin cobro y revertir una operación cobrada:
1. **Anulación Simple (`VoidInvoiceAction`)**:
   - Aplica a facturas en estado `issued` sin cobros registrados.
   - Requiere un motivo textual obligatorio de al menos 5 caracteres.
   - Verifica que la caja de emisión permanezca abierta.
   - **Bloqueo de facturas cobradas**: Si la factura tiene cobros vigentes (`POSTED`), la anulación simple se bloquea intencionalmente y registra `invoice.void_blocked_paid` en auditoría, instruyendo al usuario a utilizar el reverso.
   - Al proceder: cambia el estado a `void`, anula automáticamente los recibos institucionales vinculados (`VoidInstitutionalReceiptAction`), preserva la fecha original de emisión (`issued_at`) y audita `invoice.voided`.
2. **Reverso de Factura (`ReverseInvoiceAction`)**:
   - Aplica a facturas pagadas (`paid`) o parciales (`partial`).
   - Requiere motivo de al menos 5 caracteres.
   - Valida que ninguna de las cajas físicas donde se cobraron los pagos esté cerrada (si alguna cerró, bloquea la operación y exige un ajuste de supervisión).
   - Itera sobre cada pago posted: invoca `VoidPaymentAction`, el cual marca el pago como anulado y crea un `CashMovement::TYPE_PAYMENT_VOID` (egreso) en la sesión correspondiente.
   - Reintegra el saldo de la factura y finalmente la cambia a `STATUS_VOID`.
   - Registra en auditoría `invoice.reversed`.

### 5.2 Auditoría de Reimpresión y Motivo Obligatorio (`ReprintReason`)
- **Regla contractual inmutable**: Cualquier intento de reimpresión de comprobante exige un motivo humano explícito redactado por el operador (`5 <= mb_strlen(reason) <= 500`).
- El backend rechaza activamente cualquier cadena automática o enlatada (p. ej. *"Impresión desde vista de recibo"*), devolviendo error de validación HTTP 422.
- **Contador durable**:
  - Tanto `invoices.legacy_reprint_count` como `institutional_receipts.reprint_count` se incrementan de forma transaccional mediante bloqueo de fila (`SELECT ... FOR UPDATE`).
  - No dependen de la tabla `audit_logs` (la cual es podable por mantenimiento).
  - La primera emisión genera la etiqueta "Original" y no incrementa el contador.
  - Las reimpresiones se rotulan de forma inalterable como `REIMPRESIÓN #1`, `REIMPRESIÓN #2`, etc.
  - Cada evento físico o descarga de reimpresión genera un `InstitutionalReceiptPrintEvent` con el usuario, fecha, motivo y número consumido.

---

## 6. Generación Documental: Motores PDF y Exportación Excel

### 6.1 Motor de PDF: `barryvdh/laravel-dompdf` (DomPDF 3.1)

#### 6.1.1 Comprobante Institucional R6 (`InstitutionalReceiptPdfService` & `InstitutionalReceiptHtmlBuilder`)
- **Perfiles y Dimensiones Soportadas**:
  - **Carta Vertical (Oficial / Principal)**: $215.90 \times 279.40\text{ mm}$ ($612 \times 792\text{ pt}$), márgenes de 12 mm. Plantilla `institutional_compact`.
  - **Media Carta Horizontal**: $612 \times 396\text{ pt}$. Geometría nativa sin reducción artificial de escala.
  - **A4 Vertical**: $210 \times 297\text{ mm}$ ($595.28 \times 841.89\text{ pt}$).
  - **A5 Horizontal**: $595.28 \times 419.53\text{ pt}$.
  - **Térmicos (80mm / 58mm)**: soportados únicamente como compatibilidad secundaria.
- **Identidad Visual y Limpieza**:
  - **Exclusión total de códigos de barras, QR y códigos técnicos internos**.
  - Estructura limpia y compacta: cintillo gubernamental/secretaría, nombre institucional, RTN, teléfono, dirección, título "Recibo Institucional", distintivo de copia ("ORIGINAL" o "REIMPRESIÓN #n"), número correlativo visible.
  - Nombre del paciente destacado.
  - Tabla de conceptos contables continuos: cantidad, descripción, precio registrado de catálogo, ajuste autorizado por regla e importe final de línea.
  - Importe en letras en español exacto generado por `AmountToSpanishWords` (p. ej. *"NOVECIENTOS LEMPIRAS CON 00/100 CENTAVOS"*).
  - Recuadros sobrios para firma y sello de caja.
- **Desacoplamiento Estricto Cobro/Impresión**:
  - La emisión y cobro de la factura ocurren antes de tocar el motor PDF.
  - Si el visor PDF falla, el proceso se interrumpe o el usuario cancela la impresión en el navegador, **el cobro ya está asentado y no se duplica ni se altera el correlativo** (verificado en `PdfFailureDoesNotRechargeTest`).

#### 6.1.2 Reporte Ejecutivo R5 (`ExecutivePdfExportService`)
- Formato Carta vertical estándar (`size: letter portrait; margin: 1.5cm 1.5cm 1.8cm 1.5cm`).
- Paleta monocromática mínima y sobria para escala de grises y ahorro de tinta (`#ffffff`, `#0f172a`, `#475569`, bordes `#111827` y `#e2e8f0`).
- **Repetición de cabeceras de tabla en saltos de página**: implementado mediante estilos compatibles con DomPDF:
  ```css
  .report-table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  .report-table thead { display: table-header-group; }
  .report-table tr { page-break-inside: avoid; }
  ```
- **Paginación dinámica real**: inyectada en el canvas del PDF mediante PHP:
  ```php
  $canvas->page_text($canvas->get_width() - 150, $canvas->get_height() - 26, 'Pagina {PAGE_NUM} de {PAGE_COUNT}', $font, 8.5, [0.39, 0.45, 0.55]);
  ```

### 6.2 Exportación Excel: `PhpOffice\PhpSpreadsheet` 5.7 (`ExecutiveExcelExportService`)

- **Estructura Canónica de 5 Hojas**:
  1. `Resumen`: indicadores ejecutivos clave (facturado, cobrado, saldo, anulado, reversado, ticket promedio, gratuidad desglosada y variaciones porcentuales).
  2. `Operaciones`: listado de facturas emitidas (fecha, correlativo, paciente, caja, cajero, importes y estados).
  3. `Detalle`: apertura renglón por renglón de cada prestación vendida (servicio, categoría, área, cantidad, precio registrado, ajuste por regla, impuesto y marca de gratuidad).
  4. `Cobros`: desglose cronológico de recaudación real por fecha de pago, cajero, método y referencia bancaria.
  5. `Caja`: historial de sesiones de turno con fondos iniciales, efectivo esperado, conteo físico y diferencias conciliadas.
- **Tipos de Datos Numéricos Reales**:
  - No exporta texto para importes. Utiliza valores de coma flotante con formato contable `#,##0.00` (`MONEY_FORMAT`).
  - Conteos como enteros con formato `#,##0` (`COUNT_FORMAT`).
  - Variaciones porcentuales como fracciones decimales (0.125 = 12.50%) con formato `+0.00%;-0.00%;0.00%`.
  - Fechas como números seriales de Excel mediante `\PhpOffice\PhpSpreadsheet\Shared\Date::PHPToExcel` con formato `dd/mm/yyyy` o `dd/mm/yyyy hh:mm`.
- **Prevención de Inyección de Fórmulas (CSV/Excel Formula Injection)**:
  - Todo valor alfanumérico suministrado por el usuario, nombres de pacientes, notas o códigos pasa por `App\Support\ExcelSafe::value`:
    ```php
    public static function value(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        return preg_match('/^[=+\-@\t\r\n]/', $value) === 1
            ? "'".$value
            : $value;
    }
    ```
  - Las celdas de identificadores, números correlativos y texto de riesgo se fijan con `DataType::TYPE_STRING` mediante `$this->setTextCell(...)`.
- **Configuración de Impresión en Excel**:
  - Filas de encabezado fijadas para repetición al imprimir: `setRepeatingRows([1, 1], [3, 3])`.
  - Ajuste automático de ancho a una página (`fitToWidth = 1`) y flujo vertical continuo (`fitToHeight = 0`) para evitar la miniaturización ilegible de listados extensos.

---

## 7. Verificación y Resultados de Pruebas Automatizadas

Se realizaron ejecuciones directas de la suite de pruebas unitarias y de integración sobre el entorno de laboratorio backend:

1. **`MixedDialysisBasketTest`**:
   - Comando: `php vendor/phpunit/phpunit/phpunit tests/Feature/Billing/MixedDialysisBasketTest.php`
   - Resultado: **100% aprobado (1 test, 13 aserciones)** en 10.2s.
   - Confirma: Una canasta mixta (Glucosa L.900.00 + Eritropoyetina L.25.00 con receta de diálisis) factura L.900.00 exactos, aplica gratuidad únicamente al medicamento y verifica la invariante de suma de líneas.
2. **`InvoicePreviewContractTest`**:
   - Comando: `php vendor/phpunit/phpunit/phpunit tests/Feature/Billing/InvoicePreviewContractTest.php`
   - Resultado: **100% aprobado (18 tests, 119 aserciones)** en 9.3s.
   - Confirma: El endpoint `/api/invoices/preview` no realiza escrituras en base de datos, calcula centavos exactos, maneja estados `ok`, `zero_tax`, `zero_total` y `tax_unavailable`, y preserva los motivos de importe cero.
3. **`PdfFailureDoesNotRechargeTest`**:
   - Comando: `php vendor/phpunit/phpunit/phpunit tests/Feature/Billing/PdfFailureDoesNotRechargeTest.php`
   - Resultado: **100% aprobado (1 test, 13 aserciones)** en 2.7s.
   - Confirma: Si el motor PDF arroja un error 500 al generar el comprobante, el cobro y los movimientos de caja permanecen intactos y los reintentos no duplican el pago.
4. **`CloseCashSessionDifferenceTest`**:
   - Comando: `php vendor/phpunit/phpunit/phpunit tests/Feature/CloseCashSessionDifferenceTest.php`
   - Resultado: **100% aprobado (5 tests, 18 aserciones)** en 2.5s.
   - Confirma: La validación de diferencias en arqueo, el requerimiento de justificación con mínimo 5 caracteres y el desglose de billetes.
5. **`InstitutionalReceiptPortraitProfileTest`**:
   - Comando: `php vendor/phpunit/phpunit/phpunit tests/Feature/InstitutionalReceiptPortraitProfileTest.php`
   - Resultado: **100% aprobado (7 tests ejecutados, 68 aserciones, 2 skipped por drivers de impresora opcionales)** en 8.8s.
   - Confirma: La geometría exacta de Carta vertical (612×792 pt) y A4 (595.28×841.89 pt), márgenes de 12 mm y la adopción de `institutional_compact`.
6. **`ExecutiveExcelExportTest` & `ExecutivePdfExportTest`**:
   - Comandos: `php vendor/phpunit/phpunit/phpunit tests/Feature/Reports/ExecutiveExcelExportTest.php` y `ExecutivePdfExportTest.php`
   - Resultado: **100% aprobados (15 tests combinados, 80 aserciones)**.
   - Confirma: La estructura de 5 hojas en Excel, tipos numéricos reales, prevención de inyección de fórmulas y generación de PDF formal con encabezados repetidos y paginación canvas.

7. **Análisis Estático (PHPStan / Larastan)**:
   - Comando: `php vendor/bin/phpstan analyse`
   - Resultado: 253 archivos analizados; 24 observaciones menores de tipado estricto (nivel configurado en `phpstan.neon`).
   - Observaciones identificadas para posterior saneamiento cosmético:
     - `PromoteProposedReceiptPrintProfileAction.php:44`: constante no usada `PORTRAIT_PAPER_KINDS`.
     - `ReceiptSheetComposition.php:58,70,76`: llamadas redundantes a `array_values` sobre tipos ya tipados como `list`.
     - `ExecutiveExcelExportService.php:41,118,538`: constante no usada `PERCENT_FORMAT`, coalescencia innecesaria y retorno tipado de `localDateTime`.
     - `ExecutivePdfExportService.php:102,200,1038`: tipo esperado de `$font` en `Canvas::page_text()`, tipado de `$filters` y ancho de chunk entero.
     - `ExecutiveReportService.php:890,909,956`: casteo explícito de variables `mixed` a `int`/`string`.
   - **Impacto funcional**: Nulo. Todos los tests de comportamiento y contratos pasan al 100%.

---

## 8. Conclusiones y Recomendaciones para la Integración

1. **Robustez y Completitud**: La lógica de negocio del backend de Hospital General San Isidro se encuentra implementada con un nivel de calidad sobresaliente. No se identificaron desviaciones respecto a las reglas no negociables de `AGENTS.md` ni a las directrices de `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`.
2. **Autoridad Monetaria Centralizada**: El backend actúa como la única autoridad fiscal y monetaria. El frontend React debe limitarse a consumir `/api/invoices/preview` para visualización previa y `/api/invoices` para confirmación; la interfaz jamás debe recalcular subtotales o impuestos por su cuenta.
3. **Flujo de Cobro Limpio en POS**:
   - Iniciar siempre con el formulario de paciente y líneas en blanco (sin heredar datos previos ni flags de EPO).
   - Solo enviar `dialysis_prescription: true` si el usuario activó la casilla conscientemente y tiene el permiso asignado.
   - Tras el cobro exitoso, mostrar el diálogo de confirmación y ofrecer la acción de imprimir comprobante como un paso posterior independiente, evitando bloqueos si la ventana emergente de impresión es cerrada por el navegador.
4. **Respeto a las Dimensiones Oficiales**:
   - Para comprobantes institucionales (R6), priorizar siempre el perfil oficial **Carta vertical** (`letter_portrait`, 612×792 pt) o **Media Carta** (`half_letter_landscape`, 612×396 pt).
   - Mantener thermal (80mm/58mm) como compatibilidad secundaria sin convertirlo en la vista por defecto.
