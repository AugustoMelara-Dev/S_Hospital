# =============================================================================
# Multi-cashier and fiscal-race load tests for S_Hospital.
#
# These tests validate that a validation deployment handles the expected
# hospital load (5 cashiers issuing invoices and registering payments in
# parallel) without dropping sessions, duplicating fiscal correlatives, or
# breaching the latency budget.
#
# Prerequisites
#   - a validation stack or disposable database is up and reachable at $BASE_URL
#   - do not run this against the real production database
#   - the local CA cert (nginx/ssl/hospital-ca.crt.pem) is trusted
#     by the host running k6 / node
#   - 5 temporary validation cashier users exist with permission to open cash
#     sessions, create invoices and register payments
#   - at least one active service exists in the catalog
#
# Usage
#   # k6: 5 virtual cashiers, 20 iterations each, 60s budget
#   export BASE_URL=https://192.168.1.10
#   export HOSPITAL_LOADTEST_TARGET_ENV=validation
#   export HOSPITAL_CONFIRM_LOADTEST_TARGET=https://192.168.1.10
#   export CASHIER_USER_1=validacion.caja1 CASHIER_PASSWORD_1=...
#   export CASHIER_USER_2=validacion.caja2 CASHIER_PASSWORD_2=...
#   export CASHIER_USER_3=validacion.caja3 CASHIER_PASSWORD_3=...
#   export CASHIER_USER_4=validacion.caja4 CASHIER_PASSWORD_4=...
#   export CASHIER_USER_5=validacion.caja5 CASHIER_PASSWORD_5=...
#   k6 run multi-cashier.js
#
#   # node: fiscal correlative race (no k6 required)
#   HOSPITAL_LOADTEST_TARGET_ENV=validation \
#   HOSPITAL_CONFIRM_LOADTEST_TARGET=https://192.168.1.10 \
#   BASE_URL=https://192.168.1.10 \
#   CASHIER_USER=validacion.caja1 CASHIER_PASSWORD=... \
#   RACE_PARALLEL=8 RACE_TOTAL=80 \
#     node fiscal-race.js
#
# Outputs
#   - k6 prints summary; pipe to k6-summary.json if you want a file
#   - fiscal-race.js prints a JSON report with duplicates / latencies
#
# CI gate
#   - scripts/loadtest_smoke.sh runs a 30s smoke with 2 VUs and
#     fails the build if any request takes >3s p99 or if any
#     duplicate fiscal number is returned
#
# Safety invariant
#   - every runner requires HOSPITAL_LOADTEST_TARGET_ENV and
#     HOSPITAL_CONFIRM_LOADTEST_TARGET before creating invoices
#   - credentials must be supplied explicitly from temporary validation users
#   - generated invoices, payments and screenshots are not field evidence for
#     qa/LAN_CLIENT_VALIDATION_PROOF.md or printer proof
# =============================================================================
