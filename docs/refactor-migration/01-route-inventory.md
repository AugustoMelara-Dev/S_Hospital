# Inventario de rutas

Fuente: `php artisan route:list`, `frontend/src/navigation/appNavigation.ts` y `frontend/src/App.tsx`, inspeccionados el 2026-07-21.

## Frontend

| Ruta | Módulo | Acceso principal | Carga |
|---|---|---|---|
| `/login` | autenticación | pública | diferida |
| `/verify-email` | autenticación | sesión pendiente | diferida |
| `/dashboard` | inicio | autenticado | diferida |
| `/billing/new` | facturación | `invoices.create`, catálogo, caja, pagos y recibos | diferida |
| `/cashbox` | caja | `cash.view` | diferida |
| `/catalog` | catálogo | `catalog.view` | diferida |
| `/invoices` | historial | `invoices.view` | diferida |
| `/reports` | reportes | permiso ejecutivo, caja o auditoría | diferida |
| `/backups` | respaldos | `backups.view` | diferida |
| `/settings/fiscal` | configuración | fiscal u operativa | diferida |
| `/settings/institutional-receipts` | recibos | `receipt_settings.view` | diferida |
| `/admin/users` | usuarios | `users.view` | diferida |
| `/help` | ayuda | autenticado | diferida |
| `/support` | soporte | autenticado | diferida |
| `/about` | acerca de | autenticado | diferida |

El registro de navegación es la fuente única para sidebar, command palette, título y breadcrumbs. Las rutas sin coincidencia caen en el estado de ruta desconocida. La shell agrupa operación, administración y asistencia.

## Backend

Laravel registra 115 rutas: 71 `GET|HEAD`, 30 `POST`, 8 `PATCH`, 4 `PUT`, 1 `DELETE` y 1 ruta combinada `GET|POST|HEAD`. Además de servir la SPA, los grupos API descubiertos son:

- autenticación, sesión, verificación y perfil;
- roles, permisos y usuarios;
- áreas, categorías y servicios;
- facturas, anulaciones, reversos y detalle;
- pagos y reversos;
- sesiones, movimientos, arqueo y cierre de caja;
- configuración fiscal y secuencias;
- configuración, preview, emisión, PDF y eventos de recibos institucionales;
- reportes ejecutivos, operativos, caja y auditoría, con PDF/Excel;
- backups, descarga y estado;
- health, estado del sistema, auditoría, errores cliente, realtime y OpenAPI.

## Matriz de revisión

Cada ruta visible debe demostrar: autorización de servidor, loading, vacío, error y éxito cuando aplique; teclado/foco; 320, 360, 390, 768, 1024, 1366, 1440 y 1920 px; ausencia de overflow y errores de consola/red. La evidencia final se indexará en `08-responsive-evidence.md` y `evidence/screenshots/`.

Estado final: las 15 rutas frontend están implementadas sobre la shell/shadcn. La matriz visible certificó 14 rutas y estados representativos —incluidos acceso denegado, ruta inexistente y modo oscuro— en seis viewports; `/verify-email` conserva sus pruebas de componente y flujo de autenticación. La evidencia reproducible está en `08-responsive-evidence.md` y `evidence/`.
