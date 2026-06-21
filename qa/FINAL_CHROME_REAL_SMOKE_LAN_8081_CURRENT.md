# Final Chrome real smoke LAN 8081

Fecha local: 2026-06-17
Base URL: http://192.168.1.7:8081
Stack: Docker Compose final, MariaDB, Nginx, backend Laravel, frontend React build productivo.

## Resultado

Chrome real cargo, autentico y navego las rutas principales del sistema final antes de que la conexion del plugin de Chrome se cerrara.

Usuario temporal utilizado:
- username: smoke.current
- estado final verificado: active=false
- cajas abiertas restantes: 0

## Rutas autenticadas verificadas en Chrome real

Todas pasaron sin 404 crudo, sin error boundary y con el texto esperado:

- /dashboard
- /billing/new
- /cashbox
- /catalog
- /invoices
- /reports
- /backups
- /settings/fiscal
- /settings/institutional-receipts
- /admin/users
- /help
- /about
- /ruta-inexistente-visual-smoke

La ruta /ruta-inexistente-visual-smoke ya no devuelve "404 NOT FOUND" crudo de servidor; carga la SPA y muestra el estado de React "Ruta no encontrada".

## Diagnostico Chrome

Despues del barrido, la conexion Chrome del plugin se cerro con "native pipe is closed".

Checks ejecutados:
- Chrome esta corriendo: PASS
- Google Chrome instalado: PASS
- Codex Chrome Extension instalada y habilitada en perfil Default: PASS
- Native host manifest: FAIL

Detalle del fallo:
- registry key faltante: HKCU\Software\Google\Chrome\NativeMessagingHosts\com.openai.codexextension

No se reparo manualmente porque las instrucciones del plugin indican no instalar ni reparar el native host desde aqui. Debe repararse/reinstalarse el plugin desde la UI de Codex si se necesita seguir usando Chrome real.

## Tareas Windows de backup

Comando de estado ejecutado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest -Status
```

Resultado:
- SistemaCajaHospitalaria-BackupWorker: no instalada
- SistemaCajaHospitalaria-DailyBackup: no instalada

Intento de instalacion elevada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest -UpdateExisting -LaunchElevated
```

Resultado:
- Windows solicito elevacion UAC.
- La ejecucion elevada termino sin instalar las tareas.
- Bloqueo restante: ejecutar desde PowerShell como Administrador o aprobar UAC.

## Preflight final

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://192.168.1.7:8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest -AllowMissingPhysicalProof
```

Resultado:
- APP_ENV=production: OK
- APP_DEBUG=false: OK
- APP_URL LAN: OK
- DB MariaDB/MySQL: OK
- CORS/Sanctum LAN: OK
- Docker backend/queue/scheduler/nginx/soketi/mysql: healthy
- Validacion/demo users activos: OK, ninguno activo
- Current-user backup Startup/HKCU fallback: OK
- Admin scheduled backup tasks: WARNING/FAIL
- Physical LAN/printer proof bypassed: FAIL

Estado:

```text
PRODUCTION_READY: NO (3 blocking issue(s))
```

## Bloqueos no cerrados

1. Instalar tareas Windows elevadas:
   - SistemaCajaHospitalaria-BackupWorker
   - SistemaCajaHospitalaria-DailyBackup
2. Ejecutar prueba LAN desde segunda computadora real sin -AllowMissingPhysicalProof.
3. Adjuntar evidencia fisica de impresion institucional en media carta/carta/A5/80mm/58mm.

