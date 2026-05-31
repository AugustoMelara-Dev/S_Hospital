# Offline LAN Install - Sistema de Caja Hospitalaria

## Proposito

Este documento separa el entorno Docker de desarrollo de una instalacion de produccion offline LAN. Docker Compose facilita desarrollo reproducible, pero produccion no debe depender de descargar paquetes desde internet al arrancar.

## Topologia de produccion

- Una PC servidor ejecuta Laravel API, frontend compilado, MySQL/MariaDB y backups.
- Clientes usan navegador en la red local.
- Los clientes no deben usar `localhost` para entrar al sistema, porque `localhost` apunta a la computadora cliente.
- Usar IP fija o nombre local del servidor, por ejemplo `http://192.168.1.10`.
- El despliegue recomendado para produccion es same-origin: frontend compilado y API publicados bajo el mismo host/puerto o dominio LAN.

## Desarrollo con Docker

Docker Compose en este repositorio es solo para desarrollo:

```bash
docker compose config
docker compose up -d
```

Servicios:

- `backend`: Laravel en `http://localhost:8000`.
- `frontend`: Vite React en `http://localhost:5173`.
- `mysql`: MariaDB local para desarrollo.

El servicio frontend puede ejecutar `npm install` y el backend puede ejecutar `composer install` al iniciar en desarrollo. Esa estrategia no es aceptable como requisito de produccion offline.

### Variables de entorno Docker

- `backend/.env.example` es para instalacion local normal.
- `backend/.env.docker.example` es solo para Docker de desarrollo y usa `DB_HOST=mysql`.
- Docker Compose carga `backend/.env.docker.example` y, si falta `backend/.env`, crea una copia inicial para desarrollo.
- No copiar `backend/.env.example` dentro del contenedor Docker, porque sus valores locales como `DB_HOST=127.0.0.1` no sirven dentro de Compose.
- `php artisan key:generate --force` se ejecuta solo al crear el `.env` Docker inicial de desarrollo.
- Produccion offline LAN debe usar un `.env` real creado manualmente en el servidor, con secretos locales fuera de Git.

## Produccion offline LAN

Antes de instalar en el hospital:

1. Preparar artefactos con internet en una maquina de build controlada.
2. Ejecutar `composer install --no-dev --optimize-autoloader` para backend.
3. Ejecutar `npm ci` y `npm run build` para frontend.
4. Copiar backend, `vendor/`, frontend compilado y configuracion al servidor.
5. Instalar MySQL/MariaDB local en el servidor.
6. Configurar `.env` real fuera del repositorio con secretos locales, `APP_ENV=production` y `APP_DEBUG=false`.
7. Configurar `APP_URL`, `SANCTUM_STATEFUL_DOMAINS` y CORS con la IP fija o dominio LAN final, por ejemplo `192.168.1.10`.
8. Generar `APP_KEY` en el servidor.
9. Ejecutar migraciones aprobadas sin `migrate:fresh`.
10. Crear admin real con `php artisan auth:create-initial-admin`; no ejecutar seeders demo.
11. Ejecutar `php artisan config:cache`.
12. Publicar por IP fija LAN o nombre local.
13. Levantar worker local de backups como servicio/tarea continua con `php artisan queue:work --queue=backups --tries=1 --timeout=600`.
14. Validar `/up`, `/login` y `/verify-email`.

Scripts operativos seguros:

- `setup.bat`: levanta servicios locales y ejecuta migraciones no destructivas; falla si falta `frontend/dist` para evitar descargas durante instalacion offline.
- `scripts/install_hospital_os.ps1`: asistente Windows institucional; usa `migrate --force` y seeders base de permisos/catalogo, no seeders demo.
- `scripts/repair_hospital_system.ps1`: reparacion segura ante reinicio, red caida o servicios detenidos. No borra datos; revisa Docker, levanta servicios, espera `/up`, abre `/login` y guarda diagnostico en `install-logs`.
- `scripts/validate_installer_safety.ps1`: gate local para confirmar que los scripts de instalacion/reparacion no contienen `migrate:fresh`, `db:wipe`, seeders demo ni marca tecnica heredada visible.

En publicacion same-origin con Laravel, `/`, `/login` y `/verify-email` sirven el build React desde `frontend/dist/index.html`, y `/assets/*` sirve los assets compilados. Si `frontend/dist` no existe, el servidor responde error operativo y no debe entregarse como listo.

No entregar un servidor LAN real con `APP_ENV=local`. Los usuarios `admin.demo`, `supervisor.demo` y `cajero.demo` pertenecen solo a desarrollo/testing.

## Red local

- Configurar IP fija en el servidor.
- Permitir HTTP/HTTPS en firewall local.
- No abrir el sistema a internet salvo decision explicita posterior.
- Si se configura HTTPS local, instalar certificado confiable para los clientes.
- Los clientes deben entrar por la IP o nombre LAN del servidor, por ejemplo `http://192.168.1.10`.
- No usar `localhost` en clientes; en una caja cliente, `localhost` apunta a esa misma caja, no al servidor.
- Reservar la IP fija en el router o configurar IP estatica en Windows para evitar que cambie despues de reinicios.

## Firewall y puertos

- Permitir solo el puerto publicado para HTTP/HTTPS dentro del perfil de red privada.
- No exponer MySQL/MariaDB a internet.
- Si MySQL/MariaDB debe aceptar conexiones solo del backend local, mantenerlo escuchando en `127.0.0.1`.
- Si se usa un servidor web local, validar que `/up`, `/login` y `/verify-email` respondan desde otra computadora LAN.

## impresora institucional

- Instalar la impresora media carta, carta o A5 en la computadora que imprimira.
- Validar una impresion de prueba desde el navegador usado en caja.
- Configurar el tamano de papel del driver para evitar salida tipo carta.
- Si la impresora se comparte en red, probar desde cada cliente autorizado antes de operar.
- Marcar escala 100%, margenes minimos o ninguno, encabezados/pies del navegador desactivados si el navegador lo permite.
- Ejecutar una prueba 80mm y una prueba 58mm con una factura pagada y una reimpresion desde historial.

## Backups

- Programar backup diario con `php artisan hospital:backup --type=scheduled`.
- Permitir backup manual desde admin.
- Mantener un worker local de cola `backups` para ejecutar backups pedidos desde la UI sin bloquear el request HTTP.
- Guardar archivos en carpeta local protegida y copiar una version a USB o disco externo.
- No usar cloud backups como dependencia de produccion.
- Ver `docs/BACKUP_RESTORE.md` para restore manual y checklist de validacion.

## Variables de entorno y artefactos

- El `.env` real debe vivir solo en el servidor y fuera de Git.
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
7. Reiniciar o validar el worker local de backups.
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
- Restore de prueba documentado antes de operar datos reales.

## Evidencia Fase 11 local

- Restore real MySQL/MariaDB fue validado en MariaDB XAMPP local contra `hospital_restore_validation_test`.
- Concurrencia real fue validada contra `http://192.168.1.7:8000` con `RUN_ID=concurrency-validation-20260517T20435`.
- Rutas por IP desde servidor respondieron para `/up`, `/login`, `/verify-email` y assets.
- No se declara LAN fisica completa hasta repetir el checklist desde otra computadora cliente.
- No se declara impresora fisica validada hasta imprimir media carta/carta/A5 en hardware real.

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
