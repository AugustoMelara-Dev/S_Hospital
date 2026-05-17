# Offline LAN Install - Hospital Billing OS

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
6. Configurar `.env` real fuera del repositorio con secretos locales.
7. Generar `APP_KEY` en el servidor.
8. Ejecutar migraciones y seeders aprobados.
9. Publicar por IP fija LAN o nombre local.
10. Validar `/up`, `/login` y `/verify-email`.

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

## Impresora termica

- Instalar la impresora 80mm o 58mm en la computadora que imprimira.
- Validar una impresion de prueba desde el navegador usado en caja.
- Configurar el tamano de papel del driver para evitar salida tipo carta.
- Si la impresora se comparte en red, probar desde cada cliente autorizado antes de operar.

## Backups

- Programar backup diario con `php artisan hospital:backup --type=scheduled`.
- Permitir backup manual desde admin.
- Guardar archivos en carpeta local protegida y copiar una version a USB o disco externo.
- No usar cloud backups como dependencia de produccion.
- Ver `docs/BACKUP_RESTORE.md` para restore manual y checklist de validacion.

## Variables de entorno y artefactos

- El `.env` real debe vivir solo en el servidor y fuera de Git.
- No commitear credenciales, passwords de DB, `APP_KEY` ni rutas privadas.
- Produccion debe arrancar con `vendor/` y `frontend/dist` ya preparados.
- No ejecutar `composer install` ni `npm install` como parte del arranque de produccion offline.

## Actualizacion controlada

1. Avisar ventana de mantenimiento.
2. Crear backup local y copiarlo a USB antes de actualizar.
3. Copiar artefactos nuevos ya construidos: backend, `vendor/`, frontend compilado.
4. Revisar `.env` real sin reemplazar secretos.
5. Ejecutar migraciones aprobadas.
6. Ejecutar `php artisan config:cache`.
7. Validar `/up`, `/login`, `/verify-email`.
8. Entrar como admin y revisar facturas, caja, reportes y backups.

## Validacion manual post-instalacion

- Desde servidor: `/up` responde OK.
- Desde cliente LAN: `/login` carga usando IP fija del servidor.
- Admin inicia sesion y ve configuracion/backups.
- Cajero inicia sesion, abre caja, crea factura de prueba y puede imprimir recibo.
- Supervisor/admin ve reporte diario.
- Backup manual queda `success` o, si falta herramienta de dump en servidor, queda `failed` con causa operativa sin credenciales.
- Restore de prueba documentado antes de operar datos reales.

## Riesgos

- Si el servidor se apaga, ningun cliente puede facturar.
- IP dinamica rompe acceso de clientes.
- Cortes de energia pueden afectar datos; se recomienda UPS.
- Sin restore probado, los backups no deben considerarse completos.
