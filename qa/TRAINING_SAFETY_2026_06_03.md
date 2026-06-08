# Training safety validation - 2026-06-03

Decision: `PASS`.

Scope:

- Validate that non-technical training manuals forbid practicing on the production database.
- Validate that training requires an isolated installation, disposable database or restored test database.
- Validate that cashier, supervisor, administrator and area-user exercises remain
  documented.
- Validate that common failure drills remain covered: server unavailable, LAN down, printer not responding, open cashbox, failed backup, expired session, permission error, closed browser and power failure.
- Validate that the in-app Help screen keeps the safe training and practice-mode warning.
- Validate that final training acceptance can be recorded anonymously without names, patient data, secrets or local paths.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1
```

Observed result:

- `TRAINING_SAFETY: YES`.
- Training docs still forbid production users, real patient data, `migrate:fresh` in production, restoring over the real database and sharing `.env` / passwords / tokens.
- `qa\TRAINING_ACCEPTANCE_PROOF.example.md` keeps anonymous final-training fields, role coverage including area-user paid-service consultation, incident drills and final-field blockers.
- Help screen still exposes safe training, practice mode, isolated practice guidance and the warning not to use the production database.

Safety notes:

- This check reads only versioned docs, QA templates and frontend source/test files.
- It does not start services, migrate, seed, restore data or read `.env` into evidence.
- It does not create a practice environment; it verifies that staff are instructed to use an isolated one or a disposable database before training.
- It does not collect staff names, patient names, passwords, SQL backup names or machine paths.
