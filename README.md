# S_Hospital

Sistema hospitalario local para facturacion, caja, pagos, reportes, catalogo de servicios, recibos institucionales y respaldos. Esta preparado para trabajar sin internet en produccion: un servidor Windows ejecuta React, Laravel y MariaDB, y las estaciones acceden por navegador dentro de la LAN.

## Alcance operativo

- Facturas con nombre del paciente, precios historicos, impuestos, pagos, pendientes y anulaciones auditadas.
- Regla de eritropoyetina: L 25.00 o gratuita cuando se marca receta de dialisis.
- Caja con apertura, ingresos por metodo, reversos, cierre, monto esperado y diferencia.
- Recibo institucional PDF en Media carta, Carta o A5. El operador elige el papel; margenes, fuentes y escala son internos.
- Reportes ejecutivo, de caja y auditoria, con exportaciones PDF/Excel.
- Roles, permisos y bitacora de acciones sensibles.
- Respaldos locales cifrados, manuales y programados.

No es un expediente clinico electronico ni una contabilidad financiera de partida doble. Los reportes controlan facturacion, cobros y caja. Los egresos operativos no se registran mientras no exista un modulo de egresos autorizado.

## Arquitectura

- Frontend: React 19, TypeScript estricto, Vite, TanStack Query, React Hook Form y Zod.
- API: Laravel 12, Sanctum, Policies, Actions/Services y transacciones de base de datos.
- Datos: MariaDB/MySQL; dinero persistido y calculado sin `float`.
- Produccion LAN: Nginx, PHP-FPM, MariaDB, worker, scheduler y Soketi dentro de Docker Compose.
- Operacion: no requiere internet despues de instalar el paquete offline.

## Requisitos

### Desarrollo

- Docker Desktop con Docker Compose v2.
- Git.
- Node.js y PHP no son obligatorios si todos los comandos se ejecutan en Docker.

### Servidor hospitalario

- Windows 10/11 o Windows Server de 64 bits.
- Docker Desktop activo, virtualizacion habilitada y al menos 5 GB libres.
- IP LAN fija o reserva DHCP.
- Perfil de red privada y acceso administrativo para configurar firewall.

## Desarrollo con Docker

1. Cree el entorno local:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Asigne valores locales no reutilizados en produccion a `DB_PASSWORD` y `DB_ROOT_PASSWORD`. Para esta pila de desarrollo no necesita completar los secretos de Soketi.

3. Levante los servicios e inicialice la base:

   ```powershell
   docker compose up -d
   docker compose exec backend php artisan migrate --seed
   ```

4. Abra:

   - Frontend: `http://127.0.0.1:5173`
   - API: `http://127.0.0.1:8000`

`migrate --seed` crea perfiles, serie institucional, catalogo y usuarios de validacion solamente cuando Laravel corre en `local` o `testing`:

- `admin.validacion` / `Password123!`
- `supervisor.validacion` / `Password123!`
- `cajero.validacion` / `Password123!`

Esas cuentas no se crean en `production` y nunca deben usarse en el hospital.

Para detener sin borrar datos:

```powershell
docker compose stop
```

No ejecute `down -v` sobre una instalacion con datos que deban conservarse.

## Variables de entorno

La plantilla raiz es [`.env.example`](.env.example). No contiene secretos. El instalador conserva valores existentes y genera los secretos vacios en la primera instalacion.

| Grupo | Variables | Uso |
|---|---|---|
| Aplicacion | `APP_KEY`, `APP_SCHEME`, `APP_PORT`, `SERVER_IP` | Cifrado de Laravel y URL final de la LAN. |
| Base de datos | `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | MariaDB interna. No se publica a la LAN. |
| Navegador | `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, `SESSION_LIFETIME`, `SESSION_SECURE_COOKIE` | Sesion y origen permitido. El instalador deriva IP y puerto. |
| Tiempo real | `PUSHER_APP_ID`, `PUSHER_APP_KEY`, `PUSHER_APP_SECRET`, `SOKETI_PORT` | Eventos internos de la LAN; no usan un servicio cloud. |
| Respaldos | `HOSPITAL_BACKUP_ENCRYPTION_KEY`, retenciones y horarios `HOSPITAL_*` | Cifrado, frecuencia y conservacion. La clave debe guardarse fuera del servidor. |
| Actualizaciones | `HOSPITAL_MIGRATION_BACKUP_CONFIRMED` | Confirma que existe un backup reciente antes de migrar una instalacion existente. |

En LAN HTTP controlada, `HOSPITAL_ALLOW_INSECURE_HTTP=1` documenta la excepcion y `SESSION_SECURE_COOKIE=false`. Con HTTPS, cambie `APP_SCHEME=https`, elimine la excepcion y use `SESSION_SECURE_COOKIE=true`.

## Instalacion recomendada en LAN

### Paquete offline

En una computadora tecnica con internet y Docker:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1
```

El resultado queda en `offline-release\` con compose, instalador, documentacion, checksums y todas las imagenes necesarias. Copie la carpeta completa al servidor, inicie Docker Desktop y ejecute como Administrador:

```powershell
.\setup.bat
```

El asistente:

1. diagnostica Windows, red, puertos, Docker y espacio;
2. detecta las imagenes offline y verifica su integridad;
3. pide la IP LAN y genera secretos locales;
4. inicia Nginx, Laravel, MariaDB, worker, scheduler y Soketi;
5. ejecuta migraciones y seeders base idempotentes;
6. crea el administrador inicial con contraseña temporal oculta;
7. configura firewall y comprueba `/up`.

El paquete offline solo ofrece Docker porque no incluye fuentes ni dependencias para una instalacion bare-metal.

### Instalacion desde el repositorio

En una maquina con internet tambien puede ejecutar `setup.bat` desde la raiz y elegir Docker. El mismo asistente construira las imagenes de produccion.

### Administrador inicial

No existe contraseña predeterminada de produccion. El instalador solicita una clave temporal de al menos 12 caracteres con mayuscula, minuscula, numero y simbolo, no la muestra y obliga a cambiarla en el primer inicio.

Si la instalacion fue automatizada y aun no hay administrador activo:

```powershell
$secure = Read-Host "Clave temporal" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:HOSPITAL_INITIAL_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    docker compose -f docker-compose.prod.yml exec -T -e HOSPITAL_INITIAL_ADMIN_PASSWORD backend php artisan auth:create-initial-admin --username=admin.hospital --email=admin@hospital.local --name="Administrador de Hospital"
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Item Env:\HOSPITAL_INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
```

No pase la clave con `--password` ni la escriba en scripts o historial de consola.

## Migraciones y seeders

Desarrollo completo:

```powershell
docker compose exec backend php artisan migrate --seed
```

Produccion manual, despues de un backup verificado:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan migrate --force
docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan db:seed --force
```

`DatabaseSeeder` es reproducible. En produccion carga permisos, papeles institucionales, serie de recibos y catalogo; `DevelopmentValidationSeeder` se autoexcluye fuera de `local/testing`.

## Comandos de trabajo

Backend:

```powershell
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
```

Frontend:

```powershell
docker compose exec frontend npm run dev
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run test:coverage:check
docker compose exec frontend npm run build
```

E2E mockeado mantenido:

```powershell
docker compose exec frontend npx playwright test
```

E2E de release con backend real requiere PHP y dependencias locales, y una clave desechable en variable de entorno:

```powershell
$env:E2E_RELEASE_PASSWORD = "ClaveDesechable123!"
Set-Location frontend
npm run e2e
```

El E2E de MariaDB limpio esta en `scripts\run_release_e2e_mariadb.ps1` y exige `-SeedPassword` o `E2E_RELEASE_PASSWORD`.

La matriz administrativa `e2e/refactor-total.spec.ts` solo se habilita contra
un servidor real cuando se provisionan `REFACTOR_TOTAL_E2E_USERNAME` y
`REFACTOR_TOTAL_E2E_PASSWORD` con una cuenta temporal. No contiene credenciales
predeterminadas y se omite con una razon explicita si faltan esas variables.

## Build y operacion productiva

Construir y arrancar manualmente desde fuentes:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env build
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml --env-file .env ps
```

Acceso esperado:

- Servidor: `http://localhost:8000`
- Clientes: `http://IP-FIJA-DEL-SERVIDOR:8000`

No exponga el puerto de MariaDB a la LAN. Permita solo el puerto web y Soketi si la configuracion final lo requiere. Use una UPS y copie respaldos cifrados a un medio externo controlado.

## Respaldos, restauracion y actualizaciones

Crear backup manual:

```powershell
docker compose -f docker-compose.prod.yml exec -T backend php artisan hospital:backup --type=manual
```

Antes de una actualizacion, confirme un respaldo cifrado exitoso y siga [docs/backup-restore-runbook.md](docs/backup-restore-runbook.md). Nunca restaure primero sobre produccion: valide en una base descartable.

## Verificacion de entrega

Preflight del servidor:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://IP-DEL-SERVIDOR:8000
```

El preflight detecta la instalacion Docker oficial y valida que `mysql`,
`backend`, `nginx`, `queue-worker` y `scheduler` esten corriendo. Para una pila
aislada use tambien `-EnvFile RUTA_ENV -RuntimeMode Docker -DockerProject NOMBRE`.

Las pruebas automatizadas no sustituyen estas aceptaciones en sitio:

- abrir el sistema desde una segunda PC de la LAN;
- imprimir una factura/recibo real en Media carta, Carta y A5;
- comprobar corte, orientacion y legibilidad en la impresora del hospital;
- ejecutar y restaurar un respaldo de prueba;
- validar numeracion fiscal y datos institucionales con la administracion responsable.

## Documentacion

- [Arquitectura y decisiones del refactor](docs/superpowers/specs/2026-07-09-s-hospital-total-rewrite-design.md)
- [Runbook de backup y restauracion](docs/backup-restore-runbook.md)
- [Reporte vivo de pruebas](docs/testing-report.md)
- [Changelog](CHANGELOG.md)
