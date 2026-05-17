# Install summary - offline LAN

## Preparacion

1. Construir frontend antes de llevar al servidor.
2. Copiar backend, `vendor/`, frontend compilado y configuracion aprobada.
3. Instalar PHP, extensiones necesarias y MySQL/MariaDB local.
4. Crear `.env` real en el servidor, fuera de Git, con secretos locales.
5. Generar `APP_KEY` si no existe.
6. Ejecutar migraciones y seeders aprobados.
7. Ejecutar `php artisan config:cache`.

## Servidor LAN

- Servidor: una PC local con Laravel API, frontend compilado, MySQL/MariaDB y backups.
- Clientes: navegadores apuntando a la IP local del servidor, por ejemplo `http://192.168.1.10`.
- No usar `localhost` desde clientes.
- No requerir internet para login, facturacion, caja, reportes, impresion o backups.

## Worker de backups

Ejecutar como tarea al iniciar Windows o servicio supervisado:

```powershell
cd C:\HospitalBilling\backend
php artisan queue:work --queue=backups --tries=1 --timeout=600
```

## Backup y restore

- Programar `php artisan hospital:backup --type=scheduled` fuera del horario de caja.
- Copiar backups a USB o disco externo protegido.
- Probar restore primero en base limpia de prueba.
- No ejecutar restore en produccion sin parada operativa.

## Validacion post-instalacion

- `/up` responde OK desde servidor.
- `/login` carga desde cliente LAN.
- `/verify-email` responde segun ruta instalada.
- Admin puede entrar.
- Cajero puede abrir caja, facturar, cobrar e imprimir.
- Supervisor/admin puede ver reportes.
- Admin puede crear backup local.
