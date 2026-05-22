# Final concurrency proof

This file documents the concurrent request validation performed on a test database snapshot.

## Environment

- Date/time: 2026-05-19 16:00:00
- Responsible person: Dr. Augusto Melara
- Server LAN URL: http://192.168.1.7:8000
- Target environment: Local development snapshot
- Run ID: concurrency-validation-20260519T160000
- Evidence/capture reference: qa/screenshots/concurrency_proof_20260519/
- Final conclusion: Concurrency tests passed. The application handles concurrent requests correctly by preventing double cash-session openings, keeping unique sequential invoice numbers, and ensuring double payments are prevented using database locks.

## Required checks

- [x] Double cash-session open leaves one truth. Result/evidence: The script validate_mysql_concurrency.mjs attempted to open two sessions for the same cashier simultaneously; one succeeded, and the second returned a 422 error.
- [x] Concurrent invoice emission keeps unique numbers. Result/evidence: Emitting invoices concurrently resulted in correctly incremented sequential invoice numbers without gaps or duplicates.
- [x] Double payment leaves one posted payment. Result/evidence: Two concurrent payment posting requests for the same invoice were executed; the first request was processed and the second was rejected with a 409 conflict, leaving only one payment in the payments table.

## Evidence

- Notes: Handled via DB transaction locks and Laravel database isolation levels.
