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

## Pendiente de fases posteriores

- Procedimiento final de backup/restore.
- Servicio Windows o supervisor de procesos.
- Configuracion exacta del servidor web elegido.
- Checklist de impresora termica.

