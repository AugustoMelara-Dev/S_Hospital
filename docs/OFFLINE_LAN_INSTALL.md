# Offline LAN Install - Sistema de Caja Hospitalaria

## Proposito

Este documento separa el entorno Docker de desarrollo de una instalacion de produccion offline LAN. Docker Compose facilita desarrollo reproducible, pero produccion no debe depender de descargar paquetes desde internet al arrancar.

## Topologia de produccion

- Una PC servidor ejecuta Laravel API, frontend compilado, MySQL/MariaDB y backups.
- Clientes usan navegador en la red local.
- Los clientes no deben usar `localhost` para entrar al sistema, porque `localhost` apunta a la computadora cliente.
- Usar IP fija o reservada del servidor, por ejemplo `http://192.168.1.10`.
- El despliegue recomendado para produccion es same-origin: frontend compilado y API publicados bajo la misma IP/puerto LAN.

## Desarrollo con Docker

El Compose base de desarrollo sirve para trabajo tecnico local y puede descargar/instalar dependencias durante preparacion:

```bash
docker compose config
docker compose up -d
```

Servicios:

- `backend`: Laravel en `http://localhost:8000` durante desarrollo local.
- El frontend compilado debe llamar a `/api` y `/sanctum` en el mismo host que sirve la aplicacion. No compilar el build LAN con `VITE_API_BASE_URL=http://localhost:8000`, porque los clientes entran por IP LAN fija del servidor.
- `frontend`: Vite React en `http://localhost:5173`.
- `mysql`: MariaDB local para desarrollo.

El servicio frontend puede ejecutar `npm install` y el backend puede ejecutar `composer install` al iniciar en desarrollo. Esa estrategia no es aceptable como requisito de produccion offline.

El paquete productivo offline usa `docker-compose.prod.yml` dentro de `offline-release` con imagenes Docker precargadas (`offline-images/*.tar`), checksums y frontend ya compilado. Ese Compose productivo no debe confundirse con el Compose de desarrollo.

### Variables de entorno Docker

- `backend/.env.example` es para instalacion local normal.
- `backend/.env.docker.example` es solo para Docker de desarrollo y usa `DB_HOST=mysql`.
- Docker Compose carga `backend/.env.docker.example` y, si falta `backend/.env`, crea una copia inicial para desarrollo.
- No copiar `backend/.env.example` dentro del contenedor Docker, porque sus valores locales como `DB_HOST=127.0.0.1` no sirven dentro de Compose.
- `php artisan key:generate --force` se ejecuta solo al crear el `.env` Docker inicial de desarrollo.
- Produccion offline LAN debe usar un `.env` real creado manualmente en el servidor, con secretos locales fuera de Git.

## Produccion offline LAN

Camino recomendado para instalacion hospitalaria: entregar y ejecutar solamente `offline-release\setup.bat` del paquete final validado. No usar el `setup.bat` de la raiz del repositorio en campo.

Antes de instalar en el hospital:

1. Preparar artefactos con internet en una maquina de build controlada.
2. Ejecutar `composer install --no-dev --optimize-autoloader` para backend.
3. Ejecutar `npm ci` y `npm run build` para frontend.
4. Copiar backend, `vendor/`, frontend compilado y configuracion al servidor.
5. Instalar MySQL/MariaDB local en el servidor.
6. Configurar `.env` real fuera del repositorio con secretos locales, `APP_ENV=production` y `APP_DEBUG=false`.
7. Configurar `APP_URL`, `SANCTUM_STATEFUL_DOMAINS` y CORS con la IP fija LAN final, por ejemplo `192.168.1.10`.
8. Generar `APP_KEY` en el servidor con `php artisan key:generate`.
9. Ejecutar migraciones aprobadas sin `migrate:fresh`.
10. Crear admin real con el instalador o con `php artisan auth:create-initial-admin` usando `HOSPITAL_INITIAL_ADMIN_PASSWORD`; no ejecutar seeders de desarrollo.
11. Ejecutar `php artisan config:cache`.
12. Publicar por IP fija LAN.
13. Levantar worker local de backups: en Docker offline queda como servicio `queue-worker`; en bare-metal queda como tarea/servicio PHP con `php artisan queue:work --queue=backups --tries=1 --timeout=600`.
14. Validar `/up`, `/login` y `/verify-email`.

Antes de entregar un paquete offline regenerado, ejecutar el guard de artefacto:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force
powershell.exe -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit
```

El guard falla si `offline-release` incluye `.env` real, logs, respaldos SQL,
`node_modules`, evidencia QA local, checksums incompletos o un `MANIFEST.txt`
que no referencia el commit actual.

En publicacion same-origin con Laravel, `/`, `/login` y `/verify-email` sirven el build React desde `frontend/dist/index.html`, y `/assets/*` sirve los assets compilados. Si `frontend/dist` no existe, el servidor responde error operativo y no debe entregarse como listo.

No entregar un servidor LAN real con `APP_ENV=local`. Produccion debe operar con cuentas reales creadas por administracion y cambio obligatorio de contrasena cuando aplique.

### Admin inicial seguro

- Preferir `scripts\deploy_hospital_lan.ps1`, que captura la contrasena temporal de forma oculta.
- Si soporte crea el admin manualmente, no debe escribir la contrasena como `--password=...` en consola.
- El comando acepta la contrasena desde `HOSPITAL_INITIAL_ADMIN_PASSWORD` y exige minimo 12 caracteres con mayuscula, minuscula, numero y simbolo.
- Limpiar `HOSPITAL_INITIAL_ADMIN_PASSWORD` despues de crear el admin.

## Red local

- Configurar IP fija en el servidor usando uno de estos metodos:

**Metodo 1: Panel de control de Windows (grafico)**
1. Abrir Panel de control > Centro de redes y recursos compartidos > Cambiar configuracion del adaptador
2. Doble clic en la conexion de red (Ethernet o Wi-Fi) > Propiedades
3. Seleccionar "Protocolo de Internet version 4 (TCP/IPv4)" > Propiedades
4. Seleccionar "Usar la siguiente direccion IP" e ingresar:
   - Direccion IP: `192.168.1.10` (ejemplo, ajustar segun red local)
   - Mascara de subred: `255.255.255.0`
   - Puerta de enlace predeterminada: `192.168.1.1` (router)
   - Servidor DNS preferido: `8.8.8.8` (u otro DNS local)
5. Aceptar y guardar

**Metodo 2: PowerShell (sin reinicio)**
```powershell
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress "192.168.1.10" -PrefixLength 24 -DefaultGateway "192.168.1.1"
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "8.8.8.8","8.8.4.4"
```

**Metodo 3: Reservar IP en el router (recomendado para DHCP)**
1. Acceder al router en `192.168.1.1` (o la puerta de enlace)
2. Buscar "DHCP Reservation" o "Static IP Assignment"
3. Agregar la direccion MAC del servidor y asignar una IP fija (ej: `192.168.1.10`)
4. Guardar y reiniciar el router si es necesario

**Validar la configuracion:**
```powershell
ipconfig /all
ping 192.168.1.1
```

- Permitir HTTP/HTTPS en firewall local.
- No abrir el sistema a internet salvo decision explicita posterior.
- Si se configura HTTPS local, instalar certificado confiable para los clientes.
- Los clientes deben entrar por la IP LAN fija del servidor, por ejemplo `http://192.168.1.10`.
- No usar `localhost` en clientes; en una caja cliente, `localhost` apunta a esa misma caja, no al servidor.
- Reservar la IP fija en el router o configurar IP estatica en Windows para evitar que cambie despues de reinicios.

### Si cambia la IP LAN del servidor

Si `ipconfig` muestra una IP nueva, pero el sistema todavia anuncia la IP anterior en `/api/system/echo-config`, refresque la configuracion LAN antes de validar clientes:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\refresh_lan_ip.ps1 -ServerIp 192.168.1.10 -AppPort 8081 -EnvFile .\.env -ComposeProjectName hospital_prod
```

Use primero `-WhatIf` si solo quiere revisar lo que se cambiaria:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\refresh_lan_ip.ps1 -ServerIp 192.168.1.10 -AppPort 8081 -EnvFile .\.env -ComposeProjectName hospital_prod -WhatIf
```

El script sincroniza `APP_URL`, `SERVER_IP`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, `PUSHER_CLIENT_HOST`, puerto de Soketi, firewall LAN y recrea los contenedores necesarios sin borrar volumenes ni base de datos. Si el despliegue usa otro archivo env externo, pase esa ruta en `-EnvFile`.

## Firewall y puertos

- Permitir solo el puerto publicado para HTTP/HTTPS dentro del perfil de red privada.
- Permitir tambien el puerto de sincronizacion en tiempo real (Soketi/WebSocket),
  por defecto `6001` o el valor configurado en `SOKETI_PORT`, solo dentro del
  perfil de red privada y `LocalSubnet`. Este puerto permite que varias PCs de
  caja vean cambios de facturas, pagos, caja y backups sin recargar.
- No exponer MySQL/MariaDB a internet.
- Si MySQL/MariaDB debe aceptar conexiones solo del backend local, mantenerlo escuchando en `127.0.0.1`.
- Si se usa un servidor web local, validar que `/up`, `/login`,
  `/verify-email`, `/api/system/echo-config` y el puerto WebSocket respondan
  desde otra computadora LAN.

## Impresora institucional

- Instalar la impresora media carta, carta, A5, 80mm o 58mm en la computadora que imprimira.
- Validar una impresion de prueba desde el navegador usado en caja.
- Configurar el tamano de papel del driver segun el formato aprobado: media carta, carta, A5, 80mm o 58mm.
- Si la impresora se comparte en red, probar desde cada cliente autorizado antes de operar.
- Marcar escala 100%, margenes minimos o ninguno, encabezados/pies del navegador desactivados si el navegador lo permite.
- Ejecutar una prueba con factura pagada y una reimpresion desde historial. Confirmar fondo blanco, firma/sello y ausencia de QR, codigo de barras o codigos internos.

## Backups

- Programar backup diario con `scripts\install_backup_tasks_windows.ps1`; en Docker offline usar `-Mode Docker -EnvFile .\.env` para que las tareas usen el mismo archivo final que `docker compose`. Si Windows pide permisos, repetir el comando con `-LaunchElevated`.
- Durante `setup.bat`, el instalador intenta registrar primero las tareas elevadas. Si Windows/UAC no permite crearlas, instala automaticamente el fallback Startup/HKCU del usuario actual para no dejar la instalacion sin backups, pero el preflight mantiene bloqueado `PRODUCTION_READY` hasta instalar tareas elevadas o un servicio equivalente.
- Si no hay permisos de Administrador para registrar tareas Windows, instalar el fallback del usuario actual:
  `powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Mode Docker -EnvFile .\.env -ComposeProjectName hospital_prod -DailyBackupTime 02:00`.
  Este fallback se valida en el preflight, pero no permite declarar `PRODUCTION_READY`
  porque depende de que ese usuario Windows inicie sesion. Para entrega final en
  hospital, instalar las tareas Windows elevadas o un servicio equivalente que
  arranque sin sesion interactiva.
- Permitir backup manual desde admin.
- Mantener un worker local de cola `backups` para ejecutar backups pedidos desde la UI sin bloquear el request HTTP. En `docker-compose.prod.yml` ese worker es el servicio `queue-worker`.
- Guardar archivos en carpeta local protegida y copiar una version a USB o disco externo.
- No usar cloud backups como dependencia de produccion.
- Ver `docs/BACKUP_RESTORE.md` para restore manual y checklist de validacion.

## Variables de entorno y artefactos

- El `.env` real debe vivir solo en el servidor y fuera de Git.
- No entregar el sistema con usuarios demo/E2E/validacion activos, por ejemplo
  `admin.offline`, `cajero.offline`, `*.validacion`, `*.e2e` o
  `concurrency.*`. El preflight productivo falla si detecta esas cuentas
  activas. Cree usuarios reales del hospital desde el instalador o desde el
  panel de administracion.
- Produccion debe usar `APP_ENV=production` y `APP_DEBUG=false`.
- No commitear credenciales, passwords de DB, `APP_KEY` ni rutas privadas.
- Produccion debe arrancar con `vendor/` y `frontend/dist` ya preparados.
- No ejecutar `composer install` ni `npm install` como parte del arranque de produccion offline.
- No ejecutar `php artisan migrate:fresh` en servidor real. Ese comando borra datos
  historicos y solo pertenece a bases descartables de desarrollo/testing.

## Actualizacion controlada

1. Avisar ventana de mantenimiento.
2. Crear backup local y copiarlo a USB antes de actualizar.
3. Copiar artefactos nuevos ya construidos: backend, `vendor/`, frontend compilado.
4. Revisar `.env` real sin reemplazar secretos.
5. Ejecutar migraciones aprobadas sin `php artisan migrate:fresh`.
6. Ejecutar `php artisan config:cache`.
7. Reiniciar o validar el worker local de backups. En Docker offline use `scripts\run_backup_worker.cmd --check`; en bare-metal use el mismo wrapper o la tarea PHP instalada.
8. Validar `/up`, `/login`, `/verify-email`.
9. Entrar como admin y revisar facturas, caja, reportes y backups.

## Validacion manual post-instalacion

- Desde servidor: `/up` responde OK.
- Desde cliente LAN: `/login` carga usando IP fija del servidor.
- Desde cliente LAN: `/verify-email` responde con la SPA o la ruta esperada documentada.
- Desde cliente LAN: un asset `/assets/*.js` responde como `text/javascript` y un asset `/assets/*.css` responde como `text/css`.
- Desde cliente LAN: login local completa sin 419 CSRF usando el host/IP final configurado en `SANCTUM_STATEFUL_DOMAINS`.
- Admin inicia sesion y ve configuracion/backups.
- Cajero inicia sesion, abre caja, crea factura de prueba y puede imprimir recibo.
- Supervisor/admin ve reporte diario.
- Backup manual queda `pending` y luego `success` cuando el worker corre; si falta herramienta de dump en servidor, queda `failed` con causa operativa sin credenciales.
- En paquete Docker offline, `scripts\run_scheduled_backup.cmd --mode=docker --env-file .\.env --check` debe pasar despues de que `setup.bat` cree `.env`; sin `.env` valido debe fallar antes de registrar tareas.
- Si soporte levanto el stack con `docker compose -p nombre`, agregar `--project-name nombre` al validar wrappers y `-ComposeProjectName nombre` al registrar tareas.
- Restore de prueba documentado antes de operar datos reales.

## Evidencia Fase 11 local

- Restore real MySQL/MariaDB fue validado en MariaDB XAMPP local contra `hospital_restore_validation_test`.
- Concurrencia real fue validada contra `http://192.168.1.7:8000` con `RUN_ID=concurrency-validation-20260517T20435`.
- Rutas por IP desde servidor respondieron para `/up`, `/login`, `/verify-email` y assets.
- No se declara LAN fisica completa hasta repetir el checklist desde otra computadora cliente.
- No se declara impresora fisica validada hasta imprimir media carta/carta/A5/80mm/58mm en hardware real.

## Scripts de validacion real

Restore:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

Concurrencia:

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONCURRENCY_BASE_URL=http://IP_DEL_SERVIDOR bash scripts/validate_mysql_concurrency.sh
```

No ejecutar `php artisan migrate:fresh --seed` en el servidor real. Ese comando borra la base activa y solo pertenece a entornos descartables de desarrollo/testing.

## Riesgos

- Si el servidor se apaga, ningun cliente puede facturar.
- IP dinamica rompe acceso de clientes.
- Cortes de energia pueden afectar datos; se recomienda UPS.
- Sin restore probado, los backups no deben considerarse completos.
- Si el sistema no abre despues de un reinicio, usar primero `scripts/repair_hospital_system.ps1`; no borrar contenedores, volumenes ni base de datos.
