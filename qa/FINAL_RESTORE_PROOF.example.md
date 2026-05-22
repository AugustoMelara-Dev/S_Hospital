# Final restore proof

Copy this file to `qa/FINAL_RESTORE_PROOF.md` only on the final server after
running restore validation against a disposable database. Do not restore into
the active hospital database.

## Environment

- Date/time:
- Responsible person:
- Source database:
- Disposable restore database:
- Backup file:
- Backup SHA256:
- Backup size bytes:
- Evidence/capture reference:
- Final conclusion:

## Required checks

- [ ] Disposable restore database is not the active database. Result/evidence:
- [ ] Backup file exists and has SHA256. Result/evidence:
- [ ] Restore imports without SQL error. Result/evidence:
- [ ] Migration table has rows. Result/evidence:
- [ ] Services table has rows. Result/evidence:
- [ ] Core counts captured. Result/evidence:

## Evidence

- Notes:
