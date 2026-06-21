# Final restore proof - LAN 8081 current run

## Environment

- Date/time: 2026-06-17 11:34 America/Tegucigalpa
- Compose project: `shospital_offlinetest`
- Compose file: `docker-compose.prod.yml`
- Env file: `C:\tmp\s_hospital_offlinetest.env`
- Active application database: `hospital_offlinetest`
- Disposable restore database: `hospital_restore_validation_20260617_113403`
- MariaDB image: `mariadb:11.4.3`

## Backup restored

- Backup file: `hospital-backup-20260617-113403-6gxb7e1g.sql.enc`
- Local validation copy: `C:\tmp\hospital-backup-20260617-113403-6gxb7e1g.sql.enc`
- SHA256: `658415D8F5ED5D09E6CFD1418E6DF09A46509511A620EBDB6700C288148F4D46`

## Command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore_hospital_windows.ps1 `
  -Mode Docker `
  -EnvFile C:\tmp\s_hospital_offlinetest.env `
  -ComposeProjectName shospital_offlinetest `
  -BackupFile C:\tmp\hospital-backup-20260617-113403-6gxb7e1g.sql.enc `
  -ExpectedSha256 658415D8F5ED5D09E6CFD1418E6DF09A46509511A620EBDB6700C288148F4D46 `
  -TargetDatabase hospital_restore_validation_20260617_113403
```

## Result

- [x] SHA256 verified before restore.
- [x] Encrypted backup decrypted inside the backend container.
- [x] Restore target was recreated as a disposable MariaDB database.
- [x] Backup imported successfully into MariaDB Docker.
- [x] Active application database was not used as restore target.
- [x] Restore completed with 39 tables.

## Restored counts

| Table | Count |
| --- | ---: |
| `users` | 23 |
| `services` | 122 |
| `invoices` | 62 |
| `payments` | 45 |
| `backup_logs` | 31 |

## Conclusion

`PASS`: restore real was executed against MariaDB/MySQL-compatible Docker using a disposable database. This validates backup SHA256 verification, decrypt/import/count verification, and confirms the active application database was not overwritten.
