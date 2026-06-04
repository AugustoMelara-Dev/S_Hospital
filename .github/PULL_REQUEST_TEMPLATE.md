<!--
Thanks for opening a pull request! Please fill out the sections
below so reviewers can understand the change quickly.

If you do not know the answer to a question, write "?" and a
reviewer will help. The PR template itself can be removed after
the PR is merged.
-->

## What does this change?

<!-- 1-3 bullet points. Reference files by path:line. -->

-

## Why is it needed?

<!-- Link the audit issue, phase plan, or OPERATIVE_NOTES entry. -->
- Audit / plan reference:
- Operator-visible impact (if any):

## How to test locally

<!-- The exact commands the reviewer should run. -->

```bash
cd backend
php -d memory_limit=512M vendor/bin/phpunit
vendor/bin/pint --test

cd ../frontend
npm run typecheck
npm run lint
npm run test
```

## Screenshots

<!-- Required if the change is user-visible. -->

## Risks and rollback

- **Risks** (what could go wrong, who is affected, how to detect):
- **Rollback plan** (the exact commands to revert the change if
  it ships and breaks prod):
- **Evidence** (paste the link to the docs/AUDIT or docs/OPERATIVE_NOTES
  entry that justifies the change):

## Quality gate

- [ ] `scripts/quality_gate.sh` (or the per-component variants
      above) passes locally
- [ ] Pre-commit guard installed via `scripts/install_dev_hooks.ps1`
      and green
- [ ] No secrets in the diff (pre-commit guard covers this)
- [ ] No new float money math (`rg parseFloat frontend/src/features`
      returns nothing)
- [ ] No new SaaS dependency in composer.json / package.json
- [ ] No new database migration that is non-idempotent
      (every migration must work on a re-run)
