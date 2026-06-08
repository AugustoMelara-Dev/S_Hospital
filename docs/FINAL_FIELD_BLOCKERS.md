# Final field blockers

Estado actual: `PRODUCTION_CANDIDATE`.

Este archivo resume las evidencias finales que faltan antes de declarar
`PRODUCTION_READY`. No reemplaza los proof files ni autoriza completar
evidencia sin pruebas reales en el hospital.

## Regla de cierre

El sistema solo puede pasar a `PRODUCTION_READY` cuando los siete proof files
esten completos con evidencia real, anonima y revisable, y cuando
`scripts\final_production_handoff.ps1` termine sin banderas de bypass.

Mientras cualquier punto siga pendiente, el resultado correcto es
`PRODUCTION_CANDIDATE`.

## Siete proofs finales obligatorios

| Proof final | Archivo | Evidencia esperada |
| --- | --- | --- |
| Cliente LAN real | `qa\LAN_CLIENT_VALIDATION_PROOF.md` | Segunda computadora del hospital entra por IP fija, valida `/up`, login, caja, factura, pago, recibo, historial, reportes y respaldo de Pendiente a Protegido. |
| Impresora institucional | `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` | Impresion fisica de una factura por vez en media carta, carta y A5, con fondo blanco, reimpresion, escala 100%, margenes, encabezados/pies correctos y sin QR, barcode, codigos internos ni datos tecnicos. |
| Autoarranque del servidor | `qa\FINAL_STARTUP_TASK_PROOF.md` | Tarea `SistemaCajaHospitalaria-StackAutostart` instalada con trigger `AtStartup`, arranque o reinicio observado, `/up` y login confirmados sin internet. |
| Respaldos finales | `qa\FINAL_BACKUP_TASK_PROOF.md` | Tareas `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup` instaladas, tarea continua observada, respaldo manual desde UI administrativa y estado Protegido confirmado. |
| Restore final | `qa\FINAL_RESTORE_PROOF.md` | Restauracion ejecutada solo contra base descartable del servidor final, con checksum o conteos revisables, sin tocar la base activa de produccion. |
| Concurrencia final | `qa\FINAL_CONCURRENCY_PROOF.md` | Validacion contra destino descartable de doble apertura de caja, doble emision de factura y doble pago, sin credenciales reales ni datos de pacientes. |
| Capacitacion supervisada | `qa\TRAINING_ACCEPTANCE_PROOF.md` | Cajero, supervisor, administrador y usuario de area practican en ambiente aislado; la evidencia no incluye nombres, pacientes, usuarios, passwords, dumps ni rutas locales. |

## Contenido que no debe aceptarse como prueba final

- Capturas locales de desarrollo usadas como sustituto de segunda PC LAN.
- Fotos de impresora que no muestren media carta, carta y A5.
- Backups en estado Pendiente o jobs de respaldo no observados.
- Restore sobre la base real de produccion.
- Pruebas de concurrencia contra la caja real del hospital.
- Capacitacion usando datos reales de pacientes o la base productiva.
- Evidencia con `.env`, passwords, dumps SQL, XML de tareas, rutas absolutas o
  nombres de personal.
- Resultados obtenidos con `-AllowMissingPhysicalProof`,
  `-AllowPendingFinalField`, `-SkipPreflight` o banderas equivalentes de
  bypass.

## Comandos de verificacion

Durante handoff candidato:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_field_blockers_safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_operations_objective_audit.ps1
```

Antes de cualquier cierre final:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl https://IP_DEL_SERVIDOR -InitializeProofFiles
```

Si el handoff final reporta algun bloqueante, no cambie este archivo a
`PRODUCTION_READY`; complete primero la evidencia fisica o de servidor final.
