# V1.2 Full UX/UI Redesign Research

Fecha: 2026-06-28

Base de trabajo: `origin/codex/v1-2-visible-ui-delta` sobre `origin/main` `e08f0e9d`.

Esta investigacion usa documentacion oficial y patrones aplicables al contexto de S_Hospital: sistema hospitalario offline/LAN para caja, facturacion, reportes, recibos, catalogo, usuarios, backups y settings.

## Fuentes oficiales revisadas

| Fuente | Patron recomendado | Decision para S_Hospital | Riesgo | Libreria afectada |
| --- | --- | --- | --- | --- |
| shadcn/ui Data Table: https://ui.shadcn.com/docs/components/data-table | Tabla compuesta con TanStack Table, toolbar, filtros, sorting, pagination y column visibility. | Usar el patron como referencia para una `DataTable` local con TanStack Table debajo. Migrar historial, usuarios y al menos una tabla de reportes. | Mezclar filtros backend con estado visual. Mantener filtros de negocio fuera de la tabla. | `@tanstack/react-table`, componentes UI locales |
| shadcn/ui Charts: https://ui.shadcn.com/docs/components/chart | Wrappers con tokens de chart, tooltip/legend y contenedor reutilizable. | Mantener Recharts y reforzar `ChartCard`/`ChartLegend` con tokens `chart-1..chart-8`. | Charts inaccesibles si no hay resumen textual. | Recharts, Tailwind |
| shadcn/ui Sidebar/Form/Theming: https://ui.shadcn.com/docs | Componentes copiables, tokens semanticos y primitives locales. | No correr CLI masivo. Adaptar patrones en componentes versionados del repo. | Copiar bloques sin revisar. | Radix, Tailwind |
| Tailwind CSS v4 Theme: https://tailwindcss.com/docs/theme | `@theme` define tokens CSS que generan utilities. | Profundizar `frontend/src/styles.css` con tokens hospitalarios, operativos, recibos, chart y sombras. | Token sprawl. Documentar nombres por uso real. | Tailwind CSS v4 |
| Tailwind CSS dark/responsive/print: https://tailwindcss.com/docs | Variables para dark mode, breakpoints mobile-first y variantes print. | Mantener `html.dark`, validar 320 a 1920 px y forzar papel blanco en recibos. | Dark mode contaminando impresion. | Tailwind CSS v4 |
| Radix UI primitives: https://www.radix-ui.com/primitives/docs | Dialogs, AlertDialogs, Tabs, Select, Tooltip, Popover y Dropdown con foco/teclado. | Mantener primitives existentes para modales, menus y filtros. | Dialogs sin nombre o foco visible. | Radix UI |
| Recharts API: https://recharts.org/en-US/api | `ResponsiveContainer`, tooltip/legend y charts responsivos. | Mantener Recharts con contenedores de altura estable y `accessibilityLayer` donde aplique. | Charts en blanco si el contenedor no tiene dimensiones. | Recharts |
| TanStack Table React: https://tanstack.com/table/latest/docs/framework/react/react-table | Tabla headless con state controlado y rendering flexible. | Agregar `@tanstack/react-table` para una `DataTable` profesional sin cambiar endpoints. | API local demasiado generica. Mantener wrapper hospitalario. | TanStack Table |
| WAI WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/ | Contraste, teclado, foco, errores, nombres y roles. | `v1-2-full-a11y.spec.ts` debe validar 0 critical/serious axe y no overflow global. | Axe no cubre todo. Complementar con screenshots y keyboard smoke. | A11y QA |
| WAI APG Patterns: https://www.w3.org/WAI/ARIA/apg/patterns/ | Patrones para dialogs, tabs, menus, tables y forms. | Preferir HTML semantico; ARIA solo cuando aporta. | Sobrerregular tablas simples como grids. | UI local |

## Decisiones de patron

- Las pantallas deben componer `AppSurface`, `PageShell`, `OperationalBanner`, `WorkflowPanel`, `CommandPanel`, `StatGrid`, `ChartCard`, `DataTable`, `FormSection`, `StatusBadge`, `MoneyText`, `ReceiptDocumentShell` y estados compartidos.
- Tailwind queda como motor de tokens/utilities, no como permiso para regar clases manuales sin patron.
- Recharts, Radix y TanStack Query permanecen; no se introducen UI kits pesados ni dependencias SaaS.
- TanStack Table queda aprobado para historial, usuarios y reportes, sin cambiar filtros backend ni payloads.

## Criterio de aceptacion

- Existe design system centralizado y documentado.
- Las tablas principales usan plataforma compartida o documentan excepcion.
- Mobile y dark mode se verifican en rutas criticas.
- Before/after demuestra diferencia visual grande.
- Backend, payloads, permisos, query keys y calculos de dinero permanecen sin cambios.
