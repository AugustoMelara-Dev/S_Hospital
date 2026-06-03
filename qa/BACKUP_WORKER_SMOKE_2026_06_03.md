# Backup worker smoke proof

- Date/time: 2026-06-03 04:46:28
- Base URL: http://127.0.0.1:8000
- Backup id: 42
- Filename: hospital-backup-20260603-104616-2zoj9qzt.sql
- Status: success
- Size bytes: 92050
- SHA256: 56db3aa325eb31c3fcd7eaf07f40cf2c83571ea3b72f2b67b4e3f5fee9fbee57
- Final conclusion: Backup UI/API changed from pending to success with checksum and non-zero size.

## Required checks

- [x] Manual backup request created a pending job. Result/evidence: backup id 42.
- [x] Worker processed backup to success. Result/evidence: status=success.
- [x] Backup has checksum and size. Result/evidence: sha256=56db3aa325eb31c3fcd7eaf07f40cf2c83571ea3b72f2b67b4e3f5fee9fbee57, size=92050.
