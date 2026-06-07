# Final backup task proof

Copy this file to `qa/FINAL_BACKUP_TASK_PROOF.md` only on the final server
after installing or updating the Windows backup tasks and creating one manual
backup from the admin UI.
Do not attach `.env` files, SQL dumps, database passwords, task XML exports or
absolute local paths. Use only a relative `qa/` evidence reference or a short
physical/support reference.

## Environment

- Date/time:
- Responsible person:
- Server computer name:
- Backup worker task status:
- Daily backup task status:
- Manual backup request time:
- Backup log id or filename:
- Backup size bytes:
- Evidence/capture reference:
- Final conclusion:

## Required checks

- [ ] `SistemaCajaHospitalaria-BackupWorker` is installed and Ready or Running. Result/evidence:
- [ ] `SistemaCajaHospitalaria-DailyBackup` is installed and Ready or Running. Result/evidence:
- [ ] Tarea continua de respaldos fue iniciada u observada despues de instalar las tareas. Result/evidence:
- [ ] Manual backup was requested from the admin UI, not by editing the database. Result/evidence:
- [ ] El respaldo manual cambio de Pendiente a Protegido en la UI administrativa. Result/evidence:
- [ ] Backup file or backup log entry has timestamp and size. Result/evidence:
- [ ] Evidence does not include `.env`, SQL dumps, passwords, task XML exports or absolute local paths. Result/evidence:

## Evidence

- Notes:
