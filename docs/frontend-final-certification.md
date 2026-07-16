# Certificación final del nuevo frontend

Fecha: 2026-07-14 (`America/Tegucigalpa`).

## Resultado

S_Hospital tiene un frontend institucional único. Todas las rutas usan Ant Design/Ant Design Icons, los grids operativos usan AG Grid Community y los gráficos usan Apache ECharts modular. Formularios, estado remoto y fechas usan React Hook Form + Zod, TanStack Query y Day.js. Los tokens y fuentes son locales; `borderRadius` es 0 global.

La facturación funciona como un espacio POS: paciente, catálogo compacto y cuenta permanecen visibles; la fila completa agrega por clic o teclado; categoría es la navegación principal y área un filtro secundario; la acción de cobro permanece accesible. El cobro prioriza Total, Recibido y Cambio. Historial, detalle, anulación, reverso y reimpresión conservan sus contratos y permisos. El recibo institucional comparte contenido entre preview/PDF/impresión y cubre seis formatos con original y copias.

Caja abre en Resumen y sólo enfoca el cierre cuando la persona entra a esa vista. Los refrescos automáticos de Respaldos son silenciosos. Ayuda ofrece índice por tareas, búsqueda, anclas y contenido expandible. El shell claro usa una jerarquía cromática continua y restaura el inicio al cambiar de ruta.

## Gates posteriores al merge

| Comando | Resultado exacto |
|---|---|
| `git diff --check` | PASS |
| `npm dedupe` | PASS; 0 vulnerabilidades |
| `npm ci` | 612 paquetes; 0 vulnerabilidades |
| `npm ls --depth=0` | exit 0 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:segmented` | 135/135 archivos; 1004/1004 tests; 12/12 segmentos; 0 omitidos; 1,896.3 s |
| `npm run test:storybook` | 3/3 archivos; 14/14 tests |
| `npm run test:e2e:mock` | 39/39; 131.0 s |
| matriz visual/axe | 4/4; 119 PNG + 119 JSON; 356 s |
| `npm run check:ui-legacy` | inventory: 333 archivos; 0 violaciones |
| `npm run check:ui-legacy:strict` | 333 archivos; 0 violaciones |
| `npm run check:ui-legacy:final` | 333 archivos; 0 violaciones; allowlist 0 |
| `npm run build` | PASS; 3,974 módulos; sin warning `@theme` |
| `npm run analyze:bundle` | PASS; 328.6 KiB gzip inicial; 1,053.5 KiB gzip total |

## Optimización del runner Windows (2026-07-16)

La regresión completa conserva los 12 segmentos y el aislamiento con `forks`,
pero procesa hasta dos archivos en paralelo dentro de cada segmento. El comando
`test:full:windows` delega en `test:segmented`, por lo que existe una sola ruta
mantenida para la suite completa.

| Evidencia | Resultado exacto |
|---|---|
| prueba nativa del runner | 5/5 tests; incluye manifiesto, agregación, flags y alias |
| RED observado | import de `buildVitestArgs` inexistente; exit 1 antes de implementar |
| `npm run test:segmented` | 138/138 archivos; 1083/1083 tests; 12/12 segmentos; 0 omitidos; 0 duplicados; 0 sin reporte; 742.7 s |
| comparación | 60.8 % menos tiempo que 1,896.3 s, aun con 3 archivos y 79 tests adicionales |
| `npm run typecheck` / `npm run lint` | PASS / PASS |
| `npm run build` | PASS; 3,979 módulos; 3.36 s |
| `npm run budget:bundle` | PASS; 326.7 KiB gzip inicial; 1,061.8 KiB gzip total |

Se descartó `threads` con un worker porque `billing` empeoró de 294.7 s a
363.4 s (+23.3 %). También se descartaron cuatro workers: el beneficio no está
respaldado por una medición de memoria/estabilidad y duplicaría la concurrencia
en los equipos Windows que motivaron la segmentación.

## QA, impresión y bundle

- Axe: minor 0, moderate 0, serious 0, critical 0; 191 nodos incomplete clasificados; 0 sin clasificar.
- Computed styles: 1,258 superficies; 0 radios distintos de `0px`; 0 overflow.
- Consola/red: 0 `console.error`, 0 `pageerror`, 0 `requestfailed`, 0 endpoints inesperados.
- Impresión: 18/18 PDFs para Carta, Media Carta, A5, 80 mm, 58 mm y 190×140 mm; original, primera y segunda copia.
- Bundle lazy justificado: AG Grid 845.9 KiB raw/234.3 KiB gzip; reportes/ECharts 600.6 KiB raw/200.1 KiB gzip. Ninguno forma parte del arranque.

## Eliminación legacy

Línea base 177 violaciones/406 archivos. Resultado inventory/strict/final: 0/333. `src/components/ui` y `src/components/shared`: eliminados. Dependencias reemplazadas e imports prohibidos: 0. Archivos o símbolos `Compat|Legacy|Old|V1`: 0. Ramas runtime específicas de test: 0. APIs estáticas Ant Design de feedback: 0. Warnings deprecados Ant Design: 0.

## Integración

Refactor base integrado: `959c635e513a98aa4d2993691ea907aa24f03606`. Campaña UX operativa integrada desde `codex/operational-ux-refactor` en `main` mediante `a262fccf983d0f47795aee6ebdf01b723d5b5908`, con `9985c58f` como segundo padre. El árbol del merge coincide exactamente con el árbol certificado de la rama. Todos los gates de esta tabla se ejecutaron nuevamente sobre `main` después del merge.

## Bloqueos externos

- `E2E_RELEASE_PASSWORD_present=False`; `E2E_SEED_PASSWORD_present=False`. El comando termina antes de sembrar datos con “E2E release password is required”. **BLOQUEO EXTERNO: NO SE PROPORCIONÓ E2E_RELEASE_PASSWORD NI E2E_SEED_PASSWORD**.
- No existe impresora física accesible. **VALIDACIÓN FÍSICA EN IMPRESORA PENDIENTE POR HARDWARE EXTERNO**.
