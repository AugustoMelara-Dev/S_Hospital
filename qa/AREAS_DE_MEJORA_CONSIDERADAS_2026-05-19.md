# Areas de mejora consideradas - S_Hospital Offline

Fecha: 2026-05-19
Alcance: consolidar las areas de mejora consideradas para el estado actual de `C:\Projects\S_Hospital`, separando lo ya cerrado, lo pendiente para `PRODUCTION_READY` y lo recomendable para fases posteriores sin ampliar el alcance hospitalario.

## Resumen ejecutivo

El sistema esta en estado `PRODUCTION_CANDIDATE`: puede presentarse en validacion institucional local/controlada, pero no debe declararse `PRODUCTION_READY` hasta cerrar evidencia fisica y operativa de campo.

Actualizacion de cierre repo-local:

- El panel operativo ya no muestra la evidencia fisica como pendiente fija: `/api/system/status` evalua `qa/LAN_CLIENT_VALIDATION_PROOF.md` y `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` como `pending`, `partial` o `validated`.
- Aun con ambas evidencias `validated`, el sistema mantiene `PRODUCTION_READY=false` hasta que el preflight final pase sin bypass.
- En Windows, `scripts/production_readiness_preflight.ps1` ahora bloquea si faltan `SistemaCajaHospitalaria-BackupWorker` o `SistemaCajaHospitalaria-DailyBackup`, o si el worker continuo no esta `Running`.
- Restore y concurrencia final ya tienen plantillas de evidencia (`qa/FINAL_RESTORE_PROOF.example.md`, `qa/FINAL_CONCURRENCY_PROOF.example.md`) y el preflight las exige sin bypass.
- `scripts/validate_restore_mysql.sh`, `scripts/validate_mysql_concurrency.mjs` y `scripts/validate_backup_worker_smoke.ps1` pueden generar evidencia durable para restore, concurrencia y worker `pending` a `success`.
- Se agregaron manuales cortos para cajero, admin y cierre diario en `docs/TRAINING_CAJERO.md`, `docs/TRAINING_ADMIN.md` y `docs/DAILY_CLOSE_PROTOCOL.md`.
- Se corrigio la exportacion de caja propia para que `reports.cash_session.view + reports.export` funcione solo con `cash_session_id` propio.
- El estado honesto sigue siendo `PRODUCTION_CANDIDATE` mientras no exista evidencia real de segunda PC LAN, impresora fisica y entorno final.

Las mejoras consideradas se agrupan en tres niveles:

1. Bloqueantes de produccion real: segunda PC en LAN, impresora institucional fisica media carta/carta/A5/80mm/58mm, entorno production final y worker continuo de backups.
2. Mejoras de robustez operativa: automatizacion de respaldo, repeticion de restore/concurrencia en servidor final, smoke real, diagnostico visible y hardening de permisos.
3. Mejoras futuras no bloqueantes: analisis estatico adicional, accesibilidad avanzada, exportaciones mas completas, manuales de entrenamiento y observabilidad local mas profunda.

No se recomienda abrir modulos clinicos, inventario, cloud sync, restore UI destructivo ni PDF avanzado como parte del cierre actual. Esas areas aumentarian riesgo y desviarian el producto de su nucleo operativo: facturacion, caja, pagos, recibos, historial, reportes y backups locales.

## Estado actual documentado

| Dimension | Estado | Lectura operativa |
|---|---|---|
| Validacion local | `LOCAL_VALIDATION_READY` | El flujo operativo local esta cubierto: login, caja, factura, eritropoyetina, cobro, recibo, historial, reimpresion, reportes y backup local. |
| Candidato a produccion | `PRODUCTION_CANDIDATE` | Codigo, gates, scripts y runbooks estan listos para instalar y validar en servidor final. |
| Produccion real | `NO PRODUCTION_READY` | Falta evidencia de segunda PC LAN, impresora fisica media carta/carta/A5/80mm/58mm y cierre completo del entorno production final. |
| Worktree | Limpio al momento del reporte | `git status --short` no mostro cambios antes de crear este documento. |
| Ultimo historial visible | Reciente trabajo de handoff y preflight | Commits recientes incluyen helpers de handoff, diagnostico production readiness y smoke LAN. |

## Areas de mejora consideradas

### 1. Validacion fisica de LAN

Prioridad: P0 para `PRODUCTION_READY`.

Estado actual:

- Las rutas por IP desde el servidor fueron validadas.
- Falta evidencia completa desde una segunda computadora cliente de la LAN final.
- Existe plantilla `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`.
- Existe helper `scripts/validate_lan_client.ps1` para validar `/up`, `/login`, `/verify-email` y asset JS desde una PC cliente.

Mejora considerada:

- Crear `qa/LAN_CLIENT_VALIDATION_PROOF.md` desde la segunda PC real.
- Validar por IP fija o nombre LAN, no `localhost`.
- Cubrir rutas publicas, login, dashboard, caja, nueva factura, pago, recibo, historial, reportes y backup `pending` a `success`.

Criterio de aceptacion:

- `scripts/production_readiness_preflight.ps1` pasa sin `-AllowMissingPhysicalProof`.
- No hay rutas rotas, assets faltantes ni errores de sesion desde el cliente real.

Riesgo si no se cierra:

- El sistema puede verse correcto en el servidor pero fallar en cajas reales por firewall, host, CORS/Sanctum, cache, assets o red local.

### 2. Validacion fisica de impresora institucional

Prioridad: P0 para `PRODUCTION_READY`.

Estado actual:

- La UI y los tests cubren recibo media carta/carta/A5/80mm/58mm.
- Existe `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`.
- Existe plantilla `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md`.
- No hay evidencia de impresion fisica real.

Mejora considerada:

- Probar recibo 80mm y 58mm con la impresora final o la configuracion exacta de caja.
- Validar escala 100%, margenes minimos, corte, ancho, legibilidad, CAI/RTN/rango, items y reimpresion desde historial.
- Registrar evidencia en `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.

Criterio de aceptacion:

- Recibo fisico legible, sin salir como hoja carta, sin cortes de texto y con reimpresion valida.

Riesgo si no se cierra:

- La validacion en navegador puede funcionar, pero la operacion real de caja falla en el punto mas visible: entregar comprobante.

### 3. Entorno final de produccion

Prioridad: P0 para `PRODUCTION_READY`.

Estado actual:

- Se valido una corrida con `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=http://192.168.1.7:8000`, MySQL y rutas publicas 200.
- El preflight sigue bloqueado por evidencia fisica faltante.
- La configuracion final debe repetirse en el servidor real si cambia IP, equipo, rutas o base.

Mejora considerada:

- Confirmar `.env` final fuera de Git.
- Configurar `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `SANCTUM_STATEFUL_DOMAINS` y CORS con IP fija o dominio LAN final.
- Crear admin real con el instalador o `php artisan auth:create-initial-admin` usando `HOSPITAL_INITIAL_ADMIN_PASSWORD`; no pasar la contrasena como argumento CLI.
- No ejecutar seeders de validacion temporal ni `migrate:fresh` en servidor real.
- Ejecutar `php artisan migrate --force` solo con backup previo y migraciones aprobadas.

Criterio de aceptacion:

- Preflight final sin bypass.
- Admin real creado y cambio de password obligatorio donde aplique.
- No hay credenciales de validacion temporal ni debug activo.

Riesgo si no se cierra:

- Exposicion de debug, credenciales de validacion temporal, sesiones rotas por Sanctum/CORS o entregas que parecen produccion sin serlo.

### 4. Worker continuo y automatizacion de backups

Prioridad: P0/P1 segun uso real.

Estado actual:

- Backup manual y programado existen.
- El comando real de backup genero archivos con SHA256.
- La automatizacion current-user esta activa como fallback.
- Las tareas de Windows requieren sesion elevada para instalar o actualizar correctamente.

Mejora considerada:

- Ejecutar `scripts/install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath C:\xampp\php\php.exe` desde PowerShell elevado.
- Confirmar `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup`.
- Crear un backup desde UI y validar que cambia de `pending` a `success`.
- Confirmar que `mysqldump.exe` o `mariadb-dump.exe` esta en PATH para el contexto que ejecuta el worker.

Criterio de aceptacion:

- Worker continuo activo despues de reinicio o login del servidor.
- Backup diario ejecutable sin abrir manualmente la terminal.
- UI de backups muestra estado operativo y fallos accionables.

Riesgo si no se cierra:

- El hospital puede creer que esta respaldado mientras los backups quedan `pending` o `failed`.

### 5. Restore y concurrencia en servidor final

Prioridad: P1 antes de operar con datos reales.

Estado actual:

- Restore MySQL/MariaDB fue validado localmente en base descartable.
- Concurrencia HTTP/Laravel/MySQL fue validada localmente con `RUN_ID` y datos auditables.
- Debe repetirse si cambia el servidor, base, rutas o herramienta de dump.

Mejora considerada:

- Repetir restore contra base descartable del servidor final.
- Repetir prueba de concurrencia contra entorno descartable o snapshot aprobado.
- Guardar checksum, conteos minimos y fecha de ejecucion.

Criterio de aceptacion:

- Restore confirmado sin tocar base activa.
- Doble apertura, doble emision y doble pago mantienen una sola verdad transaccional.

Riesgo si no se cierra:

- Diferencias de MariaDB/MySQL, permisos de usuario o locks reales pueden aparecer solo en el equipo final.

### 6. Seguridad y permisos operativos

Prioridad: P1 continuo.

Estado actual:

- Se considero y cerro el P0 original de pagos sobre facturas ajenas usando alcance operativo.
- Hay permisos separados para reportes gerenciales, caja propia y exportacion.
- Rutas sensibles usan autenticacion, usuario activo y cambio de password.

Mejora considerada:

- Mantener tests para cajero limitado a operacion propia.
- Revisar periodicamente permisos `reports.managerial.view`, `reports.cash_session.view`, `reports.export`, `backups.*`, `fiscal.*` y `invoices.void`.
- Agregar analisis estatico PHP si se decide hacerlo parte del gate.
- Revisar logs para evitar secretos o datos innecesarios.

Criterio de aceptacion:

- Cajero no accede backups, configuracion fiscal, reportes gerenciales ni facturas ajenas fuera de alcance.
- Supervisor/admin tienen acceso solo por permisos explicitos.

Riesgo si no se mantiene:

- Una mejora de UI podria esconder botones sin proteger backend, o un permiso amplio podria exponer informacion gerencial.

### 7. UX operativa de caja/POS

Prioridad: P1 para venta y entrenamiento.

Estado actual:

- AppShell, POS, caja, scanner/codigos, carrito, confirmaciones y recibo fueron considerados como cierre de Fase 12.
- Se evita el catalogo completo interminable en POS.
- El flujo principal exige caja abierta.

Mejora considerada:

- Validar con usuarios reales de caja tiempos de busqueda, errores comunes y textos.
- Revisar tablet/monitor pequeno con flujo real de alto volumen.
- Mantener confirmaciones para emitir, cobrar, anular, reimprimir y cerrar caja.
- Evitar que controles criticos queden solo en footer o mensajes globales.

Criterio de aceptacion:

- Una cajera puede abrir caja, buscar servicio, facturar, cobrar e imprimir sin entrenamiento tecnico largo.

Riesgo si no se mejora con uso real:

- El sistema compila y pasa tests, pero se siente lento o inseguro en una cola de pacientes.

### 8. Reportes y exportaciones

Prioridad: P1/P2.

Estado actual:

- Reportes basicos y avanzados existen con agregaciones backend.
- Export CSV esta protegido por permiso.
- Reportes usan snapshots y filtros.

Mejora considerada:

- Validar con administracion hospitalaria que KPIs, cortes por caja/cajero/categoria/metodo y auditoria cubren decisiones diarias.
- Agregar exportaciones mas grandes o Excel solo si hay necesidad real.
- Agregar indices adicionales si datos reales vuelven lentos los filtros.

Criterio de aceptacion:

- Gerencia puede reconciliar ingresos, caja, anulaciones, reimpresiones y backups sin abrir la base.

Riesgo si se amplia demasiado pronto:

- Se puede convertir en dashboard grande antes de terminar pruebas fisicas y operacion core.

### 9. QA, gates y evidencia

Prioridad: P1 continuo.

Estado actual:

- Hay gates backend/frontend, E2E local, smoke real no destructivo y preflight production.
- Los mocks de E2E estan separados del smoke real.
- Mutaciones reales requieren opt-in y snapshot/backup.

Mejora considerada:

- Mantener `npm.cmd` en Windows para evitar bloqueo de `npm.ps1`.
- Ejecutar gates antes de push a main: `php artisan test --colors=never`, `npm run build`, `php artisan config:cache`.
- Repetir smoke real con credenciales temporales autorizadas o de produccion controlada.
- Registrar evidencia de cada cierre en `qa/`.

Criterio de aceptacion:

- No se mezclan pruebas destructivas con gates seguros.
- Cualquier fallo deja evidencia clara y accionable.

Riesgo si no se disciplina:

- El equipo puede confundir validacion mockeada con produccion real validada.

### 10. Observabilidad local y soporte

Prioridad: P2.

Estado actual:

- Existe endpoint/panel de estado para production readiness y backups.
- El sistema muestra bloqueos restantes para `PRODUCTION_READY`.

Mejora considerada:

- Ampliar diagnostico local con espacio libre, version PHP/MySQL, ultima migracion, ultimo backup exitoso, jobs fallidos y reloj del servidor.
- Agregar guia de soporte de primer nivel para reiniciar worker, revisar logs y confirmar conectividad LAN.

Criterio de aceptacion:

- Un operador local puede diagnosticar problemas comunes sin entrar al codigo.

Riesgo si no se mejora:

- Soporte depende demasiado del desarrollador para fallos simples de entorno.

### 11. Documentacion de operacion y entrenamiento

Prioridad: P2.

Estado actual:

- Hay checklist, guion de validacion, install summary, backup/restore y docs de limitaciones.

Mejora considerada:

- Crear guia corta para cajero: abrir caja, facturar, cobrar, reimprimir, cerrar caja.
- Crear guia corta para admin: catalogo, fiscal, reportes, backups, restore manual.
- Crear protocolo de cierre diario con backup y reporte.

Criterio de aceptacion:

- La operacion diaria puede ejecutarse sin asistencia tecnica continua.

Riesgo si no se documenta:

- Errores humanos repetidos en caja, backups no revisados o cierre diario inconsistente.

## Mejoras no recomendadas para el cierre actual

| Area | Decision | Motivo |
|---|---|---|
| Expediente clinico | No incluir | El alcance del producto es facturacion hospitalaria; paciente solo nombre. |
| Inventario/farmacia | No incluir | Aumenta alcance y datos sin ser necesario para vender el core actual. |
| Cloud sync/SaaS | No incluir | La operacion debe funcionar offline LAN. |
| Restore UI destructivo | No incluir | Restaurar base desde UI es demasiado riesgoso; debe ser procedimiento controlado. |
| PDF avanzado | No incluir como bloqueante | Recibo institucional media carta/carta/A5/80mm/58mm es el flujo critico de caja. |
| Dashboard complejo | No incluir | Reportes gerenciales y KPIs deben mantenerse sobrios y operativos. |

## Priorizacion sugerida

### P0 - Cierre para poder declarar `PRODUCTION_READY`

1. Completar `qa/LAN_CLIENT_VALIDATION_PROOF.md` desde segunda PC real.
2. Completar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con impresora fisica real.
3. Ejecutar preflight final sin `-AllowMissingPhysicalProof`.
4. Confirmar entorno production final, admin real, CORS/Sanctum LAN y config cache.

### P1 - Antes de operar con datos reales sostenidos

1. Reinstalar o actualizar tareas Windows desde PowerShell elevado.
2. Confirmar backup manual UI `pending` a `success` con worker continuo.
3. Repetir restore y concurrencia en servidor/base descartable final si cambia el entorno.
4. Ejecutar gates completos y smoke real no destructivo.

Estado repo-local: los puntos P1 anteriores ya tienen scripts, plantillas y gates reproducibles. La ejecucion real queda pendiente solo cuando requiere servidor/base descartable final o credenciales reales.

### P2 - Mejora posterior a primera instalacion controlada

1. Manuales cortos por rol.
2. Analisis estatico PHP formal si se adopta como gate.
3. Observabilidad local ampliada.
4. Exportaciones/reportes adicionales basados en uso real.
5. Ajustes UX despues de observar caja real.

Estado repo-local: manuales, observabilidad local ampliada y exportacion de caja propia quedaron cubiertos. Analisis estatico PHP formal y accesibilidad automatizada quedan como mejoras futuras no bloqueantes porque requieren adoptar dependencias/gates nuevos.

## Criterio de cierre recomendado

El reporte no cambia el estado actual: `PRODUCTION_CANDIDATE`.

El sistema solo debe pasar a `PRODUCTION_READY` cuando existan estas evidencias:

- `qa/LAN_CLIENT_VALIDATION_PROOF.md` completo, sin placeholders, desde segunda PC real.
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` completo, sin placeholders, con impresora fisica media carta/carta/A5/80mm/58mm.
- `scripts/production_readiness_preflight.ps1` ejecutado sin bypass y con salida aprobada.
- Backup worker continuo activo y backup manual validado desde UI.
- Entorno final con `APP_ENV=production`, `APP_DEBUG=false`, admin real, `config:cache`, CORS/Sanctum LAN final y sin seeders de validacion temporal.

Hasta entonces, la forma honesta de presentarlo es:

> Sistema listo para validacion institucional y candidato de produccion local. No es `PRODUCTION_READY` hasta completar la validacion fisica de LAN, impresora y entorno final.
