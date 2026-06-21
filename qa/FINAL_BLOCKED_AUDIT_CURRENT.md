# Final blocked audit current

Fecha local: 2026-06-19
Base URL final actual: http://192.168.1.37:8081
Decision: READY_FOR_REAL_LAN_INSTALLATION_TEST

## Estado verificable en esta PC

- Docker stack final `shospital_offlinetest`: healthy.
- MariaDB/MySQL final: operativo.
- `http://192.168.1.37:8081/up`: 200 OK.
- `http://192.168.1.37:8081/api/system/echo-config`: 200 OK y `host=192.168.1.37`.
- `C:\tmp\s_hospital_offlinetest.env`: `APP_URL`, `SERVER_IP`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS` y `PUSHER_CLIENT_HOST` ya apuntan a `192.168.1.37`.
- `scripts\refresh_lan_ip.ps1`: ejecutado con `-EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest`; termino limpio y recreo backend, queue-worker, scheduler y nginx sin borrar volumenes.
- `qa/LAN_CLIENT_VALIDATION_PROOF.md`: validado con segunda PC fisica el 2026-06-17 contra `192.168.1.7:8081`; debe repetirse contra `192.168.1.37:8081` si esta es la IP final.
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`: PDF institucional validado; impresion fisica en papel sigue pendiente.
- Fallback de backups para usuario actual: instalado en Startup/HKCU.
- `qa/production-audit/button-smoke-report.json`: generado el 2026-06-19; smoke E2E no destructivo paso pantallas principales en desktop/mobile, controles nombrados, axe serious/critical y cancelacion de accion destructiva.
- `scripts\quality_gate_windows.ps1 -CriticalOnly`: `WINDOWS_QUALITY_GATE_PASSED` el 2026-06-19 despues del smoke de botones/a11y y del fix del runner golden DB.
- qa/production-audit/golden-db-runner-proof.md: generado el 2026-06-19; runner MySQL/MariaDB rapido validado con MariaDB temporal, primera corrida reconstruyo golden y segunda corrida reutilizo hash en 9.4s.

## Preflight actual

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://192.168.1.37:8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest
```

Resultado relevante:

```text
[ OK ] APP_URL matches BaseUrl
[ OK ] PUSHER_CLIENT_HOST matches BaseUrl host
[ OK ] SANCTUM_STATEFUL_DOMAINS includes LAN host
[ OK ] CORS origins are same-origin or include BaseUrl
[ OK ] Elevated Windows backup task proof confirms SistemaCajaHospitalaria tasks are Ready as SYSTEM.
[WARN] Windows denied access while validating scheduled task 'SistemaCajaHospitalaria-BackupWorker'. Run this preflight from an elevated PowerShell window.
[WARN] Windows denied access while validating scheduled task 'SistemaCajaHospitalaria-DailyBackup'. Run this preflight from an elevated PowerShell window.
[FAIL] LAN client proof is marked as historical or requiring repeat; rerun scripts\validate_lan_client.ps1 from the second PC against final BaseUrl http://192.168.1.37:8081.
[FAIL] Complete a checked evidence item with a result for 'media carta' in %PROJECT_ROOT%\qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md.
PRODUCTION_READY: NO (2 blocking issue(s))
```

## Evidencia administrativa cerrada

### Tareas Windows elevadas

Accion realizada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest -UpdateExisting -LaunchElevated
```

Log elevado:

```text
[2026-06-19 05:15:05] Scheduled tasks registered successfully.
[2026-06-19 05:15:07] SistemaCajaHospitalaria-BackupWorker: state=Ready, lastRun=11/30/1999 00:00:00, lastResult=267011, nextRun=, user=SYSTEM.
[2026-06-19 05:15:08] SistemaCajaHospitalaria-DailyBackup: state=Ready, lastRun=11/30/1999 00:00:00, lastResult=267011, nextRun=06/20/2026 02:00:00, user=SYSTEM.
```

Estado actual: cerrado por evidencia elevada reciente. El preflight no elevado aun muestra advertencias de acceso a tareas SYSTEM, pero acepta `qa\WINDOWS_BACKUP_TASK_ELEVATED_INSTALL.log` porque el ultimo intento elevado registra ambas tareas `Ready` como `SYSTEM` y no tiene `ERROR` posterior.

## Bloqueos que impiden PRODUCTION_READY

### 1. Impresion fisica institucional

Archivo actual: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`

Estado:

```text
Estado actual: PARCIALMENTE VALIDADO
Decision actual: PDF_RECEIPT_VALIDATED_PHYSICAL_PRINT_PENDING
```

Bloqueo real:

```text
Media carta result: PENDIENTE DE IMPRESION FISICA
Carta result: PENDIENTE DE IMPRESION FISICA
A5 result: PENDIENTE DE IMPRESION FISICA
Margins/browser headers-footers: PENDIENTE DE FOTO/ACTA DE PAPEL IMPRESO
```

Accion externa requerida: imprimir con impresora/configuracion real y completar evidencia fisica al menos del formato institucional aprobado en papel real. Las impresoras virtuales validan PDF/layout, pero no sustituyen alimentacion, escala, margenes, orientacion, drivers ni legibilidad fisica.

### 2. Segunda PC LAN contra la IP final

La segunda PC fisica ya fue validada contra `192.168.1.7:8081` en `qa/LAN_CLIENT_VALIDATION_PROOF.md`.

Como la IP final actual es `192.168.1.37`, debe repetirse el checklist desde la segunda PC contra la IP final:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.37:8081 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force
```

Como `qa\LAN_CLIENT_VALIDATION_PROOF.md` ya existe con evidencia historica contra `192.168.1.7:8081`, el tecnico debe usar `-Force` solo para reemplazar esa evidencia autorizada por la prueba final.

## Conclusion

No se puede declarar `PRODUCTION_READY` todavia. Lo que si quedo cerrado hoy:

- IP LAN productiva corregida a `192.168.1.37`.
- Realtime LAN corregido a `PUSHER_CLIENT_HOST=192.168.1.37`.
- Fallback de backups Startup/HKCU instalado.
- Instalacion elevada de tareas reportada como exitosa en log administrador.
- Preflight funcional y sin fallos de APP_URL/CORS/Sanctum/WebSocket.

Para cerrar entrega final faltan evidencias externas/fisicas:

- Segunda PC LAN repetida contra `http://192.168.1.37:8081`.
- Impresion fisica en papel real.
