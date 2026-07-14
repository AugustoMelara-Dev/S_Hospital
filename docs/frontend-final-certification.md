# Certificación final del nuevo frontend

Fecha: 2026-07-14 (`America/Tegucigalpa`).

## Resultado

S_Hospital tiene un frontend institucional único. Todas las rutas usan Ant Design/Ant Design Icons, los grids operativos usan AG Grid Community y los gráficos usan Apache ECharts modular. Formularios, estado remoto y fechas usan React Hook Form + Zod, TanStack Query y Day.js. Los tokens y fuentes son locales; `borderRadius` es 0 global.

La facturación conserva búsqueda/filtros de servicios, paciente obligatorio, carrito/totales, cobro, confirmación, éxito, historial, detalle, anulación, reverso y reimpresión. El recibo institucional comparte contenido entre preview/PDF/impresión y cubre seis formatos con original y copias.

## Gates previos al merge

| Comando | Resultado exacto |
|---|---|
| `git diff --check` | PASS |
| `npm dedupe` | PASS; 0 vulnerabilidades |
| `npm ci` | 612 paquetes; 0 vulnerabilidades |
| `npm ls --depth=0` | exit 0 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:segmented` | 132/132 archivos; 965/965 tests; 12/12 segmentos; 0 omitidos; 1,307.3 s |
| `npm run test:storybook` | 3/3 archivos; 14/14 tests |
| `npm run test:e2e:mock` | 39/39; 118.7 s |
| matriz visual/axe | 4/4; 119 PNG + 119 JSON; 356 s |
| `npm run check:ui-legacy` | inventory: 329 archivos; 0 violaciones |
| `npm run check:ui-legacy:strict` | 329 archivos; 0 violaciones |
| `npm run check:ui-legacy:final` | 329 archivos; 0 violaciones; allowlist 0 |
| `npm run build` | PASS; 3,973 módulos; sin warning `@theme` |
| `npm run analyze:bundle` | PASS; 336,667 B gzip inicial; 1,077,880 B gzip total |

## QA, impresión y bundle

- Axe: minor 0, moderate 0, serious 0, critical 0; 191 nodos incomplete clasificados; 0 sin clasificar.
- Computed styles: 1,258 superficies; 0 radios distintos de `0px`; 0 overflow.
- Consola/red: 0 `console.error`, 0 `pageerror`, 0 `requestfailed`, 0 endpoints inesperados.
- Impresión: 18/18 PDFs para Carta, Media Carta, A5, 80 mm, 58 mm y 190×140 mm; original, primera y segunda copia.
- Bundle lazy justificado: AG Grid 866,247 B raw/239,949 B gzip; reportes/ECharts 614,226 B raw/204,756 B gzip. Ninguno forma parte del arranque.

## Eliminación legacy

Línea base 177 violaciones/406 archivos. Resultado inventory/strict/final: 0/329. `src/components/ui` y `src/components/shared`: eliminados. Dependencias reemplazadas e imports prohibidos: 0. Archivos o símbolos `Compat|Legacy|Old|V1`: 0. Ramas runtime específicas de test: 0. APIs estáticas Ant Design de feedback: 0.

## Integración

Rama del refactor: `codex/refactor-total`. Rama objetivo verificada: `main`. Los hashes de merge y certificación post-merge se registrarán en este mismo documento después de ejecutar de nuevo todos los gates sobre `main`.

## Bloqueos externos

- `E2E_RELEASE_PASSWORD_present=False`; `E2E_SEED_PASSWORD_present=False`. El comando termina antes de sembrar datos con “E2E release password is required”. **BLOQUEO EXTERNO: NO SE PROPORCIONÓ E2E_RELEASE_PASSWORD NI E2E_SEED_PASSWORD**.
- No existe impresora física accesible. **VALIDACIÓN FÍSICA EN IMPRESORA PENDIENTE POR HARDWARE EXTERNO**.
