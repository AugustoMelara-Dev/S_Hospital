# S_Hospital - Infrastructure & Deployment Audit (read-only)

Auditor: senior infrastructure / deployment auditor

Scope: `C:\Projects\S_Hospital` - local Windows LAN hospital billing system

Method: read-only. No file was modified, no migration was run, no service was touched.

Note: the working tree contains live `.env` and `backend/.env` files. They are

**not** tracked in git (verified with `git ls-files`), but they are still on

disk and were only read, not changed. Their contents are quoted below as

evidence.

## Severity summary

| Severity | Count |

|---|---|

| P0 | 3 |

| P1 | 8 |

| P2 | 9 |

| P3 | 6 |

| NO VERIFICADO | 3 |

## Findings table

| ID | Sev | Area | Title |

|---|---|---|---|

| INF-001 | P0 | env | `backend/.env` in working tree has `APP_DEBUG=true` and `DB_PASSWORD=[redacted-dev-default]` |

| INF-002 | P0 | env, hardcoded | Root `.env` carries well-known dev DB passwords and an `APP_KEY` |

| INF-003 | P0 | env | `.env` files not tracked but present in the worktree (silent leak) |

| INF-004 | P1 | script | `setup.bat` generates DB passwords with `Get-Random` (not RNGCrypto) |

| INF-005 | P1 | permission, script | `setup.bat` writes `.env` without ACL restrictions |

| INF-006 | P1 | script, env | `setup.bat` does not warn or fix `APP_DEBUG=true` left in `backend/.env` |

| INF-007 | P2 | script | `setup.bat` does not pre-check that 8000 / 3306 are free |

| INF-008 | P2 | env | `setup.bat` does not generate Pusher secrets or `HOSPITAL_LICENSE_SALT` |

| INF-009 | P3 | script | `setup.bat` runs `docker compose` without `-f docker-compose.yml` |

| INF-010 | NV | docker | No `docker-compose.prod.yml` separate from `docker-compose.prod.yml` (clarification) |

| INF-011 | P2 | docker, permission | `mariadb` container has no `user:` pin and no `cap_drop` |

| INF-012 | P2 | docker, log | No log rotation configured for Docker containers |

| INF-013 | P2 | docker, log | `backend` container has no persisted log volume; logs lost on restart |

| INF-014 | P1 | header | nginx HTTP server has no HSTS; CSP `report-uri` only on report-only |

| INF-015 | P2 | header | nginx does not add security headers on `/api/` and error pages |

| INF-016 | P3 | header | nginx per-server `client_max_body_size`; no buffer sizes set |

| INF-017 | P2 | header, DoS | No nginx-level rate limit (only Laravel) |

| INF-018 | P1 | env, security | `TRUSTED_PROXIES` not configured; `Request::ip()` trust issue |

| INF-019 | P2 | env, security | No `URL::forceScheme('https')` / no `trusted_hosts` in production |

| INF-020 | P2 | env, security | `SESSION_SECURE_COOKIE` not set; cookies not marked Secure by default |

| INF-021 | P2 | secret, env | `MAIL_PASSWORD` env vars present; could leak via support packets |

| INF-022 | P1 | secret, ci | CI uses `DB_PASSWORD=[redacted-dev-default]` and a hard-coded test `APP_KEY` |

| INF-023 | P3 | ci | CI does not build the production Docker image; release workflow skips tests |

| INF-024 | P2 | scheduler, backup | No `RTO` / `RPO` documented; no external backup destination |

| INF-025 | P2 | backup, permission | No instruction to exclude backup folder from Windows Defender |

| INF-026 | P2 | scheduler, queue | Queue worker has no `--memory` limit; can OOM on large DB dump |

| INF-027 | P2 | permission, log | `AuditLog::old_values` / `new_values` may contain PII in plaintext |

| INF-028 | P3 | log | `LOG_DAILY_DAYS` not set in any env file (defaults to 14) |

| INF-029 | P2 | docker, security | `PUSHER_APP_SECRET` etc. are not pulled from Docker secrets or files |

| INF-030 | P2 | header, log | `report-uri` for CSP is public and unauthenticated (4KB body limit) |

| INF-031 | P2 | script | Hardcoded `C:\xampp\...` paths in multiple scripts; no `C:\Hospital_Caja` example |

| INF-032 | P2 | script | `install_backup_tasks_windows.ps1` runs scheduled tasks as `SYSTEM` |

| INF-033 | P3 | script | `-ExecutionPolicy Bypass` used in 28 places; rely on caller trust |

| INF-034 | P3 | docs | `docs/BACKUP_RESTORE.md` references `C:\HospitalBilling\backend` as default install path |

| INF-035 | NV | docker | Soketi is configured and correctly bound to 127.0.0.1 (verified) |

| INF-036 | P3 | backup, log | `scheduler-task.log` lives in `backend/storage/logs/` and is git-ignored (good) |

| INF-037 | P2 | docker, security | `mariadb` port is **not** exposed in `docker-compose.prod.yml` (verified good) |

| INF-038 | NV | backup | Backups are kept only on the named volume; manual copy needed |

---

## INF-001 - backend/.env in working tree has APP_DEBUG=true and DB_PASSWORD=[redacted-dev-default]

- Severity: **P0**

- Area: env

- File: backend/.env:4, 25

- Evidence:

  `env

  APP_ENV=local

  APP_KEY=base64:[redacted]

  APP_DEBUG=true

  ...

  DB_PASSWORD=[redacted-dev-default]

  `

- Reproduction: Get-Content C:\Projects\S_Hospital\backend\.env.

- Impact: anyone running docker compose up against this checkout starts the

  backend with debug pages (stack traces, env dump, file paths exposed) and

  the publicly-documented dev DB password. The production preflight explicitly

  rejects both values (scripts/production_readiness_preflight.ps1:362,398),

  so a deployer shipping the file as-is will fail loudly - but a developer

  running locally silently leaks.

- Fix: regenerate the file from .env.docker.example before each local

  session, or template it through setup.bat. The pre-commit guard already

  blocks committing it (scripts/pre-commit-guard.ps1:77-82). Add a

  scripts/reset_dev_env.ps1 that wipes backend/.env and .env,

  regenerates from templates, and prompts for fresh dev passwords.

- Test: after a clean checkout, git status must show no .env files

  present; running php artisan env must report production-safe defaults

  or require explicit regeneration.

## INF-002 - .env at the project root has the well-known dev DB passwords

- Severity: **P0**

- Area: env / hardcoded

- File: .env:4, 8, 9

- Evidence:

  `env

  APP_KEY=base64:[redacted]

  DB_PORT=3307

  DB_DATABASE=hospital_billing

  DB_USERNAME=hospital

  DB_PASSWORD=[redacted-dev-default]

  DB_ROOT_PASSWORD=[redacted-dev-default]

  `

- Reproduction: Get-Content C:\Projects\S_Hospital\.env.

- Impact: same as INF-001, plus the file is the env-file consumed by

  docker-compose.yml and docker-compose.prod.yml (e.g. line 15 of

  docker-compose.yml consumes ${DB_PASSWORD:?DB_PASSWORD is required}).

  The dev defaults hospital_dev and
oot_dev are listed in the

  preflight's $forbiddenDbPasswords array

  (scripts/production_readiness_preflight.ps1:398), so a copy of the prod

  stack started against this file would be refused at deploy time. It is

  still a leaked credential.

- Fix: same as INF-001. The root .env should be deleted from the working

  tree of any non-deployment host. The preflight already does

  git ls-files .env backend/.env frontend/.env

  (scripts/update_release_preflight.ps1:111-116).

- Test: git status --ignored shows .env listed under "ignored files".

## INF-003 - .env files not tracked but present in the worktree

- Severity: **P0** (because of the values; the file itself is correctly

  git-ignored)

- Area: env

- Files: .gitignore:12, backend/.gitignore:3

- Evidence:

  - git ls-files returns only .env.example, backend/.env.example,

    backend/.env.docker.example, frontend/.env.example - no real .env

    is tracked.

  - The pre-commit guard already blocks real .env from being added

    (scripts/pre-commit-guard.ps1:77-82).

  - But the file is **on disk** (see INF-001/002). A contributor who

    git pulls and runs docker compose up -d will pick up the stale

    local .env, not the templates.

- Impact: local dev environment is silently misconfigured; deleting .env

  would force the operator through the documented

  cp .env.docker.example .env flow.

- Fix: add scripts/clean_local_env.ps1 that the preflight invokes in

  non-prod mode and refuses to run if .env exists. Document in

  docs/RELEASE_CHECKLIST.md that contributors should delete

  .env / backend/.env before a docker run.

- Test: in a fresh clone, run docker compose config and verify it

  fails (because ${DB_PASSWORD:?DB_PASSWORD is required} is undefined).

## INF-004 - setup.bat uses Get-Random (not RNGCrypto) to generate DB passwords

- Severity: **P1**

- Area: script

- File: setup.bat:84

- Evidence:

  `powershell

  powershell -NoProfile -Command \"\='abc...XYZ0..9'.ToCharArray(); \=(\ | Sort-Object {Get-Random} | Select-Object -First 24) -join ''; ...\"

  `

  docs/SECRETS.md:50 says the old Get-Random implementation was

  "replaced in v1.0.0" with RandomNumberGenerator, but this dev-only

  setup.bat still uses Get-Random.

- Reproduction: run setup.bat and inspect the generated .env.

- Impact: 24-char password from a 62-char alphabet has lower entropy than

  a true random source. Not the production path (prod uses

  deploy_hospital_lan.ps1), but it is the entry point for fresh dev/test

  installs and is the one operators are most likely to fall through to.

- Fix: replace with [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24) (the pattern used in deploy_hospital_lan.ps1). Even

  better, delete the inline PowerShell and call a shared

  scripts/lib/RandomPassword.ps1.

- Test: after a generated password, run a histogram of the chars and

  confirm uniform distribution across all 62 chars.

## INF-005 - setup.bat writes .env without restricting ACL

- Severity: **P1**

- Area: permission / script

- File: setup.bat:84

- Evidence: Set-Content -Path '%~dp0.env' -Value ('DB_PASSWORD='+\+...) -

  no chmod 600 / no icacls step. The file inherits the

  Authenticated Users default DACL.

- Reproduction: run setup.bat and icacls .env on the generated file.

- Impact: the freshly-generated DB password is readable by every other

  Windows user on the same machine.
estore_hospital_windows.ps1:113-118

  already does the equivalent ACL tightening for the mysql defaults file;

  setup.bat does not.

- Fix: chain an icacls \"%~dp0.env\" /inheritance:r /grant:r \"%USERNAME%:(R,W)\" /grant:r \"SYSTEM:(R,W)\" call after the

  Set-Content. Same treatment for backend\\.env.

- Test: after setup.bat, icacls .env must show only the operator

  user and SYSTEM with read/write; no Users or Everyone.

## INF-006 - setup.bat does not warn when APP_DEBUG=true is in backend/.env

- Severity: **P1**

- Area: script / env

- File: setup.bat:79

- Evidence: the script copies backend\\.env.docker.example to

  backend\\.env only **if it does not already exist** (line 77-80).

  backend/.env.example and backend/.env.docker.example both have

  APP_DEBUG=false, so a fresh setup is correct. But on a workstation where

  backend/.env already exists (see INF-001), the script never inspects

  the value.

- Impact: the existing APP_DEBUG=true from INF-001 propagates into the

  live container.

- Fix: after the if not exist check, findstr /b \"APP_DEBUG=true\" backend\\.env and either rewrite to false (with a warning) or

  refuse to continue.

- Test: with a backend/.env containing APP_DEBUG=true, run setup.bat;

  it must print a warning or rewrite the value.

## INF-007 - setup.bat does not check that the network ports are free

- Severity: **P2**

- Area: script

- File: setup.bat:90

- Evidence: docker compose up -d backend mysql - no port preflight.

  The error path at line 94 mentions "Revise si los puertos 8000 o 3306

  estan ocupados" but only after the failure.

- Impact: if another service is bound to 8000, the script exits with

  errorlevel 1, but the operator has to read the error to find out which

  port; meanwhile the partial stack (mysql up, backend crashing) is left

  behind.

- Fix: add a small PowerShell block that calls

  Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -InformationLevel Quiet

  and refuses to continue if the port is already in use; propose

  alternative APP_PORT values.

- Test: start a dummy listener on 8000, run setup.bat, and confirm it

  fails fast with a clear message before any docker call.

## INF-008 - setup.bat does not generate APP_KEY, Pusher, or HOSPITAL_LICENSE_SALT

- Severity: **P2**

- Area: env / hardcoded

- File: setup.bat (whole file)

- Evidence: only DB_PASSWORD and DB_ROOT_PASSWORD are generated

  (line 84). APP_KEY is generated by php artisan key:generate at

  line 125. PUSHER_APP_ID/KEY/SECRET and HOSPITAL_LICENSE_SALT

  remain empty.

- Impact: production docker-compose.prod.yml fails to start without Pusher

  values (backend/config/broadcasting.php:5-11 throws a

  RuntimeException in production if any Pusher env is blank).

  HOSPITAL_LICENSE_SALT is required for signed license files in

  production (docs/SECRETS.md:76-78).

- Fix: extend the inline PowerShell to also generate 32-char secrets for

  PUSHER_APP_ID, PUSHER_APP_KEY, PUSHER_APP_SECRET and

  HOSPITAL_LICENSE_SALT when running in production mode; or document

  that the operator must edit .env after setup.bat.

- Test: in a fresh worktree, run setup.bat and check the generated .env

  for empty PUSHER_* values; they must be filled.

## INF-009 - setup.bat runs docker compose without -f docker-compose.yml

- Severity: **P3**

- Area: script

- File: setup.bat:90

- Evidence: docker compose up -d backend mysql defaults to

  docker-compose.yml (dev). That is correct for the documented use of

  this file. But there is no guard against the operator being in a

  checkout where docker-compose.yml was modified to point to production

  images.

- Impact: P3 because the script is explicitly labelled dev-only.

- Fix: docker compose -f docker-compose.yml up -d backend mysql to make

  the target explicit; refuse to run if docker-compose.prod.yml is the

  only compose file in the root.

- Test: a typo of docker-compose.yml to docker-compose.prod.yml must

  be caught and refused with a clear message.

## INF-010 - Production compose file clarification

- Severity: **NO VERIFICADO**

- Area: docker

- File: docker-compose.prod.yml

- Evidence: the only production compose file is

  docker-compose.prod.yml. The dev compose file is docker-compose.yml.

  This is consistent with setup.bat:18-19. The offline release is

  generated by scripts/make_offline_release.ps1 and includes the prod

  compose. The preflight (scripts/production_readiness_preflight.ps1:354)

  detects the docker package layout by the presence of

  docker-compose.prod.yml and the absence of backend/artisan.

- Impact: none if the offline-release flow is followed.

- Fix: N/A.

- Test: N/A.

## INF-011 - mariadb container has no user: pin and no cap_drop

- Severity: **P2**

- Area: docker / permission

- File: docker-compose.prod.yml:100-123

- Evidence: the mariadb:11.4.3 image runs as mysql by default, but

  the compose file does not pin a user: directive. There is no

  cap_drop: [\"ALL\"] either.

- Impact: if the upstream image ever changes the default UID, the named

  volume (mysql_prod_data) might be created with the wrong owner. Also

  the container keeps the full default capability set.

- Fix: add user: \"999:999\" and cap_drop: [\"ALL\"]; cap_add: [\"CHOWN\",\"DAC_OVERRIDE\",\"FOWNER\",\"SETUID\",\"SETGID\"].

- Test: docker compose -f docker-compose.prod.yml --env-file .env exec mysql whoami must report mysql, and capsh --print inside

  must not show cap_sys_admin etc.

## INF-012 - No log rotation configured for Docker containers

- Severity: **P2**

- Area: docker / log

- File: docker-compose.prod.yml (whole file)

- Evidence: there is no logging: block and the host does not

  configure log rotation for /var/lib/docker/containers/*/log.json.

  The mysql, backend, queue-worker, scheduler and soketi containers

  will all eventually fill /var/lib/docker.

- Impact: long-running hospital server, no rotation, will eventually

  cause a disk full incident. The runbook covers

  "Disco del servidor lleno" in docs/DISASTER_RECOVERY.md:123 but it

  is a self-inflicted incident.

- Fix: add a project-level /etc/docker/daemon.json snippet via

  scripts/install_hospital_os.ps1 that sets

  \"log-driver\": \"json-file\", \"log-opts\": {\"max-size\": \"20m\", \"max-file\": \"5\"}

  - and document this in docs/OFFLINE_LAN_INSTALL.md. Alternatively, set

  per-service logging: in the compose file.

- Test: after 1 week of uptime, du -sh /var/lib/docker/containers/*

  must be bounded.

## INF-013 - backend container has no persisted log volume

- Severity: **P2**

- Area: docker / log

- File: docker-compose.prod.yml:63-68

- Evidence:
ead_only: false and tmpfs: [/tmp:size=64m,mode=1777].

  This is intentional because Laravel needs to write to

  storage/framework/views, storage/framework/cache,

  storage/framework/sessions and bootstrap/cache/. But there is no

  dedicated writable volume for those paths - they are inside the image

  overlay and lost on container restart.

- Impact: log loss on every container restart. LOG_CHANNEL=daily is

  configured in docker-compose.prod.yml:34, but the daily log files

  vanish on docker compose restart backend. The same applies to

  queue-worker and scheduler.

- Fix: mount a named volume backend_logs:/var/www/html/storage/logs in

  both backend and queue-worker services. Alternatively, set

  LOG_CHANNEL=stderr and let the docker log driver handle rotation

  (with INF-012's fix).

- Test: after docker compose restart backend, the previous day's

  storage/logs/laravel-*.log files must still be readable.

## INF-014 - nginx HTTP server has no HSTS; CSP
eport-uri only on report-only

- Severity: **P1**

- Area: header

- File:

ginx/default.conf:12-112

- Evidence: the server { listen 80; ... } block has no

  Strict-Transport-Security (only the commented-out HTTPS block at

  line 127 does), and the per-location add_header CSP does not include


eport-uri. The
eport-uri is only added by

  backend/app/Http/Middleware/AddSecurityHeaders.php:128 for

  Content-Security-Policy-Report-Only, which the nginx config sends in

  a separate add_header and nginx strips (it does not concatenate

  multiple CSP headers - it sends both, and the browser only enforces

  the first).

- Impact: without HSTS, even after the optional HTTPS block is enabled,

  a downgrade attack is possible on the first request. The CSP


eport-uri set by the middleware never reaches the enforced CSP

  header.

- Fix: add HSTS to the HTTP server when nginx is reachable on HTTPS.

  Move the CSP
eport-uri to the enforced header.

- Test: curl -I http://server/ | grep -i strict must show

  Strict-Transport-Security even on port 80; curl -I http://server/ | grep -i content-security-policy must show


eport-uri /api/system/csp-report.

## INF-015 - nginx does not add security headers on /api/ responses

- Severity: **P2**

- Area: header

- File:

ginx/default.conf:45-56

- Evidence: the /api/ location block has no add_header lines at

  all (the comment at line 41 says "Cabeceras comunes de seguridad

  eliminadas del nivel de servidor"). It relies on the Laravel

  middleware (AddSecurityHeaders) to set them. That is fine, but the

  access_log off (line 55) means nginx is also not logging

  cache-control violations or response status for API calls. More

  importantly, error responses returned directly by nginx (502, 504,

  413) will be sent without any security headers.

- Impact: if PHP-FPM goes down, the 502 page returned by nginx has no

  X-Frame-Options, no CSP, no Referrer-Policy. The HTML nginx

  returns could be rendered inside an iframe by an attacker page.

- Fix: add add_header X-Frame-Options \"DENY\" always; (and the other

  headers) to the /api/ location block, and to a generic

  location @error_page. Keep access_log off if the volume is too

  high.

- Test: stop php-fpm, hit /api/health, and confirm the 502 response

  carries the security headers.

## INF-016 - nginx per-server client_max_body_size; no buffer sizes set

- Severity: **P3**

- Area: header / request limit

- File:

ginx/default.conf:19

- Evidence: client_max_body_size 32M is per server. That matches the

  PHP upload_max_filesize=32M and post_max_size=32M from

  backend/Dockerfile.prod:55-58, which is good. But the nginx config

  also has no explicit client_body_buffer_size and no

  client_header_buffer_size.

- Impact: occasional 400 Bad Request from nginx on legitimate requests.

  P3 because easy to diagnose.

- Fix: add client_body_buffer_size 16k; client_header_buffer_size 4k; large_client_header_buffers 4 16k; at the top of the server block.

- Test: send a request with a 2 KB Referer header and confirm 200.

## INF-017 - No rate limit at the nginx layer

- Severity: **P2**

- Area: header / DoS

- File:

ginx/default.conf (whole file)

- Evidence: there is no limit_req_zone or limit_conn_zone. The

  Laravel middleware ThrottleByUser exists

  (backend/app/Http/Middleware/ThrottleByUser.php:21) and is used

  for some routes, but /login, /sanctum/csrf-cookie, and the static

  assets have no IP-based protection.

- Impact: a malicious or buggy cashier PC can flood the CSRF cookie

  endpoint or the static asset endpoint and saturate the backend /

  nginx connection pool.

- Fix: add limit_req_zone \ zone=lan:10m rate=10r/s; and limit_req zone=lan burst=20 nodelay; in the server block.

  Key on IP, not on user, because login happens before authentication.

- Test: ab -n 200 -c 20 http://server/up must return 429 within the

  first 100 requests.

## INF-018 - TRUSTED_PROXIES is not configured

- Severity: **P1**

- Area: env / security

- File: backend/app/Http/Middleware/LoginLockout.php:23,

  backend/app/Http/Middleware/ThrottleByUser.php:64

- Evidence: $request->ip() is used for the per-IP login lockout

  (5 per login, 20 per IP). A grep for TRUSTED_PROXIES or

  TrustProxies in the entire backend/ directory returns **no

  matches**. The bootstrap/app.php does not register

  TrustProxies::class.

- Impact: Laravel will trust X-Forwarded-For only if a TrustProxies

  middleware is registered. With nginx as the only proxy, by default

  Laravel uses the connection IP (127.0.0.1 inside the container) for

  everything, which makes the per-IP lockout useless (every cashier PC

  connects from 127.0.0.1 as far as FPM is concerned). The

  per-login lockout still works, but the 20-per-IP cap is bypassed.

  Alternatively, if TRUSTED_PROXIES=* is ever set without

  TrustProxies, the IP would be taken from the header and the lockout

  could be bypassed by an attacker rotating the header.

- Fix: register Illuminate\Http\Middleware\TrustProxies in

  bootstrap/app.php with the nginx subnet (e.g.

  \->trustProxies(at: '172.16.0.0/12,192.168.0.0/16,10.0.0.0/8')).

  Document in docs/SECRETS.md / docs/DECISIONS.md.

- Test: from a second PC, attempt 20 failed logins; the 21st must

  return 423 with lockout_reason=login_ip.

## INF-019 - No URL::forceScheme('https') / no trusted_hosts in production

- Severity: **P2**

- Area: env / security

- File: backend/app/Providers/AppServiceProvider.php (whole file)

- Evidence: AppServiceProvider::boot() does not call URL::forceScheme

  or Request::setTrustedHosts. A grep for forceScheme or

  trusted_hosts in the entire backend/ directory returns **no

  matches**. docs/HTTPS_OPTIONAL.md documents the optional HTTPS

  block, and F7_OPERATIONAL_RELEASE_GATE_REPORT.md mentions

  "mandatory HTTPS in PRODUCTION_READY", but neither has been

  implemented in code.

- Impact: if the optional nginx HTTPS block is enabled but

  forceScheme is not called, mixed-content warnings appear in the SPA.

  If APP_URL is set to http://... (as the docker compose does),

  password reset links, signed URLs, and CSRF cookies are all served

  over HTTP.

- Fix: add if (\->app->environment('production')) { URL::forceScheme('https'); } to AppServiceProvider::boot(), gated by

  HOSPITAL_REQUIRE_HTTPS env. Document in

  docs/DECISIONS.md.

- Test: with APP_ENV=production, generate a signed URL

  (php artisan tinker --execute=\"echo URL::temporarySignedRoute(...);\")

  and confirm the scheme is https.

## INF-020 - SESSION_SECURE_COOKIE not set

- Severity: **P2**

- Area: env / security

- File: backend/.env, backend/.env.example, backend/config/session.php:173

- Evidence: a grep for SESSION_SECURE_COOKIE in the .env files

  returns no matches. The default in config/session.php is

  env('SESSION_SECURE_COOKIE') which evaluates to

ull if unset.

  The docker prod env does not set it either.

- Impact: in production behind the optional HTTPS block, the session

  cookie is still sent over HTTP. CSRF / session hijacking is possible

  if a cashier PC is ever routed to plaintext.

- Fix: set SESSION_SECURE_COOKIE=true in the production env.

  Cross-check with SESSION_HTTP_ONLY (default true, good) and

  SESSION_SAME_SITE (default 'lax', OK for Sanctum).

- Test: curl -i http://server/login | grep -i set-cookie must show

  Secure; HttpOnly; SameSite=Lax when HTTPS is enabled.

## INF-021 - MAIL_PASSWORD env vars present; could leak via support packets

- Severity: **P2**

- Area: secret / env

- File: backend/.env.example:78-85, backend/.env.docker.example:49-51,

  backend/.env:46-53

- Evidence: both .env templates define MAIL_HOST, MAIL_PORT,

  MAIL_USERNAME, MAIL_PASSWORD (all set to

ull / 127.0.0.1 /

  log mailer, so no real creds in the templates). The MAIL_MAILER=log

  is correct for an offline LAN, so the values will never be used, but

  the variables are still defined and would be redacted by

  collect_support_packet.ps1 and production_readiness_preflight.ps1.

- Impact: a future operator might fill these with real SMTP creds for

  "email receipts", which then get printed in the support packet

  (or worse, in a screen-sharing session with the pre-commit guard

  text). The redactor in production_readiness_preflight.ps1:43 and

  update_release_preflight.ps1:33 does cover MAIL_PASSWORD so the

  print is safe, but the variable should not be in the offline

  production env at all.

- Fix: remove the MAIL_* variables from backend/.env.example,

  backend/.env.docker.example, and the docker prod env. They are

  not used.

- Test: grep -i MAIL_ .env* returns no results.

## INF-022 - CI uses DB_PASSWORD=[redacted-dev-default] and a hard-coded test APP_KEY

- Severity: **P1**

- Area: secret / ci

- File: .github/workflows/ci.yml:59, 98, 130, 167

- Evidence:

  - APP_KEY=base64:[redacted] is the

    hard-coded CI key (32 	 characters). This is documented as a

    "safe placeholder" in docs/CI.md:67-75.

  - DB_PASSWORD=[redacted-dev-default] is used in the mariadb service container

    (line 98) and re-used for the test connection (line 167). It is the

    same value as the dev default the preflight rejects in production.

- Impact: the same APP_KEY and DB_PASSWORD are used across every CI

  run. If a contributor copies the test APP_KEY into a commit by

  accident, the pre-commit guard will accept it because it is 32 chars

  and matches the regex ^[A-Za-z0-9+/=]{16,}\$ (scripts/pre-commit-guard.ps1:85).

  The pre-commit guard actually fires for the

  'base64:dGVzdHRlc3R0ZXN0dGVzdHRlc3R0ZXN0dGVzdHRlc3Q=' value because

  the regex matches; but a 	*t string will pass the preflight's

  "non-empty / non-blank" check and could land in a real .env. The

  CI secret is safe inside GitHub (per docs/CI.md), but the pattern

  is brittle.

- Fix: use a CI-specific APP_KEY that is not all the same character

  (e.g. base64: followed by 32 random hex). Use a random

  DB_PASSWORD for the mariadb service and pass it through

  secrets: instead of hard-coding.

- Test: git log --all -S \"base64:dGVzdHRlc3R0ZXN0dGVzdHRlc3R0ZXN0dGVzdHRlc3Q=\" returns zero hits in any tracked file other than the

  workflow itself.

## INF-023 - CI does not build the production Docker image; release workflow skips tests

- Severity: **P3**

- Area: ci

- File: .github/workflows/ci.yml (whole file),

  .github/workflows/release.yml (whole file)

- Evidence: the ci.yml jobs run PHPUnit, Pint, PHPStan, npm

  typecheck/lint/test/build, and a mocked E2E. None of them run

  docker build -f backend/Dockerfile.prod or

  docker compose -f docker-compose.prod.yml config. The


elease.yml alidate job only checks release notes exist and

  that the proof files have moved past PENDING. It does not run

  tests.

- Impact: a broken prod-only change (e.g. wrong Dockerfile.prod

  ENTRYPOINT) will pass CI and only be caught by the offline

  release pipeline or a manual run.

- Fix: add a docker-prod-build job in ci.yml that runs

  docker build -f backend/Dockerfile.prod . on every PR; gate the


elease.yml alidate job on ci.yml having passed for the

  release tag.

- Test: a PR with a broken Dockerfile.prod must fail the

  docker-prod-build job.

## INF-024 - No RTO / RPO documented; no external backup destination

- Severity: **P2**

- Area: scheduler / backup

- File: docs/DISASTER_RECOVERY.md, docs/BACKUP_RESTORE.md,

  backend/routes/console.php:55-77

- Evidence: the recovery runbook describes 10 scenarios, but does not

  state the recovery time objective (RTO) or recovery point objective

  (RPO). The backup schedule is: daily at 02:00 + every 15 min during

  operating hours (backend/routes/console.php:55-67). The backup

  volume is backup_data:/var/www/html/storage/app/private/backups

  (docker-compose.prod.yml:53, 167, 236). No mention of a USB drive,

  NAS, or remote copy.

- Impact: in a disk-loss incident (runbook scenario 5), the only

  backup is on the same server. The hospital has no off-host copy.

  The RPO depends on how recently the operator copied the backup off.

- Fix: document the expected RTO (<= 1 hour) and RPO (<= 15 min

  during operating hours, <= 24 hours otherwise) in

  docs/DISASTER_RECOVERY.md. Add a section "External backup copy"

  that documents the USB / NAS cadence, and a Windows scheduled task

  that copies the latest backup to a removable drive.

- Test: a fresh disaster_recovery_drill run with a USB drive

  inserted must succeed in <= 1 hour; a backup made at 17:00 must be

  available for restore at 17:15 (or, if outside operating hours, the

  last 02:00 backup).

## INF-025 - No instruction to exclude backup folder from Windows Defender

- Severity: **P2**

- Area: backup / permission

- File: docs/BACKUP_RESTORE.md, docs/DISASTER_RECOVERY.md,

  scripts/install_hospital_os.ps1

- Evidence: no mention of MpPreference or Add-MpPreference

  -ExclusionPath anywhere. The backup volume is mounted at

  storage/app/private/backups and is written by the PHP process.

- Impact: Windows Defender real-time scan will scan every .sql file

  written by the worker, sometimes locking the file mid-write and

  causing the worker to crash. This is a known Windows issue.

- Fix: in scripts/install_hospital_os.ps1, add a step that runs

  Add-MpPreference -ExclusionPath \"\\\backend\\storage\\app\\private\\backups\" -ErrorAction SilentlyContinue when

  Defender is detected. Document the rationale in

  docs/DECISIONS.md.

- Test: with Defender active, generate 10 backups in a row; all 10

  must reach success status.

## INF-026 - Queue worker has no --memory limit; can OOM on large DB dump

- Severity: **P2**

- Area: scheduler / queue

- File: docker-compose.prod.yml:131

- Evidence:

  php artisan queue:work --queue=backups --tries=1 --timeout=600

  No --memory=256 flag. The container's mem_limit: 384m is set, so

  the kernel OOM-killer will terminate the worker; but the

  RestartCount 3 (scripts/install_backup_tasks_windows.ps1:222) will

  restart it, and the next run will read the same job and OOM again.

- Impact: a large DB (multi-GB dump) will fail the worker, retry

  forever, and the queue fills up.

- Fix: add --memory=256 to the queue:work command. Add a check in

  the CreateBackupAction that splits the dump into chunks if

  DB_SIZE_MB > 200.

- Test: with a 300 MB database, the worker must succeed or fail

  cleanly (no restart loop).

## INF-027 - AuditLog::old_values /

ew_values may contain PII in plaintext

- Severity: **P2**

- Area: permission / log

- File: backend/app/Models/AuditLog.php:14-15, 28-43

- Evidence: the AuditLog model exposes old_values and

ew_values

  as JSON arrays with no redaction. A grep for AuditLog::create or

  audit_log in the codebase (e.g. backend/app/Observers/PermissionAuditObserver.php)

  shows that the observer stores attachPermission /

  detachPermission payloads, which are role/permission names, not

  PII. But other code paths that write to audit_log (e.g. invoice

  creation, payment) may include patient name, totals, payment

  reference, and other PII. There is no encrypted cast on

  old_values/

ew_values.

- Impact: a backup of the database (taken via the in-app backup) is a

  plaintext SQL dump. Whoever reads the backup (operator, USB holder)

  can read every patient name and every payment. The

  idempotency:encrypt-legacy command exists

  (backend/app/Console/Commands/EncryptLegacyIdempotencyKeysCommand.php)

  and is referenced in docs/RELEASE_CHECKLIST.md:138-142, but only

  for idempotency_keys, not for audit_logs.

- Fix: add an encrypted cast on old_values and

ew_values, and

  run a one-time audit_log:encrypt-legacy command similar to

  idempotency:encrypt-legacy. Or, alternatively, do not store PII

  in the audit log - just record the entity id, action, and IP.

- Test: after the fix, the database backup must not contain any

  patient name in plaintext when grepped for a known patient.

## INF-028 - LOG_DAILY_DAYS not set in any env file

- Severity: **P3**

- Area: log

- File: backend/.env.example:31, backend/config/logging.php:72

- Evidence: the daily channel reads env('LOG_DAILY_DAYS', 14). None

  of the env files set it. So logs are kept for 14 days.

- Impact: 14 days may be too short for a hospital audit requirement

  (typically 90 days for financial records). No

  HOSPITAL_LOG_RETENTION_DAYS env exists.

- Fix: set LOG_DAILY_DAYS=90 in docker-compose.prod.yml and

  document the rationale in docs/DECISIONS.md.

- Test: after 100 days, the daily log file for day 1 must still be

  on disk (or offloaded to a NAS).

## INF-029 - PUSHER_APP_SECRET etc. are env vars, not Docker secrets

- Severity: **P2**

- Area: docker / secret

- File: docker-compose.prod.yml:42-51, 156-165, 268-270

- Evidence: PUSHER_APP_ID/KEY/SECRET are passed via

  environment: from the root .env file. They are not pulled from

  Docker secrets (secrets: block) nor from a file mount.

- Impact: docker inspect backend will reveal the values to anyone

  with shell access on the host. With the .env file having

  chmod 600, the risk is bounded, but a Docker secrets / file

  approach is preferable for production.

- Fix: in docker-compose.prod.yml, replace the env-based approach

  with:

  `yaml

  secrets:

    - pusher_app_id

    - pusher_app_key

    - pusher_app_secret

  `

  and add a secrets: block at the bottom pointing to files in

  /etc/hospital/secrets/. Update .env.example accordingly.

- Test: docker inspect backend | jq '.[0].Config.Env' must not

  include the Pusher values; cat /run/secrets/pusher_app_key must

  work inside the container.

## INF-030 - CSP
eport-uri endpoint is unauthenticated

- Severity: **P2**

- Area: header / log

- File: backend/app/Http/Controllers/CspReportController.php:12-45,

  backend/routes/api.php:37-38

- Evidence: POST /api/system/csp-report is rate-limited to 30 r/m

  but not authenticated. The body is sanitized (4 KB max, password

  redaction, URL redaction) before being logged.

- Impact: a malicious LAN client can flood the endpoint and fill

  storage/logs/laravel-*.log with junk. With 30 r/m cap and 4 KB

  per body, an attacker can write up to ~1.7 MB of log per minute

  (~100 MB/h).

- Fix: keep the endpoint unauthenticated (browsers cannot send

  auth headers automatically) but add a per-IP daily cap (e.g. 1000

  reports / day) and store the reports in a separate

  csp_reports table with a TTL job, not in the main log file.

- Test: send 100 valid CSP reports from a single IP; the 31st must

  return 429; the next day, the count must reset.

## INF-031 - Hardcoded C:\xampp\... paths in multiple scripts

- Severity: **P2**

- Area: script

- Files: scripts/install_hospital_os.ps1:81,85,86,

  scripts/install_backup_startup_current_user.ps1:3,

  scripts/install_backup_tasks_windows.ps1:115,

  scripts/run_backup_scheduler_loop.ps1:3,

  scripts/restore_hospital_windows.ps1:68-69,

  scripts/production_readiness_preflight.ps1:491-507,

  scripts/deploy_hospital_lan.ps1:335-336, 1199-1200

- Evidence: C:\xampp\php\php.exe,

  C:\xampp\mysql\bin\mysql.exe, C:\xampp\mysql\bin\mariadb-dump.exe

  are hard-coded as defaults. The deploy_hospital_lan.ps1:335-336

  uses C:\Hospital OS Test and C:\Hospital for tests.

- Impact: the user explicitly mentioned C:\Hospital_Caja\ as a

  possible install path. The scripts do not propose this path or

  any path other than C:\xampp\.... If the hospital has PHP in

  C:\laragon\bin\php\php.exe (also supported by the preflight) or

  in a custom path, the operator has to pass -PhpPath to every

  script.

- Fix: factor a scripts/lib/Discover-PHP.ps1 and a

  scripts/lib/Discover-MySQL.ps1 that auto-detect PHP and MySQL

  in the standard locations (C:\xampp, C:\laragon, C:\wamp,

  C:\Program Files\MariaDB*, etc.) and fall back to

  [System.IO.Path]::IsPathRooted(\). Replace the

  hard-coded defaults with calls to these functions.

- Test: install PHP to C:\Program Files\PHP\php.exe; the script

  must find it without the -PhpPath argument.

## INF-032 - install_backup_tasks_windows.ps1 runs scheduled tasks as SYSTEM

- Severity: **P2**

- Area: script

- File: scripts/install_backup_tasks_windows.ps1:229, 241

- Evidence:

  `powershell

  Register-ScheduledTask ... -User \"SYSTEM\" ...

  `

  The worker and the daily backup both run as SYSTEM. The same

  pattern is used in scripts/register_scheduler_cron.ps1:84.

- Impact: a PHP process running as SYSTEM can read every file on

  the server. If a vulnerability in the backup code (or in PHP

  itself) allows RCE, the attacker gets NT AUTHORITY\SYSTEM. The

  scheduler in Docker is also pinned to
oot (or www-data inside

  the image, but the container runs as root by default because

  Dockerfile.prod:83 USER www-data is overridden by the

  healthcheck using 	inker which needs root for the entrypoint).

- Fix: run the scheduled task as a dedicated low-privilege local

  user (e.g. hospital-svc) with LogonType=ServiceAccount and

  RunLevel=LeastPrivilege. Grant the user read access to the

  project root, read/write to the backup folder, and read to

  backend/.env. Document the user provisioning in

  docs/DISASTER_RECOVERY.md.

- Test: Get-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker | Select-Object -ExpandProperty Principal

  must show the low-privilege user.

## INF-033 - -ExecutionPolicy Bypass used in 28 places; rely on caller trust

- Severity: **P3**

- Area: script

- Files: many - see grep below

- Evidence: -ExecutionPolicy Bypass appears in

  scripts/deploy_hospital_lan.ps1:774, 1129, 1178, 1353, 1366,

  scripts/install_hospital_os.ps1:7, 269,

  scripts/final_production_handoff.ps1:255, 256, 261, 312, 327, 343, 346, 348, 351, 374,

  scripts/install_backup_tasks_windows.ps1:246-248,

  scripts/install_dev_hooks.ps1:51,

  scripts/install_hospital_startup_shortcut.ps1:72, 81,

  scripts/make_offline_release.ps1:91, 213,

  scripts/register_scheduler_cron.ps1:135,

  scripts/validate_support_packet_safety.ps1:76,

  scripts/test_validate_lan_client_safety.ps1:13,

  setup.bat:87, 143.

- Impact: every invocation bypasses the user's machine-wide ExecutionPolicy

  (which is RemoteSigned by default on Windows servers). For a

  hospital environment that may have a stricter policy, -Bypass

  is necessary. It is acceptable for hospital-internal scripts but

  must be documented.

- Fix: keep -Bypass but add a Read-Host \"Press Enter to confirm\"

  prompt in setup.bat and any other script that runs as a

  non-interactive user.

- Test: with Set-ExecutionPolicy AllSigned enforced at machine

  level, the scripts must still run (which they do) and must

  include a confirmation step (only setup.bat needs this).

## INF-034 - docs/BACKUP_RESTORE.md references C:\HospitalBilling\backend as default install path

- Severity: **P3**

- Area: docs

- File: docs/BACKUP_RESTORE.md:22, 36, 71, 92, 99,

  docs/DISASTER_RECOVERY.md (no fixed path)

- Evidence: the docs assume the install root is

  C:\HospitalBilling\. The actual installer

  (scripts/deploy_hospital_lan.ps1) accepts any path. The user

  asked about C:\Hospital_Caja\ - the docs do not mention this

  path or any other.

- Impact: an operator who installs to C:\Hospital_Caja\ and then

  follows the doc verbatim will run the command in the wrong

  directory.

- Fix: replace the hard-coded C:\HospitalBilling\ with

  %PROJECT_ROOT% or \ placeholders, and add a note

  that the path is whatever the operator chose during install.

- Test: copy the doc to a temp file, replace the path placeholder,

  and confirm the resulting command is well-formed.

## INF-035 - Soketi is configured and correctly bound to 127.0.0.1 (verified good)

- Severity: **NO VERIFICADO** (no problem found)

- Area: docker

- File: docker-compose.prod.yml:259-283

- Evidence: ports: - \"127.0.0.1:\:6001\" binds

  Soketi to the loopback only. The Pusher host on the backend is

  soketi (Docker service name), the Pusher client host is

  ${SERVER_IP} (the LAN IP), so cashier PCs can reach the

  websocket on the LAN IP, and the backend reaches Soketi on the

  internal network. Credentials are env-driven, not hard-coded.

  healthcheck opens a TCP connection to 127.0.0.1:6001.

- Impact: correctly hardened.

- Fix: N/A.

- Test: N/A.

## INF-036 - scheduler-task.log is in the right place

- Severity: **NO VERIFICADO** (no problem found)

- Area: backup / log

- File: scripts/register_scheduler_cron.ps1:60

- Evidence: the script writes its log to

  backend/storage/logs/scheduler-task.log. That directory is

  git-ignored (backend/storage/logs/ in .gitignore:19).

- Impact: the log is in a known location and not committed.

- Fix: N/A.

- Test: N/A.

## INF-037 - mariadb port is **not** exposed in docker-compose.prod.yml (verified good)

- Severity: **NO VERIFICADO** (no problem found)

- Area: docker / security

- File: docker-compose.prod.yml:100-123

- Evidence: the production mariadb service has no ports: block

  at all. It is reachable only from backend, queue-worker, and

  scheduler over the internal Docker network. The dev

  docker-compose.yml:55-56 correctly binds 3306 to 127.0.0.1.

- Impact: LAN clients cannot reach MariaDB directly. The only entry

  point is the nginx-fronted backend. This is the correct

  posture for a LAN hospital.

- Fix: N/A.

- Test: from a cashier PC, Test-NetConnection IP -Port 3306 must

  return TcpTestSucceeded: False.

## INF-038 - Backups are kept only on the named volume; manual copy needed

- Severity: **NO VERIFICADO** (working as documented, but documented

  gap)

- Area: backup

- File: docs/BACKUP_RESTORE.md:5-17, docker-compose.prod.yml:53, 167, 236

- Evidence: the backup volume is backup_data (named). The UI

  allows downloading the .sql / .tar.gz, and the docs say the

  operator must \"copie a USB o disco externo\". There is no

  scheduled copy to a remote destination.

- Impact: the disk-loss scenario in docs/DISASTER_RECOVERY.md:19-22

  depends on the operator having copied the backup elsewhere.

- Fix: see INF-024 / INF-025.

- Test: see INF-024.

---

## Cross-cutting recommendations

1. **Adopt a single source of truth for env defaults.** The current

   setup duplicates defaults across .env.example,

   backend/.env.example, backend/.env.docker.example, and

   docker-compose.prod.yml. A drift between them is hard to

   detect. Consider a scripts/sync_env_templates.ps1 that diffs

   the files and fails the CI if they diverge.

2. **Move all setup.bat inline PowerShell to scripts/lib/.** The

   inline PS at line 84 and line 87 is hard to test and hard to

   audit. A shared library would let the unit tests cover the

   entropy check (INF-004) and the ACL tightening (INF-005).

3. **Tighten the setup.bat flow.** It currently runs migrations

   and seeds inside the dev container. In a non-dev

   setup.bat this would seed RolesAndPermissions into a

   production database. The offline-release setup.bat should be

   the only one that ever touches a real DB.

4. **Add a --dry-run to setup.bat.** None of the operational

   scripts have a dry-run mode for the install path. The

   production preflight has -AllowMissingPhysicalProof which

   is a kind of dry-run, but setup.bat does not.

5. **Document the relationship between setup.bat and

   offline-release\setup.bat.** The comment at setup.bat:18-19

   is good, but it is hidden in Spanish; an English-speaking

   auditor will miss it. Add a docs/QUICKSTART.md with the

   decision matrix.

6. **The backend/.env and .env files in the worktree should be

   quarantined to a .local/ directory.** The current gitignore

   keeps them visible, which is fine for dev but confusing for

   an auditor. Renaming them to backend/.env.local (which is

   also gitignored) makes the intent obvious.

---

## Quick reference: things the project already does well

- Multi-stage production Dockerfile (frontend-builder, composer-builder,

  php-fpm). backend/Dockerfile.prod:1-87. Image is small and uses

  USER www-data.

-

o-new-privileges:true and
ead_only: true on the nginx

  container, with tmpfs for cache and run dirs

  (docker-compose.prod.yml:87-95).

- PHP-FPM pool is sized for the 512 MB memory limit (8 workers,

  static pm, 500 max requests, 5s slowlog)

  (backend/docker/php-fpm.conf).

- OPcache is configured for production

  (backend/Dockerfile.prod:40-48).

- expose_php=Off is set (backend/Dockerfile.prod:60).

- password, secret, token, key are scrubbed from CSP reports

  (CspReportController.php:55-63).

- AddSecurityHeaders middleware sets X-Frame-Options: DENY,

  X-Content-Type-Options: nosniff, Referrer-Policy: same-origin,

  Permissions-Policy for camera/microphone/geolocation, and

  Cross-Origin-Opener-Policy: same-origin

  (AddSecurityHeaders.php:18-24).

- LoginLockout middleware enforces 5 attempts per login and 20 per

  IP, with 15-minute lockout, returns 423 with reason

  (LoginLockout.php:14-53).

- The pre-commit guard blocks any tracked .env, DB_PASSWORD= with

  a real value, HOSPITAL_INITIAL_ADMIN_PASSWORD= with a real value,

  and

ginx/ssl/* (pre-commit-guard.ps1:77-103).

- The production preflight rejects hospital_dev,
oot_dev,

  changeme, password, secret as DB passwords

  (production_readiness_preflight.ps1:398-414).

- The production preflight requires LAN host (not localhost) in

  BaseUrl (production_readiness_preflight.ps1:416-420).

-
estore_hospital_windows.ps1 checks for symlink and path

  traversal in tar.gz (
estore_hospital_windows.ps1:352-387).

-
estore_hospital_windows.ps1 validates the database name is

  disposable (matches (test|validation|restore|disposable|proof),

  rejects hospital_billing, mysql, information_schema)

  (
estore_hospital_windows.ps1:171-225).

-
estore_hospital_windows.ps1 writes the mysql defaults file with

  a restricted ACL and removes it after use

  (
estore_hospital_windows.ps1:95-132).

- install_backup_tasks_windows.ps1 requires admin, validates the

  PHP source, validates the daily backup time, has

  -WhatIfOnly, -UpdateExisting, -Uninstall, -Status

  (install_backup_tasks_windows.ps1:74-202).

- update_release_preflight.ps1 is read-only except for an optional

  evidence file under qa/, and redacts secrets in its output

  (update_release_preflight.ps1:21-37, 191-231).

- quality_gate_windows.ps1 collects failures rather than

  fail-fast, supports CriticalOnly and Full modes

  (quality_gate_windows.ps1:17-19, 100-107).

- composer.json scripts use APP_DEBUG-safe defaults: the

  setup script copies .env.example and runs key:generate

  (backend/composer.json:32-41).

- CI has 4 jobs in parallel: backend-sqlite, backend-mariadb,

  frontend, e2e-mocked (ci.yml:16-211).

- The release workflow requires PRODUCTION_READY=YES in

  qa/FINAL_PRODUCTION_HANDOFF_RESULT.md and refuses to release

  if any proof file still contains PENDING

  (
elease.yml:44-67).

- docs/SECRETS.md documents the rotation procedure, threat model,

  and pre-commit guard.

- docs/DISASTER_RECOVERY.md covers 10 distinct scenarios.

- docs/RELEASE_CHECKLIST.md enumerates the quality gate commands

  and what each gate protects.

- docs/QUALITY_GATES_WINDOWS.md defines a Windows-friendly

  variant of the gate that does not require Docker.

- The Dockerfile.prod entrypoint waits for MariaDB with

  --defaults-file (not --password=) and removes the file

  after use (backend/docker/entrypoint.sh:21-46).

- The scheduler sidecar in docker-compose.prod.yml records a

  heartbeat in cache and DB and exposes it via

  SystemStatusController::schedulerHeartbeat().

- The production mariadb image is pinned to mariadb:11.4.3

  (docker-compose.prod.yml:101) - good.

- ALWAYS keyword is used on every nginx add_header so the

  header survives 4xx/5xx responses

  (

ginx/default.conf:78-83, 103-108).

---

## Method and what was not verifiable

The audit is read-only. I did **not**:

- run php artisan, composer install,

pm install, or any

  Docker command;

- start, stop, or restart any service;

- run any of the PowerShell scripts;

- modify, delete, or rename any file;

- push to any remote.

The following areas I could not conclusively verify:

- **NO VERIFICADO — INF-010 / INF-035 / INF-036 / INF-037 / INF-038.**

  These are marked as NV because the question was either

  \"does this exist?\" (yes / no) or \"is the value X?\" (yes /

  no), and the answer is documented in the relevant config file

  without needing to run anything.

- **Runtime behavior of LoginLockout without TrustProxies**

  (INF-018): I could not exercise the middleware without

  starting the backend. The static analysis (no

  TrustProxies registered anywhere) is enough to conclude

  that the per-IP limit is currently either useless or

  bypassable.

- **Whether setup.bat is ever called in production.** The

  comment at line 18-19 says it is dev-only, and the

  production_readiness_preflight.ps1:354 distinguishes the

  docker package layout by the absence of backend/artisan,

  which suggests setup.bat is not used in production. But I

  did not verify that no operator ever calls it on a prod

  server.

- **Real entropy of Get-Random in setup.bat** (INF-004): I

  did not run the script, so the entropy claim is based on

  the static analysis of the algorithm.

- **Whether Windows Defender is in scope on the real hospital

  server** (INF-025): the install scripts do not probe for it.

The audit is intentionally conservative. Anything marked P1

should be triaged before any further release. Anything marked

P0 is a real leak or misconfiguration that should be fixed

before the next deploy.
