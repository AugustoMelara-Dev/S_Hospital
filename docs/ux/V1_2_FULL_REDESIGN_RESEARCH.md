# V1.2 Full Redesign Research

Fecha: 2026-06-28
Base: `742fdb551b202ddb0473a0269440e0bf6ff116ce`

## Resumen

La investigacion se limita a documentacion oficial o primaria. S_Hospital debe operar en LAN/offline en produccion, por lo que los patrones adoptados no deben depender de CDNs, servicios SaaS ni runtime remoto.

## Fuentes Y Decisiones

| Fuente | Patron recomendado | Decision para S_Hospital | Riesgo | Libreria afectada |
| --- | --- | --- | --- | --- |
| shadcn/ui Blocks - https://ui.shadcn.com/blocks | Usar composiciones tipo dashboard/sidebar como referencia, no como dependencia runtime. | Adaptar patrones visuales y estructura a componentes propios. No ejecutar CLI masivo. | Copiar bloques sin revisar puede introducir estilos locales repetidos. | Tailwind, Radix |
| shadcn/ui Data Table - https://ui.shadcn.com/docs/components/data-table | Tabla headless con TanStack Table, toolbar, columnas y paginacion. | Consolidar `DataTable`, `DataTableToolbar`, `DataTablePagination`, empty/loading/error y usarlo en reportes, historial y usuarios. | Migrar tablas sin tests puede romper filtros o acciones. | @tanstack/react-table |
| shadcn/ui Charts - https://ui.shadcn.com/charts | Charts con contenedor semantico, leyenda y variables CSS. | Mantener Recharts, envolver en `ChartCard` y `ChartLegend` con tokens `chart-1..chart-8`. | Charts sin alto estable pueden renderizar vacios. | Recharts |
| shadcn/ui Forms - https://ui.shadcn.com/docs/components/form | React Hook Form con mensajes, labels y descripcion por campo. | Mantener RHF/Zod y componer con `FormSection`, `FieldGroup` y estados de error visibles. | Duplicar validacion fiscal en frontend. | react-hook-form, zod |
| shadcn/ui Sidebar - https://ui.shadcn.com/docs/components/sidebar | Sidebar responsive con estado activo, grupos y accesibilidad. | Reforzar AppShell/sidebar actual con patron institucional y navegacion movil clara. | Cambios de nav pueden afectar permisos si se alteran rutas. | Radix, React Router |
| shadcn/ui Registry - https://ui.shadcn.com/docs/registry | Componentes copiables y auditables. | Usar solo como referencia. No agregar registry remoto como requisito productivo. | Dependencia mental de generadores en vez de codigo fuente. | N/A |
| shadcn/ui Theming - https://ui.shadcn.com/docs/theming | Variables CSS y tokens compartidos. | Centralizar tokens en `frontend/src/styles.css` y componentes compartidos. | Paleta monotona o contraste bajo si no se prueba. | Tailwind |
| Tailwind CSS v4 Theme - https://tailwindcss.com/docs/theme | `@theme` define tokens de color, radius, shadow, spacing y fonts. | Mantener Tailwind v4 con tokens hospitalarios, operativos, charts y recibo. | Tokens sin nombre de dominio llevan a clases hardcodeadas. | tailwindcss |
| Tailwind CSS Dark Mode - https://tailwindcss.com/docs/dark-mode | Dark mode mediante selector/clase y variables. | Mantener `html.dark` con tokens equivalentes y verificar contraste. | Modo oscuro puede degradar recibos si no se aisla print/paper. | tailwindcss |
| Tailwind CSS Responsive Design - https://tailwindcss.com/docs/responsive-design | Breakpoints mobile-first. | Diseñar primero flujo de caja movil con sticky action bar y tablas con overflow controlado. | Overflow horizontal global en POS/reportes. | tailwindcss |
| Tailwind CSS Print Styles - https://tailwindcss.com/docs/hover-focus-and-other-states#print-styles | Variantes `print` y media print. | Mantener CSS print explicito para recibos institucionales. | Cambiar print puede romper factura papel. | tailwindcss |
| Radix Dialog - https://www.radix-ui.com/primitives/docs/components/dialog | Dialog modal accesible con foco gestionado. | Usar para pago, confirmaciones y settings sensibles con titulo/descripcion. | Dialog sin titulo o foco inicial incorrecto falla a11y. | @radix-ui/react-dialog |
| Radix Alert Dialog - https://www.radix-ui.com/primitives/docs/components/alert-dialog | Confirmaciones destructivas con cancel/confirm claro. | Usar en anulaciones, cierre de caja y acciones irreversibles. | Boton destructivo mal jerarquizado induce errores operativos. | @radix-ui/react-alert-dialog |
| Radix Tabs - https://www.radix-ui.com/primitives/docs/components/tabs | Tabs con teclado y estado controlado. | Usar para reportes, settings fiscal/recibos y vistas admin. | Tabs como links pueden romper deep linking si no se coordina. | @radix-ui/react-tabs |
| Radix Select - https://www.radix-ui.com/primitives/docs/components/select | Select accesible para opciones cerradas. | Usar para filtros de fecha/estado/metodo/formato. | Selects sin label accesible bloquean QA. | @radix-ui/react-select |
| Radix Tooltip - https://www.radix-ui.com/primitives/docs/components/tooltip | Tooltip para icon buttons, no informacion critica. | Usar en acciones compactas de tabla y toolbar. | Tooltip no reemplaza texto o label accesible. | @radix-ui/react-tooltip |
| Radix Popover - https://www.radix-ui.com/primitives/docs/components/popover | Contenido flotante no modal con foco controlado. | Usar para filtros avanzados o acciones secundarias. | Popovers grandes en mobile pueden desbordar. | @radix-ui/react-popover |
| Radix Dropdown Menu - https://www.radix-ui.com/primitives/docs/components/dropdown-menu | Menus de accion con teclado. | Usar para acciones por fila y menu de usuario. | Acciones criticas escondidas pueden bajar usabilidad. | @radix-ui/react-dropdown-menu |
| Recharts ResponsiveContainer - https://recharts.org/en-US/api/ResponsiveContainer | Charts deben vivir en contenedor con ancho/alto estable. | Todo chart en `ChartCard` con `min-h` y `ResponsiveContainer`. | Sin altura, el chart puede quedar en blanco. | recharts |
| Recharts Tooltip/Legend - https://recharts.org/en-US/api/Tooltip y https://recharts.org/en-US/api/Legend | Tooltips/legends consistentes. | Usar leyendas propias cuando se necesite consistencia visual; mantener tooltip accesible y sobrio. | Tooltip visual no sustituye tabla/resumen textual. | recharts |
| TanStack Table React - https://tanstack.com/table/latest/docs/framework/react/react-table | Tabla headless con estado controlado. | Ya esta instalado; ampliar `DataTable` sin cambiar payloads ni query keys. | Mucho estado local duplicado puede hacer tablas fragiles. | @tanstack/react-table |
| TanStack Table Sorting - https://tanstack.com/table/latest/docs/guide/sorting | Sorting controlado por columnas. | Agregar sorting visual en tablas de reportes/historial/usuarios si no rompe orden backend. | Sorting cliente en datos paginados backend puede confundir. | @tanstack/react-table |
| TanStack Table Filtering - https://tanstack.com/table/latest/docs/guide/column-filtering | Filtros por columna/global. | Mantener filtros de negocio existentes; usar toolbar centralizada. | Filtro frontend no debe reemplazar filtros backend/reportes. | @tanstack/react-table |
| TanStack Table Pagination - https://tanstack.com/table/latest/docs/guide/pagination | Paginacion controlada o manual. | Usar paginacion UI consistente; respetar API actual. | Mezclar paginacion cliente/servidor sin indicar alcance. | @tanstack/react-table |
| TanStack Table Column Visibility - https://tanstack.com/table/latest/docs/guide/column-visibility | Visibilidad configurable. | Aplicar donde haya muchas columnas: reportes, historial, usuarios. | Ocultar datos obligatorios en auditoria operativa. | @tanstack/react-table |
| TanStack Table Row Selection - https://tanstack.com/table/latest/docs/guide/row-selection | Seleccion de filas controlada. | Solo usar si hay acciones masivas reales. Diferir por defecto. | Acciones masivas no requeridas elevan riesgo. | @tanstack/react-table |
| WAI WCAG Quick Reference - https://www.w3.org/WAI/WCAG22/quickref/ | Contraste, teclado, foco visible, mensajes de error y nombres accesibles. | Gate: axe critical/serious 0, foco visible, single h1 y controles nombrados. | A11y rota en modales/tablas compactas. | UI completa |
| WAI ARIA APG Dialog - https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Dialog modal con foco contenido y nombre accesible. | Verificar payment modal, confirmaciones y settings. | Foco perdido rompe teclado en caja. | Radix |
| WAI Forms Tutorial - https://www.w3.org/WAI/tutorials/forms/ | Labels, instrucciones y errores asociados. | Formularios de POS/settings/admin con labels visibles y errores inline. | Mensajes solo por color no pasan. | RHF/Zod |
| WAI Tables Tutorial - https://www.w3.org/WAI/tutorials/tables/ | Caption, encabezados y semantica. | `DataTable` debe conservar table/head/body/caption y numeric alignment. | Div tables degradan lector y teclado. | DataTable |

## Criterios Adoptados

- El backend sigue siendo fuente de verdad para totales, pagos, caja, permisos y PDF.
- No se agregan librerias por ahora: las candidatas fuertes ya existen.
- El rediseño debe mover estilo local hacia tokens y componentes compartidos.
- Los componentes nuevos deben exponer estados loading, empty, error y permission.
- Las tablas deben ser profesionales sin cambiar contratos de API.
- El recibo institucional mantiene papel/PDF sobrio y no introduce QR, codigos internos ni datos fiscales inventados.
