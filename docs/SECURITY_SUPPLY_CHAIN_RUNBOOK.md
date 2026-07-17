# Supply Chain Security Runbook

This project runs offline in production, so dependency safety must be checked before building release artifacts or moving files to the hospital server.

## Routine Check

Run from the repository root:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\security\test-supply-chain-check.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\security\run-security-checks.ps1
```

Optional deeper local cache scan:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\security\run-security-checks.ps1 -IncludeCaches
```

Optional strict pin warning mode:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\security\supply-chain-check.ps1 -StrictPins
```

## What The Guard Blocks

The guard fails on known npm/pnpm and Composer supply-chain indicators,
including:

- Compromised Axios versions `1.14.1` and `0.30.4`.
- `plain-crypto-js`.
- Laravel-Lang compromised package family: `laravel-lang/lang`, `laravel-lang/actions`, `laravel-lang/attributes`, `laravel-lang/http-statuses`.
- Package.json/Packagist incident indicators such as `systemd-network-helper`, `echarts-for-react`, `silverstripe-cms-theme`, `crosierlib-base`, `devdojo/wave`, `katanaui/katana`, and related package names.
- Runtime/file indicators such as `flipboxstudio.info`, `.laravel_locale`, `DebugChromium.exe`, suspicious VBS/PHP drop names, `bun run index.js`, `/tmp/.sshd`, and cloud metadata probing strings.

The guard also reviews Composer packages that autoload `src/helpers.php` outside the approved package list because that pattern was used by recent Laravel supply-chain malware.

In CI, the central `supply-chain` job must pass before any backend or frontend
dependency installation starts. Composer then audits `composer.lock` with
`--locked` before each backend install; frontend scans installed artifacts again
after pnpm completes.

## If The Guard Fails

1. Disconnect the machine from the internet and LAN share paths used for deployment.
2. Do not run `npm install`, `npm update`, `composer install`, or `composer update`.
3. Save the failing output, `package.json`, `package-lock.json`,
   `pnpm-lock.yaml`, `composer.json`, and `composer.lock` for review.
4. Check active processes and scheduled tasks before deleting evidence.
5. Rotate any secrets that may have been available to the process, including `.env` database passwords, app keys for non-production clones, npm tokens, GitHub tokens, and deployment credentials.
6. Delete `node_modules` and `vendor` only after evidence is captured.
7. Reinstall from known-good locks in a disposable development clone.
8. Run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\security\run-security-checks.ps1 -IncludeCaches
```

9. Run the current local equivalent documented in [`docs/CI.md`](CI.md) before
   release; the obsolete `scripts/quality_gate.sh` wrapper is not present.

## Dependency Change Rules

- Use `pnpm install --frozen-lockfile` for the frontend, matching CI. Use
  `npm ci` only where `package-lock.json` is the selected lockfile.
- Use `npm install --package-lock-only --ignore-scripts` when refreshing a lock for review.
- Do not add SaaS or cloud-dependent security scanners to the production path.
- Do not disable the guard to ship a release. If a false positive appears, document the exact package, version, file path, reason, and reviewer approval in `docs/DECISIONS.md`.
- Keep production artifacts offline after they pass checks.

## Current Project Notes

- CI installs the frontend from `frontend/pnpm-lock.yaml`; the custom guard now
  validates package names and denied versions in pnpm v9 package keys.
- The production Docker frontend stage uses the same frozen pnpm lock and pinned
  pnpm version as CI. `frontend/package-lock.json` is excluded from the Docker
  context so it cannot resolve a different production dependency graph or
  invalidate the build cache.
- `frontend/pnpm-workspace.yaml` allows dependency build scripts only for
  `esbuild`; do not add packages without reviewing the exact script and need.
- The production Composer stage runs on the same PHP 8.3 base as the final
  runtime. It may ignore only `ext-*` requirements while extensions are built
  in the final stage; never restore the global `--ignore-platform-reqs` bypass.
- `backend/package-lock.json` exists so Laravel's Vite-side JavaScript dependencies cannot float silently on future installs.
- Composer may not be available in every Windows shell; this guard reads `composer.lock` directly and does not require Composer for the IOC checks.
