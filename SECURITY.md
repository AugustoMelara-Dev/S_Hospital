# Security policy

## Reporting a vulnerability

If you discover a vulnerability in S_Hospital, please report it
privately to the security team. **Do not file a public issue.**

- **Email:** `security@hospital-san-isidro.local`
- **Encrypted channel (PGP):** see the hospital intranet
- **Response time:** we acknowledge within 2 business days and
  aim to ship a fix within 14 days for critical issues.

The security team triages the report, assigns a CVSS-style
severity, and coordinates the fix through a private fork. Public
disclosure happens after the fix is released and a
`docs/SECURITY_ADVISORIES/<date>-<id>.md` file is published.

## Supported versions

Only the latest tagged release receives security backports.
For v1.0.0 the support window is:

| Version | Status | Security backport until |
|---|---|---|
| v1.0.0  | current stable | indefinite (until v1.1.0) |
| v1.0.0-rc.4 | release candidate | not supported (upgrade to v1.0.0) |
| v1.0.0-rc.3 and earlier | superseded | not supported |

If you are running an RC in production, **upgrade to v1.0.0
first**. RCs do not receive security backports.

## Backport policy

- **Critical (CVSS 9.0+):** backport to the latest stable
  release immediately. Customers running an older release are
  notified by the security advisory.
- **High (CVSS 7.0-8.9):** backport within 30 days. Same
  notification channel.
- **Medium (CVSS 4.0-6.9):** backport on a best-effort basis;
  included in the next minor release.
- **Low (CVSS 0.1-3.9):** no backport; included in the next
  minor release.

## Secret management

All secrets are stored in `backend/.env` (which is git-ignored
at the project root) or in `docker-compose.prod.yml` env
references that pull from the host's `.env` via `${VAR:?...}`
fail-closed syntax. The pre-commit guard (`scripts/pre-commit-guard.ps1`)
detects:

- `APP_KEY=base64:...` with a real value
- `HOSPITAL_LICENSE_SALT` with a non-empty value
- `HOSPITAL_INITIAL_ADMIN_PASSWORD` with a non-empty value
- Real `.env` files (only `*.env.example` is allowed)
- Files inside `nginx/ssl/` (private cert material)

See `docs/SECRETS.md` for the full secret-management playbook
(rotation, audit log, disposal of old dumps).

## Disclosure policy

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):

- Reporter and the security team agree on a 90-day disclosure
  window from the date of acknowledgment.
- If a fix is ready earlier, we publish the advisory on the
  same day as the fix.
- If a fix is not ready by day 90, the reporter is free to
  publish. We do not request embargoes longer than 90 days.

## Cryptography

S_Hospital uses:

- **TLS 1.2+** for the public SPA (configurable; see
  `docs/HTTPS_OPTIONAL.md` for the self-signed CA path).
- **AES-256-CBC** for backup encryption (via `mysqldump` /
  `mariadb-dump --skip-comments` + openssl).
- **bcrypt** with cost 12 for password hashing.
- **RSA-2048** for the self-signed CA (regenerated per host).

The system does not implement a key rotation flow. The
`scripts/rotate_app_key.ps1` (see `docs/SECRETS.md`) rotates
the `APP_KEY` and re-signs the local license file, but it is
not a zero-downtime operation — plan a maintenance window.

## Dependency policy

- No cloud SDKs (no Supabase, Firebase, AWS, Azure, GCP,
  Stripe, etc). The system runs offline.
- No SaaS auth providers. Authentication is local
  (Sanctum session cookies + Spatie Permission).
- No npm packages that phone home at install time.
- Composer and npm installs must succeed on a network-isolated
  build box that has only the pre-bundled `offline-release/`
  archive.

## Acknowledgements

S_Hospital is built on the shoulders of the open-source
ecosystem: Laravel, React, TanStack Query, shadcn/ui, Recharts,
spatie/laravel-permission, Soketi, and many others. We are
grateful to the maintainers who make this work possible.
