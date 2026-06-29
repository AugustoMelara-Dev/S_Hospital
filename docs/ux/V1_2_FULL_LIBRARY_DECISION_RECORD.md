# V1.2 Full Library Decision Record

Fecha: 2026-06-28

Base revisada: `frontend/package.json` en rama `codex/v1-2-full-ux-ui-redesign`.

## Principio

S_Hospital debe operar offline/LAN en produccion. Las librerias nuevas solo se aceptan si reducen riesgo real, centralizan patrones o mejoran una superficie critica sin imponer servicios externos.

## Decisiones

| Libreria | Decision | Motivo | Impacto | Riesgo y mitigacion |
| --- | --- | --- | --- | --- |
| shadcn/ui | Usar como referencia, no agregar como dependencia runtime. | El repo ya posee componentes locales estilo shadcn/Radix. | Patrones para sidebar, chart, forms, data table y theming. | No correr CLI masivo. |
| Tailwind CSS v4 | Mantener y profundizar. | Ya instalado; `styles.css` usa `@theme`. | Tokens hospitalarios, dark mode, print y responsive. | Token sprawl; documentar en design system. |
| Radix UI | Mantener. | Ya cubre interacciones complejas. | Accesibilidad en modales, menus, filtros y settings. | Requiere titulos/labels/focus tests. |
| Recharts | Mantener. | Ya instalado y suficiente. | `ChartCard`, `ChartLegend`, tooltips y responsive charts. | Evitar charts sin resumen textual. |
| `@tanstack/react-table` | Agregar. | Historial, reportes y usuarios necesitan una base de tabla mantenible. | `DataTable` profesional sin cambiar endpoints. | Wrapper local; filtros de negocio siguen fuera de la tabla. |
| `@tanstack/react-virtual` | Diferir. | No hay evidencia de dataset gigante client-side. | Ninguno. | Revaluar con datasets reales. |
| `class-variance-authority` | No agregar. | `clsx` y `tailwind-merge` ya cubren variantes actuales. | Ninguno. | Revaluar si crece la combinatoria. |
| Framer Motion | Rechazar. | No aporta al flujo de caja hospitalaria; agrega peso. | Ninguno. | Usar CSS sobrio y `prefers-reduced-motion`. |
| Sonner | Rechazar por ahora. | `react-hot-toast` ya funciona. | Ninguno. | Mejorar wrapper local si hace falta. |
| Date picker pesado | Rechazar. | El rango actual puede mejorarse localmente. | Ninguno. | Mantener labels y teclado. |
| Chart library alternativa | Rechazar. | Recharts ya cubre necesidades. | Ninguno. | Invertir en wrappers accesibles. |
| UI kits pesados | Rechazar. | Pelearian con Tailwind/shadcn local. | Ninguno. | Mantener design system propio. |

## Librerias nuevas aprobadas

- `@tanstack/react-table`

## Librerias nuevas rechazadas

- `@tanstack/react-virtual`
- `class-variance-authority`
- Framer Motion
- Sonner
- Date picker pesado
- Chart library alternativa
- MUI, Ant Design, Chakra, Bootstrap, Tremor completo, Flowbite, DaisyUI

## Bundle y operacion offline

`@tanstack/react-table` es headless y no llama servicios externos. Es compatible con operacion offline/LAN. El impacto de bundle se revisara en `docs/qa/V1_2_FULL_PERFORMANCE_REVIEW.md`.
