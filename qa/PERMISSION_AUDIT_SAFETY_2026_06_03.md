# Permission audit safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Verify that role and permission administration changes are recorded in
  `audit_logs`, not only in technical logs.
- Verify that Spatie permission events are enabled and wired through
  `PermissionAuditObserver`.
- Verify that audit payloads keep human role/permission names and do not
  expose passwords, tokens, `.env` values or raw local paths.
- Close the stale v1.1 known limitation for permission-change audit without
  changing production data.

Commands run:

```powershell
docker compose exec -T backend php artisan test --filter=PermissionAuditTest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_permission_audit_safety.ps1
```

Observed result:

- `PermissionAuditTest` passed: 4 tests, 11 assertions.
- `PERMISSION_AUDIT_SAFETY: YES`.
- Role attach writes `role.attached` to `audit_logs`.
- Role sync writes `role.detached` and `role.attached` to `audit_logs`.
- Role creation writes a durable audit record.
- Permission attach writes `permission.attached` to `audit_logs`.
- `config/permission.php` keeps Spatie permission events enabled.
- `AppServiceProvider` registers model observers and Spatie attach/detach
  event listeners.
- `PermissionAuditObserver` records current operator id when available and
  catches audit-write failures so permission administration is not broken by
  an audit storage issue.
- `UserController` avoids calling `syncRoles` when the requested role is
  already assigned, reducing false audit noise.

Safety notes:

- This was a local validation run.
- No `.env` file was deleted or printed.
- No database volume was reset.
- No production data was restored over.
- No push was performed.
- This evidence does not invent fiscal compliance or replace final staff
  training/production handoff evidence.
