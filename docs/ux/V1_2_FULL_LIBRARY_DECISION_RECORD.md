# V1.2 Full Library Decision Record

Fecha: 2026-06-28
Base: `742fdb551b202ddb0473a0269440e0bf6ff116ce`

## Decision

No agregar dependencias nuevas en el inicio de la fase. El frontend ya incluye las librerias necesarias para el refactor visual:

- `@tanstack/react-table`
- `@tanstack/react-query`
- `@radix-ui/react-*`
- `recharts`
- `react-hook-form`
- `zod`
- `clsx`
- `tailwind-merge`
- `lucide-react`
- `tailwindcss` v4

## Evaluacion

| Libreria | Estado | Decision | Motivo |
| --- | --- | --- | --- |
| `@tanstack/react-table` | Ya instalada | AGREGADO previamente / USAR | Necesaria para reportes, historial, usuarios, catalogo y backups. Se debe ampliar el componente `DataTable` en vez de instalar otra tabla. |
| `@tanstack/react-virtual` | No instalada | DIFERIDO | No hay evidencia de datasets enormes que requieran virtualizacion. Evita complejidad hasta medir volumen real. |
| shadcn/ui | Patron, no runtime | USAR COMO REFERENCIA | Sus bloques orientan dashboard, data table, forms, sidebar y charts; no se ejecutara CLI masivo sin revisar diffs. |
| `class-variance-authority` | No instalada | RECHAZADO POR AHORA | El proyecto ya tiene `cn()` con `clsx`/`tailwind-merge`; variantes actuales pueden resolverse con helpers tipados locales. |
| `clsx` | Ya instalada | USAR | Base de `cn()` y composicion de clases. |
| `tailwind-merge` | Ya instalada | USAR | Evita conflictos de utilidades Tailwind. |
| Framer Motion | No instalada | RECHAZADO | Animaciones pesadas no aportan al flujo hospitalario LAN/offline. |
| Sonner | No instalada | RECHAZADO POR AHORA | `react-hot-toast` ya existe; cambiar toaster no reduce riesgo funcional. |
| Date picker pesado | No instalado | RECHAZADO | Mantener controles actuales salvo problema probado de UX. |
| Chart library alternativa | No instalada | RECHAZADO | Recharts ya esta instalado y cubre dashboards/reportes. |
| MUI / Ant Design / Chakra / Bootstrap / Tremor completo / Flowbite / DaisyUI | No instaladas | RECHAZADO | UI kits pesados chocan con el sistema Tailwind/shadcn propio y aumentan bundle/estilos. |

## Impacto Bundle

Sin dependencias nuevas en esta etapa, no hay aumento de bundle atribuible a paquetes. El riesgo de performance vendra de composicion visual, charts y tablas; debe revisarse en `docs/qa/V1_2_FULL_PERFORMANCE_REVIEW.md`.

## Condiciones Para Cambiar Esta Decision

- Agregar `@tanstack/react-virtual` solo si QA o datos reales muestran tablas con muchos registros y problemas medibles.
- Agregar `class-variance-authority` solo si las variantes locales crecen al punto de duplicar logica o clases en varios componentes.
- Cualquier dependencia nueva requiere `pnpm install`, `pnpm audit`, typecheck, lint, tests y build.
