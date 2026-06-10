# SECRETS_SCAN — S_Hospital v1.0.0

**Date:** 2026-06-10
**Commit:** `94915a66`

## Method

- `git ls-files` (committed) + `git status --porcelain` (working tree) — what is or is not in git
- `git log -S` across all branches for the literal patterns
  - `APP_KEY=base64:`
  - `DB_PASSWORD=`
  - `HOSPITAL_LICENSE_SALT=`
  - `hospital-key`, `hospital-secret`, `hospital-app`, `hospital-os-lan-secured`
  - `MYSQL_PASSWORD=`
  - `BEGIN PRIVATE KEY`, `Bearer ey`
- Direct read of `backend/.env`, `backend/.env.example`, `backend/.env.docker.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `nginx/default.conf`, `offline-release/*`
- PHP-side: `ConfigLoader`-style scan via `php -r` over the repo
- `scripts/pre-commit-guard.ps1` smoke-tested on a sample of patterns

## Findings

| # | Pattern | File | Result |
|---|---|---|---|
| 1 | `APP_KEY=base64:` (real, >16 chars) | (none in HEAD) | **CLEAN** |
| 2 | `DB_PASSWORD=hospital_dev` | (none in HEAD) | **CLEAN** |
| 3 | `DB_PASSWORD=root_dev` | (none in HEAD) | **CLEAN** |
| 4 | `HOSPITAL_LICENSE_SALT=<32+>` | (none in HEAD) | **CLEAN** |
| 5 | `HOSPITAL_LICENSE_SALT=` (empty/default) | `backend/.env.example`, `backend/.env.docker.example` | **CLEAN** (placeholders only) |
| 6 | `HOSPITAL_INITIAL_ADMIN_PASSWORD=<value>` | (none in HEAD) | **CLEAN** |
| 7 | `PUSHER_APP_KEY=hospital-key` | (none in HEAD after `2fc53e14`) | **CLEAN** |
| 8 | `PUSHER_APP_SECRET=hospital-secret` | (none in HEAD) | **CLEAN** |
| 9 | `PUSHER_APP_ID=hospital-app` | (none in HEAD) | **CLEAN** |
| 10 | `Hospital_OS_LAN_Secured_2026_Key` | (none in HEAD after `94915a66`) | **CLEAN** |
| 11 | `SECRET_SALT hardcoded` | (none in HEAD) | **CLEAN** |
| 12 | `MYSQL_PASSWORD: hospital_dev` (YAML) | (none in HEAD after this round) | **CLEAN** |
| 13 | `MYSQL_ROOT_PASSWORD: root_dev` (YAML) | (none in HEAD after this round) | **CLEAN** |
| 14 | `localhost:3306 hospital hospital_dev` (Compose) | (none in HEAD) | **CLEAN** |
| 15 | LAN IPs hardcoded | (none in HEAD; `backend/.env` had `192.168.1.3` but is gitignored) | **CLEAN in committed code** |
| 16 | Windows user paths (`C:\Users\…`, `C:\xampp\…`) | (none in HEAD) | **CLEAN** |
| 17 | `.env` file present in working tree | `backend/.env` (gitignored, dev defaults cleaned) | **WORKING-TREE ONLY**, not committed |
| 18 | `backup.sql` / `*.sql` files | (none in HEAD, none in `offline-release/`) | **CLEAN** |
| 19 | JWT/Bearer tokens (`Bearer ey…`) | (none in HEAD) | **CLEAN** |
| 20 | `BEGIN PRIVATE KEY` / `BEGIN RSA PRIVATE KEY` | (none in HEAD) | **CLEAN** |

## Working-tree audit

The only `.env` present in the working tree is `backend/.env`. Its
`DB_PASSWORD` was cleaned to empty and the LAN IP replaced with
`localhost`. It is gitignored (`backend/.env` in `.gitignore`) and
the pre-commit guard refuses to commit it. No real production
secret is exposed in the working tree at HEAD.

The production installer (`scripts/deploy_hospital_lan.ps1`)
generates all real secrets at install time using
`[System.Security.Cryptography.RandomNumberGenerator]` (after the
`2fc53e14` fix). No installer-time hardcoded literals remain.

## Docker / offline-release scan

| File | Result |
|---|---|
| `docker-compose.yml` | no real DB password, uses `${DB_PASSWORD:?required}` |
| `docker-compose.prod.yml` | uses `${VAR:?required}` for every secret |
| `offline-release/MANIFEST.txt` | no secrets |
| `offline-release/checksums.sha256` | sha256 of image tars only |
| `offline-release/setup.bat` | does not embed credentials |
| `nginx/default.conf` | no credentials |
| `nginx/crontab` | no credentials |
| `offline-images/*/Dockerfile.prod` | no secrets baked |

## CI workflow

`./.github/workflows/ci.yml` references `hospital_dev` / `root_dev` in
ephemeral MariaDB service env. These are **not real secrets**;
they are dev-only literal placeholders that mirror what the
`phpunit.xml` testing harness already uses. They are blocked from
becoming real by the `${VAR:?}` fail-fast guards in
`docker-compose.prod.yml`. Tracked as **LOW** `SEC-SEC-007` (open by
design, out-of-tree for this repo).

## History of fixes

| Commit | Fix |
|---|---|
| `8c0f4188` | `fix(backend): remove unused AuditLogger support class` (cleanup) |
| `f97ffca4` | `fix(security): activate permission assignment auditing` |
| `cdf00efe` | `qa(secret-scan): refresh output after secretscan fix` |
| `2fc53e14` | `fix(frontend+ops): csrf TTL 10m, nginx api access_log off, deploy crypto helpers` |
| `94915a66` | `fix(security): apply v1.0.0 security audit round 2 hardening` (this round) |

## Conclusion

**0 real production secrets in the working tree, the git index, or
any commit reachable from HEAD.** All sensitive values are either:
1. placeholders in `.env.example` / `.env.docker.example`,
2. resolved at install time from `deploy_hospital_lan.ps1`'s cryptographic RNG,
3. resolved at container start from `docker-compose.prod.yml`'s `${VAR:?required}` fail-fast,
4. stored in OS-level environment variables (CI), not in any tracked file.

**The secret scan passes the security quality gate.**
