# Worklog 2026-05-17 - Fase 12 UX Reset

## Contexto

El usuario cuestiono si el producto esta mal planteado por UX/UI: una sola pagina, falta de dashboard/secciones, falta de sidebar, lista interminable de servicios, falta de categorias dominantes, falta de scanner/QR, reportes basicos y apariencia no vendible.

## Verificacion rapida del repo

Archivos inspeccionados:

- `docs/00_EXECUTIVE_RESET.md`
- `docs/02_UI_ARCHITECTURE.md`
- `docs/03_POS_BILLING_UX_SPEC.md`
- `docs/04_ADVANCED_REPORTS_SPEC.md`
- `docs/06_BARCODE_QR_WORKFLOW.md`
- `docs/07_FINAL_PHASES_ROADMAP.md`
- `prompts/00_PLAN_MODE_MASTER_PROMPT.md`
- `prompts/01_PLAN_REVIEW_ORCHESTRATOR.md`
- `frontend/src/App.tsx`
- `frontend/src/layout/AppShell.tsx`
- `frontend/src/features/invoices/NewInvoiceView.tsx`
- `frontend/src/features/catalog/CatalogView.tsx`
- `frontend/src/features/reports/ReportsView.tsx`
- `frontend/src/styles.css`

## Hallazgo

La critica es parcialmente cierta.

Ya existe separacion por rutas y un `AppShell` con sidebar/topbar. Por tanto, no es correcto decir que todo sigue literalmente en una sola pantalla.

Pero el problema comercial de UX sigue vivo:

- `NewInvoiceView` todavia muestra servicios como lista filtrable y no como POS por categorias/codigo/scanner.
- La busqueda solo cruza nombre y categoria; no hay campo dedicado de scanner ni soporte visible de `scan_code`/barcode/QR.
- `CatalogView` tiene categorias, busqueda y tabla, pero aun no expone codigos de escaneo.
- `ReportsView` ya tiene diario, rango, categorias y caja, pero no cumple todavia el nivel de reportes avanzados solicitado: top servicios, anulaciones, reimpresiones, backups, exportacion CSV, graficas y filtros completos.
- La documentacion existente ya reconoce que la UX visible es el bloqueo principal de venta.

## Decision

Fase 12 queda como cierre final obligatorio antes de enviar el producto como version vendible:

1. 12A App shell y design system.
2. 12B POS de facturacion profesional.
3. 12C Catalogo, categorias y codigos de scanner.
4. 12D Reportes avanzados.
5. 12E QA final y demo premium.

## Riesgo

Si se entrega solo con backend funcional, el cliente puede percibir el sistema como prototipo. Para venta, entrenamiento y confianza operativa, el criterio visual/operativo es parte del cierre tecnico.

## Siguiente accion

Usar `docs/09_FINAL_EXECUTION_PACK_INDEX.md` como indice maestro y ejecutar una fase a la vez en rama `codex/*`, empezando por la fase que todavia este incompleta en el checkout actual.
