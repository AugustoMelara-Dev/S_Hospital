# Manifiesto final de violaciones legacy del frontend

Generado desde el gate global `inventory`. Archivos auditados: **406**. Violaciones iniciales: **177**.

La línea base coincide exactamente con 177 violaciones en 406 archivos.

## Resumen por dependencia

| Grupo | Violaciones |
|---|---:|
| `@radix-ui/` | 20 |
| `@tanstack/react-table` | 3 |
| `cmdk` | 2 |
| `lucide-react` | 24 |
| `motion/react` | 2 |
| `react-day-picker` | 2 |
| `recharts` | 2 |
| `sin dependencia externa` | 106 |
| `sonner` | 15 |
| `vaul` | 1 |

## Resumen por módulo

| Grupo | Violaciones |
|---|---:|
| `design-system` | 21 |
| `layout` | 9 |
| `settings` | 4 |
| `shared` | 6 |
| `ui-primitives` | 137 |

## Resumen por carpeta

| Grupo | Violaciones |
|---|---:|
| `src/components` | 5 |
| `src/components/ui` | 137 |
| `src/design-system/motion` | 1 |
| `src/design-system/primitives` | 20 |
| `src/features/settings` | 3 |
| `src/features/settings/components` | 1 |
| `src/layout/components` | 9 |
| `src/lib/realtime` | 1 |

## Resumen por clase

| Grupo | Violaciones |
|---|---:|
| `rounded-2xl` | 4 |
| `rounded-full` | 10 |
| `rounded-lg` | 17 |
| `rounded-md` | 26 |
| `rounded-sm` | 3 |
| `rounded-xl` | 22 |
| `shadow-2xl` | 1 |
| `shadow-lg` | 2 |
| `shadow-md` | 3 |
| `shadow-sm` | 16 |
| `shadow-xl` | 1 |
| `sin clase` | 72 |

## Resumen por componente

| Grupo | Violaciones |
|---|---:|
| `accordion.tsx` | 3 |
| `action-menu.tsx` | 2 |
| `alert-dialog.tsx` | 2 |
| `alert.tsx` | 4 |
| `animations.tsx` | 4 |
| `audit-log-list.tsx` | 4 |
| `badge.tsx` | 1 |
| `breadcrumb.tsx` | 3 |
| `button.tsx` | 4 |
| `Button.tsx` | 3 |
| `calendar.tsx` | 4 |
| `card.tsx` | 1 |
| `chart.tsx` | 4 |
| `checkbox.tsx` | 4 |
| `collapsible.tsx` | 1 |
| `command.tsx` | 6 |
| `confirm-dialog.tsx` | 4 |
| `data-table.test.tsx` | 1 |
| `data-table.tsx` | 6 |
| `date-range-picker.tsx` | 2 |
| `dialog.tsx` | 3 |
| `drawer.tsx` | 3 |
| `dropdown-menu.tsx` | 3 |
| `empty.tsx` | 2 |
| `Field.tsx` | 1 |
| `filter-bar.tsx` | 5 |
| `FiscalNumerationView.tsx` | 3 |
| `FiscalStatusCard.tsx` | 1 |
| `form-field.tsx` | 1 |
| `input-group.tsx` | 1 |
| `input.tsx` | 1 |
| `keyboard-shortcuts-palette.tsx` | 5 |
| `metric-card.tsx` | 3 |
| `MotionProvider.tsx` | 1 |
| `OperationalStatus.tsx` | 5 |
| `pagination.tsx` | 3 |
| `popover.tsx` | 3 |
| `primitives.test.tsx` | 12 |
| `progress.tsx` | 2 |
| `radio-group.tsx` | 3 |
| `scroll-area.tsx` | 2 |
| `search-input.tsx` | 5 |
| `select.tsx` | 9 |
| `separator.tsx` | 1 |
| `sheet.tsx` | 2 |
| `SidebarNavItem.tsx` | 4 |
| `sonner.tsx` | 3 |
| `spinner.tsx` | 1 |
| `states.tsx` | 6 |
| `status-badge.tsx` | 1 |
| `StatusMark.tsx` | 1 |
| `Surface.tsx` | 1 |
| `switch.tsx` | 3 |
| `table.tsx` | 1 |
| `tabs.tsx` | 5 |
| `textarea.tsx` | 2 |
| `Toaster.tsx` | 2 |
| `tooltip.tsx` | 2 |
| `ui-patterns.test.tsx` | 1 |
| `useBroadcastSync.ts` | 1 |

## Resumen por severidad

| Grupo | Violaciones |
|---|---:|
| `high` | 69 |
| `medium` | 108 |

## Asignación sin solapamientos

| Subagente | Archivos | Violaciones | Propiedad |
|---|---:|---:|---|
| A | 47 | 137 | `src/components/ui/**` |
| B | 13 | 40 | runtime residual fuera de `src/components/ui/**` |

## Inventario individual

| # | Archivo | Línea | Módulo | Tipo | Import o clase | Consumidor | Dependencia | Subagente | Acción | Test | Estado | Commit |
|---:|---|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/components/keyboard-shortcuts-palette.tsx` | 2 | shared | legacy-import | `lucide-react` | `src/components/keyboard-shortcuts-palette.tsx` | lucide-react | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 2 | `src/components/keyboard-shortcuts-palette.tsx` | 116 | shared | prohibited-class | `rounded-xl` | `src/components/keyboard-shortcuts-palette.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 3 | `src/components/keyboard-shortcuts-palette.tsx` | 131 | shared | prohibited-class | `rounded-lg` | `src/components/keyboard-shortcuts-palette.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 4 | `src/components/keyboard-shortcuts-palette.tsx` | 137 | shared | prohibited-class | `shadow-sm` | `src/components/keyboard-shortcuts-palette.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 5 | `src/components/keyboard-shortcuts-palette.tsx` | 150 | shared | prohibited-class | `rounded-md` | `src/components/keyboard-shortcuts-palette.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 6 | `src/components/ui/accordion.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/accordion.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 7 | `src/components/ui/accordion.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/accordion.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 8 | `src/components/ui/accordion.tsx` | 7 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/accordion.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 9 | `src/components/ui/action-menu.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/action-menu.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 10 | `src/components/ui/action-menu.tsx` | 63 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/action-menu.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 11 | `src/components/ui/alert-dialog.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/alert-dialog.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 12 | `src/components/ui/alert-dialog.tsx` | 33 | ui-primitives | prohibited-class | `rounded-2xl` | `src/components/ui/alert-dialog.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 13 | `src/components/ui/alert.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/alert.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 14 | `src/components/ui/alert.tsx` | 39 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/alert.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 15 | `src/components/ui/alert.tsx` | 39 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/alert.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 16 | `src/components/ui/alert.tsx` | 43 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/alert.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 17 | `src/components/ui/animations.tsx` | 2 | ui-primitives | legacy-motion | `motion/react` | `src/components/ui/animations.tsx` | motion/react | A | sustituir motion por transición institucional/Ant Design | gate focal + suite segmentada | resuelto | 238c33c6 |
| 18 | `src/components/ui/animations.tsx` | 11 | ui-primitives | prohibited-class | `rounded-2xl` | `src/components/ui/animations.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 19 | `src/components/ui/animations.tsx` | 11 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/animations.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 20 | `src/components/ui/animations.tsx` | 73 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/animations.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 21 | `src/components/ui/audit-log-list.tsx` | 81 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/audit-log-list.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 22 | `src/components/ui/audit-log-list.tsx` | 81 | ui-primitives | prohibited-class | `rounded-full` | `src/components/ui/audit-log-list.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 23 | `src/components/ui/audit-log-list.tsx` | 81 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/audit-log-list.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 24 | `src/components/ui/audit-log-list.tsx` | 103 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/audit-log-list.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 25 | `src/components/ui/badge.tsx` | 23 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/badge.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 26 | `src/components/ui/breadcrumb.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/breadcrumb.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 27 | `src/components/ui/breadcrumb.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/breadcrumb.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 28 | `src/components/ui/breadcrumb.tsx` | 43 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/breadcrumb.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 29 | `src/components/ui/button.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/button.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 30 | `src/components/ui/button.tsx` | 11 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/button.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 31 | `src/components/ui/button.tsx` | 23 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/button.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 32 | `src/components/ui/button.tsx` | 24 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/button.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 33 | `src/components/ui/calendar.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/calendar.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 34 | `src/components/ui/calendar.tsx` | 2 | ui-primitives | legacy-import | `react-day-picker` | `src/components/ui/calendar.tsx` | react-day-picker | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 35 | `src/components/ui/calendar.tsx` | 8 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/calendar.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 36 | `src/components/ui/calendar.tsx` | 8 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/calendar.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 37 | `src/components/ui/card.tsx` | 10 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/card.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 38 | `src/components/ui/chart.tsx` | 2 | ui-primitives | legacy-import | `recharts` | `src/components/ui/chart.tsx` | recharts | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 39 | `src/components/ui/chart.tsx` | 20 | ui-primitives | legacy-import | `recharts` | `src/components/ui/chart.tsx` | recharts | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 40 | `src/components/ui/chart.tsx` | 26 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/chart.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 41 | `src/components/ui/chart.tsx` | 26 | ui-primitives | prohibited-class | `shadow-xl` | `src/components/ui/chart.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 42 | `src/components/ui/checkbox.tsx` | 2 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/checkbox.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 43 | `src/components/ui/checkbox.tsx` | 3 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/checkbox.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 44 | `src/components/ui/checkbox.tsx` | 15 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/checkbox.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 45 | `src/components/ui/checkbox.tsx` | 15 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/checkbox.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 46 | `src/components/ui/collapsible.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/collapsible.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 47 | `src/components/ui/command.tsx` | 1 | ui-primitives | legacy-import | `cmdk` | `src/components/ui/command.tsx` | cmdk | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 48 | `src/components/ui/command.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/command.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 49 | `src/components/ui/command.tsx` | 5 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/command.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 50 | `src/components/ui/command.tsx` | 6 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/command.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 51 | `src/components/ui/command.tsx` | 9 | ui-primitives | legacy-import | `cmdk` | `src/components/ui/command.tsx` | cmdk | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 52 | `src/components/ui/command.tsx` | 10 | ui-primitives | prohibited-class | `rounded-sm` | `src/components/ui/command.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 53 | `src/components/ui/confirm-dialog.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/confirm-dialog.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 54 | `src/components/ui/confirm-dialog.tsx` | 3 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/confirm-dialog.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 55 | `src/components/ui/confirm-dialog.tsx` | 59 | ui-primitives | prohibited-class | `rounded-2xl` | `src/components/ui/confirm-dialog.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 56 | `src/components/ui/confirm-dialog.tsx` | 63 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/confirm-dialog.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 57 | `src/components/ui/data-table.test.tsx` | 2 | ui-primitives | legacy-import | `@tanstack/react-table` | `src/components/ui/data-table.test.tsx` | @tanstack/react-table | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 58 | `src/components/ui/data-table.tsx` | 15 | ui-primitives | legacy-import | `@tanstack/react-table` | `src/components/ui/data-table.tsx` | @tanstack/react-table | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 59 | `src/components/ui/data-table.tsx` | 16 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/data-table.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 60 | `src/components/ui/data-table.tsx` | 37 | ui-primitives | legacy-import | `@tanstack/react-table` | `src/components/ui/data-table.tsx` | @tanstack/react-table | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 61 | `src/components/ui/data-table.tsx` | 164 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/data-table.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 62 | `src/components/ui/data-table.tsx` | 196 | ui-primitives | prohibited-class | `rounded-sm` | `src/components/ui/data-table.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 63 | `src/components/ui/data-table.tsx` | 273 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/data-table.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 64 | `src/components/ui/date-range-picker.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/date-range-picker.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 65 | `src/components/ui/date-range-picker.tsx` | 3 | ui-primitives | legacy-import | `react-day-picker` | `src/components/ui/date-range-picker.tsx` | react-day-picker | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 66 | `src/components/ui/dialog.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/dialog.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 67 | `src/components/ui/dialog.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/dialog.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 68 | `src/components/ui/dialog.tsx` | 39 | ui-primitives | prohibited-class | `rounded-2xl` | `src/components/ui/dialog.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 69 | `src/components/ui/drawer.tsx` | 1 | ui-primitives | legacy-import | `vaul` | `src/components/ui/drawer.tsx` | vaul | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 70 | `src/components/ui/drawer.tsx` | 9 | ui-primitives | prohibited-class | `rounded-full` | `src/components/ui/drawer.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 71 | `src/components/ui/drawer.tsx` | 9 | ui-primitives | prohibited-class | `shadow-2xl` | `src/components/ui/drawer.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 72 | `src/components/ui/dropdown-menu.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/dropdown-menu.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 73 | `src/components/ui/dropdown-menu.tsx` | 18 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/dropdown-menu.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 74 | `src/components/ui/dropdown-menu.tsx` | 31 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/dropdown-menu.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 75 | `src/components/ui/empty.tsx` | 3 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/empty.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 76 | `src/components/ui/empty.tsx` | 5 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/empty.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 77 | `src/components/ui/filter-bar.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/filter-bar.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 78 | `src/components/ui/filter-bar.tsx` | 48 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/filter-bar.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 79 | `src/components/ui/filter-bar.tsx` | 56 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/filter-bar.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 80 | `src/components/ui/filter-bar.tsx` | 67 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/filter-bar.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 81 | `src/components/ui/filter-bar.tsx` | 105 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/filter-bar.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 82 | `src/components/ui/form-field.tsx` | 68 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/form-field.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 83 | `src/components/ui/input-group.tsx` | 3 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/input-group.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 84 | `src/components/ui/input.tsx` | 10 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/input.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 85 | `src/components/ui/metric-card.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/metric-card.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 86 | `src/components/ui/metric-card.tsx` | 38 | ui-primitives | prohibited-class | `shadow-lg` | `src/components/ui/metric-card.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 87 | `src/components/ui/metric-card.tsx` | 42 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/metric-card.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 88 | `src/components/ui/pagination.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/pagination.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 89 | `src/components/ui/pagination.tsx` | 19 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/pagination.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 90 | `src/components/ui/pagination.tsx` | 19 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/pagination.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 91 | `src/components/ui/popover.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/popover.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 92 | `src/components/ui/popover.tsx` | 7 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/popover.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 93 | `src/components/ui/popover.tsx` | 7 | ui-primitives | prohibited-class | `shadow-md` | `src/components/ui/popover.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 94 | `src/components/ui/progress.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/progress.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 95 | `src/components/ui/progress.tsx` | 5 | ui-primitives | prohibited-class | `rounded-full` | `src/components/ui/progress.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 96 | `src/components/ui/radio-group.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/radio-group.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 97 | `src/components/ui/radio-group.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/radio-group.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 98 | `src/components/ui/radio-group.tsx` | 9 | ui-primitives | prohibited-class | `rounded-full` | `src/components/ui/radio-group.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 99 | `src/components/ui/scroll-area.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/scroll-area.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 100 | `src/components/ui/scroll-area.tsx` | 37 | ui-primitives | prohibited-class | `rounded-full` | `src/components/ui/scroll-area.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 101 | `src/components/ui/search-input.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/search-input.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 102 | `src/components/ui/search-input.tsx` | 35 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/search-input.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 103 | `src/components/ui/search-input.tsx` | 35 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/search-input.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 104 | `src/components/ui/search-input.tsx` | 48 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/search-input.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 105 | `src/components/ui/search-input.tsx` | 59 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/search-input.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 106 | `src/components/ui/select.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/select.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 107 | `src/components/ui/select.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/select.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 108 | `src/components/ui/select.tsx` | 15 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 109 | `src/components/ui/select.tsx` | 15 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 110 | `src/components/ui/select.tsx` | 37 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 111 | `src/components/ui/select.tsx` | 37 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 112 | `src/components/ui/select.tsx` | 64 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 113 | `src/components/ui/select.tsx` | 64 | ui-primitives | prohibited-class | `shadow-md` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 114 | `src/components/ui/select.tsx` | 92 | ui-primitives | prohibited-class | `rounded-sm` | `src/components/ui/select.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 115 | `src/components/ui/separator.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/separator.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 116 | `src/components/ui/sheet.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/sheet.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 117 | `src/components/ui/sheet.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/sheet.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 118 | `src/components/ui/sonner.tsx` | 1 | ui-primitives | legacy-import | `sonner` | `src/components/ui/sonner.tsx` | sonner | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 119 | `src/components/ui/sonner.tsx` | 18 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/sonner.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 120 | `src/components/ui/sonner.tsx` | 18 | ui-primitives | prohibited-class | `shadow-lg` | `src/components/ui/sonner.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 121 | `src/components/ui/spinner.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/spinner.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 122 | `src/components/ui/states.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/states.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 123 | `src/components/ui/states.tsx` | 18 | ui-primitives | prohibited-class | `rounded-md` | `src/components/ui/states.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 124 | `src/components/ui/states.tsx` | 42 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/states.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 125 | `src/components/ui/states.tsx` | 43 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/states.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 126 | `src/components/ui/states.tsx` | 44 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/states.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 127 | `src/components/ui/states.tsx` | 90 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/states.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 128 | `src/components/ui/status-badge.tsx` | 1 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/status-badge.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 129 | `src/components/ui/switch.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/switch.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 130 | `src/components/ui/switch.tsx` | 5 | ui-primitives | prohibited-class | `rounded-full` | `src/components/ui/switch.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 131 | `src/components/ui/switch.tsx` | 5 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/switch.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 132 | `src/components/ui/table.tsx` | 12 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/table.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 133 | `src/components/ui/tabs.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/tabs.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 134 | `src/components/ui/tabs.tsx` | 8 | ui-primitives | prohibited-class | `rounded-xl` | `src/components/ui/tabs.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 135 | `src/components/ui/tabs.tsx` | 8 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/tabs.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 136 | `src/components/ui/tabs.tsx` | 14 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/tabs.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 137 | `src/components/ui/tabs.tsx` | 14 | ui-primitives | prohibited-class | `shadow-md` | `src/components/ui/tabs.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 138 | `src/components/ui/textarea.tsx` | 11 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/textarea.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 139 | `src/components/ui/textarea.tsx` | 11 | ui-primitives | prohibited-class | `shadow-sm` | `src/components/ui/textarea.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 140 | `src/components/ui/tooltip.tsx` | 1 | ui-primitives | legacy-import | `@radix-ui/` | `src/components/ui/tooltip.tsx` | @radix-ui/ | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 141 | `src/components/ui/tooltip.tsx` | 28 | ui-primitives | prohibited-class | `rounded-lg` | `src/components/ui/tooltip.tsx` | sin dependencia externa | A | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 142 | `src/components/ui/ui-patterns.test.tsx` | 2 | ui-primitives | legacy-import | `lucide-react` | `src/components/ui/ui-patterns.test.tsx` | lucide-react | A | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 143 | `src/design-system/motion/MotionProvider.tsx` | 1 | design-system | legacy-motion | `motion/react` | `src/design-system/motion/MotionProvider.tsx` | motion/react | B | sustituir motion por transición institucional/Ant Design | gate focal + suite segmentada | resuelto | d4a274a4 |
| 144 | `src/design-system/primitives/Button.tsx` | 1 | design-system | legacy-import | `@radix-ui/` | `src/design-system/primitives/Button.tsx` | @radix-ui/ | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 145 | `src/design-system/primitives/Button.tsx` | 76 | design-system | prohibited-class | `rounded-md` | `src/design-system/primitives/Button.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | d4a274a4 |
| 146 | `src/design-system/primitives/Button.tsx` | 91 | design-system | prohibited-class | `rounded-full` | `src/design-system/primitives/Button.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | d4a274a4 |
| 147 | `src/design-system/primitives/Field.tsx` | 46 | design-system | prohibited-class | `rounded-md` | `src/design-system/primitives/Field.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | d4a274a4 |
| 148 | `src/design-system/primitives/StatusMark.tsx` | 30 | design-system | prohibited-class | `rounded-full` | `src/design-system/primitives/StatusMark.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | d4a274a4 |
| 149 | `src/design-system/primitives/Surface.tsx` | 20 | design-system | prohibited-class | `rounded-md` | `src/design-system/primitives/Surface.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | d4a274a4 |
| 150 | `src/design-system/primitives/Toaster.tsx` | 1 | design-system | legacy-import | `sonner` | `src/design-system/primitives/Toaster.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 151 | `src/design-system/primitives/Toaster.tsx` | 47 | design-system | inline-radius | `sin clase` | `src/design-system/primitives/Toaster.tsx` | sin dependencia externa | B | usar geometría global borderRadius: 0 | gate focal + suite segmentada | resuelto | d4a274a4 |
| 152 | `src/design-system/primitives/primitives.test.tsx` | 11 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 153 | `src/design-system/primitives/primitives.test.tsx` | 22 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 154 | `src/design-system/primitives/primitives.test.tsx` | 23 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 155 | `src/design-system/primitives/primitives.test.tsx` | 25 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 156 | `src/design-system/primitives/primitives.test.tsx` | 26 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 157 | `src/design-system/primitives/primitives.test.tsx` | 27 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 158 | `src/design-system/primitives/primitives.test.tsx` | 28 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 159 | `src/design-system/primitives/primitives.test.tsx` | 29 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 160 | `src/design-system/primitives/primitives.test.tsx` | 30 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 161 | `src/design-system/primitives/primitives.test.tsx` | 31 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 162 | `src/design-system/primitives/primitives.test.tsx` | 119 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 163 | `src/design-system/primitives/primitives.test.tsx` | 140 | design-system | legacy-import | `sonner` | `src/design-system/primitives/primitives.test.tsx` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | d4a274a4 |
| 164 | `src/features/settings/FiscalNumerationView.tsx` | 176 | settings | prohibited-class | `rounded-xl` | `src/features/settings/FiscalNumerationView.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 165 | `src/features/settings/FiscalNumerationView.tsx` | 187 | settings | prohibited-class | `rounded-xl` | `src/features/settings/FiscalNumerationView.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 166 | `src/features/settings/FiscalNumerationView.tsx` | 270 | settings | prohibited-class | `rounded-xl` | `src/features/settings/FiscalNumerationView.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 167 | `src/features/settings/components/FiscalStatusCard.tsx` | 48 | settings | prohibited-class | `rounded-xl` | `src/features/settings/components/FiscalStatusCard.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 168 | `src/layout/components/OperationalStatus.tsx` | 1 | layout | legacy-import | `lucide-react` | `src/layout/components/OperationalStatus.tsx` | lucide-react | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |
| 169 | `src/layout/components/OperationalStatus.tsx` | 27 | layout | prohibited-class | `shadow-sm` | `src/layout/components/OperationalStatus.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 170 | `src/layout/components/OperationalStatus.tsx` | 32 | layout | prohibited-class | `rounded-md` | `src/layout/components/OperationalStatus.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 171 | `src/layout/components/OperationalStatus.tsx` | 46 | layout | prohibited-class | `rounded-md` | `src/layout/components/OperationalStatus.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 172 | `src/layout/components/OperationalStatus.tsx` | 56 | layout | prohibited-class | `rounded-md` | `src/layout/components/OperationalStatus.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 173 | `src/layout/components/SidebarNavItem.tsx` | 27 | layout | prohibited-class | `rounded-md` | `src/layout/components/SidebarNavItem.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 174 | `src/layout/components/SidebarNavItem.tsx` | 32 | layout | prohibited-class | `shadow-sm` | `src/layout/components/SidebarNavItem.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 175 | `src/layout/components/SidebarNavItem.tsx` | 42 | layout | prohibited-class | `rounded-full` | `src/layout/components/SidebarNavItem.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 176 | `src/layout/components/SidebarNavItem.tsx` | 53 | layout | prohibited-class | `rounded-full` | `src/layout/components/SidebarNavItem.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | resuelto | 238c33c6 |
| 177 | `src/lib/realtime/useBroadcastSync.ts` | 6 | shared | legacy-import | `sonner` | `src/lib/realtime/useBroadcastSync.ts` | sonner | B | migrar consumidor y eliminar import/dependencia | gate focal + suite segmentada | resuelto | 238c33c6 |

## Cierre verificado

- Línea base preservada: 177 violaciones individuales en 406 archivos.
- Gate final e inventory: 329 archivos TS/TSX/CSS, 0 violaciones.
- Allowlist: 0.
- Excepciones temporales: 0.
- `src/components/ui`: eliminado.
- Dependencias e imports reemplazados: 0 coincidencias en `src` y `package.json`.
- Commits de resolución principales: `238c33c6`, `d4a274a4`, `9b04b62a`, `962d0983`, `3155b187` y `eada8b6e`.
