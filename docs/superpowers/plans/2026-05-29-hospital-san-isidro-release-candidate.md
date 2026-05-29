# Hospital San Isidro Release Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert S_Hospital into an institutional cashier and billing release candidate for Hospital San Isidro, suitable for local LAN operation by non-technical hospital staff.

**Architecture:** Preserve the current React + TypeScript frontend, Laravel API, and MySQL/MariaDB offline LAN architecture. Refactor through shared components, settings-backed receipt snapshots, additive migrations, permission checks, and non-technical operator documentation; do not reset production data or introduce SaaS dependencies.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4 tokens, Radix/shadcn-style local components, TanStack Query, React Hook Form, Zod, Recharts, Laravel 12, Sanctum, Spatie Permission, MySQL/MariaDB, Docker Compose for development, Playwright, PHPUnit/Vitest.

---

## 1. Resumen Ejecutivo

El sistema ya tiene una base avanzada: autenticación local, roles, catálogo, facturación, caja, pagos, recibo institucional, historial, reportes, respaldos, scripts Windows, evidencia QA y release offline. La auditoría viva del 2026-05-29 levantó Docker (`backend:8000`, `frontend:5173`, `mysql:3307`) y generó capturas en `qa/screenshots/field-qa-2026-05-29-fixed/` para login, inicio, configuración fiscal, respaldos, catálogo, nueva factura, reportes, caja, historial y recibo.

El objetivo nuevo cambia la vara: no basta con estar `PRODUCTION_CANDIDATE` ni con verse limpio. Debe quedar institucional para Hospital San Isidro y Gobierno de Honduras, sin lenguaje demo, sin recibo térmico, sin QR/barcode/códigos internos visibles cuando scanner está deshabilitado, con respaldo/restauración comprensible, instalación Windows clara, y con pruebas reales de los flujos de caja.

Este plan queda en fases pequeñas, verificables y commiteables. La primera implementación debe iniciar por auditoría y branding institucional, luego recibo/caja/pagos, después UX de flujos, respaldos/instalación, documentación y gates finales.

## 2. Suposiciones Explícitas

- Producción sigue siendo local offline LAN, con una PC servidor y clientes por navegador.
- No se usará Supabase cloud, Firebase, SQLite multiusuario ni SaaS obligatorio.
- No se hará `git push`.
- No se borrará `.env`, no se ejecutará `migrate:fresh` contra una base real y no se hará reset destructivo.
- La base local actual es de desarrollo; cualquier prueba mutacional deberá usar datos claramente auditables o entorno descartable.
- El nombre visible final debe ser "Hospital San Isidro" cuando haya datos reales configurados; si faltan datos fiscales o institucionales reales, la UI debe decir "Configuración pendiente", no inventar cumplimiento fiscal.
- El recibo final de caja no será ticket térmico 80/58mm. Debe ser institucional en carta, media carta o A5, blanco al imprimir, sin QR, barcode ni códigos internos.
- Scanner/códigos pueden existir como capacidad interna opcional, pero si `scanner_enabled=false` no se muestran controles ni códigos operativos al cajero/paciente.
- Pagos parciales solo se permiten si `partial_payments_enabled=true`; si está apagado, un pago menor al total se bloquea.

## 3. Preguntas Bloqueantes

No hay preguntas que bloqueen planificar. Hay tres decisiones operativas que deben confirmarse durante la fase correspondiente:

- Datos reales fiscales: RTN, CAI, serie, rango, textos autorizados, fecha límite y nombre legal exacto del hospital.
- Formato físico preferido: carta, media carta o A5 como predeterminado.
- Restauración: si se permite solo procedimiento manual documentado o si el hospital necesita una validación asistida desde UI sin sobrescribir producción.

Supuesto seguro hasta tener respuesta: usar configuración pendiente y bloquear emisión/impresión fiscal si faltan datos obligatorios; conservar restore destructivo fuera de UI y documentarlo con validación en base descartable.

## 4. Evidencia Base Leída y Capturada

Docs/prompts leídos:

- `AGENTS.md`
- `prompts/00_PLAN_MODE_MASTER_PROMPT.md`
- `prompts/01_PLAN_REVIEW_ORCHESTRATOR.md`
- `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md`
- `docs/01_FINAL_PRODUCT_REQUIREMENTS.md`
- `docs/02_UI_ARCHITECTURE.md`
- `docs/03_POS_BILLING_UX_SPEC.md`
- `docs/04_ADVANCED_REPORTS_SPEC.md`
- `docs/05_DESIGN_SYSTEM_AND_LIBRARIES.md`
- `docs/06_BARCODE_QR_WORKFLOW.md`
- `docs/07_FINAL_PHASES_ROADMAP.md`
- `docs/08_CRITICAL_ACCEPTANCE_CRITERIA.md`
- `docs/12_CORRECTED_FINAL_PRODUCT_PLAN.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/FISCAL_RULES.md`
- `docs/BACKUP_RESTORE.md`
- `docs/OFFLINE_LAN_INSTALL.md`
- `docs/PERMISSIONS_MATRIX.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/DECISIONS.md`
- Word docs principales en `docs/*.docx`, incluyendo flujo agentic, subagentes, convenciones, backlog, catálogo y documento maestro UX.

Referencias leídas:

- `database/database_schema_critico.sql`
- `references/software_architecture.md`
- `references/database_integrity_mysql.md`
- `references/offline_lan_deployment.md`
- `references/security_privacy_hospital_billing.md`
- `references/ui_ux_cashier_workflows.md`
- `references/performance_laravel_react_mysql.md`
- `references/hospital_billing_domain.md`
- `references/tdd_quality_gates.md`
- `references/thermal_printing_80mm.md`
- `references/barcode_qr_reference.md`
- `references/advanced_reports_reference.md`

Capturas vivas:

- `qa/screenshots/field-qa-2026-05-29-fixed/01-login.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/02-dashboard.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/03-fiscal-settings.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/04-backups.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/05-catalog.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/06-billing-new.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/07-reports.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/08-cashbox.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/09-invoices.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/10-receipt-preview.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/field-qa-fixed-report.json`

Hallazgos base:

- La UI ya es más limpia que una demo, pero todavía usa "Caja hospitalaria" como identidad genérica en vez de Hospital San Isidro.
- El script de captura no logró evidenciar claramente el recibo institucional; `10-receipt-preview.png` muestra historial, así que el flujo de captura/prueba del recibo debe corregirse.
- El catálogo sigue mostrando 122 servicios como tabla larga. Es aceptable para administración, pero necesita mejor escaneo, paginación/estado y enfoque de tareas.
- Reportes separan facturado/cobrado/métodos/estado, pero la presentación es cruda y no destaca saldo pendiente, parciales/anuladas y conciliación con caja.
- Respaldos muestra estados útiles, pero aún habla de pendientes de campo en un lenguaje que puede simplificarse para administrador no técnico.
- Código y docs conservan conceptos heredados de térmico 80/58mm (`receipt_width`, `thermal`, `THERMAL_PRINTER_PROOF`) que chocan con el objetivo nuevo.

## 5. Arquitectura Propuesta

### Backend

- Mantener controllers delgados y Actions/Services existentes.
- No cambiar cálculos financieros a frontend.
- Consolidar configuración institucional en `fiscal_settings` y snapshots de `invoices`.
- Mantener `DECIMAL(12,2)`, transacciones y locks para factura/pago/caja.
- Añadir migraciones solo aditivas para reemplazar conceptos térmicos por institucionales si faltan campos.
- Mantener compatibilidad con campos legados mientras se migra UI/docs.
- Fortalecer tests de pago parcial, métodos de pago, cierre de caja, recibo histórico y reportes.

### Frontend

- Mantener AppShell, rutas y componentes base.
- Priorizar cambios en componentes compartidos: `PageHeader`, `DataTable`, `FilterBar`, `MetricCard`, `ConfirmDialog`, `ReceiptPreview`, estados y tokens.
- No agregar estilos inline ni parches visuales por pantalla.
- Hacer foco visible, teclado y estados carga/error/vacío por pantalla.
- Retirar UI visible de scanner/códigos si `scanner_enabled=false`.
- Convertir el recibo a vista institucional de papel, no térmica.

### Operación Windows/LAN

- Mantener scripts seguros existentes.
- Validar que arranque Windows, acceso directo, backup worker y backup diario estén documentados para no técnicos.
- No automatizar restore destructivo sobre producción.
- Agregar checklist físico claro: impresora, LAN, reinicio, acceso directo, backup manual/automático, restore en prueba.

## 6. Modelo de Datos y Migraciones

Migraciones esperadas solo si la auditoría confirma campos faltantes. Antes de crear cualquier migración se debe revisar el esquema actual, especialmente `backend/database/migrations/2026_05_29_000001_add_institutional_receipt_settings.php`, porque varios campos institucionales ya existen.

- Agregar campos institucionales explícitos a `fiscal_settings`:
  - `institution_name`
  - `institution_legal_name`
  - `government_line`
  - `secretariat_line`
  - `receipt_default_paper_size`
  - `receipt_original_copy_mode`
  - `restore_validation_enabled`
- Agregar snapshots faltantes a `invoices`:
  - `receipt_copy_label`
  - `receipt_signature_label`
  - `receipt_paper_size`
  - `receipt_government_line`
  - `receipt_secretariat_line`
- Mantener `receipt_width` como legado interno si ya existe, pero removerlo de UI visible salvo compatibilidad técnica.

Reglas de migración:

- No eliminar columnas en esta release candidate.
- No renombrar columnas con riesgo de datos sin migración de compatibilidad.
- No usar `migrate:fresh` excepto en entorno descartable.
- Toda nueva migración debe tener test de migración/feature asociado o cobertura indirecta de modelo/API.
- Antes de ejecutar una migración fuera de entorno descartable, crear backup o documentar explícitamente por qué la base es descartable.

## 7. Módulos y Fases

### Fase 0 - Auditoría Institucional y Plan Aprobable

Alcance:

- Congelar línea base con capturas, rutas, módulos, docs, scripts y estados de git.
- Crear checklist de hallazgos por flujo: login, inicio, nueva factura, caja, catálogo, historial, reportes, respaldos, configuración, recibo, reimpresión e instalación.
- Ejecutar revisión del plan con 8 subagentes.
- No cambiar código de producto.

Archivos esperados:

- Crear: `docs/superpowers/plans/2026-05-29-hospital-san-isidro-release-candidate.md`
- Crear: `qa/HOSPITAL_SAN_ISIDRO_AUDIT_2026-05-29.md`
- Actualizar: `docs/DECISIONS.md`

Migraciones:

- Ninguna.

Pruebas/comandos:

- `docker compose ps`
- `node qa/visual-smoke/field-qa-current-screenshots.mjs`
- `git status --short --branch`

Riesgos:

- Confundir evidencia previa con estado actual.
- Plan demasiado grande para revisar.

Criterios de aceptación:

- Plan aprobado sin bloqueantes.
- Capturas actuales enlazadas.
- Hallazgos ordenados por severidad y módulo.

Commit:

- `docs(plan): define hospital san isidro rc audit plan`

### Fase 1 - Branding Institucional y Lenguaje No Técnico

Alcance:

- Sustituir identidad genérica visible por Hospital San Isidro cuando esté configurado.
- Eliminar textos visibles de demo, stack, contenedores, rutas internas, `APP_ENV`, `PRODUCTION_READY`, `thermal`, `80mm/58mm`, `QR`, `barcode` o códigos internos para usuarios normales.
- Mantener diagnósticos técnicos solo en secciones admin con lenguaje operativo.
- Crear branding check para "Hospital San Isidro", "Gobierno de Honduras", "Secretaría de Salud" y ausencia de marcas heredadas.
- No rediseñar layout ni flujos en esta fase; solo identidad, copy visible y checks.

Archivos esperados:

- Modificar: `frontend/src/lib/hospital-name.ts`
- Modificar: `frontend/src/features/auth/LoginView.tsx`
- Modificar: `frontend/src/layout/AppShell.tsx`
- Modificar: `frontend/src/features/backups/BackupsView.tsx`
- Modificar: `frontend/src/features/help/HelpView.tsx`
- Modificar: `frontend/src/features/about/AboutView.tsx`
- Modificar: `scripts/check-branding.ps1`
- Modificar: `docs/DECISIONS.md`
- Tests: `frontend/src/lib/hospital-name.test.ts`, `frontend/src/App.test.tsx`

Migraciones:

- Ninguna esperada.

Pruebas:

- `cd frontend && npm.cmd run test -- hospital-name.test.ts App.test.tsx`
- `cd frontend && npm.cmd run typecheck`
- `cd frontend && npm.cmd run lint`
- `cd frontend && npm.cmd run check:branding`
- Smoke por rol admin/supervisor/cajero para confirmar que cajero no ve diagnósticos técnicos, respaldos ni configuración fiscal si no tiene permiso.

Riesgos:

- Cambiar texto de tests E2E sin actualizar selectores accesibles.
- Ocultar diagnóstico necesario para admin.

Criterios de aceptación:

- Login, sidebar, topbar, ayuda y respaldos no muestran lenguaje demo/técnico.
- Admin ve estados operativos en español claro.
- Cajero no ve detalles técnicos de instalación o contenedores.

Commit:

- `feat(branding): institutionalize hospital identity and copy`

### Fase 2 - Recibo Institucional en Papel y Snapshot Histórico

Alcance:

- Convertir recibo a formato institucional parecido al talonario manual de Hospital San Isidro.
- Soportar carta, media carta y A5.
- Imprimir siempre en blanco aunque la app esté en modo oscuro.
- Incluir encabezado gobierno/secretaría/hospital, número, serie, fecha, valor en lempiras, paciente/enterante, concepto/servicios, total, pagado, saldo si aplica, cajero, método, firma/sello, original/copia.
- No mostrar QR, barcode, scan_code ni códigos internos.
- Mostrar "Configuración pendiente" si faltan datos reales, sin inventar cumplimiento fiscal.
- Corregir captura/prueba de recibo para evidenciar el modal real.

Archivos esperados:

- Modificar: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modificar: `frontend/src/styles.css`
- Modificar: `frontend/src/features/settings/FiscalSettingsView.tsx`
- Modificar: `backend/app/Actions/Receipts/GenerateReceiptDataAction.php`
- Modificar: `backend/app/Actions/Receipts/ReprintReceiptAction.php`
- Modificar: `backend/app/Actions/Billing/CreateInvoiceAction.php`
- Modificar: `backend/app/Http/Requests/Receipts/ShowReceiptRequest.php`
- Modificar: `backend/app/Http/Requests/Receipts/ReprintReceiptRequest.php`
- Crear/modificar migración aditiva solo si falta snapshot.
- Tests: `backend/tests/Feature/CashPaymentsReceiptTest.php`, `backend/tests/Feature/InvoiceHistoryReprintVoidTest.php`, frontend receipt tests if present or `App.test.tsx`.
- Modificar: `qa/visual-smoke/field-qa-current-screenshots.mjs`

Migraciones:

- Aditiva si faltan labels/snapshots institucionales.
- Sin drop de campos térmicos legados.
- Reutilizar campos existentes antes de crear columnas nuevas.
- Backup previo o entorno descartable confirmado antes de ejecutar migración.

Pruebas:

- `docker compose exec backend php artisan test --colors=never --filter=CashPaymentsReceiptTest`
- `docker compose exec backend php artisan test --colors=never --filter=InvoiceHistoryReprintVoidTest`
- `cd frontend && npm.cmd run test -- NewInvoiceView.test.tsx`
- `node qa/visual-smoke/field-qa-current-screenshots.mjs`
- Captura manual/Playwright de carta, media carta y A5.

Riesgos:

- Romper reimpresión histórica al depender de configuración actual.
- React-to-print puede capturar más de una factura si el selector no está aislado.

Criterios de aceptación:

- Una factura por impresión.
- Recibo visible e impreso no tiene QR/barcode/códigos internos.
- Reimpresión usa snapshot histórico.
- Si faltan CAI/serie/rango/textos, aparece "Configuración pendiente".
- Para facturas nuevas, emisión sigue bloqueada si la configuración fiscal obligatoria falta; para facturas históricas incompletas, el recibo muestra pendiente sin mutar datos.

Commit:

- `feat(receipts): render institutional paper receipt`

### Fase 3 - Pago, Parciales y Conciliación de Caja

Alcance:

- Validar end-to-end que un pago menor al total se bloquee si `partial_payments_enabled=false`.
- Si parciales están habilitados, registrar saldo claro y estado parcial sin marcar pagado completo.
- Confirmar que tarjeta/transferencia no aumentan efectivo esperado.
- Fortalecer UI de cobro para saldo, cambio, método y referencia.
- Asegurar que cierre de caja bloquea facturas pendientes/parciales o exige flujo autorizado si se decide permitirlo.

Archivos esperados:

- Modificar: `frontend/src/features/invoices/components/PaymentModal.tsx`
- Modificar: `frontend/src/features/cash/CashBoxView.tsx`
- Modificar: `backend/app/Actions/Payments/RegisterPaymentAction.php`
- Modificar: `backend/app/Actions/Cash/CloseCashSessionAction.php`
- Modificar: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modificar: `frontend/src/features/invoices/NewInvoiceView.test.tsx`

Migraciones:

- Ninguna esperada.

Pruebas:

- Pago menor bloqueado sin parciales.
- Pago menor registra estado `partial` con parciales habilitados.
- Pago tarjeta no altera efectivo esperado.
- Pago transferencia no altera efectivo esperado.
- Cierre de caja con pendiente/parcial se bloquea.
- `docker compose exec backend php artisan test --colors=never --filter=CashPaymentsReceiptTest`
- `cd frontend && npm.cmd run test -- NewInvoiceView.test.tsx`

Riesgos:

- Tests existentes pueden depender de datos demo con factura parcial.
- Cambios de copy pueden romper E2E por roles.

Criterios de aceptación:

- Cajero no puede marcar completo un pago incompleto por error.
- Reporte de caja y pantalla de cierre separan efectivo, tarjeta y transferencia.
- Saldo pendiente aparece claro en factura, recibo e historial.

Commit:

- `fix(cashbox): enforce payment balance and cash reconciliation`

### Fase 4 - Nueva Factura y Búsqueda Tolerante

Alcance:

- Hacer Nueva factura aún más simple: paciente, búsqueda, categorías, servicios activos, carrito, cobrar/imprimir.
- "Todos" debe permitir ver servicios activos sin reintroducir una lista interminable; usar paginación/límite visual o agrupación compacta.
- Búsqueda tolera tildes, mayúsculas, códigos y errores simples razonables, empezando por normalización segura antes de fuzzy costoso.
- Si scanner está deshabilitado, no se ve botón escanear, barra, QR ni códigos internos.
- Mantener backend como fuente de precio y reglas.

Archivos esperados:

- Modificar: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modificar: `frontend/src/features/invoices/components/ServiceSearch.tsx`
- Modificar: `frontend/src/features/invoices/components/PatientStep.tsx`
- Modificar: `backend/app/Support/ServiceSearch.php`
- Modificar: `backend/app/Http/Controllers/ServiceController.php`
- Modificar: `backend/tests/Feature/ServiceCatalogTest.php`
- Modificar: `frontend/src/features/invoices/NewInvoiceView.test.tsx`

Migraciones:

- Ninguna esperada.

Pruebas:

- "Todos" muestra servicios activos en una presentación controlada, no 122 filas sin límite.
- Buscar `acido`, `ÁCIDO`, `acído`, `glucsa` encuentra opciones esperadas si el algoritmo lo permite.
- Servicio inactivo no se factura.
- Scanner disabled oculta controles y códigos.
- Scanner enabled muestra controles solo para rol/permisos/config.

Riesgos:

- Fuzzy search demasiado permisiva puede devolver servicios equivocados.
- Mostrar todos puede reintroducir lista inmanejable si no hay paginación/virtualización o límite visible.
- Implementar fuzzy pesado en backend puede degradar latencia LAN; medir y mantener consultas index-friendly.

Criterios de aceptación:

- Cajero puede facturar sin recorrer 122 servicios.
- El foco de teclado se conserva en búsqueda/paciente.
- Estados vacío/error/carga son claros.

Commit:

- `feat(billing): simplify invoice search and active services`

### Fase 5 - Reportes Administrativos y Saldos

Alcance:

- Reportes deben separar facturado, cobrado, saldo pendiente, pagadas, parciales, anuladas y métodos.
- Mostrar caja por cajero y métodos sin mezclar efectivo esperado con tarjeta/transferencia.
- Mejorar diseño de tablas crudas a componentes legibles.
- Exportaciones deben conservar filtros, permisos y lenguaje institucional.

Archivos esperados:

- Modificar: `backend/app/Actions/Reports/DailyReportService.php`
- Modificar: `backend/app/Actions/Reports/IncomeReportService.php`
- Modificar: `backend/app/Actions/Reports/CashSessionReportService.php`
- Modificar: `backend/app/Actions/Reports/PdfExportService.php`
- Modificar: `backend/app/Actions/Reports/PremiumExcelExportService.php`
- Modificar: `frontend/src/features/reports/ReportsView.tsx`
- Modificar: `frontend/src/features/reports/ReportsView.test.tsx`
- Modificar: `backend/tests/Feature/ReportsTest.php`

Migraciones:

- Índices aditivos solo si reportes actuales muestran consultas sin índice para filtros nuevos.
- Backup previo o entorno descartable confirmado antes de ejecutar índices nuevos.

Pruebas:

- Reporte diario separa total facturado vs cobrado vs saldo.
- Facturas parciales aparecen como parciales.
- Anuladas no cuentan como ingreso.
- Métodos de pago se separan.
- Export requiere `reports.export`.
- `docker compose exec backend php artisan test --colors=never --filter=ReportsTest`
- `cd frontend && npm.cmd run test -- ReportsView.test.tsx`

Riesgos:

- Cambiar payload de reportes puede romper dashboard.
- Export Excel/PDF puede seguir usando etiquetas legadas.

Criterios de aceptación:

- Administrador entiende cuánto se facturó, cuánto entró y cuánto quedó pendiente.
- Cajero solo ve reportes permitidos.
- No hay totales financieros calculados como autoridad en frontend.

Commit:

- `feat(reports): clarify billed collected and balance metrics`

### Fase 6 - Respaldos, Restauración Segura e Instalación Windows

Alcance:

- Respaldos automáticos: diario, al cerrar caja y manual.
- UI de respaldos con historial: estado, fecha, tamaño, checksum/verificación.
- Validación de restauración segura en base descartable, sin botón destructivo sobre producción.
- Windows: levantar servicios al iniciar PC, crear acceso directo y documentar fallas comunes.
- Quitar variables técnicas de usuarios normales.

Archivos esperados:

- Modificar: `frontend/src/features/backups/BackupsView.tsx`
- Modificar: `frontend/src/features/backups/components/*`
- Modificar: `backend/app/Actions/Backups/*`
- Modificar: `backend/app/Http/Controllers/BackupController.php`
- Modificar: `backend/app/Http/Controllers/SystemStatusController.php`
- Modificar: `scripts/install_hospital_startup_shortcut.ps1`
- Modificar: `scripts/start_hospital_services.ps1`
- Modificar: `scripts/install_backup_tasks_windows.ps1`
- Modificar: `scripts/validate_restore_mysql.sh`
- Modificar: `scripts/validate_backup_worker_smoke.ps1`
- Modificar: `docs/BACKUP_RESTORE.md`
- Modificar: `docs/OFFLINE_LAN_INSTALL.md`
- Modificar: `docs/RELEASE_CHECKLIST.md`
- Tests: `backend/tests/Feature/BackupWorkflowTest.php`, `backend/tests/Feature/SystemStatusTest.php`

Migraciones:

- Aditiva si `backup_logs` no guarda checksum, verified_at, trigger, completed_at o failure-safe status.
- Backup previo o entorno descartable confirmado antes de ejecutar migración.

Pruebas:

- Backup manual crea archivo y checksum.
- Backup al cerrar caja se encola o ejecuta según worker.
- Restore validation script rechaza base activa y exige nombre descartable.
- Windows scripts `-WhatIfOnly` no modifican estado.
- `docker compose exec backend php artisan test --colors=never --filter=BackupWorkflowTest`
- `docker compose exec backend php artisan test --colors=never --filter=SystemStatusTest`

Riesgos:

- Automatizar demasiado puede ocultar fallos reales de `mysqldump`.
- Restore UI destructivo sería riesgo de pérdida de datos; no implementarlo sin fase separada.

Criterios de aceptación:

- Admin no técnico entiende cuándo el respaldo está completo y verificado.
- Restore solo se valida sin pisar datos reales.
- Documentos Windows explican arranque, acceso directo y qué hacer si falla.

Commit:

- `feat(ops): harden backups restore validation and startup`

### Fase 7 - Accesibilidad, Teclado, Estados y Responsive

Alcance:

- Auditar cada pantalla principal: carga, error, vacío, éxito, focus visible, teclado, contraste y textos.
- Corregir botones/inputs/selects sin labels o estados.
- Validar modo claro/oscuro, pero recibo imprime blanco.
- Revisar mobile/tablet sin romper escritorio LAN.

Archivos esperados:

- Modificar: `frontend/src/components/ui/*`
- Modificar: `frontend/src/layout/*`
- Modificar: `frontend/src/features/*`
- Modificar: `frontend/src/styles.css`
- Modificar: `frontend/e2e/production-readiness.spec.ts`
- Crear: `qa/ACCESSIBILITY_UX_AUDIT_2026-05-29.md`

Migraciones:

- Ninguna.

Pruebas:

- `cd frontend && npm.cmd run test`
- `cd frontend && npm.cmd run typecheck`
- `cd frontend && npm.cmd run lint`
- `cd frontend && npm.cmd run build`
- `cd frontend && npm.cmd run e2e`
- Playwright keyboard smoke para login, nueva factura, pago, reimpresión, respaldos.

Riesgos:

- Cambios visuales globales pueden afectar capturas y snapshots.
- Foco visible mal aplicado puede crear ruido visual.

Criterios de aceptación:

- Flujo principal operable con teclado.
- Focus visible en controles.
- Estados carga/error/vacío/éxito por pantalla.
- Texto no se desborda en viewport desktop/tablet/mobile.

Commit:

- `fix(a11y): improve keyboard states and responsive workflows`

### Fase 8 - Manuales No Técnicos y Capacitación

Alcance:

- Manual de cajero: abrir caja, nueva factura, cobrar, imprimir, reimprimir, cerrar caja.
- Manual administrador: catálogo, usuarios, reportes, respaldos, configuración fiscal.
- Instalación: Windows servidor, IP LAN, acceso directo, arranque, firewall básico.
- Respaldos/restauración: manual, automático, prueba en base descartable, USB.
- Capacitación: checklist físico y guion de práctica.
- Remover promesas de cumplimiento fiscal no validado.

Archivos esperados:

- Modificar: `docs/manuales/MANUAL_CAJERO.md`
- Modificar: `docs/manuales/MANUAL_ADMINISTRADOR.md`
- Modificar: `docs/manuales/GUIA_INSTALACION_OPERATIVA.md`
- Modificar: `docs/manuales/GUIA_RESPALDOS_Y_RESTAURACION.md`
- Modificar: `docs/manuales/CHECKLIST_CAPACITACION.md`
- Modificar: `docs/TRAINING_CAJERO.md`
- Modificar: `docs/TRAINING_ADMIN.md`
- Modificar: `docs/Manual_Usuario.md`
- Modificar: `docs/Manual_Usuario.html`
- Crear: `docs/CHECKLIST_FISICO_HOSPITAL_SAN_ISIDRO.md`

Migraciones:

- Ninguna.

Pruebas:

- Branding/doc check con `rg`.
- Links/rutas documentadas coinciden con app.
- `scripts/check-branding.ps1`

Riesgos:

- Documentación técnica puede filtrarse al manual no técnico.
- Manual HTML puede quedar desactualizado respecto al Markdown.

Criterios de aceptación:

- Persona no técnica puede seguir manuales sin leer comandos internos salvo instalación/admin.
- Checklist físico cubre impresora real, LAN, reinicio Windows, acceso directo, respaldos y restauración.

Commit:

- `docs(training): update non technical hospital manuals`

### Fase 9 - Release Offline, Quality Gates y Evidencia Antes/Después

Alcance:

- Ejecutar gates finales.
- Regenerar capturas después de cambios y comparar contra capturas base.
- Validar migraciones aditivas.
- Ejecutar smoke navegador real.
- Ejecutar branding check.
- Actualizar release offline solo si el diff lo exige y sin exponer secretos.
- No tocar `offline-release.rar`, `Sistema-Caja-Hospitalaria-RC1.zip` ni otros artefactos grandes salvo aprobación explícita.

Archivos esperados:

- Modificar: `qa/RELEASE_READINESS.md`
- Modificar: `qa/FINAL_UX_ACCEPTANCE_CHECKLIST.md`
- Crear: `qa/HOSPITAL_SAN_ISIDRO_RC_EVIDENCE_2026-05-29.md`
- Modificar scripts de release solo si el diff lo exige.

Migraciones:

- Validar `php artisan migrate --pretend` o migración en entorno descartable.

Pruebas:

- `docker compose exec backend composer validate`
- `docker compose exec backend php artisan test --colors=never`
- `docker compose exec backend vendor/bin/pint --test`
- `cd frontend && npm.cmd run typecheck`
- `cd frontend && npm.cmd run lint`
- `cd frontend && npm.cmd run test`
- `cd frontend && npm.cmd run build`
- `cd frontend && npm.cmd run e2e`
- `cd frontend && npm.cmd run check:branding`
- `node qa/visual-smoke/field-qa-current-screenshots.mjs`
- Smoke real no destructivo con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN`, `E2E_REAL_PASSWORD`.

Riesgos:

- E2E mutacional puede crear facturas reales; mantener apagado salvo entorno descartable.
- Release archive grande puede ensuciar git si se regenera sin necesidad.

Criterios de aceptación:

- Gates pasan o fallos quedan documentados con causa concreta.
- Capturas antes/después guardadas.
- No hay secretos ni `.env` staged.
- No se hizo push.

Commit:

- `test(release): verify hospital san isidro release candidate`

## 8. Plan de TDD/Pruebas por Fase

- Reglas de negocio: empezar con tests backend antes de cambiar Actions.
- UI crítica: tests de componente para pago, búsqueda, recibo y reportes.
- E2E: usar mocks para recorrido completo y smoke real no destructivo contra Laravel.
- Browser/capturas: ejecutar al inicio y al cierre de fases visuales.
- Branding: `scripts/check-branding.ps1` debe fallar si vuelven marcas heredadas o lenguaje técnico visible.
- Migraciones: solo aditivas; validar en base descartable.

## 9. Plan de Commits

1. `docs(plan): define hospital san isidro rc audit plan`
2. `feat(branding): institutionalize hospital identity and copy`
3. `feat(receipts): render institutional paper receipt`
4. `fix(cashbox): enforce payment balance and cash reconciliation`
5. `feat(billing): simplify invoice search and active services`
6. `feat(reports): clarify billed collected and balance metrics`
7. `feat(ops): harden backups restore validation and startup`
8. `fix(a11y): improve keyboard states and responsive workflows`
9. `docs(training): update non technical hospital manuals`
10. `test(release): verify hospital san isidro release candidate`

## 10. Riesgos Técnicos y Mitigaciones

- **Datos reales fiscales incompletos:** mostrar configuración pendiente y no inventar CAI/serie/rango.
- **Recibo histórico mutable:** usar snapshots de `invoices` e `invoice_items`; tests de reimpresión.
- **Pagos parciales confusos:** gate backend y UI con saldo claro.
- **Efectivo esperado incorrecto:** reportes/cierre solo suman método efectivo al efectivo esperado.
- **Restore destructivo:** scripts con guardas y base descartable; no UI destructiva.
- **Lenguaje técnico visible:** branding check y revisión visual por rol.
- **Scanner/códigos visibles sin habilitar:** tests config off/on.
- **Cambios amplios visuales:** implementar por componentes compartidos y una fase por commit.
- **E2E con datos reales:** mantener mutaciones apagadas salvo entorno descartable.
- **Archivos release enormes:** no regenerar zip/rar sin necesidad explícita.

## 11. Comandos de Verificación

Backend:

```powershell
docker compose exec backend composer validate
docker compose exec backend php artisan test --colors=never
docker compose exec backend vendor/bin/pint --test
docker compose exec backend php artisan config:cache --no-ansi
```

Frontend:

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run check:branding
npm.cmd run e2e
```

Visual/smoke:

```powershell
node qa\visual-smoke\field-qa-current-screenshots.mjs
```

Smoke real no destructivo:

```powershell
cd frontend
$env:E2E_REAL_BASE_URL="http://127.0.0.1:8000"
$env:E2E_REAL_LOGIN="admin.demo"
$env:E2E_REAL_PASSWORD="Password123!"
npm.cmd run smoke:real
```

Restore seguro en base descartable:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

## 12. Lista de Archivos Esperados por Fase

- Fase 0: `docs/superpowers/plans/*`, `qa/HOSPITAL_SAN_ISIDRO_AUDIT_2026-05-29.md`, `docs/DECISIONS.md`
- Fase 1: `frontend/src/lib/hospital-name.ts`, `frontend/src/features/auth/LoginView.tsx`, `frontend/src/layout/AppShell.tsx`, `frontend/src/features/backups/BackupsView.tsx`, `scripts/check-branding.ps1`
- Fase 2: `frontend/src/features/receipts/ReceiptPreview.tsx`, `frontend/src/styles.css`, `backend/app/Actions/Receipts/*`, receipt requests/tests, possible additive migration
- Fase 3: `PaymentModal.tsx`, `CashBoxView.tsx`, `RegisterPaymentAction.php`, `CloseCashSessionAction.php`, cash/payment tests
- Fase 4: `NewInvoiceView.tsx`, `ServiceSearch.tsx`, `ServiceSearch.php`, `ServiceController.php`, service/POS tests
- Fase 5: report services/controllers/exporters, `ReportsView.tsx`, report tests
- Fase 6: `BackupsView.tsx`, backup actions/controllers/system status, Windows scripts, backup docs/tests
- Fase 7: shared UI/layout/features/styles, Playwright specs, accessibility audit doc
- Fase 8: manuals under `docs/manuales/`, training docs, physical checklist
- Fase 9: QA readiness docs, screenshots, final evidence report

## 13. Checklist de Entrada a Implementación

- [ ] Plan revisado por 8 subagentes sin bloqueantes.
- [ ] Usuario aprueba iniciar Fase 0/Fase 1.
- [ ] Rama/commit strategy clara; no push.
- [ ] `git status` revisado para no mezclar cambios ajenos.
- [ ] Base actual respaldada antes de migraciones o pruebas mutacionales.
- [ ] Ninguna fase ejecuta reset destructivo contra datos reales.
