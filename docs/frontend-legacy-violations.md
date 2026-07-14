# Inventario de violaciones legacy del frontend

Fecha de corte: 2026-07-13

## Estado verificable

| Línea base | Valor |
| --- | --- |
| Versión anterior del gate | v1, inventario focal con primitivas parcialmente exentas |
| Archivos auditados anteriormente | 407 |
| Violaciones anteriores | 163 |
| Versión actual del gate | v2, inventario exhaustivo con clasificación import/clase/motion/radius y modos inventory/strict/final |
| Archivos auditados actualmente | 409 |
| Nueva línea base comparable | **190 violaciones / 409 archivos** |

Las cifras 163/407 y 190/409 no son comparables porque cambió tanto el conjunto auditado como la regla. El gate v1 omitía clases dentro de primitivas exentas y contaba erróneamente propiedades institucionales como `borderRadiusLG: 0`; el gate v2 hace visible esa deuda y elimina ese falso positivo. A partir de esta línea base, toda reducción se calculará ejecutando exactamente el gate v2 sobre el mismo alcance de `src/`. Un cambio solo se registrará como regresión si esa misma versión y configuración demuestra un aumento.

```text
npm run check:ui-legacy
[INVENTORY] 408 archivos; 177 violaciones; exit 0

npm run check:ui-legacy:strict
[QUALITY GATE PASSED] 408 archivos; 0 violaciones
Módulos estrictos: shell, auth, dashboard, cash, invoices, catalog, admin, receipt-settings, receipts, printing, modules/receipts, reports y accounting

npm run check:ui-legacy:final
[QUALITY GATE FAILED] 408 archivos; 177 violaciones; exit 1
```

| Tipo | Cantidad |
| --- | ---: |
| Imports legacy | 69 |
| Clases prohibidas | 105 |
| Motion legacy | 2 |
| Border radius inline distinto de cero | 1 |
| **Total** | **177** |

| Módulo propietario | Violaciones | Riesgo / estado |
| --- | ---: | --- |
| ui-primitives | 137 | alto; backlog prioritario, no eliminar hasta migrar consumidores |
| design-system legacy | 21 | alto; consolidar en Ant/institucional central |
| layout | 9 | alto; consumidor transversal |
| shared | 6 | alto; incluye atajos del shell y notificaciones |
| settings | 4 | medio; fase Configuración |

## Inventario por archivo y consumidor

`Archivo / consumidor` identifica el consumidor físico; `Propietario` es la fase que debe retirarlo. El JSON completo y sus líneas exactas se obtiene con `node scripts/check-no-legacy-ui.mjs --mode=inventory --format=json`.

| Archivo / consumidor | Módulo | Dependencias | Clases | Propietario | Riesgo | Estado | N |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| `src/components/keyboard-shortcuts-palette.tsx` | shared | lucide-react | rounded-lg/md/xl, shadow-sm | shell | alto | backlog | 5 |
| `src/components/ui/accordion.tsx` | ui-primitives | Radix, lucide | rounded-md | UI central | alto | backlog | 3 |
| `src/components/ui/action-menu.tsx` | ui-primitives | lucide | shadow-sm | UI central | alto | backlog | 2 |
| `src/components/ui/alert-dialog.tsx` | ui-primitives | Radix | rounded-2xl | UI central | alto | backlog | 2 |
| `src/components/ui/alert.tsx` | ui-primitives | lucide | rounded-lg/xl, shadow-sm | UI central | alto | backlog | 4 |
| `src/components/ui/animations.tsx` | ui-primitives | motion/react | rounded-2xl/md, shadow-sm | UI central | medio | backlog | 4 |
| `src/components/ui/audit-log-list.tsx` | ui-primitives | — | rounded-full/md/xl, shadow-sm | Admin | medio | backlog | 4 |
| `src/components/ui/badge.tsx` | ui-primitives | — | rounded-md | UI central | medio | backlog | 1 |
| `src/components/ui/breadcrumb.tsx` | ui-primitives | Radix, lucide | rounded-md | UI central | alto | backlog | 3 |
| `src/components/ui/button.tsx` | ui-primitives | Radix | rounded-md | UI central | alto | backlog | 4 |
| `src/components/ui/calendar.tsx` | ui-primitives | lucide, react-day-picker | rounded-lg/md | UI central | alto | backlog | 4 |
| `src/components/ui/card.tsx` | ui-primitives | — | rounded-xl | UI central | medio | backlog | 1 |
| `src/components/ui/chart.tsx` | ui-primitives | recharts | rounded-lg, shadow-xl | Reportes | alto | backlog | 4 |
| `src/components/ui/checkbox.tsx` | ui-primitives | Radix, lucide | rounded-md, shadow-sm | UI central | alto | backlog | 4 |
| `src/components/ui/collapsible.tsx` | ui-primitives | Radix | — | UI central | alto | backlog | 1 |
| `src/components/ui/command.tsx` | ui-primitives | cmdk, lucide | rounded-md/sm | UI central | alto | backlog | 6 |
| `src/components/ui/confirm-dialog.tsx` | ui-primitives | Radix, lucide | rounded-2xl/xl | UI central | alto | backlog | 4 |
| `src/components/ui/data-table.test.tsx` | ui-primitives | TanStack Table | — | UI central | alto | backlog | 1 |
| `src/components/ui/data-table.tsx` | ui-primitives | TanStack Table, lucide | rounded-sm/xl | UI central | alto | backlog | 6 |
| `src/components/ui/date-range-picker.tsx` | ui-primitives | lucide, react-day-picker | — | UI central | alto | backlog | 2 |
| `src/components/ui/dialog.tsx` | ui-primitives | Radix, lucide | rounded-2xl | UI central | alto | backlog | 3 |
| `src/components/ui/drawer.tsx` | ui-primitives | vaul | rounded-full, shadow-2xl | UI central | alto | backlog | 3 |
| `src/components/ui/dropdown-menu.tsx` | ui-primitives | Radix | rounded-lg/xl | UI central | alto | backlog | 3 |
| `src/components/ui/empty.tsx` | ui-primitives | — | rounded-lg | UI central | medio | backlog | 2 |
| `src/components/ui/filter-bar.tsx` | ui-primitives | lucide | rounded-lg/md/xl, shadow-sm | UI central | alto | backlog | 5 |
| `src/components/ui/form-field.tsx` | ui-primitives | — | rounded-lg | UI central | medio | backlog | 1 |
| `src/components/ui/input-group.tsx` | ui-primitives | — | rounded-md | UI central | medio | backlog | 1 |
| `src/components/ui/input.tsx` | ui-primitives | — | rounded-md | UI central | medio | backlog | 1 |
| `src/components/ui/metric-card.tsx` | ui-primitives | lucide | rounded-xl, shadow-lg | Dashboard | alto | backlog | 3 |
| `src/components/ui/pagination.tsx` | ui-primitives | lucide | rounded-xl, shadow-sm | UI central | alto | backlog | 3 |
| `src/components/ui/popover.tsx` | ui-primitives | Radix | rounded-md, shadow-md | UI central | alto | backlog | 3 |
| `src/components/ui/progress.tsx` | ui-primitives | Radix | rounded-full | UI central | alto | backlog | 2 |
| `src/components/ui/radio-group.tsx` | ui-primitives | Radix, lucide | rounded-full | UI central | alto | backlog | 3 |
| `src/components/ui/scroll-area.tsx` | ui-primitives | Radix | rounded-full | UI central | alto | backlog | 2 |
| `src/components/ui/search-input.tsx` | ui-primitives | lucide | rounded-lg/xl, shadow-sm | UI central | alto | backlog | 5 |
| `src/components/ui/select.tsx` | ui-primitives | Radix, lucide | rounded-lg/md/sm, shadow-md/sm | UI central | alto | backlog | 9 |
| `src/components/ui/separator.tsx` | ui-primitives | Radix | — | UI central | alto | backlog | 1 |
| `src/components/ui/sheet.tsx` | ui-primitives | Radix, lucide | — | UI central | alto | backlog | 2 |
| `src/components/ui/sonner.tsx` | ui-primitives | sonner | rounded-lg, shadow-lg | UI central | alto | backlog | 3 |
| `src/components/ui/spinner.tsx` | ui-primitives | lucide | — | UI central | alto | backlog | 1 |
| `src/components/ui/states.tsx` | ui-primitives | lucide | rounded-md/xl | UI central | alto | backlog | 6 |
| `src/components/ui/status-badge.tsx` | ui-primitives | lucide | — | UI central | alto | backlog | 1 |
| `src/components/ui/switch.tsx` | ui-primitives | Radix | rounded-full, shadow-sm | UI central | alto | backlog | 3 |
| `src/components/ui/table.tsx` | ui-primitives | — | rounded-lg | UI central | medio | backlog | 1 |
| `src/components/ui/tabs.tsx` | ui-primitives | Radix | rounded-lg/xl, shadow-md/sm | UI central | alto | backlog | 5 |
| `src/components/ui/textarea.tsx` | ui-primitives | — | rounded-lg, shadow-sm | UI central | medio | backlog | 2 |
| `src/components/ui/tooltip.tsx` | ui-primitives | Radix | rounded-lg | UI central | alto | backlog | 2 |
| `src/components/ui/ui-patterns.test.tsx` | ui-primitives | lucide | — | UI central | alto | backlog | 1 |
| `src/design-system/motion/MotionProvider.tsx` | design-system | motion/react | — | UI central | medio | backlog | 1 |
| `src/design-system/primitives/Button.tsx` | design-system | Radix | rounded-full/md | UI central | alto | backlog | 3 |
| `src/design-system/primitives/Field.tsx` | design-system | — | rounded-md | UI central | medio | backlog | 1 |
| `src/design-system/primitives/StatusMark.tsx` | design-system | — | rounded-full | UI central | medio | backlog | 1 |
| `src/design-system/primitives/Surface.tsx` | design-system | — | rounded-md | UI central | medio | backlog | 1 |
| `src/design-system/primitives/Toaster.tsx` | design-system | sonner | inline radius | UI central | alto | backlog | 2 |
| `src/design-system/primitives/primitives.test.tsx` | design-system | sonner | — | UI central | alto | backlog | 12 |
| `src/features/settings/FiscalNumerationView.tsx` | settings | — | rounded-xl | Configuración | medio | backlog | 3 |
| `src/features/settings/components/FiscalStatusCard.tsx` | settings | — | rounded-xl | Configuración | medio | backlog | 1 |
| `src/layout/components/OperationalStatus.tsx` | layout | lucide | rounded-md, shadow-sm | Layout | alto | backlog | 5 |
| `src/layout/components/SidebarNavItem.tsx` | layout | — | rounded-full/md, shadow-sm | Layout | medio | backlog | 4 |
| `src/lib/realtime/useBroadcastSync.ts` | shared | sonner | — | UI central | alto | backlog | 1 |

## Registro por fase

| Fase | Violaciones al inicio | Imports eliminados | Clases eliminadas | Archivos legacy eliminados | Violaciones al final comparable | Estado |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Facturación 8B | 16 focales | 11 | 5 | 2 Compat | 0 focales | estricta |
| Catálogo 9 | 7 focales | 4 | 3 | 0 Compat | 0 focales | estricta |
| Shell accesibilidad | 163 globales (criterio anterior) | 2 (`lucide`, Dialog/Button legacy del tour) | 2 radios/sombras del tour | 0 | 159 globales (criterio anterior) | QA global pendiente |
| Gate exhaustivo | 159 visibles | n/a | +31 deudas antes exentas ahora visibles | 0 | 190 reales | inventario activo |
| Administración 10 | 0 focales | 11 consumidores dejaron `adminAntCompat` | 0 contabilizadas | 1 Compat transitorio eliminado | 0 focales | estricta |
| Ajustes de recibos | 190 globales v2 | 1 | 7 | 0 Compat nuevos | 182 globales v2 | estricta; impresión física pendiente |
| Reportes | 182 globales v2 | 2 | 3 | 0 Compat nuevos | 177 globales v2 | estricta; ECharts institucional |
| Respaldos | 177 globales v2 | 0 | 0 | 1 Compat eliminado | 177 globales v2 | estricta; Ant Design directo |

Las primitivas no se eliminarán hasta migrar todos sus consumidores. La reducción comparable con gate v2 es **190/409 → 177/408**: 13 violaciones y un archivo Compat eliminados con la misma regla/configuración. El modo estricto cubre Shell, Auth, Dashboard, Caja, Facturación, Catálogo, Administración, Respaldos, Ajustes de recibos, Recibos, impresión TypeScript, Reportes y Contabilidad; todos están en cero. Este estado no equivale a certificación transversal.
