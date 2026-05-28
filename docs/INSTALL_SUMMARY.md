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
7. Crear admin real con `php artisan auth:create-initial-admin`.
8. Ejecutar `php artisan config:cache --no-ansi`.
9. Registrar tareas Windows para backup worker y scheduler con `scripts\install_backup_tasks_windows.ps1`.
10. Abrir la app como admin, entrar a Backups y revisar el checklist operativo: `APP_ENV=production`, `APP_DEBUG=false`, MySQL/MariaDB, dump tool, storage local, worker continuo, rutas `/up`, `/login`, `/verify-email` y evidencias LAN/impresora.
11. Crear un backup manual y confirmar que cambia de `pending` a `success`.
12. Preparar archivos de evidencia con `scripts\init_production_proofs.ps1`.
13. Desde una segunda PC cliente, ejecutar `scripts\validate_lan_client.ps1 -BaseUrl http://IP_DEL_SERVIDOR -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md` y completar los checks manuales de login, caja, factura, pago, reportes y backup.
14. Completar `qa\THERMAL_PRINTER_PROOF.md` con la impresora fisica 80mm/58mm.
15. Ejecutar `scripts\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR` sin `-AllowMissingPhysicalProof` solo cuando ya existan pruebas de segunda PC LAN e impresora.

## Preparación y Despliegue Automatizado (Recomendado)

El despliegue está completamente automatizado a través de un asistente inteligente. Ya no es necesario ejecutar comandos manuales en producción:

1. **Copiar el proyecto** a la carpeta final del Servidor.
2. Hacer clic derecho en **`setup.bat`** y seleccionar **"Ejecutar como administrador"** (esencial para configurar el firewall del puerto 8000 y el programador de tareas en Windows).
3. Seleccionar el modo de despliegue:
   - **Opción 1 (Contenedores Docker):** Levantará Nginx, MariaDB, PHP-FPM y el queue worker en contenedores aislados y de alto rendimiento. Compila el frontend automáticamente dentro de la construcción de la imagen sin depender de volumenes host locales (bulletproof).
   - **Opción 2 (Bare-Metal Windows):** Usará PHP local, pedirá credenciales de base de datos MySQL de forma interactiva (sin sobreescribir valores preexistentes en el `.env`) y registrará automáticamente las tareas en el **Windows Task Scheduler**.
4. Crear la cuenta inicial del administrador del hospital.
5. Iniciar sesión y validar el checklist.

---

## Arquitectura de Red LAN Local Hospitalaria

- **Servidor LAN:** Una única PC local de alto rendimiento ejecuta el sistema completo, base de datos y automatización de backups. Debe contar con una **IP fija estática** configurada en Windows para evitar que el router cambie su IP.
- **Estaciones Cliente (3+ terminales):** Computadoras de caja, consultorios y admisión. No instalan absolutamente nada. Abren el navegador (Chrome/Edge) e ingresan a: `http://IP_DEL_SERVIDOR:8000`.
- **⚠️ ADVERTENCIA DE SEGURIDAD Y FISCAL:** *No instalar el sistema local por PC individual.* Cada estación de cobro debe conectarse a la misma base de datos del servidor para evitar la duplicación de números fiscales correlativos de facturación y para garantizar un único flujo consolidado de arqueo de caja diario.


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
