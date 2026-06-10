# Secrets and credentials management

This document defines how secrets, credentials and keys are managed across
the S_Hospital system. It is the source of truth for the install scripts,
the pre-commit guard, and the production readiness preflight.

## Scope

The system is a local LAN deployment. There is no cloud, no SaaS, no
third-party identity provider. All secrets live on the server PC, in
`.env` files, in scheduled task environment, and in the database
configuration.

The following values are treated as secrets:

| Variable | Where it lives | Who sets it |
|---|---|---|
| `APP_KEY` | `backend/.env` | `php artisan key:generate` (auto on first boot) or installer |
| `DB_PASSWORD` | `backend/.env`, `docker-compose.prod.yml` env | `deploy_hospital_lan.ps1` random 16-char |
| `DB_ROOT_PASSWORD` | `backend/.env`, `docker-compose.prod.yml` env | `deploy_hospital_lan.ps1` random 16-char |
| `HOSPITAL_INITIAL_ADMIN_PASSWORD` | env, not in repo | Operator via hidden prompt |
| `HOSPITAL_LICENSE_SALT` | `backend/.env` | Operator (32+ chars random) |
| Backup encryption passphrase | Windows DPAPI or local file | Installer |

## Threat model

The server runs on a hospital LAN. Threats we care about:

1. A developer accidentally commits a working `.env` to git.
2. A field tech uses the dev defaults from `.env.example` in production.
3. A secret is leaked in a log file or support packet.
4. A backup file leaves the server with credentials inside the dump.

We do not defend against a hostile local admin (they have root). We do
defend against accidental disclosure and against a cashier PC on the LAN
reading each other's network traffic in cleartext.

## Rules

1. **No real secret in a tracked file.** `.env`, `.env.production`,
   `*.env.local` are git-ignored at the project root and in `backend/`.
2. **No real secret in `.env.example`.** Example files only contain
   placeholders, never real values, even for development. The dev
   `DB_PASSWORD=hospital_dev` default was removed in v1.0.0.
3. **No real secret in support packets.** `collect_support_packet.ps1`
   redacts `APP_KEY`, `DB_PASSWORD`, `*_TOKEN`, `*_SECRET`, `*_KEY`.
4. **Installer-generated secrets are random.** `deploy_hospital_lan.ps1`
   uses `[System.Security.Cryptography.RandomNumberGenerator]` for
   `APP_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`. The previous
   `Get-Random` implementation was replaced in v1.0.0.
5. **No secret in code comments.** Do not paste real keys into JSDoc,
   PHPDoc, or commit messages.

## APP_KEY rotation

`APP_KEY` encrypts Sanctum tokens, session cookies, signed URLs, and the
local license file. Rotating it invalidates:

- All active sessions (cashiers log in again)
- All pending password reset tokens
- All signed backup URLs
- The signature on the local license file

Procedure:

1. Schedule rotation during off-hours.
2. Run `php artisan key:generate --show` to capture the new key.
3. Update `backend/.env` with the new value.
4. Run `php artisan config:cache`.
5. Notify cashiers to log in again.
6. Re-sign the license file with the new salt if `HOSPITAL_LICENSE_SALT`
   also rotates.

Production note:

- If `license.json` exists in production, `HOSPITAL_LICENSE_SALT` must be
  configured. An empty salt only preserves local/testing compatibility with
  older unsigned development workflows; production validation fails closed.

## DB password rotation

MariaDB password rotation is more involved because the running PHP
connection pool needs to be reloaded.

Procedure:

1. Update the password in MariaDB: `ALTER USER 'hospital'@'%' IDENTIFIED BY 'NEW'; FLUSH PRIVILEGES;`
2. Update `DB_PASSWORD` in `backend/.env`.
3. Run `php artisan config:cache`.
4. Restart the queue worker and the web container so the new password
   is picked up: `docker compose restart backend queue-worker nginx`.
5. Verify with `php artisan tinker --execute="DB::connection()->getPdo(); echo 'ok';"`

## Pre-commit guard

A `pre-commit` hook is installed by `scripts/install_dev_hooks.ps1` (or
manually) at `.git/hooks/pre-commit`. It blocks:

- Adding a tracked file that contains `APP_KEY=base64:` followed by
  more than 16 base64 characters (real key, not the placeholder).
- Adding `DB_PASSWORD=anything-but-empty-or-placeholder` to a tracked
  file (the legacy dev defaults `hospital_dev` and `root_dev` are also
  blocked — v1.0.0 rotation).
- Adding `DB_ROOT_PASSWORD=anything-but-empty-or-placeholder` to a
  tracked file.
- Adding `HOSPITAL_LICENSE_SALT` with 8+ non-placeholder characters.
- Adding `HOSPITAL_INITIAL_ADMIN_PASSWORD` with any non-empty value.
- Adding a file inside `offline-release/` to the index (it is
  generated, not committed).
- Adding a file inside `nginx/ssl/` (private cert material).
- Adding a real `.env`, `.env.local`, or `.env.production` file (only
  `*.env.example` and `*.env.docker.example` are allowed).
- Adding a `HOSPITAL_DUMP_BINARY` with a Windows path (warning only,
  review intent).

The guard only inspects staged diffs. It does not scan the working tree
or untracked files.

### Rotation log

| Date | Reason | What was rotated |
|---|---|---|
| 2026-06-02 | Audit finding CRIT-1 — dev `APP_KEY` in `.env` was the same value used in tests and matched the prior leaked value. | New random dev `APP_KEY` generated; pre-commit guard expanded to cover `HOSPITAL_LICENSE_SALT`, `HOSPITAL_INITIAL_ADMIN_PASSWORD`, `.env` files, and `nginx/ssl/`. |

To skip the guard for a one-off commit (for example, when committing a
test fixture with a fake key): `git commit --no-verify`. Never skip
when committing real production configuration.

## Verification

The production readiness preflight validates that:

- `APP_KEY` in `backend/.env` is not the empty string and not the
  placeholder.
- `DB_PASSWORD` and `DB_ROOT_PASSWORD` are not `hospital_dev` or
  `root_dev`.
- `CORS_ALLOWED_ORIGINS` and `SANCTUM_STATEFUL_DOMAINS` do not
  contain `*` in production.
- No file inside `offline-release/` other than `MANIFEST.txt`,
  `checksums.sha256`, `setup.bat`, `docker-compose.prod.yml` and
  `Dockerfile.prod` is tracked.

Run with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://IP-SERVIDOR
```

## Reporting a leak

If a real secret is committed to git, even on a branch that has not
been pushed:

1. Rotate the secret immediately.
2. Use `git filter-repo --path <file> --invert-paths` to scrub the
   history (see the git-filter-repo documentation).
3. Force-push the rewritten history to all remotes.
4. Notify the team that the secret is compromised and that prior
   backups containing the old password should be considered leaked.

A committed secret cannot be "uncommitted". Rotation is the only
remedy.
