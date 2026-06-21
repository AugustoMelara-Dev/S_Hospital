# Release E2E golden SQLite proof - 2026-06-20

## Alcance

Validacion local no destructiva del runner E2E de release. El objetivo es que los E2E de flujo cajero y RBAC configurable no ejecuten migraciones desde cero en cada corrida, sino que reutilicen una base SQLite dorada por hash de migraciones/seeders y clonen una base limpia por corrida.

## Entorno

- Proyecto: `C:\Projects\S_Hospital`
- Frontend runner: `frontend\scripts\run-release-e2e.mjs`
- Golden SQLite: `backend\storage\framework\testing\e2e-golden-d484c1f28df7.sqlite`
- Runtime SQLite disposable observado: `backend\storage\framework\testing\e2e-release-d484c1f28df7-61820.sqlite`
- Reporte humano: `frontend\test-results\release-e2e-report.json`
- Reporte Playwright: `frontend\test-results\release-e2e-playwright.json`

## Comandos ejecutados

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test_release_e2e_golden_sqlite_safety.ps1
node --check frontend\scripts\run-release-e2e.mjs
cd frontend
npm.cmd run e2e
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\quality_gate_windows.ps1 -CriticalOnly -SkipBackend -SkipFrontend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installer_safety.ps1 -Root C:\Projects\S_Hospital
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1
```

## Evidencia

### Safety gate

`RELEASE_E2E_GOLDEN_SQLITE_SAFETY: YES`

El gate valida:

- Nombre reusable `e2e-golden-<hash>.sqlite`.
- Nombre disposable `e2e-release-<hash>-<pid>.sqlite`.
- Hash de `database/migrations` y `database/seeders`.
- Clonado con `copyFileSync`.
- Materializacion de golden solo cuando falta.
- Preparacion de datos con `hospital:prepare-e2e-release-data`.
- `APP_ENV=testing` y `DB_CONNECTION=sqlite`.
- Ausencia de `docker compose down -v`, `db:wipe` y `migrate:reset`.
- `quality_gate_windows.ps1` invoca explicitamente `test_release_e2e_golden_sqlite_safety.ps1`.
- El reporte humano consolida `release-e2e-playwright.json`.

### E2E release

Salida relevante:

```text
[release-e2e] Reusing golden SQLite database C:\Projects\S_Hospital\backend\storage\framework\testing\e2e-golden-d484c1f28df7.sqlite
[release-e2e] Cloned golden SQLite database to C:\Projects\S_Hospital\backend\storage\framework\testing\e2e-release-d484c1f28df7-61820.sqlite
Running 2 tests using 1 worker
ok 1 ... release gate cashier can issue, collect, show receipt and surface reports
ok 2 ... administrator creates exact catalog-only user and navigation enforces module access
2 passed
```

`frontend\test-results\release-e2e-report.json` ahora incluye:

```json
{
  "migration_hash": "d484c1f28df7ee35826b4de5560e56e37626ab866966b81fa440f62780c00d53",
  "playwright_summary": {
    "expected": 2,
    "skipped": 0,
    "unexpected": 0,
    "flaky": 0
  },
  "playwright_specs": [
    {
      "title": "release gate cashier can issue, collect, show receipt and surface reports",
      "status": "passed"
    },
    {
      "title": "administrator creates exact catalog-only user and navigation enforces module access",
      "status": "passed"
    }
  ]
}
```

### Offline release

`OFFLINE_RELEASE_CLEAN: YES`

El paquete actual incluye `offline-release\scripts\test_release_e2e_golden_sqlite_safety.ps1` y `offline-release\scripts\quality_gate_windows.ps1` coincide con la fuente versionada.

## Limite de esta evidencia

Esta evidencia no sustituye:

- Repetir segunda PC LAN contra `http://192.168.1.2:8081`.
- Imprimir recibo institucional en papel real.
- Regenerar/anclar `offline-release\MANIFEST.txt` al commit final cuando el arbol quede listo para handoff.
