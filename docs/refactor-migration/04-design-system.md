# Sistema de diseño shadcn institucional

## Fuente de verdad

`frontend/components.json` y `npx --no-install shadcn info --json` confirman Vite, TypeScript, Tailwind v4, CSS variables, base Radix, estilo `radix-nova`, Lucide y aliases `@/components/ui`. `frontend/src/styles.css` y `frontend/src/design-system/tokens/institutional-tokens.css` definen tokens globales; no se cargarán fuentes, CSS ni componentes desde CDN en producción.

## Capas

- `components/ui`: 40 primitivas shadcn locales, incluidas Button, Dialog, AlertDialog, Sheet, DropdownMenu, Tabs, Table, Chart, Calendar, Command, Sonner y Sidebar.
- `design-system/components`: identidad, importes, encabezados y bloques institucionales.
- `design-system/patterns`: DataTable TanStack, RouteState, Chart y composición de páginas.
- `design-system/providers`: tema y feedback persistente por severidad.
- `shell`: rail/sidebar, navegación móvil, barra contextual, command palette y menú de usuario.
- `features`: UI y lógica de presentación por dominio.

## Reglas verificadas

- `npm run check:ui-legacy:final`: 376 archivos, 0 violaciones.
- `npm run check:ui-rules`: 380 archivos shadcn conformes.
- No hay imports productivos de Ant Design, AG Grid o ECharts.
- Las tablas de aplicación usan el adaptador TanStack/shadcn; gráficos Recharts conservan alternativa HTML accesible.
- Sonner mantiene éxito 6 s, información 8 s, advertencia 12 s y errores hasta cierre explícito.
- El estado de la barra contextual se expresa como `Mi caja …`, evitando confundir la caja del usuario con sesiones ajenas visibles en supervisión.

## Criterios de continuidad

Todo componente nuevo debe usar tokens semánticos, foco visible, estados disabled/loading/error/success y targets táctiles. Las excepciones de impresión usan tokens propios de papel y no heredan superficies decorativas de la aplicación. El guard arquitectónico bloquea reintroducir librerías heredadas o tablas visuales fuera del patrón institucional.

