# Backup worker smoke proof

- Date/time: 2026-06-17 00:39:44
- Base URL: http://192.168.1.3:8081
- Backup id: 22
- Filename: hospital-backup-20260617-003938-3weumrny.sql.enc
- Status: success
- Size bytes: 1699984
- SHA256: b40d2ffda0bc33474cd96cda518a13f4e46026eec1d8a3504963dfef72f18eb6
- Final conclusion: Backup UI/API changed from pending to success with checksum and non-zero size.

## Required checks

- [x] Manual backup request created a pending job. Result/evidence: backup id 22.
- [x] Worker processed backup to success. Result/evidence: status=success.
- [x] Backup has checksum and size. Result/evidence: sha256=b40d2ffda0bc33474cd96cda518a13f4e46026eec1d8a3504963dfef72f18eb6, size=1699984.
