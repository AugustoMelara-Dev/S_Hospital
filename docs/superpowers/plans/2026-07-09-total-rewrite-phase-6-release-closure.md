# S_Hospital Total Rewrite Phase 6: Release Closure

**Goal:** Leave the hospital system reproducibly installable on an offline LAN, migrate the production-readiness browser journey to the institutional receipt contract, and close accessibility, security and release verification with recorded evidence.

## Tasks

### 1. Migrate the production-readiness E2E journey

- Replace legacy HTML receipt-preview expectations with the institutional PDF receipt outcome.
- Mock issuance, PDF and print-event endpoints for paid and zero-total invoices.
- Verify payment is registered once, the receipt is issued automatically, reprints require a reason, and the workflow reaches reports, administration, backups and support without console errors.

### 2. Make installation and operation reproducible

- Expand the root README with prerequisites, development, offline package, production/LAN, environment variables, migrations, seeders, initial administrator and every quality command.
- Remove duplicate environment declarations and clarify which values are installer-managed secrets.
- Replace the generic Laravel backend README with repository-specific commands and links to the operational runbooks.
- Reconcile setup, deployment and backup instructions with the commands that actually exist in the repository.

### 3. Close accessibility and security validation

- Run the existing accessibility suites and remediate release-blocking violations.
- Run dependency, static-analysis and security-policy checks without weakening the offline production model.
- Confirm administrative credentials, backups and browser-facing responses do not expose secrets or internal paths.

### 4. Prove release readiness from clean state

- Run migrations and seeders against a disposable clean MariaDB database or the supported clean-install harness.
- Execute backend tests, Pint, PHPStan, frontend lint, typecheck, coverage, build and all maintained E2E suites.
- Run the production-readiness preflight and update the testing report/changelog with exact results and any physical-hardware validation that remains explicitly external.

## Acceptance Criteria

- A technical operator can install development or offline production from the README without guessing commands or credentials.
- No default production administrator password is published; the initial administrator is created through the supported command/installer and must change the temporary password.
- The maintained production-readiness E2E follows the institutional receipt workflow and passes without hidden network or console failures.
- Accessibility, security and quality gates pass on the final tree.
- A clean database can be migrated and seeded reproducibly, and the production build starts without internet dependencies.
- Physical printer and hospital LAN checks are identified as site acceptance checks, not misrepresented as automated proof.
