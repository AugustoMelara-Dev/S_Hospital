# Web Research Design References

Fecha: 2026-06-25
Objetivo: fundamentar el pulido V1.1 con fuentes oficiales o primarias. Esta investigacion informa desarrollo, pero no introduce dependencias de internet en produccion offline.

## Referencias

| Fuente | Link | Conclusion aplicable | Decision para S_Hospital | Dependencia afectada | Riesgo |
| --- | --- | --- | --- | --- | --- |
| shadcn/ui Theming | https://ui.shadcn.com/docs/theming | shadcn recomienda tokens semanticos con CSS variables para cambiar tema sin reescribir clases. | Consolidar tokens hospitalarios en `styles.css` y componentes locales. | Tailwind CSS, componentes locales | Bajo: ya existe patron local. |
| shadcn/ui Chart | https://ui.shadcn.com/docs/components/radix/chart | La configuracion de charts debe contener labels humanos y colores/tokens; los containers necesitan altura minima para responsive. | Crear/normalizar `ChartCard` y configs con labels en espanol, no data keys crudos. | Recharts, chart components | Medio: charts sin altura estable pueden colapsar. |
| shadcn/ui Data Table | https://ui.shadcn.com/docs/components/radix/data-table | shadcn no entrega una tabla universal; recomienda construir tablas segun sorting, filtering, pagination y data source. | Mantener DataTable propio; evaluar TanStack Table solo si se necesita ordenamiento/column visibility real. | Table/DataTable | Medio: sobreabstraer tablas puede frenar POS/reportes. |
| shadcn/ui Registry | https://ui.shadcn.com/docs/registry/registry-item-json | Los registry items declaran tipo, archivos y dependencias; se debe revisar el codigo que se incorpora. | No instalar blocks por CLI a ciegas; copiar/adaptar componentes pequenos auditables si aportan. | componentes locales | Medio: registry externo puede agregar dependencias no deseadas. |
| Tailwind CSS Theme Variables | https://tailwindcss.com/docs/theme | `@theme` define variables que generan utilidades y tambien CSS variables accesibles en runtime. | Mantener tokens de color, spacing, radius y chart palette con `@theme`; usar `:root` solo para variables que no deban generar utilidades. | Tailwind v4 | Bajo. |
| Tailwind CSS Dark Mode | https://tailwindcss.com/docs/dark-mode | Tailwind provee variante `dark` para estilos alternos. | Conservar `html.dark`; revisar contraste de tokens y no duplicar paletas por pantalla. | Tailwind v4 | Medio: dark mode inconsistente en charts/receipts. |
| Tailwind CSS Responsive Design | https://tailwindcss.com/docs/responsive-design | Las variantes responsive aplican a todas las utilidades; breakpoints base empiezan en 640/768/1024/1280/1536 px. | Auditar 320, 375, 768, 1024, 1366 y 1920; definir dimensiones estables para tablas, toolbars y charts. | Tailwind v4, layout | Medio: overflow en caja/POS. |
| Tailwind CSS Functions and Directives | https://tailwindcss.com/docs/functions-and-directives | `@variant`, `@custom-variant` y `@apply` permiten CSS de componentes conectado a tokens. | Usar CSS global solo para tokens, print, tablas/recibo y utilidades compartidas; evitar estilos artesanales por modulo. | Tailwind v4 | Bajo. |
| Tailwind CSS Break Utilities | https://tailwindcss.com/docs/break-after | Tailwind ofrece utilidades para controlar saltos de pagina/columna. | Usar print CSS y break utilities con cuidado en recibos/reportes imprimibles. | Tailwind v4, print CSS | Medio: cortes malos en PDF/print. |
| Radix Dialog | https://www.radix-ui.com/primitives/docs/components/dialog | Dialog maneja trap de foco, Title/Description, modo modal/no modal y Esc. | Mantener Dialog para formularios/modales no destructivos con titulo y descripcion accesibles. | Radix Dialog | Bajo si se respetan partes. |
| Radix AlertDialog | https://www.radix-ui.com/primitives/docs/components/alert-dialog | AlertDialog atrapa foco y anuncia Title/Description; adecuado para acciones criticas. | Usar en anular, cerrar caja, restaurar backup, reimpresion sensible y cambios fiscales. | Radix AlertDialog | Bajo; riesgo si se omite descripcion. |
| Radix Popover | https://www.radix-ui.com/primitives/docs/components/popover | Popover administra foco y teclado; Esc devuelve foco al trigger. | Usar para filtros/ayudas cortas, no para flujos criticos que requieren confirmacion. | Radix Popover | Medio: popovers anidados con tooltip pueden generar foco confuso. |
| Radix Accessibility | https://www.radix-ui.com/primitives/docs/overview/accessibility | Radix cubre ARIA, roles, focus management y keyboard navigation en patrones comunes. | Seguir primitives Radix y no reemplazarlas por divs interactivos. | Radix UI | Bajo. |
| Recharts ResponsiveContainer | https://recharts.github.io/en-US/api/ResponsiveContainer/ | El contenedor ajusta ancho/alto segun el padre y usa ResizeObserver. | Dar altura/aspect ratio estable al padre; no depender de alto automatico en grid/flex. | Recharts | Medio: charts invisibles o con warnings. |
| Recharts Tooltip | https://recharts.github.io/en-US/api/Tooltip/ | Tooltip puede mostrar valores por punto/eje y personalizar contenido. | Crear tooltips con moneda L, fechas locales y labels humanos; no exponer keys tecnicas. | Recharts | Bajo. |
| Recharts Legend | https://recharts.github.io/en-US/api/Legend/ | Legend soporta alineacion y afecta espacio del chart. | Legends compactas o externas en mobile para no aplastar graficos. | Recharts | Medio en responsive. |
| Recharts Accessibility Wiki | https://github.com/recharts/recharts/wiki/Recharts-and-accessibility | Recharts v3 agrega capa accesible por defecto; `accessibilityLayer` agrega aria labels, roles y teclado. | Verificar `accessibilityLayer` y fallback tabular para KPIs/charts financieros. | Recharts | Medio: charts solos no bastan como reporte accesible. |
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | WCAG 2.2 es recomendacion W3C e incluye criterios de foco no obscurecido, target size y autenticacion accesible. | Auditar contraste, focus-visible, target sizes, errores de formularios, auth y navegacion por teclado. | UI/A11y | Alto: incumplir afecta operacion real. |
| WAI-ARIA APG Patterns | https://www.w3.org/WAI/ARIA/apg/patterns/ | APG documenta patrones para dialog, table, tabs, toolbar y widgets comunes. | Preferir HTML semantico y APG cuando Radix no cubra el patron. | UI/A11y | Medio. |
| Carbon Empty States | https://carbondesignsystem.com/patterns/empty-states-pattern/ | Empty states deben explicar falta de datos y orientar accion. | Estados vacios de reportes, backups, catalogo e historial deben ser operativos, no decorativos. | Shared UI | Bajo. |
| USWDS | https://designsystem.digital.gov/ | Sistema gubernamental centrado en accesibilidad y mobile-friendly. | Tomar como referencia de sobriedad institucional, no instalar USWDS. | Design direction | Bajo. |
| MDN CSS Paged Media | https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Paged_media | Paged media controla margenes, tamano, orientacion, headers/footers y contenido fragmentado. | Fortalecer recibos/reportes imprimibles con CSS print probado digitalmente. | Print CSS, receipt PDF | Medio. |
| MDN page-break-inside | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-inside | `page-break-inside` es legado; usar `break-inside` y tratar alias por compatibilidad. | Evitar cortes dentro de totales, firmas, filas y bloques de recibo usando `break-inside`. | Print CSS | Medio. |
| W3C CSS Paged Media | https://www.w3.org/TR/css-page-3/ | CSS Paged Media define fragmentacion y saltos de pagina. | Validar multipagina del recibo con 40/100 items y encabezados repetibles. | Print/PDF | Medio. |

## Decisiones de aplicacion inmediata

- No agregar librerias por investigacion. El stack actual cubre los patrones requeridos.
- Consolidar tokens y componentes compartidos antes de pantallas.
- Mantener Radix como base de overlays accesibles.
- Mantener Recharts con fallback tabular y labels humanos.
- Tratar print/PDF como superficie de producto principal, no accesorio.
- Separar evidencia digital de impresion fisica real.
