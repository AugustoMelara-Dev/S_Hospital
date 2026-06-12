# F2 - Estado compartido, query keys, readiness y caja

Fecha: 2026-06-11

## Objetivo

Cerrar la primera capa de coherencia operativa entre Dashboard, Caja, Configuracion y Respaldos sin entrar en rediseño visual amplio.

## Inventario de query keys

### Antes

- Query keys dispersas y mezcladas en hooks/vistas:
  - `['cash', 'current-session']`
  - `['cash-sessions', 'current']`
  - `['dashboard']` invalidado por realtime, pero sin query real asociada
  - keys inline para settings, backups, invoices y catalogo
- Dashboard cargado con estado local e `apiClient.getDashboardReport()` fuera de TanStack Query.
- `BackupsView`, `AboutView` y `useServerStatus` hacian fetch manual por caminos distintos.

### Despues

- Registro central en `frontend/src/lib/queryKeys.ts`:
  - `queryKeys.categories.*`
  - `queryKeys.services.*`
  - `queryKeys.invoices.*`
  - `queryKeys.cashSessions.*`
  - `queryKeys.settings.*`
  - `queryKeys.fiscalSequences.*`
  - `queryKeys.reports.*`
  - `queryKeys.backups.*`
  - `queryKeys.system.*`
  - `queryKeys.audit.*`
- Dashboard ahora usa `queryKeys.reports.dashboard()`.
- Caja actual y readiness usan la misma key: `queryKeys.cashSessions.current()`.
- Salud y estado del servidor comparten:
  - `queryKeys.system.health()`
  - `queryKeys.system.status()`

## Fuente real de readiness

`useSystemReadiness()` ahora se arma desde fuentes backend reales y persistentes:

- `/api/system/setup-status`
- `/api/settings/fiscal`
- `/api/fiscal-sequences`
- `/api/cash-sessions/current`
- `/api/system/status`

No se usa `localStorage` para readiness, caja, fiscal ni auditoria.

## Invalidaciones y refresh

- Catalogo:
  - `invalidateCatalogQueries()` invalida categorias, servicios y setup status.
- Facturacion/POS/Caja/Dashboard:
  - `invalidateBillingQueries()` invalida facturas, caja y dashboard.
  - Se ejecuta despues de abrir/cerrar caja, registrar pagos, anular facturas y eventos realtime relevantes.
- Configuracion:
  - `invalidateSettingsQueries()` invalida settings, secuencias y estado de sistema.
- Respaldos:
  - `invalidateBackupQueries()` invalida respaldos y estado de sistema.

## Vistas alineadas

- Dashboard:
  - ya no usa fetch local aislado; consume `useDashboardReport()`.
- Caja:
  - escribe y relee `queryKeys.cashSessions.current()`.
- Respaldos:
  - consume `useBackups()` + `useSystemStatusSnapshot()`.
- Informacion del sistema:
  - consume `useBackups()` + `useSystemStatusSnapshot()`.
- Estado LAN/login/topbar:
  - consume `useServerStatus()` basado en `queryKeys.system.health()`.

## Evidencia visual

- `qa/screenshots/after/f2-dashboard.png`
- `qa/screenshots/after/f2-cashbox.png`
- `qa/screenshots/after/f2-backups.png`
- `qa/screenshots/after/f2-settings-fiscal.png`
- `qa/screenshots/after/f2-browser-console.json`
- `qa/screenshots/after/f2-shared-state-report.json`

## Observaciones verificadas

- Dashboard y Caja coinciden en estado operativo de caja:
  - Dashboard: `CAJA Atencion Cerrada`
  - Caja: `Sin caja abierta`
- Dashboard muestra accion coherente con ese estado:
  - `Abrir caja`
- Respaldos muestra estado operativo real del entorno actual:
  - `ESTADO OPERATIVO Error`
  - `Worker inactivo`
- Configuracion fiscal sigue leyendo datos institucionales reales del backend.
- Consola final del navegador interactivo: `[]`

## Alcance tocado

- Centralizacion de query keys e invalidaciones.
- Reemplazo de fetches manuales duplicados por hooks compartidos.
- Polling real para respaldos pendientes.
- Pruebas frontend ajustadas al nuevo modelo de QueryClient compartido.

## Pendientes reales para continuar F2

- El entorno local actual muestra `Worker inactivo` en Respaldos; eso es estado operativo real, no contradiccion de frontend.
- `FiscalSettingsView` sigue usando estado local interno del formulario; funcional, pero todavia no migrado a un hook dedicado.
- No se toco shell visual amplio fuera de lo necesario para coherencia de estado.
