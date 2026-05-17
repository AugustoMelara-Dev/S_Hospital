# Windows Server Local Install - Hospital Billing OS

## Objetivo

Guia inicial para instalar Hospital Billing OS en una PC servidor Windows dentro de una red local. Esta guia es para produccion offline LAN y no reemplaza el Docker Compose de desarrollo.

## Requisitos del servidor

- Windows 10/11 Pro o Windows Server.
- PHP compatible con la version Laravel usada por `backend/composer.json`.
- Composer disponible durante preparacion o artefacto `vendor/` preconstruido.
- Node.js solo en maquina de build; no debe ser obligatorio en el servidor si se entrega frontend compilado.
- MySQL/MariaDB instalado como servicio local.
- Servidor web local: IIS, Apache o Nginx.
- IP fija en LAN.
- UPS recomendado.
- Puerto HTTP/HTTPS permitido en Firewall de Windows para red privada.
- Carpeta local protegida para backups y unidad USB/disco externo para copia fuera del servidor.

## Preparacion recomendada

1. Construir artefactos en una maquina con internet controlada.
2. Copiar backend con `vendor/` ya instalado.
3. Copiar frontend ya compilado desde `frontend/dist`.
4. Copiar `.env` real manualmente en el servidor; no guardar secretos en Git.
5. Configurar base de datos `hospital_billing` en MySQL/MariaDB.
6. Ejecutar `php artisan key:generate` si no existe `APP_KEY`.
7. Ejecutar migraciones y seeders aprobados.
8. Ejecutar `php artisan config:cache`.
9. Configurar el servidor web para publicar el frontend y enrutar API Laravel.

## Acceso de clientes

- Los clientes deben abrir la IP o nombre local del servidor, por ejemplo `http://192.168.1.10`.
- No usar `http://localhost` en computadoras cliente.
- En produccion se prefiere same-origin para frontend y API.
- Reservar la IP en el router o configurar IP estatica en el adaptador de red del servidor.
- Validar el acceso desde al menos una computadora cliente antes de operar caja.

## Firewall

1. Abrir Firewall de Windows.
2. Crear regla de entrada para el puerto publicado por IIS/Apache/Nginx.
3. Aplicar solo al perfil Privado.
4. No abrir el puerto de MySQL/MariaDB hacia redes externas.
5. Probar desde cliente:

```powershell
Invoke-WebRequest http://192.168.1.10/up
```

## Backups locales y USB

Crear carpeta:

```powershell
New-Item -ItemType Directory C:\HospitalBillingBackups
```

Programar tarea diaria:

- Programa: `php`
- Argumentos: `artisan hospital:backup --type=scheduled`
- Iniciar en: `C:\HospitalBilling\backend`

Despues de generar backup, copiar el archivo reciente desde `storage\app\private\backups` hacia `C:\HospitalBillingBackups` y una unidad USB del hospital. No guardar backups en servicios cloud como requisito de produccion.

## Impresora termica

- Instalar driver local de la impresora 80mm o 58mm.
- Configurar tamano de papel en Windows.
- Probar impresion desde el navegador de caja.
- Si la impresora esta compartida, validar permisos de impresion por usuario Windows.

## Actualizacion offline

1. Crear backup local y copia USB antes de actualizar.
2. Detener o poner en mantenimiento el servidor web.
3. Copiar artefactos nuevos ya construidos; no ejecutar `composer install` ni `npm install` en el arranque productivo.
4. Mantener `.env` real fuera de Git y no reemplazar secretos.
5. Ejecutar migraciones aprobadas.
6. Ejecutar `php artisan config:cache`.
7. Reiniciar servidor web.
8. Validar `/up`, `/login`, `/verify-email`, login admin, caja, impresion y backup manual.

## Validacion minima

Ejecutar desde el servidor:

```powershell
php artisan test --colors=never
php artisan config:cache
```

Validar desde un cliente en LAN:

```powershell
Invoke-WebRequest http://192.168.1.10/up
Invoke-WebRequest http://192.168.1.10/login
Invoke-WebRequest http://192.168.1.10/verify-email
```

## Politica offline

Produccion no debe depender de:

- `npm install` al arrancar.
- `composer install` al arrancar.
- CDNs o assets remotos obligatorios.
- Servicios cloud para login, facturacion, reportes o impresion.

## Restore

Restore no se ejecuta desde UI. Seguir `docs/BACKUP_RESTORE.md`, primero en base de prueba y luego en produccion solo con parada controlada y backup previo.

## Pendiente de fases posteriores

- Servicio Windows o supervisor de procesos.
- Configuracion exacta del servidor web elegido.
