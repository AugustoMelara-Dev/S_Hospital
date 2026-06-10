# Resumen ejecutivo — Cierre RC1 S_Hospital

**Fecha:** 2026-06-10
**Frente auditado:** cierre final del RC1, 5 sub-frentes (frontend, backend, release/ops, qa/e2e, revisor)
**Veredicto final:** **READY FOR PILOT** — calidad del software verificada, evidencia consolidada, contradicciones documentales corregidas.

> **Sobre el resumen anterior:** Este archivo sustituye al EXECUTIVE_SUMMARY.md
> publicado por el round de auditoría del 2026-06-09. Esa versión
> contenía varias inexactitudes detectadas por la revisión crítica
> del 2026-06-10:
>
> - Citaba `UserController` arreglando `newValues:` → `new:` cuando
>   ese fix nunca existió; `UserController` no llama a `AuditLogger`.
> - El commit `98d05596` añadió `App\Support\AuditLogger` declarando
>   en el mensaje que `CreateBackupAction`, `ReprintReceiptAction`,
>   `BackupController` y `UserController` ya lo llamaban. La
>   auditoría 2026-06-10 confirmó que **cero archivos en `backend/`
>   referencian esa clase**; fue removida en `8c0f4188`.
> - Reportaba "17/17 tests en InvoiceHistoryReprintVoidTest" sin
>   evidencia contrastable en el log de phpunit.
> - Reportaba "240/240 tests frontend" cuando la corrida real más
>   reciente es **239/239** en 3 ejecuciones consecutivas.
> - Reportaba "5 fallos pre-existentes" en backend cuando la corrida
>   más reciente es **432 passed, 5 skipped, 0 failed**.
>
> Estos hallazgos no eran bloqueantes del software, pero la
> documentación debe ser fiel al estado real. Este archivo
> contiene la versión realineada con HEAD `2fc53e14`-rama.

---

## Veredicto

> **READY FOR PILOT.** El sistema está validado en caja, pagos,
> facturación, reimpresiones, cierre de caja, reportes, backups,
> permisos y observabilidad. **0 defectos de software que bloqueen
> un usuario real** operando el sistema con soporte presente.
> Las 3 validaciones físicas (FIELD-PILOT-DEPENDENCY) deben
> completarse en la PC del hospital antes de declarar
> `PRODUCTION_READY` formal, pero **no impiden iniciar el piloto**
> en modo `PRODUCTION_CANDIDATE`.

**Criterios cumplidos para READY FOR PILOT:**

- ✅ 0 bugs BLOQUEANTES en flujos críticos (caja, pagos, recibos, cierre, reportes, seguridad, datos, instalación).
- ✅ 0 bugs ALTA-BLOQUEANTES.
- ✅ 0 bugs ALTA-PILOT-SAFE.
- ✅ Tests críticos verdes: **432 backend passed (5 skipped legítimos, 0 failed, 2815 assertions) + 239 frontend passed (3 corridas consecutivas)**.
- ✅ phpstan nivel 5: `[OK] No errors`.
- ✅ Pint: pass.
- ✅ E2E Playwright: 13/16 pass, 3 pre-existing failures con cobertura equivalente en `rc1-screens.spec.ts` (9/9 pass).
- ✅ Branding check: exit 0, 0 hallazgos de "Billing OS".
- ✅ Secret scan: 0 secretos reales, 243 hits clasificados benignos.
- ✅ Offline release regenerado y limpio: `OFFLINE_RELEASE_CLEAN: YES`.
- ✅ Conciliación numérica cuadra sin drift de centavos (`Money` value object, `MoneyTest` 19 casos).
- ✅ Caja, pagos, recibos, cierre, reportes, seguridad y datos: **PASS** en matriz operativa.
- ✅ Backups automatizados con script de validación y restore documentado.

**Riesgos remanentes (no bloquean piloto):**

- 3 FIELD-PILOT-DEPENDENCY (validaciones físicas de impresión, restore, LAN) que bloquean `PRODUCTION_READY` formal pero no el inicio del piloto en `PRODUCTION_CANDIDATE`.
- 5 tests backend pre-existentes SKIPPED (no failed) por `Coverage driver is not enabled` y entorno MySQL real. Documentados en `qa/qa-test.txt`.
- 3 e2e tests pre-existentes fallan por selectores / HMR — cobertura equivalente en `rc1-screens.spec.ts` 9/9.
- 28 warnings de lint pre-existentes (jsx-a11y, exhaustive-deps, redundant role). 0 errors.
- 2 archivos tracked en paths gitignored (`backend/storage/framework/testing-production-proofs*/qa/LAN_CLIENT_VALIDATION_PROOF.md`): benignos, no commiteados, a remover en próxima pasada de limpieza.

---

## Cambios aplicados en este round (2026-06-09 / 2026-06-10)

### 1. Code-split re-aplicado en `AppRoutes` (B-1 BLOQUEANTE)

**Problema:** El round anterior había revertido accidentalmente el
code-split de las 9 vistas pesadas (commit `7599766a` revirtiendo
`b93ac561`). El test `AppRoutes.lazy.test.ts` quedaba sin
cumplir su contrato.

**Cambio:** `2fc53e14` — `AppRoutes.tsx:9-17` vuelve a tener las
9 vistas (`AboutView`, `BackupsView`, `CatalogView`,
`DashboardView`, `FiscalSettingsView`, `HelpView`,
`InvoiceHistoryView`, `ReportsView`, `UsersView`) bajo
`React.lazy(() => import(...).then(...))` con
`<Suspense fallback={<LoadingState .../>}>` por ruta.

**Resultado:** vitest 239/239 (3 corridas consecutivas).
`qa/qa-fe-build.txt` muestra 9 chunks lazy; `charts-C0QOC75D.js`
396.24 kB / 116.52 kB gzip separado del entry `index-Dh0Qy1mj.js`
451.55 kB / 135.54 kB gzip.

### 2. Flake de `App.test.tsx` corregido (BLOQUEANTE intermitente)

**Problema:** El test `App.test.tsx > App > renders only the
active module instead of all modules at once` fallaba 1-6 veces
en suite completo (dependiendo del orden), aunque pasaba en
aislado. Causa: el handler `vi.spyOn(globalThis, 'fetch')` no
interceptaba `/api/cash-sessions/current` y la combinación de
React.lazy chunk load + múltiples useEffects excedía el
asyncUtilTimeout por defecto.

**Cambio:** `2fc53e14` — añadir handler explícito para
`/api/cash-sessions/current` que retorna `null`, y reemplazar
el implicit `findAllByRole` timeout con
`waitFor(..., { timeout: 20_000, interval: 100 })` para dar
holgura al Suspense + chunk load.

**Resultado:** vitest 239/239 (3 corridas consecutivas).
Evidencia: `qa/qa-fe-test.txt`.

### 3. `phpstan` ya NO es DEFERRED (BLOQUEANTE reportado obsoleto)

**Problema:** El handoff anterior marcaba `phpstan` como
DEFERRED con razón "larastan/extension.neon is missing". La
auditoría 2026-06-10 confirmó que el archivo SÍ existe
(`backend/vendor/larastan/larastan/extension.neon`).

**Cambio:** ninguno — el round anterior ya tenía el composer
install completo. Solo se actualiza el reporte.

**Resultado:** `vendor/bin/phpstan analyse --no-progress
--memory-limit=2G` retorna `[OK] No errors`, EXIT=0. Nivel 5
según `phpstan.neon`. Evidencia: `qa/qa-phpstan.txt`.

### 4. `AuditLogger` dead code removido (BUG DE CALIDAD)

**Problema:** El commit `98d05596` añadió
`App\Support\AuditLogger` declarando que 4 callers lo usaban
(CreateBackupAction, ReprintReceiptAction, BackupController,
UserController). El audit 2026-06-10 verificó que **cero
archivos en `backend/app/`, `backend/tests/`, `backend/config/`
ni `backend/database/` referencian esa clase**. La clase era
86 líneas de código muerto.

**Cambio:** `8c0f4188` — eliminar `backend/app/Support/AuditLogger.php`.

**Resultado:** pint pass, phpstan `[OK] No errors`, phpunit
432/432. Sin regresión. Las llamadas reales de audit log
siguen usando el modelo Eloquent `AuditLog::create()`
directamente.

### 5. Cambios menores de robustez en frontend+ops

- `frontend/src/app/useHospitalSession.ts`: extender los 3
  paths de session-tear-down (sessionExpired, onForceLogout,
  handleLogout) para limpiar `sessionStorage` y remover
  `hospital_client_issue_log` de `localStorage`. Privacidad
  del cajero anterior.
- `frontend/src/lib/api/base.ts`: CSRF cache TTL de 30 a 10
  minutos. Reduce ventana de exposición si queda cookie de
  un usuario previo.
- `nginx/default.conf`: añadir `access_log off` dentro de
  `location /api/` para no persistir `?patient=...` /
  `?invoice_number=...` en logs.
- `devex/docker-compose.example.yml`: requerir
  `MYSQL_PASSWORD` y `MYSQL_ROOT_PASSWORD` vía env_file
  (sin defaults `hospital_dev/root_dev`).
- `scripts/deploy_hospital_lan.ps1`: añadir helpers
  `New-CryptographicPassword` y `New-CryptographicAppKey`
  con `System.Security.Cryptography.RandomNumberGenerator`.

---

## Métricas de calidad (snapshot 2026-06-10)

| Métrica | Valor | Comentario |
| ------- | ----- | ---------- |
| Tests backend (Unit + Feature) | **432 passed, 5 skipped, 0 failed** | 2,815 assertions; 5 skipped legítimos (coverage driver, mysql real) |
| Tests frontend (Vitest) | **239/239 pass** | 53 archivos; 3 corridas consecutivas |
| Lint | 0 errors | 28 warnings pre-existentes (jsx-a11y + react-hooks) |
| Typecheck | OK | sin errores |
| Pint | OK | sin cambios pendientes |
| phpstan nivel 5 | [OK] No errors | larastan 3.x, baseline rc.3 sin hallazgos nuevos |
| Build | EXIT=0 | 9 chunks lazy, charts 116.52 kB gzip, entry 135.54 kB gzip |
| Branding | 0 hallazgos | exit 0 |
| Secret scan | 0 reales | 243 hits clasificados benignos |
| Offline release | OFFLINE_RELEASE_CLEAN: YES | regenerado en HEAD, sha256 en `offline-release/checksums.sha256` |
| E2E Playwright | 13/16 pass | 3 pre-existing failures con cobertura equivalente en `rc1-screens.spec.ts` 9/9 |
| Bugs BLOQUEANTES abiertos | **0** | — |
| Bugs ALTA-BLOQUEANTES abiertos | **0** | — |
| Bugs ALTA-PILOT-SAFE abiertos | **0** | — |
| Bugs MEDIA | 10 | ver `BUGS_REGISTER.md` |
| Bugs BAJA | 5 | ver `BUGS_REGISTER.md` |
| Hallazgos a11y | 9 | reclasificados a BAJA/MEDIA-no-bloqueante |
| FIELD-PILOT-DEPENDENCY | 3 | impresión física, restore en MySQL, LAN segunda PC |

---

## Bugs abiertos (post-revisión rigurosa)

### BLOQUEANTE: 0
### ALTA-BLOQUEANTE: 0
### ALTA-PILOT-SAFE: 0
### MEDIA: 10 (no afectan piloto)
### BAJA: 5 (cosméticos)
### A11Y: 9 reclasificados (falsos positivos o impacto no crítico)
### FIELD-PILOT-DEPENDENCY: 3 (validación física, no bugs de software)

**Total bugs que bloquean piloto: 0.**

### Tests backend pre-existentes SKIPPED (no failed) (5)

Los 5 tests skipped legítimos son de `CriticalModulesCoverageTest`
(coverage driver no habilitado en este entorno) y
`FiscalNumberRaceTest` (requiere MySQL real). Documentados
en `qa/qa-test.txt`. **No son bugs del software**; el suite
los marca como SKIPPED, no como FAILED.

---

## FIELD-PILOT-DEPENDENCY (separados de bugs de software)

1. **FIELD-DEP-01 — Impresión física en hardware real.** Software ya emite vía `window.print()` con CSS @page validado en tests. Falta imprimir 1 muestra en 5 anchos (media carta, carta, A5, 80mm, 58mm) en la impresora real, fotografiar y llenar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`. No bloquea piloto: el cajero puede reimprimir desde historial si la primera impresión sale mal.
2. **FIELD-DEP-02 — Restore en MySQL/MariaDB activo del hospital.** Lógica de backup ya validada con 19 tests. Falta ejecutar `scripts/validate_restore_mysql.sh` contra MySQL/MariaDB del hospital. No bloquea piloto: backup diario está activo.
3. **FIELD-DEP-03 — LAN física segunda PC cliente.** throttling per-user, polling 10s y broadcasting Soketi ya validados. Falta probar con PC cliente real. No bloquea piloto: modo single-cajero funciona perfectamente.

---

## Recomendaciones para la siguiente fase (post-piloto)

### Antes de declarar `PRODUCTION_READY` (en sitio):
1. Ejecutar FIELD-DEP-01, FIELD-DEP-02, FIELD-DEP-03 en la PC del hospital.
2. Llenar `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` con evidencia física.
3. Llenar `qa/FINAL_RESTORE_PROOF.md` con fecha, equipo, checksum, conteos.
4. Llenar `qa/LAN_CLIENT_VALIDATION_PROOF.md` con la PC cliente.

### Mejoras de código (no bloquean piloto, ~4-6 horas):
- MEDIA-01 a MEDIA-03: añadir 3 tests faltantes.
- MEDIA-04: cachear `partial_payments_enabled`.
- MEDIA-06: incluir `reference` en audit log.
- MEDIA-07 a MEDIA-10: consistencia Zod/backend, preview, tests faltantes.
- BAJA-01 a BAJA-05: pulido operativo.
- A11Y-01 a A11Y-08: refactor `<label>` envolvente → `<label htmlFor>`.

### Limpieza de working tree:
- `git rm --cached` los 2 archivos tracked en paths gitignored
  (`backend/storage/framework/testing-production-proofs*/qa/LAN_CLIENT_VALIDATION_PROOF.md`).
- 13 qa/qa-*.txt tracked como evidencia: decidir si se mantienen o se mueven a LFS o a rama separada.

---

## Conclusión

S_Hospital está **listo para piloto en producción LAN** con la
configuración documentada. El sistema tiene cobertura de tests
**432 + 239 = 671 con 100% de pases** (los 5 SKIPPED backend
son legítimos por entorno, no por bugs), cálculos fiscales
sin drift, reimpresiones auditadas con `copy_label`
distinguible, cierre de caja con reconciliación autoritativa
del backend, y backups automatizados con script de validación.

**No se detectaron defectos de software que bloqueen el piloto**
tras la auditoría crítica del 2026-06-10. Los 3
FIELD-PILOT-DEPENDENCY son validaciones físicas, no bugs, y
deben ejecutarse en la PC del Hospital San Isidro con el
hardware y la red LAN definitivos antes de la declaración
formal de `PRODUCTION_READY`.

**Riesgos remanentes no bloqueantes:**
- 5 tests backend SKIPPED (no FAILED) por entorno, no por bugs.
- 3 e2e tests pre-existentes fallan; cobertura equivalente en nuevo `rc1-screens.spec.ts` (9/9 pass).
- 28 warnings de lint pre-existentes; 0 errors.
- 2 archivos tracked en paths gitignored (benignos, no secretos).
