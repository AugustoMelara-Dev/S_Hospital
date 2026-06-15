# Manual de Actualizacion Segura

Estado permitido despues de este procedimiento: `TECHNICAL_RELEASE_CANDIDATE_PENDING_FIELD_VALIDATION`.
No usar este manual para declarar `PRODUCTION_READY`.

Este manual describe como actualizar una instalacion real del Sistema de Caja
Hospitalaria sin perder datos. El objetivo es conservar base de datos,
configuracion local, respaldos, recibos, logos y archivos generados por el
hospital.

## Regla principal

Una actualizacion real nunca debe ejecutar:

- `php artisan migrate:fresh`
- `php artisan db:wipe`
- `php artisan migrate:reset`
- `php artisan migrate:rollback`
- `DROP DATABASE`
- borrado de volumenes Docker
- borrado de `backend/storage`
- reemplazo de `.env` real por archivos de ejemplo

Si algun instructivo, script o tecnico pide usar esos comandos contra el
servidor real, detener la actualizacion y escalarlo como riesgo P0.

## Antes de iniciar

Confirmar:

- Hay ventana de mantenimiento aprobada.
- Nadie esta facturando, cobrando o cerrando caja.
- La version instalada esta identificada.
- El paquete nuevo corresponde al commit/version aprobado.
- Hay acceso local al servidor.
- Hay espacio libre suficiente para un backup y una copia del paquete anterior.
- La impresora y la red LAN no se estan reconfigurando en la misma ventana.

## Preflight de version actual

En una instalacion con Git disponible:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
```

En un paquete offline sin Git, revisar el `MANIFEST.txt`, release notes o el
reporte de entrega que acompana el paquete.

Ejecutar el preflight no destructivo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\update_release_preflight.ps1 `
  -ProjectRoot C:\Projects\S_Hospital `
  -ExpectedCurrentCommit 6508418d62ec25f0cea37221bfce7295977b7629
```

El preflight solo lee archivos y configuracion. No ejecuta migraciones, no crea
backups, no reinicia servicios y no toca datos.

## Backup obligatorio

Antes de copiar artefactos nuevos:

1. Crear un backup manual desde **Respaldos > Crear respaldo local** o con el
   comando operativo aprobado.
2. Esperar que el estado cambie a **Protegido** o `success`.
3. Confirmar que el backup tiene tamano mayor a cero y checksum SHA256.
4. Copiar el archivo a un medio externo o carpeta protegida fuera del paquete
   que se va a reemplazar.
5. Registrar ruta relativa, fecha, responsable y checksum en el checklist.

Si el backup queda `pending`, `failed` o no tiene checksum, detener la
actualizacion.

## Verificacion del backup

La verificacion fuerte consiste en restaurar el backup en una base temporal o
descartable, nunca sobre la base activa:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 \
RESTORE_TEST_DATABASE=hospital_restore_update_test \
HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_update_test \
HOSPITAL_RESTORE_EVIDENCE_PATH=qa/FINAL_RESTORE_PROOF.md \
bash scripts/validate_restore_mysql.sh
```

El nombre de la base temporal debe contener `test`, `restore`, `validation` o
`disposable`. No usar el nombre de la base activa.

## Proteccion de archivos locales

Antes de copiar el paquete nuevo, proteger:

- `.env` del proyecto si existe.
- `backend/.env`.
- `backend/storage/app/private/backups`.
- `backend/storage/app/public` y `backend/storage/app/public/branding`.
- `backend/storage/logs`.
- `backend/storage/framework` si la instalacion lo usa para sesiones/cache.
- `frontend/dist` solo como artefacto reemplazable, nunca como fuente de datos.
- cualquier carpeta local indicada por el hospital para respaldos externos.

El paquete nuevo puede reemplazar codigo, `vendor/` y assets compilados. No debe
reemplazar secretos ni storage generado por la instalacion.

## Aplicacion de actualizacion

Secuencia segura:

1. Registrar backup verificado.
2. Detener trabajos de fondo si el procedimiento lo requiere, sin borrar colas
   ni tablas.
3. Copiar paquete nuevo encima del codigo aprobado, preservando `.env` y
   `storage`.
4. Ejecutar solo migraciones incrementales:

```powershell
php artisan migrate --force
```

5. Regenerar caches de configuracion:

```powershell
php artisan config:cache --no-ansi
php artisan route:cache --no-ansi
```

6. Reiniciar servicios o contenedores segun el modo instalado.
7. Validar worker de respaldos.
8. Ejecutar health checks.

No ejecutar seeders de demostracion. Solo se permiten seeders idempotentes
operativos ya aprobados, por ejemplo roles/permisos o catalogo base cuando el
script de instalacion los llama de forma segura.

## Health checks posteriores

Validar desde el servidor:

```powershell
curl http://IP-DEL-SERVIDOR/up
curl http://IP-DEL-SERVIDOR/login
curl http://IP-DEL-SERVIDOR/verify-email
```

Validar desde la aplicacion:

- Login admin.
- Login cajero.
- Dashboard carga sin error.
- Caja muestra estado correcto.
- Historial muestra facturas existentes.
- Reportes responden.
- Respaldos lista registros existentes.
- Configuracion fiscal conserva datos.
- Configuracion de recibos institucionales conserva serie/perfiles.
- Reimpresion de factura historica abre recibo institucional si existe o
  fallback legacy si corresponde.

## Verificacion de datos criticos

Antes y despues de actualizar, comparar al menos:

- cantidad de usuarios activos;
- cantidad de servicios activos;
- ultima factura emitida;
- ultima caja abierta/cerrada;
- cantidad de pagos;
- cantidad de respaldos registrados;
- series activas de factura y recibo institucional;
- existencia de logo/configuracion local si el hospital la usa.

Si un conteo baja sin explicacion o desaparece configuracion critica, detener y
usar rollback.

## Rollback documentado

Rollback permitido:

1. Mantener la base activa sin borrar.
2. Detener servicios.
3. Restaurar el codigo/artefactos anteriores desde la copia de seguridad del
   paquete.
4. Restaurar `.env` y `storage` protegidos si fueron alterados por error.
5. Ejecutar `php artisan config:cache --no-ansi`.
6. Levantar servicios.
7. Validar `/up`, login, historial, caja y respaldos.

Rollback de base de datos solo se considera si la actualizacion ya modifico la
base y la direccion tecnica aprueba restaurar un backup completo. Esa accion
puede perder transacciones hechas despues del backup; por eso la ventana de
mantenimiento debe impedir operacion durante la actualizacion.

## Cierre

La actualizacion queda aceptada tecnicamente cuando:

- backup previo verificado;
- `.env` y `storage` preservados;
- migraciones incrementales terminaron sin error;
- health checks pasan;
- datos criticos coinciden;
- recibos institucionales siguen disponibles;
- backup manual posterior se puede solicitar o el worker queda validado.

La validacion fisica de impresora, papel final, politica de copias, sello/firma
y LAN real siguen pendientes de campo cuando no hay hardware disponible.
