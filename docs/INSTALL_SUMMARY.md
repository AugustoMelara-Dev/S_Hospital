# Install summary - offline LAN

## Preparacion

1. Construir frontend antes de llevar al servidor.
2. Copiar backend, `vendor/`, frontend compilado y configuracion aprobada.
3. Instalar PHP, extensiones necesarias y MySQL/MariaDB local.
4. Crear `.env` real en el servidor, fuera de Git, con secretos locales.
5. Configurar obligatoriamente `APP_ENV=production` y `APP_DEBUG=false`.
6. Generar `APP_KEY` si no existe.
7. Ejecutar migraciones aprobadas sin `migrate:fresh`.
8. Crear admin real con `php artisan auth:create-initial-admin`; no ejecutar seeders demo en servidor real.
9. Ejecutar `php artisan config:cache`.

No entregar un servidor LAN real con `APP_ENV=local`. Los usuarios `admin.demo`, `supervisor.demo` y `cajero.demo` son exclusivamente para desarrollo/testing.

## Servidor LAN

- Servidor: una PC local con Laravel API, frontend compilado, MySQL/MariaDB y backups.
- Clientes: navegadores apuntando a la IP local del servidor, por ejemplo `http://192.168.1.10`.
- No usar `localhost` desde clientes.
- No requerir internet para login, facturacion, caja, reportes, impresion o backups.
- Produccion debe correr con `APP_ENV=production` y `APP_DEBUG=false`.
- Si se publica same-origin desde Laravel, las rutas `/`, `/login` y `/verify-email` deben servir el build React generado en `frontend/dist`.
- La ruta `/assets/*` debe servir los assets del build React; ejecutar `npm.cmd run build` antes de copiar artefactos.

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

## Validacion Fase 10 antes de produccion

- Ejecutar `scripts/e2e_gate.sh` en la maquina de build.
- Ejecutar `scripts/validate_restore_mysql.sh` en entorno MySQL/MariaDB con herramienta dump.
- Ejecutar `scripts/validate_mysql_concurrency.sh` contra servidor Laravel conectado a MySQL/MariaDB.
- Completar checklist de impresora termica 80mm/58mm en la PC de caja.
