# F6 Operational Polish - 2026-06-12

## Alcance revisado

- Dashboard / Inicio.
- Reportes, especialmente filtros de ingresos.
- Historial de facturas.
- Catalogo de servicios.
- Usuarios, respaldos y configuracion fiscal como pantallas densas de administracion.
- Nueva factura, caja, recibo/reimpresion y preparacion de impresion.
- Responsive desktop, laptop, tablet y movil de consulta.
- Estados empty/loading/error de tablas y reportes.

## Evidencia baseline before

Capturas generadas en `qa/screenshots/before/f6-*`.

- Capturas: 31 PNG + `f6-operational-polish-report.json`.
- Consola: 0 errores.
- Overflow horizontal global: 0 hallazgos.
- Controles sin nombre accesible: 0 hallazgos.
- Hallazgos de script: el baseline tenia advertencias de evidencia textual por timing/selector del smoke, no errores de consola ni overflow.

## Cambios implementados

- Tablas operativas:
  - `frontend/src/components/ui/table.tsx` ahora usa el wrapper visual `table-wrap` y clase `data-table`.
  - `frontend/src/styles.css` centraliza legibilidad: encabezados sticky, bordes consistentes, numeros tabulares, hover sobrio, scroll horizontal claro y aviso movil para tablas anchas.
  - `CatalogView` e `InvoiceHistoryView` eliminan wrappers dobles alrededor de tablas.
  - Acciones de historial pueden envolver en pantallas estrechas.
  - Badges de facturas usan variantes del sistema (`info`, `warning`, `success`, `destructive`) para dark mode.

- Dashboard/reportes:
  - Graficas vacias de dashboard explican que no hay actividad registrada, en lugar de parecer incompletas.
  - La tendencia semanal muestra estado vacio cuando no hay facturas ni pagos.
  - Filtros de ingresos pasan de anchos fijos a grid responsive con labels conectados y selects de ancho completo.

- Responsive:
  - Paginacion de catalogo e historial permite wrap.
  - Tablas densas mantienen ancho minimo dentro de contenedor scrollable.
  - Tablet/movil muestran scroll de tabla sin generar overflow de documento.

- QA visual:
  - Se agrega `qa/visual-smoke/f6-operational-polish.mjs`.
  - El smoke soporta `F6_VISUAL_VIEWPORTS`, `F6_VISUAL_ROUTES`, `F6_VISUAL_FULL=1` y merge de reportes con `F6_VISUAL_MERGE=1`.
  - El comando por defecto ejecuta un smoke representativo y escribe en `qa/screenshots/smoke` para no sobrescribir before/after.

## Evidencia after

Capturas generadas en `qa/screenshots/after/f6-*`.

- Capturas: 31 PNG + `f6-operational-polish-report.json`.
- Consola: 0 errores, 0 HTTP 429/500 en reporte final.
- Overflow horizontal global: 0 hallazgos.
- Controles sin nombre accesible: 0 hallazgos.
- Advertencias restantes:
  - `cashbox`: el smoke no pudo abrir caja automaticamente en esa corrida.
  - `receipt`: el flujo automatico de recibo se omitio porque el fixture operativo no dejo visible el campo requerido en el momento de captura.

## Antes / despues

- Before: tablas con scroll menos explicito y wrappers duplicados en vistas con tabla.
- After: tablas con encabezados sticky, scroll contenido, aviso movil y acciones que no se aplastan.
- Before: estados vacios de dashboard eran frases cortas.
- After: estados vacios explican si el dato esta realmente en cero y que accion lo alimenta.
- Before: filtros de ingresos usaban anchos fijos.
- After: filtros de ingresos usan grid responsive y labels conectados.

## Recibos e impresion

- No se cambiaron contratos, calculos fiscales, secuencia, reimpresion ni backend.
- No se declara validacion fisica de impresora termica 80mm/58mm.
- La validacion automatica especifica de recibo/cobro queda cubierta por el smoke F4 y pruebas existentes; F6 documenta que su intento visual de recibo requiere fixture operativo con caja/servicios disponibles.

## Riesgos residuales

- Validacion fisica de impresora termica queda pendiente en hardware real.
- El smoke F6 completo se ejecuta mejor por subconjuntos para no saturar el backend local de desarrollo.
- Los reportes sin datos dependen de fixtures actuales; no se inventaron metricas.

## No regresion F4/F5

- F6 no modifica endpoints, migraciones, Actions, politicas, pagos, caja, fiscalidad ni recibos backend.
- F5 se protege con ausencia de consola, 429, overflow y controles sin nombre en evidencia after F6.
- F4 debe seguir validandose con `node qa\visual-smoke\f4-billing-cashbox-flow.mjs` antes de cierre.
