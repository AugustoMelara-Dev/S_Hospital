# V1.1 MySQL/MariaDB Focal Proof

Status: passed after test-harness correction
Date: 2026-06-25
Branch: `codex/v1-1-production-polish`
Scope: disposable MariaDB 11.4.3 validation for receipt PDF, cash/payment receipts, and user/RBAC flows.

This proof uses a throwaway Docker network and MariaDB container. It does not touch the running `shospital_prodtest`, `shospital_offlinetest`, LAN, or hospital production databases.

## Disposable Environment

- Docker network: `v11_mysql_gate_<timestamp>`.
- MariaDB container: `v11_mysql_gate_<timestamp>_mariadb`.
- Database names: `s_hospital_golden_v11_polish` and `s_hospital_test_<timestamp>`.
- Backend image: `s_hospital-v1-1-polish-backend`.
- Repo mount: `/workspace`.
- Backend vendor volume: `s_hospital-v1-1-polish_backend_vendor`.
- DB connection: `mysql` against MariaDB `11.4.3`.
- Safety: database names use `s_hospital_golden_` and `s_hospital_test_` prefixes; resources were removed after the run.

## Initial Finding

The first MariaDB focal run reached PHPUnit and found one MySQL-specific test issue:

- `Tests\Feature\UserManagementTest::test_user_manager_cannot_assign_case_variant_admin_role_without_admin_assignment_permission`
- Error: duplicate `roles_name_guard_name_unique` entry for `Admin-web`.
- Cause: the test attempted to create a separate `Admin` role after the seeded `admin` role. MariaDB/MySQL collation treats those values as equal for the unique key.

Correction:

- The test now renames the seeded `admin` role to `Admin` before submitting the case-variant payload.
- This preserves the intended assertion: role protection must be case-insensitive.
- It avoids creating an impossible duplicate under MySQL/MariaDB collation.

## Passing MariaDB Command Shape

The final run:

```powershell
docker network create v11_mysql_gate_<timestamp>
docker run --name v11_mysql_gate_<timestamp>_mariadb --network v11_mysql_gate_<timestamp> --network-alias mariadb -d -e MARIADB_ROOT_PASSWORD=RootTest123! -e MARIADB_AUTO_UPGRADE=1 mariadb:11.4.3
docker run --rm --network v11_mysql_gate_<timestamp> ... s_hospital-v1-1-polish-backend php artisan testing:prepare-golden-database --database=s_hospital_test_<timestamp> --golden-database=s_hospital_golden_v11_polish
docker run --rm --network v11_mysql_gate_<timestamp> ... s_hospital-v1-1-polish-backend vendor/bin/phpunit --configuration phpunit.mysql.xml --filter 'InstitutionalReceiptPdfTest|CashPaymentsReceiptTest|UserManagementTest'
```

## Passing MariaDB Result

- `testing:prepare-golden-database`: passed.
- Migration hash: `4f4f0cd342534b5c0261237777705c75d7887a77abf16d58763b9fdb0dbfdccd`.
- PHPUnit result: OK.
- Tests: 71.
- Assertions: 614.
- Duration: 66.94s.
- Covered suites:
  - `InstitutionalReceiptPdfTest`.
  - `CashPaymentsReceiptTest`.
  - `UserManagementTest`.

## SQLite Regression Check

```powershell
docker run --rm -v ${PWD}:/workspace -v s_hospital-v1-1-polish_backend_vendor:/workspace/backend/vendor -w /workspace/backend s_hospital-v1-1-polish-backend php artisan test --filter=UserManagementTest --colors=never
```

Result:

- Exit code: 0.
- Tests: 26 warnings from missing `/workspace/backend/.env`.
- Assertions: 103.

## Limits

- This is a focal MySQL/MariaDB proof, not a full production-load proof.
- It does not use the hospital LAN server or existing production-like stacks.
- It does not validate physical printer output, restore, or multi-client LAN load.
