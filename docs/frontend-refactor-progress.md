# Cierre del refactor del frontend de S_Hospital

Fecha de certificación: 2026-07-14 (`America/Tegucigalpa`).

## Estado

El refactor está implementado y certificado en la rama de integración del trabajo. Todas las rutas extraídas de `AppRoutes.tsx` usan el shell institucional y el sistema visual único. `src/components/ui` y `src/components/shared` fueron eliminados; los patrones institucionales válidos viven en `src/design-system`.

## Arquitectura única

- Ant Design 6.5.0 y Ant Design Icons.
- AG Grid Community 36.0.0, sin Enterprise.
- Apache ECharts 6.1.0 con imports modulares.
- React Hook Form 7.76.0 + Zod 4.4.3.
- TanStack Query 5.100.10 y Day.js 1.11.21.
- Tokens centralizados, fuentes locales y `borderRadius: 0` global.
- Vitest, Testing Library, Storybook, Playwright y axe.

## Rutas certificadas

Autenticación: login, cambio obligatorio de contraseña y sesión expirada.

Protegidas: `/dashboard`, `/billing/new`, `/cashbox`, `/catalog`, `/invoices`, `/reports`, `/reports/executive`, `/reports/cash`, `/reports/audit`, `/backups`, `/settings/fiscal`, `/settings/institutional-receipts`, `/admin/users`, `/help`, `/support`, `/about` y fallback 404. Los estados 403, loading, empty, error y overlays se cubren dentro de sus rutas propietarias.

## Evidencia final posterior al merge

| Gate | Resultado |
|---|---|
| Regresión segmentada | 132/132 archivos; 967/967 tests; 12/12 segmentos; 0 omitidos |
| Storybook | 3/3 archivos; 14/14 tests |
| Playwright mock | 39/39 |
| Matriz visual | 4/4 recorridos agregados; 119 PNG + 119 JSON |
| Axe | 0 minor/moderate/serious/critical; 191 nodos incomplete clasificados; 0 sin clasificar |
| Estilos computados | 1,258 superficies; 0 radios distintos de `0px`; 0 overflow |
| Gate legacy | inventory/strict/final: 329 archivos; 0 violaciones |
| TypeScript / lint / build | PASS / PASS / PASS |
| Bundle | 336,323 B gzip inicial; 1,077,559 B gzip total |

Los únicos pendientes externos son la impresión física por falta de hardware y el E2E release por falta de credencial.
