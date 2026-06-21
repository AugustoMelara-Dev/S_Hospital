# Fase G - Prueba fisica LAN/offline real

Estado inicial: `READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST`  
Estado permitido si todo pasa: `Decision: PRODUCTION_READY` en `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md`
Estado actual hasta ejecutar hardware real: `Decision: READY_FOR_REAL_LAN_INSTALLATION_TEST`

No usar esta guia para declarar produccion lista con pruebas locales. La validacion debe ocurrir en el servidor final o PC final, con una segunda PC cliente en la misma LAN y la impresora real o configuracion exacta aprobada por el hospital.

## 1. Preflight de Git

Antes de instalar o capturar evidencia:

```powershell
git branch --show-current
git rev-parse HEAD
git rev-parse origin/fix/f7-operational-release-gate
git status --short --untracked-files=all
```

El artefacto usado debe corresponder al commit publicado que se va a instalar. Si se regenera el paquete offline despues de commits documentales, registrar el nuevo HEAD en `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md`.

## 2. Preparar artefacto offline

En una maquina de build con internet y Docker disponible:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -Force
powershell.exe -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit
```

Registrar en evidencia:

- Nombre del ZIP/paquete generado.
- Commit incluido en `MANIFEST.txt`.
- SHA256 del paquete.
- Resultado de `assert_offline_release_clean.ps1`.

No copiar `.env` real, backups SQL, logs, `node_modules` ni evidencia QA local dentro del paquete.

## 3. Instalar en servidor o PC final

En el servidor final:

1. Configurar IP fija o reserva DHCP.
2. Instalar Docker Desktop/Engine o runtime aprobado para el paquete offline.
3. Cargar imagenes offline si aplica:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\load_offline_images.ps1
```

4. Crear `.env` real fuera de Git con:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=http://IP_DEL_SERVIDOR
SANCTUM_STATEFUL_DOMAINS=IP_DEL_SERVIDOR
```

5. Levantar servicios:

```powershell
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env exec backend php artisan migrate --force
docker compose -f docker-compose.prod.yml --env-file .env exec backend php artisan config:cache
```

6. Crear admin real con entrada segura, no por argumento visible:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy_hospital_lan.ps1
```

No ejecutar `php artisan migrate:fresh`, seeders de validacion ni comandos destructivos sobre la base real.

## 4. Validar desde segunda PC LAN

Desde una segunda PC en la misma LAN, no desde el servidor:

```powershell
cd C:\Projects\S_Hospital
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

Si ya existe una evidencia historica contra otra IP y el responsable tecnico autoriza reemplazarla, repetir el comando con `-Force`. Para el cierre actual contra la IP final validada:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 `
  -BaseUrl http://192.168.1.10:8081 `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md `
  -Force
```

Completar manualmente en `qa/LAN_CLIENT_VALIDATION_PROOF.md`:

- Login.
- Navegacion principal.
- Dashboard.
- Caja.
- Emision de factura.
- Pago.
- Reimpresion.
- Reportes.
- Backup manual desde UI y cambio `pending` -> `success`.

## 5. Prueba fisica de impresion

Completar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` desde la PC de caja real.

Validar el formato institucional principal configurado/aprobado:

- Carta.
- Media carta o A5 si aplica.
- 80mm/58mm solo si el hospital tiene impresora termica configurada.

Registrar explicitamente cualquier tamano fuera de alcance actual como `NO APLICA` con motivo, no como `PASS`.

Confirmar:

- Una factura por impresion.
- Fondo blanco y legibilidad.
- Hospital, RTN/CAI si aplica, numero, fecha, paciente, cajero, servicios, metodo de pago y totales.
- Ausencia de QR, codigo de barras, codigos internos y campos tecnicos.
- Reimpresion desde historial con motivo.

## 6. Backup y restore en base descartable

Desde UI admin:

1. Crear backup manual.
2. Esperar estado `success`.
3. Registrar nombre del archivo en `qa/FINAL_RESTORE_PROOF.md`.
4. Calcular SHA256:

```powershell
Get-FileHash RUTA_DEL_BACKUP -Algorithm SHA256
```

Restaurar en una base descartable, nunca sobre la activa:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
  -UseExistingEnv `
  -TargetDatabase hospital_restore_validation_test `
  -BackupFile RUTA_DEL_BACKUP
```

Validar:

- `php artisan migrate:status`.
- Conteos de `users`, roles, permissions, services, invoices, payments, cash_register_sessions, backup_logs`.
- Login basico contra entorno restaurado si se levanta app descartable.

## 7. Concurrencia real

Ejecutar solo contra base descartable o snapshot aprobado. No usar datos vivos sin ventana de mantenimiento.

```powershell
$env:HOSPITAL_VALIDATE_REAL_MYSQL="1"
$env:HOSPITAL_CONCURRENCY_BASE_URL="http://IP_DEL_SERVIDOR"
$env:HOSPITAL_CONFIRM_CONCURRENCY_TARGET="http://IP_DEL_SERVIDOR"
$env:HOSPITAL_CONCURRENCY_TARGET_ENV="validation"
$env:HOSPITAL_CONCURRENCY_LOGIN="usuario.temporal"
$env:HOSPITAL_CONCURRENCY_PASSWORD="password-temporal"
$env:HOSPITAL_CONCURRENCY_EVIDENCE_PATH="qa/FINAL_CONCURRENCY_PROOF.md"
bash scripts/validate_mysql_concurrency.sh
```

Documentar:

- Doble apertura de caja.
- Doble facturacion.
- Doble pago.
- Cierre de caja con operaciones simultaneas.
- Resultado esperado y resultado real.

## 8. Handoff final

Cuando las seis evidencias finales esten completas:

- `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
- `qa/FINAL_RESTORE_PROOF.md`
- `qa/FINAL_CONCURRENCY_PROOF.md`
- `qa/FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md`
- `qa/FINAL_REAL_SMOKE_LAN_8081.md`

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR

powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 `
  -BaseUrl http://IP_DEL_SERVIDOR `
  -PhpPath C:\xampp\php\php.exe
```

Si algo falta o falla, `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` debe mantener:

```text
Decision: READY_FOR_REAL_LAN_INSTALLATION_TEST
```

Solo con evidencia fisica completa y preflight exitoso puede cambiarse a:

```text
Decision: PRODUCTION_READY
```
