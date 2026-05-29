# Hospital San Isidro RC - Auditoría Previa

Fecha: 2026-05-29

## Alcance

Se inspeccionó el repositorio antes de tocar código de producto:

- Frontend React/TypeScript: rutas, shell, componentes UI, nueva factura, caja, catálogo, historial, reportes, respaldos, configuración, usuarios, recibo y estilos globales.
- Backend Laravel: rutas API, pagos, cierre de caja, recibos, reportes, migraciones, settings fiscales, permisos y tests.
- Base de datos: migraciones críticas, snapshots, pagos, caja, fiscal settings, scan codes y backup logs.
- Scripts/operación: Docker Compose, backup worker, startup Windows, preflight, release offline y visual smoke.
- Documentación: docs, prompts, referencias y docx principales.

## Sistema Levantado

`docker compose ps` mostró:

- `s_hospital-backend-1`: `0.0.0.0:8000->8000`
- `s_hospital-frontend-1`: `0.0.0.0:5173->5173`
- `s_hospital-mysql-1`: healthy, `0.0.0.0:3307->3306`

## Pantallas Auditadas

- Login
- Inicio
- Nueva factura
- Caja
- Catálogo
- Historial
- Reportes
- Respaldos
- Configuración fiscal
- Recibo/reimpresión desde historial

## Capturas Base

Directorio:

- `qa/screenshots/field-qa-2026-05-29-fixed/`

Archivos:

- `01-login.png`
- `02-dashboard.png`
- `03-fiscal-settings.png`
- `04-backups.png`
- `05-catalog.png`
- `06-billing-new.png`
- `07-reports.png`
- `08-cashbox.png`
- `09-invoices.png`
- `10-receipt-preview.png`
- `field-qa-fixed-report.json`

Resultado del script:

- `node qa/visual-smoke/field-qa-current-screenshots.mjs`: pasó.
- El reporte no detectó marcas prohibidas, datos demo fiscales visibles, `APP_ENV`, `APP_DEBUG`, términos de contenedores ni scanner/QR visible cuando scanner está deshabilitado.

## Hallazgos UX/Accesibilidad

- Login se ve limpio y no técnico, pero aún usa identidad genérica "Caja hospitalaria"; debe pasar a identidad institucional configurable de Hospital San Isidro.
- Nueva factura tiene foco visible, paciente destacado, búsqueda, categorías y carrito. Riesgo: el texto vacío aún menciona "escanee un código"; debe depender de `scanner_enabled`.
- Catálogo muestra una tabla larga de servicios. Para administración es manejable, pero "Todos" en POS no debe convertirse en 122 resultados sin límite.
- Reportes separan facturado, cobrado, pagos y estados, pero la presentación de tablas es cruda y debe destacar saldo pendiente, parciales y anuladas con mayor claridad.
- Caja separa efectivo esperado, efectivo cobrado, tarjeta y transferencia; esto está alineado con el objetivo.
- Respaldos muestra estado comprensible, pero mezcla pendientes de campo y checklist en una vista densa. Debe simplificarse para administrador no técnico.
- La captura `10-receipt-preview.png` no evidencia claramente el recibo institucional; el script de captura o flujo de modal debe corregirse.
- El recibo en código ya es institucional y papel (`letter`, `half_letter`, `a5`), pero CSS y docs conservan clases/nombres legados `thermal`, `80mm`, `58mm`.

## Hallazgos Backend/Dominio

- `RegisterPaymentAction` bloquea pagos mayores que saldo y bloquea pagos menores si `partial_payments_enabled=false`.
- `CloseCashSessionAction` calcula efectivo esperado solo con pagos en efectivo y bloquea cierre con facturas emitidas/parciales pendientes.
- `GenerateReceiptDataAction` usa snapshots de factura e items para recibo.
- `ReportController` protege exportaciones con `reports.export` y scope por caja/cajero cuando no hay permiso gerencial.
- Migración `2026_05_29_000001_add_institutional_receipt_settings.php` ya agrega campos institucionales; evitar duplicar columnas.

## Archivos Cambiados Durante Auditoría

- `docs/superpowers/plans/2026-05-29-hospital-san-isidro-release-candidate.md`
- `qa/HOSPITAL_SAN_ISIDRO_PLAN_REVIEW_2026-05-29.md`
- `qa/HOSPITAL_SAN_ISIDRO_AUDIT_2026-05-29.md`
- `qa/screenshots/field-qa-2026-05-29-fixed/02-dashboard.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/04-backups.png`

No se modificó código de producto.

## Pruebas Ejecutadas

- `docker compose ps`
- `node qa/visual-smoke/field-qa-current-screenshots.mjs`

No se ejecutó todavía el quality gate completo porque el repositorio exige plan aprobado antes de implementar fases.

## Recomendación

Iniciar implementación por Fase 1 del plan aprobado: identidad institucional y lenguaje visible. No tocar recibo, pagos, búsqueda, reportes ni respaldos en el mismo commit.

