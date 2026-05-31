# Operational Support Evidence - 2026-05-31

Estado: `IN_PROGRESS`.

Este archivo resume evidencia actual del frente de continuidad operativa,
soporte, diagnostico local, instalacion y capacitacion guiada. No declara
`PRODUCTION_READY`: aun faltan validaciones fisicas y gates amplios.

## Alcance Cubierto En Este Frente

- Ayuda institucional para cajero, supervisor y administrador.
- Mensajes humanos para fallas comunes: servidor no disponible, impresora,
  red local, caja abierta, respaldo fallido, sesion vencida y permisos.
- Evidencia local segura en el navegador para soporte.
- Resumen seguro para soporte desde **Ayuda > Preparar resumen**.
- Diagnostico de reparacion segura por PowerShell.
- Paquete seguro para soporte con manifiesto y logs recortados.
- Manuales no tecnicos para instalacion, soporte, respaldos, cajero,
  supervisor, administrador y capacitacion.

## Evidencia De Codigo Y Commits

| Commit | Evidencia | Estado |
| --- | --- | --- |
| `59034da` | Ayuda muestra evidencia local guardada para soporte. | Implementado |
| `82561d1` | Ayuda incluye escalamiento de soporte y fallos reales de turno. | Implementado |
| `701a14c` | Reparacion segura incluye version instalada y acceso LAN probable. | Implementado |
| `0372711` | Accesos operativos abren el sistema instalado en puerto LAN `8000`. | Implementado |
| `72aa99f` | Ayuda prepara resumen seguro para soporte y conserva capturas. | Implementado |
| `3ec6442` | Manuales explican como usar resumen seguro. | Implementado |
| `9b0c677` | Script `collect_support_packet.ps1` genera paquete seguro de soporte. | Implementado |
| `77a4991` | Instalador usa migraciones no destructivas y agrega `APP_VERSION`. | Implementado |
| `4a0b161` | Instalador registra worker continuo y respaldo diario en tareas Windows. | Implementado |
| `a16ffef` | Manual de usuario se rehizo con lenguaje institucional no tecnico. | Implementado |
| Esta fase | Gate E2E acepta `-UseExistingServer -BaseUrl` para validar instalacion local/LAN sin iniciar Vite; mock E2E cubre reporte mensual y areas para evitar fugas al backend real. | Verificado |
| Esta fase | Diagnostico operativo agrega interfaz instalada y direccion LAN configurada sin exponer rutas absolutas ni secretos. | Verificado |
| Esta fase | Reparacion segura advierte si `APP_URL` usa `localhost`/`127.0.0.1` y orienta a usar IP o nombre LAN para clientes. | Verificado |
| Esta fase | Smoke de worker de backups acepta URL/usuario por entorno, pide contrasena segura si no se pasa en linea de comando y falla con mensaje claro si el servidor no responde. | Verificado |
| Esta fase | Acceso directo `open_hospital_system.ps1` intenta abrir el sistema y, si no responde, ejecuta reparacion segura sin borrar datos y deja diagnostico para soporte. | Verificado |
| Esta fase | Handoff final muestra como bloqueantes las cuatro evidencias: LAN fisica, impresora fisica, restore descartable y concurrencia descartable. | Verificado |
| Esta fase | `validate_lan_client.ps1` protege la evidencia LAN existente y solo la reemplaza con `-Force` explicito. | Verificado |
| Esta fase | Handoff final trata como incompleta una prueba que referencia capturas/fotos locales inexistentes. | Verificado |
| Esta fase | Instalador de tareas de backup valida `DailyBackupTime` antes de reemplazar tareas existentes. | Verificado |
| Esta fase | Reparacion segura aplica redaccion generica de rutas locales y valores sensibles en el diagnostico. | Verificado |
| Esta fase | Reparacion segura usa el mismo detalle sanitizado en consola y en archivo de diagnostico. | Verificado |
| Esta fase | Loop de automatizacion de backups valida `DailyBackupTime` antes de iniciar worker o ciclo diario. | Verificado |
| Esta fase | Arranque manual de servicios valida carpeta/Compose y falla con mensaje humano sin tocar datos. | Verificado |
| Esta fase | Instalador LAN difiere el modo consola hasta que `Run-SetupCli` este definido, evitando fallo en equipos sin GUI/WPF. | Verificado |
| Esta fase | Instalador LAN usa texto visible ASCII para evitar mojibake en consola/WPF durante soporte offline. | Verificado |
| Esta fase | Instalador de acceso directo valida URL/carpeta antes de tocar escritorio o tareas y ofrece `-WhatIfOnly` para soporte. | Verificado |
| Esta fase | Paquete seguro para soporte valida carpeta, limites y `-WhatIfOnly` antes de crear archivos. | Verificado |
| Esta fase | Handoff final sanitiza rutas locales tambien en consola, no solo en el reporte. | Verificado |
| Esta fase | Reparacion segura valida ruta de diagnostico y `-WhatIfOnly` antes de tocar Docker, navegador o archivos. | Verificado |

## Evidencia Visual Disponible

| Carpeta | Contenido | Resultado |
| --- | --- | --- |
| `qa/screenshots/rc-help-support-2026-05-31/` | Ayuda institucional en claro/oscuro con reporte JSON. | Sin errores de consola reportados; evidencia local visible; sin palabras sensibles detectadas. |
| `qa/screenshots/rc-backups-status-2026-05-31/` | Vista de respaldos y estado operativo en claro/oscuro. | Estado resumido visible para operador y detalle avanzado separado. |
| `qa/screenshots/rc-lan-api-relative-2026-05-31/` | Flujos principales usando rutas API relativas para LAN. | Capturas claro/oscuro de dashboard, facturacion, respaldos y reportes. |

## Evidencia De Scripts Operativos

### Reparacion Segura

Comando verificado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -SkipDockerStart -NoBrowser -Retries 1 -DelaySeconds 1 -ReportPath qa\diagnostics\repair-script-smoke.md
```

Resultado observado en esta linea de trabajo:

- No borra datos.
- No elimina volumenes.
- No ejecuta seeders.
- No restaura backups automaticamente.
- Genera diagnostico sanitizado.
- Revisa `/up`, `/api/health`, `/login`, `/verify-email`, Docker, build
  frontend, espacio en disco, IP LAN probable y tareas de backup.
- Advierte cuando `APP_URL` no esta preparada para clientes LAN.

### Paquete Seguro Para Soporte

Comando verificado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\collect_support_packet.ps1 -OutputDir qa\support-packets\script-smoke -TailLines 5 -RunRepairDiagnostic -SkipDockerStart -RepairRetries 1 -RepairDelaySeconds 1
```

Resultado observado:

- Genero `MANIFIESTO.md`, `LOCAL_REPAIR_DIAGNOSTIC.md` y `laravel-log-tail.md`.
- Escaneo local no encontro rutas reales del proyecto, rutas de usuario ni
  valores asignados a claves sensibles como `APP_KEY`, `DB_PASSWORD`, `TOKEN`
  o `SECRET`.
- La evidencia temporal fue eliminada del repositorio despues de verificar.

## Pruebas Y Gates Ejecutados En Este Frente

| Comando | Resultado |
| --- | --- |
| `npm.cmd test -- HelpView.test.tsx clientIssueLog.test.ts` | Paso: 4 tests. |
| `npm.cmd run typecheck` | Paso. |
| `npm.cmd run lint` | Paso. |
| `npm.cmd run build` | Paso con warning de chunk grande existente. |
| `php artisan test tests/Feature/SystemStatusTest.php` | Paso en subfase de version instalada/diagnostico. |
| `php artisan test tests/Feature/CashPaymentsReceiptTest.php` | Paso: 18 tests, ejecutado por cambios concurrentes de pagos/caja. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-branding.ps1` | Paso sin hallazgos. |
| Parser PowerShell de `repair_hospital_system.ps1` y `collect_support_packet.ps1` | Paso. |
| `repair_hospital_system.ps1` smoke con `APP_URL` LAN real | Paso con **Direccion APP_URL para LAN** en OK; conserva warnings esperados de `APP_VERSION`/tareas en este entorno. |
| `repair_hospital_system.ps1` smoke temporal con `APP_URL=http://127.0.0.1:8000` | Paso de la nueva regla: reporta **REVISION** y recomienda usar IP/nombre LAN para clientes. |
| Parser PowerShell de `validate_backup_worker_smoke.ps1` | Paso. |
| `validate_backup_worker_smoke.ps1` sin parametros | Falla antes de red con instruccion clara para `-BaseUrl` o `HOSPITAL_SMOKE_BASE_URL`, sin traza tecnica de PowerShell. |
| `validate_backup_worker_smoke.ps1` con variables de entorno y servidor cerrado | Falla antes de crear respaldo con mensaje humano sobre servidor/BaseUrl/LAN, sin traza tecnica de PowerShell. |
| `validate_backup_worker_smoke.ps1` manejo de errores API | Endurecido para login, permisos, token vencido, respuesta no JSON y error interno sin mostrar contrasenas ni trazas tecnicas de PowerShell al operador. |
| Parser PowerShell de `open_hospital_system.ps1` | Paso. |
| `open_hospital_system.ps1` con servidor cerrado y `-SkipRepair` | Falla con mensaje humano y recomienda ejecutar reparacion segura desde el servidor. |
| `open_hospital_system.ps1` con servidor cerrado y reparacion segura `-SkipDockerStart -NoBrowser` | Ejecuta `repair_hospital_system.ps1`, genera diagnostico en ruta indicada y termina sin borrar datos ni abrir navegador. |
| Parser PowerShell de `final_production_handoff.ps1` | Paso. |
| `final_production_handoff.ps1 -SkipPreflight` | Paso: genero reporte `PRODUCTION_CANDIDATE`, mostro LAN/impresora/restore/concurrencia, bloqueo por evidencia fisica de impresora incompleta y sanitizo `%PROJECT_ROOT%`. |
| Parser PowerShell de `validate_lan_client.ps1` | Paso. |
| `validate_lan_client.ps1` con evidencia existente sin `-Force` | Falla antes de tocar red, conserva el archivo existente y muestra instruccion para usar `-Force` solo si se reemplaza intencionalmente. |
| `validate_lan_client.ps1` con `-Force` sobre archivo temporal | Regenera borrador temporal, marca rutas fallidas y mantiene `PRODUCTION_READY` bloqueado. |
| `final_production_handoff.ps1` con referencias de evidencia inexistentes | Paso: marco LAN, impresora, restore y concurrencia como `MISS`, genero `PRODUCTION_CANDIDATE` y mantuvo rutas sanitizadas en el reporte. |
| Parser PowerShell de `install_backup_tasks_windows.ps1` | Paso. |
| `install_backup_tasks_windows.ps1 -WhatIfOnly -DailyBackupTime 99:99` | Falla con mensaje humano antes de registrar, actualizar o remover tareas. |
| `install_backup_tasks_windows.ps1 -WhatIfOnly -DailyBackupTime 23:30` | Paso: muestra comandos y confirma que no registra tareas en modo WhatIf. |
| Parser PowerShell de `repair_hospital_system.ps1` despues de redaccion extra | Paso. |
| `repair_hospital_system.ps1` smoke sanitizado | Paso: genero diagnostico temporal sin `C:\Projects\S_Hospital`, rutas de usuario ni valores crudos tipo `APP_KEY`, `DB_PASSWORD`, `TOKEN` o `SECRET`; evidencia temporal eliminada. |
| Consola de `repair_hospital_system.ps1` | Paso: los mensajes `ERROR` y `REVISION` usan el mismo detalle sanitizado que el archivo de diagnostico. |
| Parser PowerShell de `run_backup_scheduler_loop.ps1` | Paso. |
| `run_backup_scheduler_loop.ps1 -DailyBackupTime 99:99` | Falla al inicio con mensaje y log humano; no inicia worker ni ciclo diario. |
| Parser PowerShell de `start_hospital_services.ps1` | Paso. |
| `start_hospital_services.ps1` con carpeta sin Compose | Falla antes de llamar Docker, muestra mensaje humano y recuerda no borrar datos, volumenes, respaldos ni `.env`. |
| Parser PowerShell de `install_hospital_os.ps1` | Paso. |
| AST de `install_hospital_os.ps1` para `Run-SetupCli` | Paso: existe una sola llamada y ocurre despues de la definicion de la funcion. |
| ASCII check de `scripts\install_hospital_os.ps1` | Paso: no quedan caracteres no ASCII en el instalador visible. |
| Parser PowerShell de `install_hospital_startup_shortcut.ps1` | Paso. |
| `install_hospital_startup_shortcut.ps1 -Url ftp://invalid.local -WhatIfOnly` | Falla antes de crear acceso directo o tarea, con mensaje humano sobre usar `http://` o `https://`. |
| `install_hospital_startup_shortcut.ps1 -Url http://127.0.0.1:8000 -WhatIfOnly` | Paso: valida carpeta/script y confirma que no crea acceso directo ni tarea. |
| Parser PowerShell de `collect_support_packet.ps1` despues de endurecer salida | Paso. |
| `collect_support_packet.ps1 -OutputDir C:\tmp\support-packet-outside -WhatIfOnly` | Falla antes de crear carpeta, con mensaje humano de usar carpeta dentro del sistema. |
| `collect_support_packet.ps1 -OutputDir ..\support-packet-outside -WhatIfOnly` | Falla antes de crear carpeta; la ruta relativa se normaliza antes de validar contencion. |
| `collect_support_packet.ps1 -WhatIfOnly -TailLines 5 -RepairRetries 1 -RepairDelaySeconds 1` | Paso: valida parametros y confirma que no crea carpeta ni copia logs. |
| `final_production_handoff.ps1 -SkipPreflight` con `-PhpPath C:\tmp\php.exe` | Paso: consola y reporte usan `%PROJECT_ROOT%` o `[ruta-local]`, sin rutas locales crudas. |
| `repair_hospital_system.ps1 -ReportPath C:\tmp\repair-outside.md -WhatIfOnly` | Falla antes de escribir diagnostico, levantar Docker o abrir navegador. |
| `repair_hospital_system.ps1 -ReportPath qa\diagnostics\repair-whatif.md -WhatIfOnly -Retries 1 -DelaySeconds 1` | Paso: valida parametros y confirma que no escribe diagnostico. |
| Parser PowerShell de `scripts\e2e_gate.ps1` | Paso. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\e2e_gate.ps1` | Paso: 2 specs Playwright. Detecto y se corrigio fuga de `/api/areas?active=1` al backend local durante el flujo Reportes -> Respaldos. |
| `php artisan test tests/Feature/SystemStatusTest.php` | Paso: 7 tests, 47 assertions. |
| `npm.cmd test -- App.test.tsx` | Paso: 11 tests. |
| `vendor\bin\pint --test app\Http\Controllers\SystemStatusController.php tests\Feature\SystemStatusTest.php` | Paso. |
| `npm.cmd run lint` | Paso despues del diagnostico interfaz/LAN. |
| `npm.cmd run build` | Paso despues del diagnostico interfaz/LAN, con warning de chunk grande existente. |

## Hallazgos Operativos Pendientes

- Validar en una PC instalada que el `.env` generado por instalador conserva
  `APP_VERSION` real para diagnosticos.
- Validar en una PC instalada que `SistemaCajaHospitalaria-BackupWorker` queda
  `Running` y que `SistemaCajaHospitalaria-DailyBackup` queda registrado con la
  hora institucional acordada.
- Falta validar desde una segunda computadora LAN usando IP fija o nombre local.
- Falta prueba fisica de impresora institucional media carta/carta/A5.
- Falta repetir restore MySQL/MariaDB en el servidor final si cambia equipo,
  rutas de dump o base real.
- Falta full gate final despues de estabilizar cambios concurrentes:
  backend tests completos, Pint, frontend tests/build, E2E real contra servidor
  instalado y smoke navegador.
- Falta cerrar evidencia fisica en `qa/LAN_CLIENT_VALIDATION_PROOF.md` y
  `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.

## Riesgos Que Siguen Abiertos

- Si el worker de backups no queda como tarea/servicio continuo, un respaldo
  manual puede quedarse en `pending`.
- Si los clientes usan `localhost` en vez de la IP del servidor, cada PC buscara
  su propio equipo y parecera que el sistema no abre.
- Si se repite una factura o un cobro despues de un reinicio sin revisar
  Historial y Caja, se puede crear confusion operativa aunque la base conserve
  auditoria.
- Si soporte recibe `.env`, respaldos SQL o logs completos por canales no
  autorizados, se exponen secretos o datos operativos innecesarios.

## Decision Actual

El frente mejora la continuidad diaria, pero el estado correcto sigue siendo
`IN_PROGRESS` / `PRODUCTION_CANDIDATE`. No hay evidencia suficiente para
declarar instalacion final lista hasta completar validacion LAN fisica,
impresora fisica, restore final, tareas de backup y gates completos.
