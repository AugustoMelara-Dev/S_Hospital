# Final UX Acceptance Checklist

Estado: **PRODUCTION_CANDIDATE** al 2026-05-18.

Los bloqueos UX de `docs/12_CORRECTED_FINAL_PRODUCT_PLAN.md` quedaron cerrados por las fases 12A0-12E. Este checklist no declara `PRODUCTION_READY`: siguen pendientes la validacion desde cliente LAN fisico, impresora institucional fisica media carta/carta/A5 y configuracion final de produccion.

## App shell
- [x] Sidebar visible.
- [x] Topbar con usuario, caja, fecha/hora local y estado servidor/LAN visible.
- [x] Rutas separadas.
- [x] Layout tablet/movil sin enterrar el contenido despues de una pantalla completa de navegacion.
- [x] Errores operativos visibles inline o toast, no solo en footer/status.
- [x] App.tsx reducido a composicion de providers/router.

## Facturacion
- [x] Categorias visibles.
- [x] Buscador visible.
- [x] Campo de identificador de servicio visible cuando corresponde.
- [x] Carrito visible.
- [x] No lista interminable por defecto.
- [x] Eritropoyetina clara.
- [x] Confirmacion antes de emitir.
- [x] Confirmacion antes de cobrar.
- [x] Flujo principal claro: cobrar y emitir con caja abierta, o emitir pendiente como accion secundaria explicita.
- [x] CTA claro para abrir caja si no hay caja abierta.

## Caja
- [x] Cierre de caja con esperado, contado, diferencia, pagos/movimientos y confirmacion.
- [x] Diferencia distinta de cero exige nota o confirmacion reforzada.
- [x] Pagos no pueden operar sobre facturas ajenas por ID.

## Catalogo
- [x] Tabla profesional basada en componente compartido.
- [x] Filtros.
- [x] Crear/editar por permisos.
- [x] Identificadores de servicio administrables por permisos.
- [x] Estados de error/empty/loading consistentes.

## Reportes
- [x] KPIs gerenciales completos.
- [x] Filtros por fecha, cajero, categoria, metodo, estado y caja.
- [x] Tablas exportables con permiso `reports.export`.
- [x] Anulaciones con motivo/usuario/fecha.
- [x] Reimpresiones con usuario/factura/fecha.
- [x] Backups ejecutados/fallidos/ultima verificacion.
- [x] Grafico con Recharts para servicios mas vendidos.

## Diseno
- [x] Componentes base consistentes en pantallas principales.
- [x] Tipografia base consistente.
- [x] Colores base consistentes.
- [x] Estados vacios/loading/error por modulo.
- [x] Responsive validado en navegador para desktop/tablet/mobile.

## QA
- [x] Unit/feature tests backend.
- [x] Frontend tests.
- [x] E2E en ambiente controlado de validacion local.
- [x] Smoke real contra Laravel/API definido como gate separado de la evidencia controlada.
- [x] Smoke real mutacional apagado por defecto; requiere `E2E_REAL_ALLOW_MUTATIONS=1` para crear/cobrar una factura real contra DB.
- [x] Browser smoke con cero `console.error`, `pageerror` y requests fallidas inesperadas.
- [x] Build.
- [x] Guion de validacion actualizado con evidencia honesta.

## Evidencia de cierre Fase 12

- `php artisan test --colors=never`: 124 tests / 724 assertions OK.
- `php artisan config:cache`: OK.
- `npm.cmd run test`: 20 tests OK.
- `npm.cmd run lint`: OK.
- `npm.cmd run build`: OK.
- `npm.cmd run smoke:real` con `E2E_REAL_BASE_URL`, `E2E_REAL_LOGIN` y `E2E_REAL_PASSWORD`: smoke real no destructivo OK; flujo mutacional omitido por defecto.
- `frontend/e2e/real-smoke.spec.ts` mantiene rojo cualquier `401`, `419`, CORS o request fallida inesperada; solo ignora el abort benigno de `/sanctum/csrf-cookie`.

## Limites que siguen fuera del cierre UX

- `PENDING_LAN_CLIENT_VALIDATION`: prueba completa desde otra computadora cliente en la LAN final.
- `PENDING_HARDWARE_VALIDATION`: impresion real media carta/carta/A5 en la impresora fisica.
- `PENDING_ENVIRONMENT_VALIDATION`: `.env` final con `APP_ENV=production`, `APP_DEBUG=false`, admin real, tarea continua de respaldos y `config:cache` en servidor.
