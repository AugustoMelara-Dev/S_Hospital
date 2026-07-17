# Decisiones de versiones de librerías frontend

Fecha de verificación: **2026-07-12**. Alcance: investigación de Fase 0; no implica instalar ni actualizar paquetes.

## Contexto comprobado

El `frontend/package.json` declara React `^19.0.0`, TypeScript `^5.0.0`, Vite `^8.0.16` y Vitest `^4.1.6`. El entorno de consulta fue Node `22.18.0` y npm `11.6.2`. Existen simultáneamente `package-lock.json` y `pnpm-lock.yaml`; debe elegirse un único gestor antes de cualquier actualización para que la instalación offline sea reproducible.

La búsqueda de imports en `frontend/src` y `frontend/.storybook` encontró uso real de Ant Design y Storybook. No encontró imports de AG Grid, ECharts ni Day.js; por tanto, su recomendación es condicional a que exista un caso de uso aprobado. Recharts ya cubre actualmente los gráficos de reportes.

Las versiones “vigentes” se comprobaron contra el registro npm el 2026-07-12. Los tamaños de bundle son **aproximaciones gzip orientativas**, no garantías: dependen de imports, módulos, minificador y datos de la aplicación. `dist.unpackedSize` de npm mide el paquete instalado sin comprimir y no equivale al bundle servido.

## Matriz de decisión

| Librería | Actual | Estable evaluada / recomendada | Compatibilidad y decisión | Licencia | Bundle de producción aproximado |
|---|---:|---:|---|---|---:|
| `antd` | 6.3.2 | 6.5.0 / **6.5.0** | Peer React/DOM `>=18`; compatible con React 19, TS 5 y Vite 8. Actualizar dentro de v6 después de pruebas visuales. | MIT | ~150–300 kB gzip con imports usados; puede crecer según componentes/locales |
| `@ant-design/icons` | 5.5.2 | 6.3.2 / **6.3.2** | **Bloqueante actual:** Ant Design 6 exige icons `>=6`; icons 6 no es compatible con antd 5. Subir ambos coordinadamente e importar iconos individuales. | MIT | ~1–5 kB gzip por icono; importar el catálogo completo puede añadir cientos de kB |
| `ag-grid-community` + `ag-grid-react` | 33.0.4 | 36.0.0 / **36.0.0 solo si se usará** | React 19 está en peers. AG Grid 36 exige TS `>=5.8.3`; el rango `^5.0.0` lo permite, pero debe fijarse/verificarse una versión efectiva >=5.8.3. Mantener ambos paquetes exactamente alineados. Si sigue sin imports, remover en una fase separada es preferible a actualizar. | MIT (Community) | ~150–300 kB gzip con módulos elegidos; `AllCommunityModule` puede ser mayor |
| `echarts` | 5.6.0 | 6.1.0 / **6.1.0 solo si sustituye justificadamente a Recharts** | Agnóstico de React; tipos incluidos y ESM apto para TS5/Vite8. Integración recomendada: wrapper propio con `echarts/core`, `echarts/charts`, `echarts/components`, renderer explícito y `echarts.use`; evitar sumar otro wrapper salvo necesidad real. | Apache-2.0 | ~120–250 kB gzip modular típico; import completo ~350–500 kB |
| `echarts-for-react` (no instalado) | — | 3.0.6 / **no añadir por ahora** | Peers admiten ECharts 6 y React >=16, pero un wrapper local pequeño controla `init`, `setOption`, `resize` y `dispose`, reduce otra dependencia y facilita lazy loading. Evaluarlo solo si reduce código probado. | MIT | wrapper ~2–5 kB gzip, además de ECharts |
| `dayjs` | 1.11.13 | 1.11.21 / **1.11.21 solo si se usa** | Sin peers; funciona con TS5/Vite8/React19. API inmutable y plugins/locales explícitos. Al no haber imports, no actualizar por inercia: retirar o documentar el uso futuro. | MIT | núcleo ~2–3 kB gzip; plugins/locales aumentan el total |
| Storybook (`storybook`, `@storybook/react`, `@storybook/react-vite`) | 10.5.0 | 10.5.0 / **mantener 10.5.0** | `react-vite` declara React 16.8–19, Vite 5–8 y TS >=4.9. Storybook 10 es ESM-only y requiere Node 20.19+ o 22.12+. Las versiones núcleo/framework/addons deben quedar alineadas. | MIT | **0 kB en app productiva**; herramienta de desarrollo/build estático |
| `@storybook/addon-vitest` | 10.5.0 | 10.5.0 / **mantener 10.5.0** | Admite Vitest 3/4 y browser packages 4; el proyecto usa Vitest 4.1.x y Playwright. Requiere framework Vite. Separar proyecto Vitest de Storybook evita mezclar configuración de tests. | MIT | 0 kB en app productiva |
| `@storybook/addon-a11y` + `axe-core` | 10.5.0 + ^4.12.0 | 10.5.0 + 4.12.0 / **mantener** | Integración oficial; configurar `parameters.a11y.test = 'error'` para que CI falle. Axe detecta automáticamente solo una parte de WCAG y no reemplaza revisión manual/teclado/lector de pantalla. | MIT + MPL-2.0 | 0 kB en app productiva; coste solo en Storybook/tests |

En npm también se verificaron `storybook`, `@storybook/react-vite`, `@storybook/addon-vitest` y `@storybook/addon-a11y` en 10.5.0. Conviene evitar rangos mezclados (`10.5.0` y `^10.5.0`) en una futura fase: fijar la misma versión exacta reduce instalaciones divergentes en el servidor offline.

## Breaking changes y validaciones requeridas

### Ant Design 6.3.2 → 6.5.0 e icons 5 → 6

- Corregir primero el desalineamiento icons 5/antd 6. Ant Design indica que v6 requiere `@ant-design/icons >=6.0.0`.
- No se necesita el parche de React 19 usado por Ant Design 5.
- Ant Design 6 cambió estructuras DOM internas, margen final de `Tag` y comportamiento de `Form.List` para hijos no registrados. Revisar CSS que alcance nodos internos, snapshots, formularios, dropdowns, modales y recibos.
- Criterio mínimo: typecheck, tests críticos, build, Storybook y regresión visual/teclado en login, shell y caja.

### AG Grid 33 → 36

- v36 eleva TypeScript mínimo a 5.8.3 y añade la dependencia compartida `ag-stack`.
- El row model cliente pasa al núcleo; `ValidationModule` ya no viene en `AllCommunityModule`. Activar `enableDevValidations()` únicamente en desarrollo.
- Desde 35.1 existe `AgGridProvider`; registrar módulos específicos mantiene el bundle menor. Revisar overlays, tooltips, filtros de fecha, agregación, scroll y el cambio de `suppressContentVisibilityAuto`.
- Antes de migrar, confirmar que realmente se adoptará AG Grid. Hoy no hay imports; agregar pruebas de tabla (teclado, paginación, orden, filtros y exportación permitida) antes de reemplazar las tablas existentes.

### ECharts 5 → 6

- El tema predeterminado cambió en v6, por lo que snapshots y contraste visual pueden variar.
- Usar imports tree-shakeable y registrar explícitamente charts, componentes, features y `CanvasRenderer` o `SVGRenderer`. Canvas es preferible para volúmenes altos; SVG puede servir para gráficos pequeños y nítidos.
- El wrapper React propio debe hacer `dispose()` al desmontar, observar el tamaño del contenedor, evitar recreaciones y permitir carga dinámica por ruta. No mantener ECharts y Recharts para la misma función sin una decisión explícita.

### Storybook 10 + Vite 8 + Vitest 4 + axe

- Storybook 10 distribuye ESM únicamente; `.storybook/main.ts` y presets deben ser ESM válidos. El proyecto ya usa `type: module` y Node 22.18 satisface el mínimo.
- `addon-vitest` transforma stories en pruebas y recomienda Browser Mode con Chromium/Playwright. Con Vitest >=4 se recomienda un proyecto separado para Storybook.
- `addon-a11y` usa axe y se integra con addon-vitest, pero solo produce fallos CI si `parameters.a11y.test` está en `error`.
- Revisar por separado `@storybook/addon-mcp` y `@chromatic-com/storybook`: no forman parte de esta decisión y podrían contrariar la operación estrictamente offline si un flujo exige servicios externos. Storybook local, Vitest, axe y Playwright sí pueden ejecutarse offline una vez precargados paquetes y navegadores.

## Política offline propuesta

Todas las librerías recomendadas se ejecutan localmente y no requieren SaaS en producción. La instalación/build sí requiere artefactos previamente disponibles. Para una liberación LAN reproducible:

1. Elegir npm o pnpm y conservar un solo lockfile.
2. Fijar versiones exactas aprobadas, descargar dependencias y binarios Playwright en la preparación conectada, y guardar un mirror/cache o artefacto de build verificable.
3. Ejecutar `npm ci --offline` solo si el cache fue poblado y probado; nunca depender de CDN para JS, CSS, iconos, fuentes o locales.
4. Servir únicamente el bundle Vite compilado desde el servidor LAN. Storybook no es requisito del runtime hospitalario y no debe exponerse en producción.
5. Registrar hashes/SBOM y conservar avisos de licencias. En particular, axe-core es MPL-2.0; las demás licencias se indican en la matriz.

## Recomendación ejecutiva

1. **Corregir en la siguiente fase** `@ant-design/icons` a 6.3.2 y evaluar `antd` 6.5.0 como una unidad, con regresión visual.
2. **Mantener** Storybook 10.5.0 y sus addons oficiales alineados; completar la configuración Vitest Browser/a11y si aún no está validada.
3. **No instalar ni migrar todavía** AG Grid 36 ni ECharts 6: primero aprobar su uso frente a las tablas actuales y Recharts. Si no se usarán, retirar AG Grid, ECharts y Day.js en commits separados tras confirmar que no hay carga dinámica o referencias fuera de `src`.
4. Medir bundles reales con el script existente `budget:bundle`; sustituir estas aproximaciones por resultados de producción antes de aceptar cada cambio.

## Addendum de implementacion - 2026-07-17

La investigacion inicial de este documento quedo superada por la implementacion comprobada en el repositorio:

- `antd` 6.5.0 y `@ant-design/icons` 6.3.2 ya estan alineados y en uso productivo; no se agrego ninguna dependencia para la convergencia UI.
- AG Grid 36.0.0 y ECharts 6.1.0 tienen adaptadores institucionales y uso real. Ambos permanecen en chunks asincronos; no deben reemplazarse por componentes Ant menos especializados.
- Ant Design es la frontera obligatoria para interaccion. Tailwind conserva layout y tokens; HTML semantico se mantiene para documentos, impresion y grids compactos sin comportamiento avanzado.
- El gate final audita 340 archivos y reporta 0 controles o tablas de aplicacion fuera de la politica.
- La medicion de produccion final es 326.6 KiB gzip de inicio y 1061.5 KiB gzip total, bajo limites de 488.3 y 1074.2 KiB respectivamente.
- Ant `Table`/`List` se descarto para la matriz de permisos y la cuenta actual: una implementacion equivalente elevo el total a 1107.3 KiB gzip. Los grids ARIA ligeros preservan accesibilidad y reducen 45.8 KiB gzip.
- `Card`/`Statistic` tampoco se fuerzan sobre wrappers puramente presentacionales. La convergencia busca consistencia funcional y accesible, no aumentar dependencias de runtime donde HTML semantico es mas simple.

Esta adenda reemplaza las recomendaciones condicionales anteriores sobre adopcion o retiro de AG Grid, ECharts y Day.js cuando contradigan el codigo y las mediciones actuales. La fuente de verdad sigue siendo `package.json`, los imports, los adaptadores, los tests y el reporte de bundle vigentes.

## Fuentes oficiales y registro

- Ant Design: [migración v5 a v6](https://ant.design/docs/react/migration-v6/) y [npm: antd](https://www.npmjs.com/package/antd), [npm: @ant-design/icons](https://www.npmjs.com/package/@ant-design/icons).
- AG Grid: [compatibilidad React/TypeScript](https://www.ag-grid.com/react-data-grid/compatibility/), [migración a v36](https://www.ag-grid.com/react-data-grid/upgrading-to-ag-grid-36/), [módulos](https://www.ag-grid.com/react-data-grid/modules/), [instalación](https://www.ag-grid.com/react-data-grid/installation/), [npm: community](https://www.npmjs.com/package/ag-grid-community) y [npm: React](https://www.npmjs.com/package/ag-grid-react).
- Apache ECharts: [imports modulares](https://echarts.apache.org/handbook/en/basics/import/), [migración v5 a v6](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/), [Canvas frente a SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/), [npm: echarts](https://www.npmjs.com/package/echarts) y [npm: echarts-for-react](https://www.npmjs.com/package/echarts-for-react).
- Day.js: [documentación](https://day.js.org/docs/en/installation/installation), [TypeScript](https://day.js.org/docs/en/installation/typescript) y [npm](https://www.npmjs.com/package/dayjs).
- Storybook: [migración a Storybook 10](https://storybook.js.org/docs/releases/migration-guide), [addon Vitest](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon), [pruebas de accesibilidad](https://storybook.js.org/docs/writing-tests/accessibility-testing) y paquetes npm [`storybook`](https://www.npmjs.com/package/storybook), [`@storybook/react-vite`](https://www.npmjs.com/package/@storybook/react-vite), [`@storybook/addon-vitest`](https://www.npmjs.com/package/@storybook/addon-vitest), [`@storybook/addon-a11y`](https://www.npmjs.com/package/@storybook/addon-a11y).
