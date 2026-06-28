# V1.2 Library Decision Record

Fecha: 2026-06-26

Base revisada: `frontend/package.json` en rama `codex/v1-2-visible-ui-delta`.

## Principio

No agregar dependencias por moda. V1.2 es un refactor UX/UI visible, no una reescritura funcional. Las librerias nuevas solo entran si reducen riesgo real, mejoran mantenibilidad o desbloquean una UX que el stack actual no puede cubrir.

## Dependencias actuales relevantes

- React 19
- TypeScript
- Tailwind CSS v4 con `@tailwindcss/vite`
- Radix UI primitives: AlertDialog, Avatar, Checkbox, Dialog, DropdownMenu, Popover, ScrollArea, Select, Separator, Slot, Tabs, Tooltip
- TanStack Query
- React Hook Form
- Zod
- Recharts
- React Router
- lucide-react
- clsx y tailwind-merge
- react-hot-toast
- Playwright, axe-core, Vitest, Testing Library

## Decisiones

| Libreria | Decision | Motivo | Impacto en V1.2 | Riesgo y mitigacion |
| --- | --- | --- | --- | --- |
| shadcn/ui | Usar como patron, no como dependencia magica. | El repo ya tiene componentes locales estilo shadcn y Radix. Copiar/adaptar patrones es suficiente. | Guiar AppShell, Sidebar, cards, chart wrappers, forms, tables y settings. | No correr CLI masivo; revisar diffs si se copia un bloque. |
| Tailwind CSS v4 | Mantener y profundizar. | Ya esta instalado y `styles.css` usa `@theme`. | Ampliar tokens hospitalarios, superficies, chart colors, receipt border, sombras, radios y spacing. | Evitar token sprawl; documentar en `V1_2_DESIGN_SYSTEM.md`. |
| Radix UI | Mantener y ampliar uso local. | Ya cubre comportamiento accesible complejo. | Dialogs, AlertDialogs, Selects, Tabs, Tooltips, Popovers, Dropdowns y mobile sheet. | Probar foco, Escape, titulos, labels y keyboard. |
| Recharts | Mantener. | Ya esta instalado y usado en dashboard/reportes. | Crear `ChartCard`, tooltip/legend institucional y revisar `accessibilityLayer`. | Evitar charts decorativos sin tabla/resumen textual. |
| TanStack Table | Evaluar, no instalar todavia. | No esta en `package.json`. El repo ya tiene `DataTable` local. | Solo se agregara si historial/reportes/usuarios requieren sorting/filtering/pagination/column visibility robusta. | Si se agrega, migrar una tabla piloto y correr `npm audit`, typecheck, lint, test, build. |
| Framer Motion / Motion | Rechazar por defecto. | Caja hospitalaria necesita rapidez y claridad, no animacion pesada. | Usar transiciones CSS discretas si hacen falta. | Evitar dependencia nueva y problemas de reduced motion. |
| Sonner | Rechazar por ahora. | `react-hot-toast` y wrapper local ya existen. | Mejorar toaster actual con tokens si hace falta. | No duplicar sistemas de notificacion. |
| Date picker pesado | Rechazar por defecto. | Ya existe `date-range-picker.tsx`; reportes necesitan rango claro, no calendario pesado. | Mejorar componente local. | Mantener labels, teclado y formatos locales. |
| Otra chart library | Rechazar. | Recharts ya cubre reportes y dashboard. | Invertir en wrappers y accesibilidad. | Evitar bundle y curva nueva. |

## Decision TanStack Table

Estado: pendiente de auditoria focal.

Condiciones para agregar `@tanstack/react-table`:

- `frontend/src/components/ui/data-table.tsx` o tablas de historial/reportes/usuarios no cubren sorting/filtering/pagination/column visibility de forma mantenible.
- La tabla piloto usa datos paginados/filtrados desde backend cuando el dataset pueda crecer.
- Se conserva semantica `table`, headers, labels y controles nombrados.
- No se rompe exportacion ni filtros existentes.

Comandos obligatorios si se agrega:

```powershell
cd frontend
npm install @tanstack/react-table
npm audit
npm run typecheck
npm run lint
npm run test
npm run build
```

## Librerias nuevas aprobadas

Ninguna en este punto.

## Librerias nuevas rechazadas

- Framer Motion / Motion
- Sonner
- Date picker pesado
- Otra chart library
- Cualquier CDN o dependencia runtime que requiera internet en produccion

## Criterio de cambio de decision

Una decision puede cambiar solo con:

1. evidencia de limitacion concreta en el codigo actual,
2. alternativa local insuficiente,
3. impacto de bundle y mantenimiento documentado,
4. pruebas y build pasando,
5. registro en `docs/DECISIONS.md`.
