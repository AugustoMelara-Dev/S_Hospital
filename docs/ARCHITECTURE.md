# Arquitectura De S_Hospital

S_Hospital es una aplicacion offline LAN para caja hospitalaria, facturacion,
pagos, reportes, catalogo, respaldos y recibos institucionales.

## Stack Real

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Radix/shadcn-style UI.
- Estado remoto: TanStack Query con `src/lib/api/*` como cliente por dominio.
- Backend: Laravel 12, PHP 8.2+, Sanctum stateful cookies, Spatie Permission.
- Base de datos: MySQL/MariaDB local.
- Produccion LAN: backend PHP-FPM, nginx, MariaDB, queue-worker, scheduler y
  Soketi para eventos locales cuando esta configurado.

## Capas

- `backend/routes/api.php`: contrato HTTP del API.
- `backend/app/Http/Requests`: validacion y autorizacion inicial.
- `backend/app/Actions`: casos de uso y reglas de negocio transaccionales.
- `backend/app/Policies`: permisos de dominio.
- `backend/app/Models`: modelos Eloquent y relaciones.
- `frontend/src/lib/api`: cliente API por dominio y contratos TypeScript.
- `frontend/src/hooks`: hooks TanStack Query por modulo.
- `frontend/src/components/ui`: componentes base reutilizables.
- `frontend/src/features`: pantallas y componentes de modulo.

## Modulos Criticos

- Facturacion: facturas, items, eritropoyetina, numeracion fiscal y recibo.
- Caja: apertura, pagos, cierre, movimientos y diferencias.
- Reportes: dashboard, cierre diario, ejecutivo, categorias, areas, servicios.
- Catalogo: categorias, areas, servicios y snapshots historicos.
- Seguridad: usuarios, roles, permisos, auditoria e idempotencia.
- Operacion: respaldos, estado del sistema, logs sanitizados y soporte.

## Reglas De Integracion

- El backend decide totales, impuestos, permisos y estados finales.
- El frontend puede previsualizar, pero no es fuente fiscal de verdad.
- Mutaciones criticas deben usar transacciones, idempotencia y auditoria.
- Las respuestas JSON siguen `{ data }` o `{ data, meta }`; errores usan
  `message`, `errors` y, cuando aplique, `code`.
- El sistema no debe requerir internet para operar en produccion.
