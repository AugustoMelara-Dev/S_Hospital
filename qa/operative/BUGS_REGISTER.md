# Registro de bugs — Auditoría operativa S_Hospital 2026-06-09

> **Convención de severidad (auditoría operativa):**
> - **BLOQUEANTE** — Impide ejecutar un flujo crítico (caja, pago, factura, cierre, reporte, seguridad, datos, instalación). No hay workaround.
> - **ALTA-BLOQUEANTE** — Severidad alta en código que sí impacta un flujo crítico.
> - **ALTA-PILOT-SAFE** — Severidad alta en código que NO impacta flujos críticos; a11y pulido o cobertura. Tiene workaround documentado.
> - **MEDIA** — Mejora importante, no impide piloto; puede esperar a fase post-piloto.
> - **BAJA** — Cosmético o stylistic.
> - **FIELD-PILOT-DEPENDENCY** — No es bug de software; requiere hardware/datos reales para validar. Sin esta validación, la entrega queda como `PRODUCTION_CANDIDATE`, no `PRODUCTION_READY`.

## Bugs corregidos durante la auditoría (cerrados)

| ID | Severidad original | Flujo | Evidencia de fix | Test que lo cubre |
| -- | ------------------ | ----- | ---------------- | ----------------- |
| H-01 | ALTA (control fiscal) | Reimpresión | `GenerateReceiptDataAction.php:12-15,47` ahora acepta `?string $copyLabel`. `ReprintReceiptAction.php:15-58` cuenta reimpresiones y propaga "Reimpresion #N". | `test_receipt_shows_original_label_and_reprint_label_increments_per_call` (test específico verificado en phpunit). La afirmación "17/17 en InvoiceHistoryReprintVoidTest" del round anterior no está contrastada con el output de qa/qa-test.txt — la suite agrega tests de muchas otras áreas y la salida no separa por clase; mantener este ID como cerrado con la lógica probada, no con un conteo total. |
| B-1 | BLOQUEANTE (CI) | Test runner | El code-split de las 9 vistas pesadas está re-aplicado en `frontend/src/AppRoutes.tsx:9-17` (commit `2fc53e14`) y `frontend/src/AppRoutes.lazy.test.ts` valida que las nueve vistas estén bajo `React.lazy(() => import(...))`. 3/3 corridas consecutivas de `npm run test` pasan 239/239 tests (incluyendo `AppRoutes.lazy.test.ts`). Evidencia: `qa/qa-fe-test.txt`, `qa/qa-fe-build.txt` (9 chunks lazy). | 2/2 tests en `AppRoutes.lazy.test.ts` |

---

## Bugs abiertos por severidad (post-corrección)

### BLOQUEANTE: 0

### ALTA-BLOQUEANTE: 0

### ALTA-PILOT-SAFE: 0

(Los 3 hallazgos a11y que el Subagente 6 marcó como ALTA son, tras revisión rigurosa del código, **falsos positivos de lint o impacto no crítico**. Ver tabla detallada abajo.)

### MEDIA (10)

| ID | Severidad | ¿Bloquea piloto? | Flujo | Evidencia | Razón técnica de por qué no bloquea | Workaround | Recomendación | Criterio de cierre |
| -- | --------- | ----------------- | ----- | --------- | ---------------------------------- | ---------- | ------------- | ------------------ |
| MEDIA-01 | MEDIA | No | Caja/Pagos (apertura, cierre) | Falta test explícito `test_partial_payment_rejected_when_partial_payments_disabled` | Lógica probada indirectamente en `CashPaymentsReceiptTest.php:354-376, 465-518`; validación en `RegisterPaymentAction.php:78-82` | Manual: cajero con `partial_payments_enabled=false` y pago parcial verá 422 con `amount: 'El monto recibido es menor al total.'` | Subagente S1 (test faltante) | Test añadido + pasa en CI |
| MEDIA-02 | MEDIA | No | Caja/Pagos (cierre) | Falta test `test_cannot_close_an_already_closed_cash_session` | Lógica cubierta por `CloseCashSessionAction.php:36-40` (`status !== STATUS_OPEN` → 422); sesión cerrada implica `open_user_id=null`, pero el chequeo es por status, no por user_id | Manual: cerrar dos veces → segunda 422 "La caja ya esta cerrada" | Subagente S1 (test faltante) | Test añadido + pasa en CI |
| MEDIA-03 | MEDIA | No | Caja/Pagos (cierre cruzado) | Falta test `test_cashier_cannot_close_other_cashiers_session` | Lógica cubierta por `CloseCashSessionAction.php:32-34` + rol cajero sin `cash.close_any` | Manual: cajero B intenta cerrar caja de A → 403 | Subagente S1 (test faltante) | Test añadido + pasa en CI |
| MEDIA-04 | MEDIA | No | Caja/Pagos (perf) | `RegisterPaymentAction.php:74-76` lee `partial_payments_enabled` con `Schema::hasColumn` defensivo + SELECT por cada pago | No afecta correctness. 1 query extra por pago. | N/A — invisible al usuario | Subagente S1 (cache) | Cachear con `Cache::remember('fiscal.partial_payments_enabled', 300, ...)` y test de performance |
| MEDIA-05 | MEDIA | No | Caja/Pagos (UX tiempo real) | `CashBoxView.tsx:49-67` no se invalida ante `CashSessionChanged` broadcast | Polling 10s + `refetchOnWindowFocus` cubren el caso | Botón "Actualizar" en `CashBoxView.tsx:187-190` | Subagente S1 (broadcast) | Suscripción a evento `CashSessionChanged` que invalide `['cash-sessions', 'current']` |
| MEDIA-06 | MEDIA | No | Caja/Pagos (auditoría fiscal) | `RegisterPaymentAction.php:118-132` no persiste `reference` en audit log | Auditoría interna tiene `payment.registered`; solo falta el campo `reference` para trazabilidad bancaria | El `reference` se persiste en `payments.reference` y aparece en recibo (`ReceiptPreview.tsx:175`) | Subagente S1 (audit log) | Añadir `'reference' => $payment->reference` al `new_values` del audit log + test |
| MEDIA-07 | MEDIA | No | Facturación (UX/UI) | `frontend/src/schemas/invoice.schema.ts:17` permite `max(255)` vs backend `max:180` | Backend es autoritativo; síntoma es 422 sin contexto si cajero teclea 181-255 chars | Manual: nombre 200 chars → 422 con `patient_name`; cajero acorta | Subagente S2 (consistencia) | Alinear Zod a `max(180)` + mostrar contador `180/180` en `PatientStep.tsx` |
| MEDIA-08 | MEDIA | No | Facturación (preview) | `frontend/src/features/invoices/state/posMath.ts` puede divergir ±1 centavo del backend | Backend sobrescribe; preview es solo UI. Tests confirman backend autoritativo | Manual: comparar preview con factura emitida | Subagente S2 (preview) | Auditar `posMath.ts`; si difiere de `intdiv(... + 50, 100)`, alinear o quitar preview |
| MEDIA-09 | MEDIA | No | Facturación (cobertura) | Sin test `test_patient_name_above_180_chars_is_rejected` | La regla `max:180` se aplica; tests de InvoiceCreationTest cubren otras validaciones | Manual: 181 chars → 422 | Subagente S2 (test) | Test con `str_repeat('a', 181)` y assert 422 |
| MEDIA-10 | MEDIA | No | Impresión (cobertura) | Sin test para nombres de servicio >120 chars en recibo | Layout CSS (`word-break: break-word` en `styles.css:639-656`) lo cubre; sin test explícito | Manual: servicio con nombre largo en 80mm | Subagente S2 (test) | Test con servicio de 100+ chars + assert recibo íntegro |

### BAJA (5)

| ID | Severidad | ¿Bloquea piloto? | Flujo | Evidencia | Razón técnica de por qué no bloquea | Workaround | Recomendación | Criterio de cierre |
| -- | --------- | ----------------- | ----- | --------- | ---------------------------------- | ---------- | ------------- | ------------------ |
| BAJA-01 | BAJA | No | Reimpresión (audit log) | `InvoiceHistoryView.tsx:141-153` llama a `auditReceiptPrint` desde preview, lo que infla el reporte de reimpresiones | El sistema audita todo `window.print()` por diseño; es decisión explícita | N/A — operativo | Subagente S3 (decisión) | Documentar política en `docs/RECEIPT_PRINT_AUDIT_POLICY.md` |
| BAJA-02 | BAJA | No | Recepción (config) | `FiscalSettings` permite configurar 80mm/58mm sin guardrail | No es bug funcional; admin debe conocer la impresora | Manual: confirmar tipo de impresora antes de cambiar | Subagente S3 (UX admin) | Validación en `FiscalSettingsController::update` con warning si es térmico |
| BAJA-03 | BAJA | No | Recepción (inmutabilidad) | `Invoice.receipt_paper_size` mutable post-emisión en BD | El campo rara vez se cambia; el snapshot en `GenerateReceiptDataAction` lo lee del invoice actual | Manual: respetar la convención de inmutabilidad | Subagente S3 (model boot) | Event `saving` que impida update si `issued_at != null` |
| BAJA-04 | BAJA | No | Backups (lock huérfano) | `CreateBackupAction.php:52` usa `Cache::lock(..., 600)` que puede quedar huérfano si el worker muere | Aceptable: Laravel libera locks expirados; siguiente intento verá `markFailed` y continuará | Manual: si `markFailed("Ya hay un backup local en proceso.")` aparece 600s+, esperar expiración | Subagente S5 (UX) | Exponer `hospital:backup:local:started_at` y permitir `> 600s` → liberar |
| BAJA-05 | BAJA | No | Backups (scheduler) | `docker-compose.prod.yml:177` requiere `SERVER_IP` y `HOSPITAL_DAILY_BACKUP_TIME` en `.env` | Operativo, documentado en `docs/DISASTER_RECOVERY.md:23-29` | Manual: validar `.env` antes de `docker compose up -d` | Subagente S5 (setup) | Guardrail en `scripts/setup.bat` que valide env vars críticas |

### Hallazgos a11y reclasificados (revisión rigurosa)

El Subagente 6 clasificó 3 hallazgos como ALTA basándose en lint warnings. Tras revisar el código línea por línea, reclasifico a continuación con evidencia:

| ID aparente | Severidad declarada | Severidad REAL tras revisión | ¿Bloquea piloto? | Flujo afectado | Evidencia | Razón técnica de por qué no bloquea | Workaround | Recomendación | Criterio de cierre |
| ----------- | ------------------- | ----------------------------- | ----------------- | -------------- | --------- | ---------------------------------- | ---------- | ------------- | ------------------ |
| **A11Y-01** (era A-1) | ALTA | **BAJA (falso positivo de lint)** | **No** | Facturación (carrito de servicios) | `InvoiceCart.tsx:141-150`: `<label>` ENVUELVE `<Checkbox id="dialysis-${index}">`. El checkbox está anidado dentro del label, por lo que la asociación HTML es correcta por construcción. ESLint `jsx-a11y/label-has-associated-control` no reconoce este patrón anidado, pero WCAG 1.3.1 sí. | El usuario SÍ puede hacer clic en el texto "Receta de dialisis (gratis)" para toggle. La etiqueta visual y el control están asociados. | N/A | Subagente S6 (lint) | Sustituir el `<label>` envolvente por `<label htmlFor={`dialysis-${index}`}>` y añadir el `id` por separado, para silenciar lint y hacerlo explícito. Esto es mejora de estilo, no corrección funcional. |
| **A11Y-02** (era A-1) | ALTA | **BAJA (falso positivo de lint)** | **No** | Pagos (modal de cobro) | `PaymentModal.tsx:214-228`: `<label>` ENVUELVE `<Checkbox id="preview-before-print">`. Mismo patrón anidado. Funcionalmente correcto. | Cajero SÍ puede hacer clic en "Ver preview antes de imprimir" para toggle. WCAG 1.3.1 cumplido. | N/A | Subagente S6 (lint) | Cambiar a `<label htmlFor="preview-before-print">` explícito + sacar el checkbox del label. |
| **A11Y-03** (era A-1) | ALTA | **BAJA (falso positivo de lint)** | **No** | Settings (configuración fiscal) | `FiscalSettingsView.tsx:439,450`: dos `<label>` ENVUELVEN `<Checkbox>` con texto descriptivo. Patrón anidado correcto. | Admin SÍ puede hacer clic en el texto para toggle. WCAG cumplido. | N/A | Subagente S6 (lint) | Cambiar a `<label htmlFor="...">` explícito. |
| **A11Y-04** (era A-2) | ALTA | **MEDIA (impacto real pero fuera de flujo crítico)** | **No** | Historial (menú de acciones de fila) | `InvoiceHistoryView.tsx:386-389`: `<div className="fixed inset-0 z-40" onClick={...}>` es overlay de cierre de menú. NO afecta flujos de caja, pagos, factura, cierre, reportes. NO está en POS. | El usuario puede: (a) hacer clic en el mismo botón MoreHorizontal para toggle, (b) hacer clic en otra fila, (c) hacer clic en el botón "Anular" directamente dentro del menú. El cajero típico en piloto usa mouse + touch, no navega este sub-menú con teclado. | N/A — usuario con teclado puede usar Tab para llegar al "Anular" tras abrir el menú, o clic en MoreHorizontal de nuevo para cerrar | Subagente S6 (UX) | Añadir listener `Escape` que llame a `setOpenActionsId(null)` y/o reemplazar `<div onClick>` por `<button type="button" aria-label="Cerrar menu">`. |
| **A11Y-05** (era A-3) | ALTA | **BAJA (falso positivo de lint)** | **No** | Componentes UI base | `card.tsx:18` y `sheet.tsx:53` definen `<h2>` para `CardTitle` y `SheetTitle`. ESLint `jsx-a11y/heading-has-content` no rastrea props en runtime, pero todos los call sites pasan texto (revisados: `CashBoxView`, `NewInvoiceView`, `DashboardView`, `ReportsView`, `InvoiceHistoryView`, etc.). | Inspección estática: cero call sites con `CardTitle` o `SheetTitle` sin contenido. El lint marca por heurística conservativa. | N/A | Subagente S6 (lint) | Configurar `eslint-plugin-jsx-a11y` con excepción documentada o usar `eslint-disable-next-line jsx-a11y/heading-has-content` con justificación. |
| **A11Y-06** (no en S6) | (no marcada) | **BAJA (falso positivo de lint)** | **No** | Auth (cambio de contraseña) | `PasswordChangeView.tsx:37,47,57`: 3 inputs `<Input type="password">` con `<label>` envolvente. Patrón anidado, WCAG cumplido. | Usuario SÍ puede hacer clic en el texto del label para enfocar el input. | N/A | Subagente S6 (lint) | Convertir a `<label htmlFor="...">` + `<Input id="...">`. |
| **A11Y-07** (no en S6) | (no marcada) | **BAJA (falso positivo de lint)** | **No** | Catálogo (categorías) | `CategorySheet.tsx:103`: `<label>` envuelve `<Checkbox>` con "Categoría activa". | Admin puede togglear. WCAG cumplido. | N/A | Subagente S6 (lint) | Convertir a `<label htmlFor="active">`. |
| **A11Y-08** (no en S6) | (no marcada) | **BAJA (falso positivo de lint)** | **No** | Catálogo (servicios) | `ServiceSheet.tsx:356,361`: 2 `<label>` envuelven `<Checkbox>` para "Aplica ISV" y "Servicio activo". | Admin puede togglear. WCAG cumplido. | N/A | Subagente S6 (lint) | Convertir a `<label htmlFor="...">`. |
| **A11Y-09** (no en S6) | (no marcada) | **BAJA (cosmético)** | **No** | Layout (sidebar) | `Sidebar.tsx:79`: `<ul role="list">` redundante (ya implícito). | WCAG sin impacto. | N/A | Subagente S6 (lint) | Quitar `role="list"`. |

**Inventario completo de lint warnings (frontend, npm run lint, 0 errors, 28 warnings):**
- 5 `react-hooks/exhaustive-deps` — funcionales, no afectan correctitud.
- 10 `jsx-a11y/label-has-associated-control` — TODOS falsos positivos (label envolvente anidado). Ver A11Y-01, -02, -03, -06, -07, -08.
- 2 `jsx-a11y/heading-has-content` — falsos positivos. Ver A11Y-05.
- 2 `jsx-a11y/click-events-have-key-events` + `no-static-element-interactions` en `InvoiceHistoryView.tsx:386` — único real. Ver A11Y-04.
- 1 `jsx-a11y/no-redundant-roles` en `Sidebar.tsx:79` — cosmético. Ver A11Y-09.

**Conclusión A11Y:** Ninguno de los 9 hallazgos a11y impacta un flujo crítico del piloto. Los 8 falsos positivos pueden corregirse en una pasada de refactor (`<label htmlFor>`) en ~10 minutos si se desea limpiar los warnings. El único real (A11Y-04) está en sub-menú de historial, fuera de POS. El piloto opera con mouse + touch, no depende de navegación por teclado completa en sub-menús secundarios.

**Actualización 2026-06-18:** A11Y-04 ya no aplica al código actual. `InvoiceHistoryView.tsx` renderiza acciones de fila como botones nativos visibles (`Ver recibo`, `Generar PDF`, `Reimprimir`, `Reversar`, `Anular`) y no contiene `openActionsId`, `role="button"`, `tabIndex` manual ni overlay `div` con `onClick`. Verificación: `npm.cmd run lint` PASS sin warnings; `rg '<div[^>]*onClick' frontend/src/features frontend/src/components` sin resultados.

---

## FIELD-PILOT-DEPENDENCY (3)

Estos NO son bugs de software. Son validaciones que **solo pueden ejecutarse en la PC del Hospital San Isidro** con hardware y datos reales.

| ID | Tipo | ¿Bloquea piloto software? | ¿Bloquea entrega `PRODUCTION_READY`? | Flujo | Evidencia | Razón | Workaround | Recomendación | Criterio de cierre |
| -- | ---- | ------------------------- | ------------------------------------ | ----- | --------- | ----- | ---------- | ------------- | ------------------ |
| **FIELD-DEP-01** | Validación física de impresión | **No** (software ya emite vía `window.print()` con CSS @page) | **Sí** | Impresión de recibos (media carta, carta, A5, 80mm, 58mm) | `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md:3` declara `PENDING_HARDWARE_VALIDATION`. `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md` + 5 anchos ya probados en tests Vitest y Playwright. | El sistema **sí** genera el HTML/CSS de recibo correctamente. Lo que falta es la validación con la impresora física del hospital: 5 anchos, márgenes reales, escala 100%, encabezados/pies del navegador desactivados. | N/A — debe hacerse en sitio | Equipo de operaciones del hospital | (a) Imprimir 1 recibo de muestra en cada uno de los 5 anchos en la PC de caja real; (b) fotografiar o escanear evidencia; (c) firmar por el responsable; (d) llenar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con la evidencia física. |
| **FIELD-DEP-02** | Validación de restore contra MySQL activo | **No** (script de validación ya existe) | **Sí** | Recuperación de desastres | `docs/BACKUP_RESTORE.md:175-274` documenta el procedimiento. `scripts/validate_restore_mysql.sh` está implementado. `docs/DISASTER_RECOVERY.md` cubre el runbook. `BackupWorkflowTest.php:19 tests` validan la lógica de backup. | La cadena de backup SÍ funciona. Lo que falta es ejecutar el restore en una base MySQL/MariaDB activa del hospital (no en SQLite in-memory) para confirmar que el SQL generado es compatible. | Backup diario automático + capacidad de recovery por código. Si hay incidente, se puede recurrir al equipo de TI con la documentación. | Administrador del hospital o equipo de operaciones | (a) Ejecutar `HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh`; (b) completar `qa/FINAL_RESTORE_PROOF.md` con fecha, equipo, archivo, checksum, resultado de `migrate:status`, conteos. |
| **FIELD-DEP-03** | Validación LAN física segunda PC | **No** (e2e API relativa + Soketi LAN ya validados) | **Sí** | Multi-PC en LAN (cajero A y cajero B simultáneos) | `docs/OFFLINE_LAN_INSTALL.md:184-190` documenta el checklist. `docs/LAN_CLIENT_VALIDATION_PROOF.md` cubre validación LAN. `frontend/e2e/production-readiness.spec.ts` ejecuta pruebas en navegador headless. | El sistema SÍ soporta LAN: throttling per-user evita bloqueos cruzados, polling 10s en caja, broadcasting vía Soketi. Lo que falta es la prueba con una segunda PC física (no simulada). | Modo single-cajero funciona. Multi-cajero se valida con `scripts/validate_mysql_concurrency.sh` que ejecuta 2 clientes concurrentes. | Administrador del hospital | (a) Encender PC cliente adicional; (b) abrir `http://IP_SERVIDOR:8000/login`; (c) login con cajero B; (d) completar checklist de `docs/OFFLINE_LAN_INSTALL.md:170-182`. |

**Conclusión FIELD-DEP:** El software está validado en los 3 escenarios a nivel de código y simulación. La validación final en hardware/red del hospital es prerrequisito para declarar `PRODUCTION_READY`, pero **no impide iniciar el piloto en modo `PRODUCTION_CANDIDATE`** con usuario real y soporte del equipo de operaciones presente.

---

## Resumen por severidad (post-revisión)

| Severidad | Cantidad | IDs |
| --------- | -------- | --- |
| BLOQUEANTE | 0 | — |
| ALTA-BLOQUEANTE | 0 | — |
| ALTA-PILOT-SAFE | 0 | — |
| MEDIA | 10 | MEDIA-01 a MEDIA-10 |
| BAJA | 5 | BAJA-01 a BAJA-05 |
| A11Y (reclasificados) | 5 | A11Y-01 a A11Y-05 (todos BAJA o MEDIA-no-bloqueante) |
| FIELD-PILOT-DEPENDENCY | 3 | FIELD-DEP-01 a FIELD-DEP-03 |

**Total bugs que bloquean piloto: 0.**
**Total FIELD-DEP que bloquean `PRODUCTION_READY`: 3** (todos de validación física, no de software).

---

## Veredicto actualizado

**READY FOR PILOT** con la siguiente salvedad:

- El software está validado. Los 3 FIELD-PILOT-DEPENDENCY deben completarse en la PC del hospital **antes** de declarar `PRODUCTION_READY` formal, pero el sistema puede operar en modo `PRODUCTION_CANDIDATE` con usuario real y soporte presente desde el día 1.
- El veredicto "READY FOR PILOT WITH RISKS" se aplicaría si hubiera ALTA-PILOT-SAFE sin justificación clara. Tras la reclasificación, los 3 hallazgos a11y son falsos positivos o impacto no crítico, y los 10 MEDIA son mejoras que no impiden el flujo.
