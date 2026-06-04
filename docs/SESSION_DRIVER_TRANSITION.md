# Transicion de SESSION_DRIVER dev -> prod

> Guia operativa para evitar perder sesiones cuando un servidor local
> se promueve a produccion offline LAN.

## Estado por defecto

| Entorno | Driver | Persistencia | Ubicacion |
|---|---|---|---|
| `local` (desarrollo) | `file` | Disco del contenedor | `backend/storage/framework/sessions` |
| `testing` (PHPUnit) | `array` | Memoria (se pierde cada test) | N/A |
| `production` (hospital) | `database` | Tabla `sessions` en MariaDB | N/A |

El backend usa `config/session.php` con el driver controlado por
`SESSION_DRIVER`. El compose de produccion fija `database` y exige
`SESSION_ENCRYPT=true` para que Sanctum pueda manejar cookies cifradas.

## Pasos para promover un servidor

1. Antes de promover, cierre todas las cajas activas. Las sesiones
   abiertas con `SESSION_DRIVER=file` se perderan al cambiar a
   `database`.
2. Detenga el stack con `docker compose -f docker-compose.prod.yml down`.
3. Cambie `APP_ENV=production`, `SESSION_DRIVER=database` y
   `SESSION_ENCRYPT=true` en `.env` (o use el instalador LAN
   `scripts/deploy_hospital_lan.ps1`, que fija esos valores).
4. Levante el stack: `docker compose -f docker-compose.prod.yml up -d`.
5. Corra las migraciones (incluye la tabla `sessions` que Laravel
   instala por defecto desde `0001_01_01_000001_create_cache_table.php`
   y las migraciones de Sanctum).
6. Ejecute `php artisan config:cache` dentro del contenedor backend.
7. Verifique que `/up` y `/login` respondan 200 desde una PC cliente.
8. Si quedo personal con sesion abierta, que cierren sesion y vuelvan
   a autenticarse; las cookies previas con `SESSION_DRIVER=file` ya
   no son validas.

## Compatibilidad hacia atras

- Una cookie emitida con `SESSION_DRIVER=file` no se reconoce con
  `SESSION_DRIVER=database`. Esto es intencional: previene el
  re-uso de sesiones antiguas tras la promocion.
- Si un operador reporta "pantalla que se queda cargando" tras
  promover, es porque su cookie previa quedo invalida. Indique
  cerrar el navegador, borrar cookies y volver a entrar.

## Diagnostico

- `php artisan tinker --execute="echo config('session.driver');"`
  imprime el driver activo.
- `GET /api/system/status` (campo `runtime.session_driver`) lo
  expone en el panel administrativo.
- `php artisan session:clear` borra sesiones persistidas (util
  para limpiar sesiones huerfanas tras incidentes).

## Por que no se usa Redis

El stack LAN hospitalario no debe depender de infraestructura
adicional. La tabla `sessions` de MariaDB cumple el mismo rol con
un costo despreciable a la escala de 5 cajeros y soporta
`SESSION_ENCRYPT=true` para confidencialidad en reposo.

## Auto-recovery del queue-worker

El servicio `queue-worker` del compose de produccion corre dentro
de un bucle `while true` que reinicia el worker cada 200 jobs o 1
hora. Esto evita que un proceso PHP de larga duracion acumule
memoria y rompe cualquier deadlock colgante. Ademas:

- `restart: unless-stopped` en Docker lo reinicia si el proceso
  muere por un crash externo.
- El healthcheck falla el contenedor si en la ultima hora hubo
  mas de 5 jobs en `failed_jobs` de la cola `backups`, lo que
  hace que Docker levante una instancia nueva.
