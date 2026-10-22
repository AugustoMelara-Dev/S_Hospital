# Manifiesto final de violaciones legacy del frontend

Generado desde el gate global `inventory`. Archivos auditados: **368**. Violaciones iniciales: **11**.

Diferencia contra la línea base aceptada (177/406): -166 violaciones y -38 archivos, causada por cambios presentes en la worktree antes de esta ejecución.

## Resumen por dependencia

| Grupo | Violaciones |
|---|---:|
| `button` | 9 |
| `sin dependencia externa` | 2 |

## Resumen por módulo

| Grupo | Violaciones |
|---|---:|
| `design-system` | 5 |
| `shared` | 6 |

## Resumen por carpeta

| Grupo | Violaciones |
|---|---:|
| `src/app` | 2 |
| `src/design-system/providers` | 5 |
| `src/hooks` | 4 |

## Resumen por clase

| Grupo | Violaciones |
|---|---:|
| `sin clase` | 11 |

## Resumen por componente

| Grupo | Violaciones |
|---|---:|
| `FeedbackProvider.test.tsx` | 5 |
| `useHospitalSession.test.tsx` | 2 |
| `useKeyboardShortcuts.test.tsx` | 1 |
| `useTheme.test.tsx` | 2 |
| `useUnsavedChangesGuard.test.tsx` | 1 |

## Resumen por severidad

| Grupo | Violaciones |
|---|---:|
| `high` | 9 |
| `medium` | 2 |

## Asignación sin solapamientos

| Subagente | Archivos | Violaciones | Propiedad |
|---|---:|---:|---|
| A | 0 | 0 | `src/components/ui/**` |
| B | 5 | 11 | runtime residual fuera de `src/components/ui/**` |

## Inventario individual

| # | Archivo | Línea | Módulo | Tipo | Import o clase | Consumidor | Dependencia | Subagente | Acción | Test | Estado | Commit |
|---:|---|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/app/useHospitalSession.test.tsx` | 43 | shared | native-interactive-control | `button` | `src/app/useHospitalSession.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 2 | `src/app/useHospitalSession.test.tsx` | 62 | shared | native-interactive-control | `button` | `src/app/useHospitalSession.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 3 | `src/design-system/providers/FeedbackProvider.test.tsx` | 24 | design-system | native-interactive-control | `button` | `src/design-system/providers/FeedbackProvider.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 4 | `src/design-system/providers/FeedbackProvider.test.tsx` | 25 | design-system | native-interactive-control | `button` | `src/design-system/providers/FeedbackProvider.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 5 | `src/design-system/providers/FeedbackProvider.test.tsx` | 26 | design-system | native-interactive-control | `button` | `src/design-system/providers/FeedbackProvider.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 6 | `src/design-system/providers/FeedbackProvider.test.tsx` | 27 | design-system | native-interactive-control | `button` | `src/design-system/providers/FeedbackProvider.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 7 | `src/design-system/providers/FeedbackProvider.test.tsx` | 28 | design-system | native-interactive-control | `button` | `src/design-system/providers/FeedbackProvider.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 8 | `src/hooks/useKeyboardShortcuts.test.tsx` | 12 | shared | native-interactive-control | `button` | `src/hooks/useKeyboardShortcuts.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 9 | `src/hooks/useTheme.test.tsx` | 5 | shared | color-literal | `sin clase` | `src/hooks/useTheme.test.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 10 | `src/hooks/useTheme.test.tsx` | 6 | shared | color-literal | `sin clase` | `src/hooks/useTheme.test.tsx` | sin dependencia externa | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |
| 11 | `src/hooks/useUnsavedChangesGuard.test.tsx` | 22 | shared | native-interactive-control | `button` | `src/hooks/useUnsavedChangesGuard.test.tsx` | button | B | eliminar clase visual y usar token/componente institucional | gate focal + suite segmentada | backlog | pendiente |

