# Fase 8 - Evidencia de backup/restore

Fecha: 2026-05-17
Entorno: Windows local de desarrollo en `C:\Projects\S_Hospital\backend`
Base configurada: MySQL/MariaDB local `hospital_billing`

## Resultado actual

Estado de cierre restore: PENDING_ENVIRONMENT_VALIDATION para restore real MySQL/MariaDB.

Fase 10 agrego `scripts/validate_restore_mysql.sh` para ejecutar la validacion real cuando el servidor tenga MySQL/MariaDB, cliente `mysql` y `mariadb-dump` o `mysqldump`. Este script crea un backup con `php artisan hospital:backup --type=manual`, restaura en una base descartable `RESTORE_TEST_DATABASE` y deja pasos exactos para validar `/up`, `/login`, `/verify-email`, `migrate:status` y conteos minimos.

Ejecucion Fase 10 en esta maquina con `HOSPITAL_VALIDATE_RESTORE_MYSQL=1`: aborta con `mysql client is required for restore validation`, por lo que no se marca como validado.

El flujo de backup registra `failed` de forma controlada porque este entorno no tiene disponible `mariadb-dump` ni `mysqldump`.

Comando ejecutado:

```powershell
php artisan migrate:fresh --seed
php artisan hospital:backup --type=manual
```

Resultado:

```text
Backup local fallido: hospital-backup-20260517-164443-p8a8btul.sql. Revise backup_logs para el detalle operativo.
```

Registro inspeccionado:

```text
status: failed
error_message: No se encontro mariadb-dump ni mysqldump. Instale una herramienta de dump local en el servidor.
checksum_sha256: null
size_bytes: null
```

No se expusieron credenciales de base de datos en la salida ni en el mensaje operativo.

## Evidencia automatizada cubierta

`BackupWorkflowTest` valida en entorno SQLite de pruebas:

- Admin puede listar backups sin exponer `path`, `disk` ni `error_message`.
- Cajero y supervisor no pueden listar, crear ni descargar backups.
- Endpoint manual registra `pending` y encola `RunBackupJob`.
- Runner de backup crea archivo local, calcula `checksum_sha256` y registra auditoria.
- Fallo controlado registra `failed` sin filtrar password.
- Download solo sirve archivos registrados, existentes, `success` y dentro de `storage/app/private/backups`.
- Path traversal y logs `failed` no descargan.
- `hospital:backup` registra `success` en entorno de pruebas.
- No existe endpoint destructivo de restore.

## Bloqueo para restore real

Para cerrar restore real de Fase 8 en MySQL/MariaDB, instalar en el servidor una de estas herramientas locales:

- `mariadb-dump`
- `mysqldump`

Después de instalarla:

1. Ejecutar `php artisan hospital:backup --type=manual`.
2. Confirmar `backup_logs.status=success`.
3. Verificar checksum con `Get-FileHash`.
4. Restaurar el archivo en una base limpia de prueba siguiendo `docs/BACKUP_RESTORE.md`.
5. Documentar conteos mínimos: users, roles, permissions, services, invoices, payments, cash_register_sessions, backup_logs.
6. Validar `/up`, `/login` y `/verify-email`.

No ejecutar restore en producción hasta completar este restore de prueba.

## Comando Fase 10

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

Guardas del script:

- Requiere `DB_CONNECTION=mysql` o `mariadb`.
- Requiere cliente `mysql`.
- Requiere `mariadb-dump` o `mysqldump`.
- Rechaza `APP_ENV=production` salvo `HOSPITAL_ALLOW_PRODUCTION_VALIDATION=1`.
- Restaura en `RESTORE_TEST_DATABASE`, no en la base activa.
