# PROMPT URGENTE PARA CODEX - Fase 12 Final Product UX Rebuild

Trabaja solo en `C:\Projects\S_Hospital`. Antes de planificar o editar, confirma:

```bash
git rev-parse --show-toplevel
```

Debe responder `C:/Projects/S_Hospital`. No trabajes dentro de `C:\Projects\S_Hospital\S_Hospital`.

## Diagnostico brutal

El sistema actual esta tecnicamente avanzado: backend, facturacion, caja, pagos, recibos, historial, anulaciones, backups y reglas fiscales ya tienen una base real. Pero la UX/UI esta bloqueada porque todavia parece prototipo. Un producto vendible de caja hospitalaria no puede sentirse como una pagina larga con secciones apiladas.

Fase 12 existe para convertir el core funcional en una aplicacion profesional, navegable y demostrable.

## Prohibiciones

- Prohibido mantener todo en una sola pagina interminable.
- Prohibido mostrar los 122 servicios como lista interminable.
- Prohibido que facturar parezca un formulario administrativo en vez de POS/caja.
- Prohibido activar cambios globales sin smoke test.
- Prohibido tocar backend o frontend antes de tener plan aprobado.
- Prohibido reescribir el sistema completo o romper APIs ya aprobadas.

## Paquete obligatorio de lectura

- `docs/00_EXECUTIVE_RESET.md`
- `docs/01_FINAL_PRODUCT_REQUIREMENTS.md`
- `docs/02_UI_ARCHITECTURE.md`
- `docs/03_POS_BILLING_UX_SPEC.md`
- `docs/04_ADVANCED_REPORTS_SPEC.md`
- `docs/05_DESIGN_SYSTEM_AND_LIBRARIES.md`
- `docs/06_BARCODE_QR_WORKFLOW.md`
- `docs/07_FINAL_PHASES_ROADMAP.md`
- `docs/08_CRITICAL_ACCEPTANCE_CRITERIA.md`
- `UI/final-product-wireframe.md`
- `UI/sidebar-navigation-spec.md`
- `UI/pos-screen-spec.md`
- `UI/reports-screen-spec.md`
- `qa/final-product-ux-acceptance.md`
- `branch/phase-12-branch-plan.md`
- `codex-skills/ui-ux-product-director.md`
- `codex-skills/pos-workflow-specialist.md`
- `codex-skills/advanced-reporting-specialist.md`
- `codex-skills/product-acceptance-reviewer.md`

## Resultado exigido

Planificar Fase 12 en fases pequenas, verificables y commiteables:

- 12A App Shell + Sidebar + Design System.
- 12B POS Billing UX profesional.
- 12C Catalogo + barcode/QR/scan_code.
- 12D Reportes avanzados.
- 12E QA UX final y demo premium.

La entrega final debe verse como producto hospitalario serio: app shell con sidebar izquierdo, topbar, rutas internas, layout persistente, POS profesional, catalogo ordenado, scanner/codigo, reportes gerenciales y criterios de bloqueo estrictos.
