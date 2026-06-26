# V1.2 Research References

Fecha: 2026-06-26

Objetivo: registrar investigacion oficial para el refactor visual V1.2 de S_Hospital sin cambiar reglas de negocio, contratos API, calculos, permisos, caja, pagos, numeracion fiscal ni recibos backend salvo mejora visual controlada.

## Resumen

S_Hospital ya usa React, TypeScript, Tailwind CSS v4, Radix UI, componentes locales estilo shadcn/ui, Recharts, TanStack Query, React Hook Form y Zod. La investigacion confirma que V1.2 debe fortalecer el design system propio y migrar pantallas a componentes compartidos, no reemplazar el stack ni ejecutar CLI masivo.

## Referencias oficiales

| Fuente | Conclusion | Decision para S_Hospital | Riesgo | Libreria afectada |
| --- | --- | --- | --- | --- |
| shadcn/ui blocks: https://ui.shadcn.com/blocks | Los blocks oficiales incluyen dashboards con sidebar, charts y data table como patrones de composicion copiables. | Usar shadcn/ui como referencia de estructura y composicion, adaptando a componentes locales existentes. No ejecutar `shadcn add dashboard-01` sin revisar diffs. | Copiar blocks completos puede introducir estilos y datos genericos o romper rutas. | shadcn/ui, componentes locales |
| shadcn/ui sidebar: https://ui.shadcn.com/docs/components/radix/sidebar | El sidebar es un componente central, complejo, composable, themeable y personalizable. | Mejorar AppShell/Sidebar propios con agrupacion por modulos, estados activos, colapso/movil y permisos, manteniendo navegacion institucional. | Cambios de navegacion pueden ocultar rutas o romper muscle memory de caja. | AppShell, SidebarNav, Radix |
| Tailwind CSS v4 blog: https://tailwindcss.com/blog/tailwindcss-v4 | Tailwind v4 mueve configuracion a CSS y expone tokens como variables CSS. | Consolidar tokens en `frontend/src/styles.css` con `@theme` y variables semanticas hospitalarias. | Tokens mal nombrados causan drift o clases crudas por pantalla. | Tailwind CSS v4 |
| Tailwind theme variables: https://tailwindcss.com/docs/theme | `@theme` debe usarse cuando el token debe mapear a utilidades; `:root` sirve para variables CSS que no necesitan utilidad. | Usar `@theme` para colores, radios, sombras y spacing que se consumen como utilidades; usar variables normales para detalles de impresion/recibo si no requieren utility class. | Meter todo en `@theme` puede aumentar superficie de utilidades sin necesidad. | Tailwind CSS v4 |
| Tailwind states/variants: https://tailwindcss.com/docs/hover-focus-and-other-states | Tailwind cubre estados interactivos, focus, responsive, dark y media variants. | Formalizar focus-visible, disabled, dark mode, print y responsive desde componentes compartidos. | Estados solo por color o sin focus visible degradan a11y. | Tailwind CSS v4 |
| Radix Primitives: https://www.radix-ui.com/primitives | Radix provee primitivas con foco, teclado, posicionamiento, colisiones y soporte a tecnologia asistiva. | Mantener Dialog, AlertDialog, Tabs, Select, Tooltip, Popover y Dropdown sobre Radix; no recrear comportamiento complejo a mano. | Composicion incorrecta entre dropdown/dialog puede romper foco o escape. | Radix UI |
| Radix Dialog: https://www.radix-ui.com/primitives/docs/components/dialog | Dialog debe manejar portal, overlay, titulo, descripcion, cierre y foco. | Todo modal de pago, anulacion, cierre de caja o permisos debe conservar titulo accesible, descripcion y retorno de foco. | Modales sin titulo o foco atrapado bloquean flujo de cajero por teclado. | Radix Dialog, AlertDialog |
| Radix Select: https://www.radix-ui.com/primitives/docs/components/select | Select provee comportamiento accesible para opciones y teclado cuando se integra correctamente. | Usar Select local para formatos de recibo, filtros y permisos cuando el control nativo no baste; mantener labels visibles. | Selects custom sin label o valor visible confunden pantalla y lector. | Radix Select |
| Recharts home/API: https://recharts.github.io/ | Recharts es composable y basado en componentes React/SVG. | Mantener Recharts para dashboard y reportes; crear wrappers ChartCard/tooltip/legend para consistencia visual. | Graficos sin texto alternativo o tablas de datos pueden ser poco utiles a screen readers. | Recharts |
| Recharts LineChart API: https://recharts.github.io/en-US/api/LineChart/ | `accessibilityLayer` esta disponible y por defecto verdadero; charts pueden usar role, tabIndex y responsive. | No apagar `accessibilityLayer` salvo motivo documentado; revisar charts existentes que lo tienen en `false`. | Dejar charts solo visuales reduce accesibilidad de reportes. | Recharts |
| Recharts ResponsiveContainer/API: https://recharts.github.io/en-US/api/ResponsiveContainer | Los charts pueden consumir contexto de `ResponsiveContainer` y adaptarse a tamano. | Conservar contenedores estables con minWidth/minHeight y wrappers que eviten charts en blanco. | Contenedores sin alto definido pueden renderizar vacio en desktop/mobile. | Recharts |
| TanStack Table: https://tanstack.com/table/latest | La tabla es headless y permite optar explicitamente por sorting, filtering, pagination, selection, sizing y visibility. | Evaluar para historial/reportes/usuarios si hay beneficio real. No agregar en la primera fase de design system. | Headless table puede aumentar boilerplate si backend ya pagina/filtra bien. | TanStack Table |
| TanStack filtering: https://tanstack.com/table/v8/docs/guide/column-filtering | Soporta filtering cliente y manual/server-side; requiere decidir caso por caso. | Si se adopta, usar manual server-side para datos grandes y mantener filtros existentes de API. | Filtrado cliente sobre datasets parciales puede dar resultados falsos. | TanStack Table |
| TanStack pagination: https://tanstack.com/table/v8/docs/guide/pagination | Soporta paginacion client-side y server-side. | No traer historiales completos al frontend; conservar paginacion backend para facturas/reportes. | Cargar todo al cliente puede afectar LAN y memoria en PCs modestas. | TanStack Table |
| W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/ | WCAG define criterios verificables para teclado, foco, contraste, nombres, errores y robustez. | V1.2 debe validar axe critical/serious 0, foco visible, no overflow global, controles nombrados y dialogos titulados. | Visual delta fuerte puede romper contraste o orden de foco. | Accesibilidad |
| W3C Error Identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html | Los errores deben indicarse en texto; no basta con redibujar el formulario. | Formularios de factura, pagos, caja, settings y usuarios deben conectar errores con labels y `aria-describedby`. | Errores visuales sin texto aumentan errores operativos. | Forms, RHF/Zod, a11y |
| W3C Techniques: https://w3c.github.io/wcag/techniques/ | Las fallas comunes incluyen controles sin nombre, tablas sin headers, foco removido y uso solo de color. | La suite V1.2 debe cubrir nombres accesibles, tablas semanticas, foco visible y estados no solo por color. | Tests automatizados no cubren toda semantica; requiere revision manual focal. | Accesibilidad |

## Decisiones de aplicacion

1. Design system primero, pantallas despues.
2. No ejecutar CLI masivo de shadcn/ui.
3. No instalar TanStack Table en Fase 5; evaluar tras auditar tablas reales.
4. Mantener Recharts, pero corregir accesibilidad y wrappers.
5. Mantener Radix como base para dialogos, menus, tabs, selects, tooltips y popovers.
6. Tailwind v4 queda como fuente de tokens via `@theme`; evitar hex/clases crudas dispersas.
7. WCAG 2.2 AA orienta los gates: keyboard, focus, contrast, forms, dialogs, tables y error states.

## Riesgos abiertos

- Las capturas before/after deben probar un delta visible real; si no, la fase queda bloqueada por UX.
- TanStack Table puede ser util, pero introducirlo tarde en una rama grande aumenta riesgo. La decision final queda atada al audit de tablas.
- Recharts actuales tienen casos con `accessibilityLayer={false}` que deben revisarse en la fase de reportes/dashboard.
- El runtime correcto conocido es `http://192.168.1.10:8081`; toda evidencia visual debe indicar si se capturo contra ese runtime o contra mocks.
