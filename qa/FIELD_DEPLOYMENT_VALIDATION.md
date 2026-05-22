# Field deployment validation - Fase 11

Fecha: 2026-05-17
Entorno: Windows local en `C:\Projects\S_Hospital`, Laravel servido en `http://192.168.1.7:8000`, MySQL/MariaDB XAMPP local.

## Estado oficial

- DEMO_READY: si.
- PRODUCTION_CANDIDATE: si.
- PRODUCTION_READY: no.

Fase 11 valida partes reales del entorno, pero no declara produccion final porque falta completar validacion fisica desde cliente LAN independiente, impresora termica real 80mm/58mm y configuracion final `APP_ENV=production` / `APP_DEBUG=false` con admin real.

## Entorno detectado

| Area | Resultado |
|---|---|
| Sistema operativo | Windows local |
| IP LAN servidor | `192.168.1.7` en Wi-Fi, gateway `192.168.1.1` |
| Laravel | Escuchando en `0.0.0.0:8000` |
| MySQL/MariaDB | XAMPP MariaDB escuchando en `0.0.0.0:3306` |
| Cliente mysql | Disponible en `C:\xampp\mysql\bin\mysql.exe` |
| Dump MySQL | Disponible en `C:\xampp\mysql\bin\mysqldump.exe` |
| Docker | CLI instalado, daemon no disponible |
| Frontend build | `frontend/dist/index.html` existe y apunta a `index-DRjLDW88.js` |
| APP_ENV actual | `local` |
| APP_DEBUG actual | `true` |
| Base activa actual | `hospital_billing` |

## Restore real MySQL/MariaDB

Estado: VALIDATED en base descartable local.

Comando ejecutado:

```bash
PATH="/c/xampp/php:/c/xampp/mysql/bin:$PATH" \
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 \
RESTORE_TEST_DATABASE=hospital_restore_validation_test \
HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test \
scripts/validate_restore_mysql.sh
```

Guardas relevantes:

- `RESTORE_TEST_DATABASE` fue `hospital_restore_validation_test`.
- La base descartable no coincide con `DB_DATABASE=hospital_billing`.
- El nombre contiene `restore`, `validation` y `test`.
- Se imprimio advertencia antes de `DROP DATABASE`.
- No se expusieron passwords en logs.

Backup usado:

- Archivo: `hospital-backup-20260517-204322-lcsexyiz.sql`.
- Ruta registrada: `backups/hospital-backup-20260517-204322-lcsexyiz.sql`.
- Tamano: `83475` bytes.
- SHA256: `5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362`.
- Resultado: restore completado en `hospital_restore_validation_test`.

Conteos en base restaurada:

| Tabla | Conteo |
|---|---:|
| users | 3 |
| roles | 3 |
| permissions | 27 |
| services | 122 |
| invoices | 1 |
| payments | 1 |
| cash_register_sessions | 1 |
| backup_logs | 5 |

## Concurrencia real MySQL/MariaDB

Estado: VALIDATED en entorno local mutante, no en produccion real.

Comando ejecutado:

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 \
HOSPITAL_CONCURRENCY_BASE_URL=http://192.168.1.7:8000 \
HOSPITAL_CONCURRENCY_TARGET_ENV=local \
HOSPITAL_CONFIRM_CONCURRENCY_TARGET=http://192.168.1.7:8000 \
HOSPITAL_ALLOW_DEMO_VALIDATION=1 \
scripts/validate_mysql_concurrency.sh
```

Resultado:

```json
{
  "status": "VALIDATED",
  "baseUrl": "http://192.168.1.7:8000",
  "target_env": "local",
  "run_id": "concurrency-validation-20260517T20435",
  "cleanup": "NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT",
  "checks": {
    "double_cash_open": [201, 422],
    "concurrent_invoice_numbers": [
      "000-001-01-00000002",
      "000-001-01-00000003"
    ],
    "double_payment": [201, 422]
  }
}
```

Datos creados con `RUN_ID` visible:

| Factura | Paciente | Estado | Total | Pagado |
|---|---|---|---:|---:|
| `000-001-01-00000002` | `Concurrente Uno concurrency-validation-20260517T20435` | paid | 28.75 | 28.75 |
| `000-001-01-00000003` | `Concurrente Dos concurrency-validation-20260517T20435` | issued | 28.75 | 0.00 |

La limpieza no se ejecuto porque facturas y pagos son registros auditables. Para repetir esta prueba en campo, usar snapshot/base descartable.

## LAN

Estado: PARTIAL_VALIDATED / PENDING_LAN_CLIENT_VALIDATION.

Validado desde la PC servidor usando la IP LAN:

- `http://192.168.1.7:8000/up`: 200.
- `http://192.168.1.7:8000/login`: 200.
- `http://192.168.1.7:8000/verify-email`: 200.
- `http://192.168.1.7:8000/assets/index-DRjLDW88.js`: 200 con `Content-Type: text/javascript; charset=UTF-8`.
- Login por API con CSRF: 200.

Pendiente para produccion final:

- Ejecutar el mismo checklist desde otra computadora cliente conectada a la red del hospital.
- Confirmar firewall Windows en perfil privado.
- Confirmar IP fija o reserva DHCP.
- Confirmar que los clientes usan `http://192.168.1.7:8000` o nombre local, nunca `localhost`.

Helper operativo agregado:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

El helper solo automatiza `/up`, `/login`, `/verify-email` y asset JS. El
operador debe completar en navegador real login, caja, factura, pago, recibo,
historial, reportes y backup `pending` -> `success`.

## Impresora termica

Estado: PENDING_HARDWARE_VALIDATION.

No se ejecuto impresion fisica porque no se confirmo hardware disponible. Checklist pendiente:

- Impresion 80mm desde navegador real de caja.
- Impresion 58mm desde navegador real de caja.
- Escala 100%.
- Margenes minimos o ninguno.
- Reimpresion desde historial.
- Confirmar que no sale como hoja carta.

## Worker real de backups

Estado: PARTIAL_VALIDATED.

Validado:

- `POST /api/backups` como admin creo backup `pending` con respuesta 202.
- `php artisan queue:work --queue=backups --tries=1 --timeout=600 --once` proceso el job.
- Primer intento sin `mysqldump` en PATH fallo controlado con mensaje operativo sin credenciales.
- Al ejecutar restore con PATH incluyendo XAMPP, `php artisan hospital:backup --type=manual` creo backup `success`.

Pendiente para servidor real:

- Dejar `C:\xampp\mysql\bin` o la ruta de MySQL/MariaDB real en PATH del servicio/tarea Windows.
- Ejecutar el worker continuo:

```powershell
cd C:\HospitalBilling\backend
php artisan queue:work --queue=backups --tries=1 --timeout=600
```

## Produccion real

Estado: PENDING_ENVIRONMENT_VALIDATION.

El entorno actual sigue en `APP_ENV=local` y `APP_DEBUG=true`, correcto para validacion local. No se modifico a produccion sin confirmacion explicita.

Antes de entregar como produccion:

- Configurar `APP_ENV=production`.
- Configurar `APP_DEBUG=false`.
- Crear admin real con `php artisan auth:create-initial-admin`.
- No ejecutar seeders demo.
- Ejecutar migraciones aprobadas sin `migrate:fresh`.
- Ejecutar `php artisan config:cache --no-ansi`.
- Validar `php artisan route:list`.
- Validar worker de backups como tarea/servicio Windows.

## Resultado Fase 11

Fase 11 eleva la evidencia tecnica de campo, pero el sistema queda:

- DEMO_READY: si.
- PRODUCTION_CANDIDATE: si.
- PRODUCTION_READY: no.

Bloqueantes restantes para `PRODUCTION_READY`: cliente LAN fisico completo, impresora termica fisica 80mm/58mm y configuracion final de produccion con admin real.
