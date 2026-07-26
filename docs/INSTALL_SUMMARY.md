# Install summary - offline LAN

## Runbook corto de instalacion en servidor

Objetivo: dejar una PC local lista para operar como monocomputadora, o como servidor LAN si el despliegue multi-PC se habilita despues, sin internet obligatorio.
No ejecutar `migrate:fresh` en el servidor real.

1. Instalar PHP, extensiones requeridas y MySQL/MariaDB local.
2. Copiar el proyecto aprobado con `backend/vendor` y `frontend/dist` ya generado.
3. Crear `backend\.env` real fuera de Git con secretos locales.
4. Configurar `APP_ENV=production`, `APP_DEBUG=false` y la URL final: `APP_URL=http://127.0.0.1:PUERTO` para monocomputadora o `APP_URL=http://IP_DEL_SERVIDOR` para multi-PC. Ajustar `SANCTUM_STATEFUL_DOMAINS` y CORS al mismo host final.
5. Configurar `HOSPITAL_DUMP_BINARY` si `mysqldump.exe` o `mariadb-dump.exe` no esta en PATH.
6. Ejecutar `php artisan migrate --force`.
7. Crear admin real con `php artisan auth:create-initial-admin`.
8. Ejecutar `php artisan config:cache --no-ansi`.
9. Registrar tareas Windows para backup worker y scheduler con `scripts\install_backup_tasks_windows.ps1`.
10. Abrir la app como admin, entrar a Backups y revisar el checklist operativo: `APP_ENV=production`, `APP_DEBUG=false`, MySQL/MariaDB, dump tool, storage local, worker continuo, rutas `/up`, `/login`, `/verify-email` y evidencias local/impresora.
11. Crear un backup manual y confirmar que cambia de `pending` a `success`.
12. Preparar archivos de evidencia copiando las plantillas `qa\LOCAL_SERVER_VALIDATION_PROOF.example.md`, `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md` si existe, `qa\FINAL_RESTORE_PROOF.example.md` y `qa\FINAL_CONCURRENCY_PROOF.example.md` al nombre `.md` final que corresponda.
13. Para monocomputadora, copiar `qa\LOCAL_SERVER_VALIDATION_PROOF.example.md` a `qa\LOCAL_SERVER_VALIDATION_PROOF.md` y completarlo desde el navegador local del servidor. Para multi-PC, ejecutar desde una segunda PC cliente `scripts\validate_lan_client.ps1 -BaseUrl http://IP_DEL_SERVIDOR -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md` y completar los checks manuales.
14. Completar `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con la impresora fisica principal en media carta, carta y A5.
15. Ejecutar `scripts\production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:PUERTO` para monocomputadora o `-BaseUrl http://IP_DEL_SERVIDOR` para multi-PC, sin `-AllowMissingPhysicalProof`, solo cuando ya existan las evidencias fisicas requeridas de navegador local/LAN, recibo institucional y restore/concurrencia.

## Preparación y Despliegue Automatizado (Recomendado)

El flujo recomendado para una sola PC es ejecutar `setup.bat`, elegir **Esta computadora (recomendado)** y usar Docker con las imagenes offline. El asistente no anuncia exito hasta validar runtime, base, migraciones, administrador, web, worker, scheduler, respaldo cifrado y acceso de aplicacion.

- Publica HTTP y tiempo real solo en `127.0.0.1` en modo monocomputadora.
- Crea accesos `S_Hospital` y `Mantenimiento S_Hospital` con icono institucional.
- Verifica un respaldo cifrado real y deja los respaldos automaticos activos.
- El modo LAN se habilita de forma explicita y conserva una unica base en el servidor.

El despliegue está completamente automatizado a través de un asistente inteligente. Ya no es necesario ejecutar comandos manuales en producción:

1. **Copiar el proyecto** a la carpeta final del Servidor.
2. Hacer clic derecho en **`setup.bat`** y seleccionar **"Ejecutar como administrador"** (esencial para configurar el firewall del puerto 8000 y el programador de tareas en Windows).
3. Seleccionar el modo de despliegue:
    - **Opción 1 (Contenedores Docker):** Levantará Nginx, MariaDB, PHP-FPM y el queue worker en contenedores aislados y de alto rendimiento. Soporta dos modalidades:
      - **Modo Online:** Si no existe la carpeta `offline-images/`, el instalador descarga y construye automáticamente todo desde internet.
      - **Modo Offline:** Si se incluye la carpeta `offline-images/` (generada previamente mediante `make_offline_release.ps1`), el instalador importará automáticamente las imágenes precargadas `.tar` usando `docker load` sin requerir conexión a internet.
    - **Opción 2 (Bare-Metal Windows):** Usará PHP local, pedirá credenciales de base de datos MySQL de forma interactiva (sin sobreescribir valores preexistentes en el `.env`) y registrará automáticamente las tareas en el **Windows Task Scheduler**.
4. Crear la cuenta inicial del administrador del hospital.
5. Iniciar sesión y validar el checklist.

---

## Arquitectura local hospitalaria

- **Modo monocomputadora aprobado:** una unica PC ejecuta la app, MySQL/MariaDB, backups y el navegador operativo. Usar `APP_URL=http://127.0.0.1:PUERTO` o dominio local equivalente y completar `qa\LOCAL_SERVER_VALIDATION_PROOF.md`.
- **Modo multi-PC opcional:** una unica PC servidor ejecuta la app, base de datos y backups; las estaciones cliente no instalan nada y entran por navegador a `http://IP_DEL_SERVIDOR:8000`.
- **Advertencia de seguridad y fiscal:** no instalar copias independientes con bases separadas. Si hay varias estaciones, todas deben usar la misma base MySQL/MariaDB del servidor para evitar duplicacion de correlativos fiscales y arqueos de caja fragmentados.

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

- `/up` responde OK desde el servidor.
- `/login` carga desde el navegador local en monocomputadora o desde cliente LAN en multi-PC.
- `/verify-email` responde segun ruta instalada.
- Admin puede entrar.
- Cajero puede abrir caja, facturar, cobrar e imprimir.
- Supervisor/admin puede ver reportes.
- Admin puede crear backup local.

## Validacion Fase 10 antes de produccion

- Ejecutar `scripts/e2e_gate.sh` en la maquina de build.
- Ejecutar `scripts/validate_restore_mysql.sh` en entorno MySQL/MariaDB con herramienta dump.
- Ejecutar `scripts/validate_mysql_concurrency.sh` contra servidor Laravel conectado a MySQL/MariaDB.
- Completar checklist de impresion institucional en media carta, carta y A5 en la PC de caja. 80mm/58mm queda como compatibilidad secundaria si se habilita.
