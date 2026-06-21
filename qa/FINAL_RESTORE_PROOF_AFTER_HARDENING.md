# Restore real MariaDB despues de hardening

- Estado: PASS
- Fecha: 2026-06-16T22:14:05.3988318-06:00
- Stack Docker: shospital_offlinetest
- URL LAN: http://192.168.1.3:8081
- Base restaurada descartable: hospital_restore_validation_after_hardening
- Backup ID: 20
- Archivo: hospital-backup-20260616-221345-jvcxbsfl.sql.enc
- SHA256: c1bd956e5f0bdfe2e55780b480c7c79c6b95e243166e3773eceb54d7754ed794
- Tamano bytes: 1370452
- Metodo: hospital:backup -> hospital:decrypt-backup -> import MariaDB en base descartable
- Conteos restaurados (migrations, users, services, invoices, payments, backup_logs): 68	13	122	29	21	20
- Confirmacion: no se restauro sobre la base activa.
