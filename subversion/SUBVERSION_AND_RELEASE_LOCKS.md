# Subversion and Release Locks

## Proposito

Esta carpeta define como congelar, versionar y entregar el producto sin convertir la fase final en una mezcla de cambios imposibles de revisar.

No reemplaza Git. En este proyecto, "subversion" significa control interno de subversiones de entrega: ramas, tags, evidencias, gates y reglas para decidir que se puede enviar.

## Versiones de entrega

| Subversion | Alcance | Estado esperado |
| --- | --- | --- |
| `v0.12a-shell` | App shell, sidebar, topbar, rutas y sistema visual base | Navegacion profesional validada |
| `v0.12b-pos` | POS de nueva factura con categorias, busqueda y carrito | Facturacion rapida validada |
| `v0.12c-catalog-scan` | Catalogo con categorias y codigos de scanner/QR | Servicios agregables por texto/codigo |
| `v0.12d-reports` | Reportes avanzados gerenciales | KPIs, filtros, tablas y CSV |
| `v0.12e-release` | QA final, demo y readiness | Entrega demostrable |

## Ramas

Todas las subversiones deben salir de ramas `codex/*`.

Ramas sugeridas:

- `codex/phase-12a-app-shell-design-system`
- `codex/phase-12b-pos-billing-ux`
- `codex/phase-12c-catalog-barcode`
- `codex/phase-12d-advanced-reports`
- `codex/phase-12e-final-ux-qa`

## Bloqueos de release

No se puede marcar una subversion como lista si ocurre cualquiera de estos puntos:

- La app vuelve a depender de una pantalla gigante para operar.
- El POS exige recorrer una lista larga de servicios.
- Hay botones visibles sin flujo real.
- Reportes no tienen filtros por fecha.
- Totales financieros se calculan solo en frontend como autoridad.
- El scanner/codigo promete funcionalidad sin backend o API.
- Backups no tienen evidencia de ejecucion/restauracion.
- No hay worklog ni checklist QA actualizado.

## Evidencia minima por subversion

Cada cierre debe agregar:

- Worklog en `worklogs/`.
- Checklist en `qa/` si aplica.
- Resultado de pruebas ejecutadas.
- Riesgos pendientes, si existen.
- Captura o descripcion del smoke manual si el navegador fue usado.

## Gates antes de merge a main

- `php artisan test --colors=never`
- `npm run build`
- `php artisan config:cache`
- Validacion manual o automatizada de `/up`, `/login` y `/verify-email`

## Regla de hotfix

Solo se permite push directo a main si el usuario declara hotfix explicito. Aun asi, el cambio debe quedar pequeno, probado y documentado en `worklogs/`.
