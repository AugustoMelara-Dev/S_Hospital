# S_Hospital Total Rewrite Phase 5: Administrative Integrity

**Goal:** Ensure high-impact administrative changes cannot exist without their audit record, preserve append-only audit history at model and database layers, and reconfirm backup secrecy/recovery controls.

## Tasks

### 1. Enforce append-only audit logs in the application model

- Modify `backend/app/Models/AuditLog.php`.
- Add tests to `backend/tests/Feature/AuditLogTest.php` proving Eloquent update/delete fail while create remains valid.
- Preserve the existing MariaDB triggers and the privileged query-builder prune command.

### 2. Make role changes transactional with audit

- Modify `backend/app/Http/Controllers/RoleController.php`.
- Add rollback tests to `backend/tests/Feature/RoleManagementTest.php` for audit-write failure during create/update.
- Keep permission cache invalidation after a successful commit.

### 3. Reconfirm user, permission and backup controls

- Run user-management tests for last-admin, self-action, elevated-role and password-reason controls.
- Run backup workflow tests for safe payloads, encrypted artifacts, idempotency, path traversal, downloads and audit.
- Run frontend Users/permission/backups critical tests and backup E2E/smoke where available.
- Record evidence and commit `fix(admin): make audit and role changes atomic`.

## Acceptance Criteria

- AuditLog cannot be updated or deleted through Eloquent.
- A role cannot be created or changed if its audit write fails.
- Normal audit pruning remains an explicit privileged technical command.
- Browser/API backup surfaces expose no filename, path, checksum, command or database secret.
- User/permission high-risk guards remain green.
