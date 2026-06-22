# Local Maintenance Routine

## Daily

- Confirm the server is on and reachable from an approved LAN client.
- Confirm login works for a test or assigned operator account.
- Confirm the current shift can open or continue CashBox according to policy.
- Review the Backups view for failed backup status.
- Confirm the configured printer is available before billing starts.
- Record any errors without secrets or real patient data in screenshots.

## Weekly

- Verify free disk space on the server.
- Verify at least one recent backup has a non-empty `.sql.enc` artifact and a
  recorded SHA256.
- Review application logs for repeated errors.
- Verify server and client clocks are aligned.
- Review active users and disable accounts that no longer belong to operators.

## Monthly

- Perform a disposable restore test using `docs/DATA_MIGRATION.md`.
- Review audit logs for unusual voids, reprints, user changes, and backup
  downloads.
- Confirm the external backup copy is present and physically protected.
- Confirm physical access controls remain in place.

## After Incidents

- Preserve evidence without secrets.
- Do not edit production data manually.
- If a reproducible software defect is found, open a `fix/*` branch from
  `origin/main`; do not modify `main` directly.

## Status

Development is closed. Maintenance belongs to operations.
