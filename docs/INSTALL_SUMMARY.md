# Install summary - offline LAN

## Runbook corto de instalacion en servidor

Objetivo: dejar una PC servidor lista para operar por LAN sin internet obligatorio.
No ejecutar `migrate:fresh` en el servidor real.

1. Instalar PHP, extensiones requeridas y MySQL/MariaDB local.
2. Copiar el proyecto aprobado con `backend/vendor` y `frontend/dist` ya generado.
3. Crear `backend\.env` real fuera de Git con secretos locales.
4. Configurar `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=http://IP_DEL_SERVIDOR`, `SANCTUM_STATEFUL_DOMAINS=IP_DEL_SERVIDOR` y CORS con el host LAN final.
5. Configurar `HOSPITAL_DUMP_BINARY` si `mysqldump.exe` o `mariadb-dump.exe` no esta en PATH.
6. Ejecutar `php artisan migrate --force`.
7. Crear admin real con el instalador o `php artisan auth:create-initial-admin` usando `HOSPITAL_INITIAL_ADMIN_PASSWORD`; no escribir la contrasena como `--password=...`.
8. Ejecutar `php artisan config:cache --no-ansi`.
9. Registrar tareas Windows para backup worker y scheduler con `scripts\install_backup_tasks_windows.ps1`.
10. Abrir la app como admin, entrar a Backups y revisar el checklist operativo: `APP_ENV=production`, `APP_DEBUG=false`, MySQL/MariaDB, dump tool, storage local, worker continuo, rutas `/up`, `/login`, `/verify-email` y evidencias LAN/impresora.
11. Crear un backup manual y confirmar que cambia de `pending` a `success`.
12. Preparar archivos de evidencia con `scripts\init_production_proofs.ps1`.
13. Desde una segunda PC cliente, ejecutar `scripts\validate_lan_client.ps1 -BaseUrl http://IP_DEL_SERVIDOR -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md` y completar los checks manuales de login, caja, factura, pago, reportes y backup.
14. Completar `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con la impresora fisica media carta/carta/A5/80mm/58mm.
15. Regenerar el paquete con `scripts\make_offline_release.ps1 -Force` y ejecutar `scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit`.
16. Ejecutar `scripts\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR` sin `-AllowMissingPhysicalProof` solo cuando ya existan pruebas de segunda PC LAN e impresora.

Si el preflight falla por evidencia fisica pendiente, el servidor puede seguir en `PRODUCTION_CANDIDATE`, pero no se debe vender como `PRODUCTION_READY`.

## Preparacion

1. Construir frontend antes de llevar al servidor.
2. Copiar backend, `vendor/`, frontend compilado y configuracion aprobada.
3. Instalar PHP, extensiones necesarias y MySQL/MariaDB local.
4. Crear `.env` real en el servidor, fuera de Git, con secretos locales.
5. Configurar obligatoriamente `APP_ENV=production` y `APP_DEBUG=false`.
6. Generar `APP_KEY` si no existe.
7. Ejecutar migraciones aprobadas sin `migrate:fresh`.
8. Crear admin real con el instalador o `php artisan auth:create-initial-admin` usando `HOSPITAL_INITIAL_ADMIN_PASSWORD`; no ejecutar seeders de desarrollo en servidor real.
9. Ejecutar `php artisan config:cache`.

No entregar un servidor LAN real con `APP_ENV=local`. Produccion debe operar con cuentas reales creadas por administracion y cambio obligatorio de contrasena cuando aplique.

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

En paquete Docker offline, el worker continuo es el servicio `queue-worker` y se
valida con:

```powershell
scripts\run_backup_worker.cmd --check
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
- Completar checklist de impresora institucional media carta/carta/A5/80mm/58mm en la PC de caja.
