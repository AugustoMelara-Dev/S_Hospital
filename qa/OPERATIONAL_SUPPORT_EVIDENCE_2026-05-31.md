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
