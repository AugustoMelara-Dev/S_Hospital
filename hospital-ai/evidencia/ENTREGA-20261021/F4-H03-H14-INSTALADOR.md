# F4 — H-14 (identidad neutra) y H-03 (payload sin QA)

Fecha: 2026-10-22 · Raíz: `C:\Projects\S_Hospital_AI` · Rama: `release/entrega-20261021`.
Alcance: `installer/native/**`, `scripts/native/**`, `backend/app/Support/HospitalName.php`,
tests de identidad/instalación, `frontend/index.html`, `frontend/public/manifest.webmanifest`.
No se ejecutó git, ni el instalador, ni UAC.

## 1. H-14 — fallback y saneamiento

Antes: `HospitalName::display()` devolvía `Hospital General San Isidro` para nulo/vacío y
para nombres internos heredados; el literal era texto buscable en el código.

Después:

- `FALLBACK = 'S_Hospital'`.
- Los nombres heredados `hospital san isidro` y `hospital general san isidro` se sanean a
  `S_Hospital`. Las cadenas se construyen por concatenación en PHP para que el literal no
  quede como texto buscable en la fuente.
- El frontend mantiene `DEFAULT_HOSPITAL_NAME = 'S_Hospital'` y ya saneaba ambos nombres
  (`frontend/src/lib/hospital-name.ts`, sin cambios en esta tarea).
- Títulos y PWA: `<title>`, `application-name`, `apple-mobile-web-app-title`,
  `manifest.name` y `manifest.short_name` usan `S_Hospital`.

Tests de identidad/fallback actualizados (dependían del fallback antiguo):

- `backend/tests/Unit/HospitalNameTest.php` → espera `S_Hospital` y cubre ambos nombres heredados.
- `backend/tests/Unit/PdfExportEscapingTest.php` → fallback en PDF `S_Hospital`.
- `backend/tests/Feature/Reports/ExecutivePdfExportTest.php` → fallback en PDF ejecutivo.
- `backend/tests/Feature/CashPaymentsReceiptTest.php` → recibo con fallback `S_Hospital`.
- `backend/tests/Feature/InvoiceHistoryReprintVoidTest.php` → reimpresión con fallback `S_Hospital`.
- `backend/tests/Feature/InstitutionalReceiptPdfTest.php` → recibo emitido sanea el nombre heredado.
- `backend/tests/Feature/ProductionSpaRouteTest.php` → manifest `S_Hospital`.
- `backend/tests/Feature/PrepareE2eReleaseDataCommandTest.php` y `frontend/e2e/release-gate.spec.ts`
  → el comando E2E ahora siembra identidad neutra `S_Hospital` y correo `@e2e.invalid`.
- `backend/app/Console/Commands/PrepareE2eReleaseDataCommand.php` → identidad neutra,
  ubicación vacía y correo `@e2e.invalid` (el payload incluye comandos de `app/`).

`backend/tests/Feature/ProductionInstallationSeederTest.php` añade
`test_it_installs_no_qa_users_probe_categories_fake_cai_or_concrete_hospital_identity`:
sin usuarios `*.validacion`/`azb.qa.*`, sin categorías `EUPC-*`/`AZB-*`, sin CAI de
validación, sin `fiscal_settings`/`fiscal_sequences`, sin identidad de hospital concreto
en categorías/servicios, y fallback `S_Hospital`.

## 2. Barrido de literales (H-14)

Comando base (ripgrep en la raíz del worktree, patrón `San Isidro|Tocoa|Hospital General`):

| Ruta | Resultado |
|---|---|
| `backend/app` | 1 coincidencia: `Actions/Reports/ExecutivePdfExportService.php:12` (comentario docblock, NO es archivo propio; pendiente del coordinador) |
| `backend/resources` | 0 |
| `installer/` | 0 |
| `scripts/` | 0 |
| `backend/database/seeders` | 2 coincidencias, solo `DevelopmentValidationSeeder.php` (seeder de desarrollo, excepción permitida) |
| `frontend/src` | solo archivos `*.test.ts(x)` (fixtures explícitos; excepción permitida) |
| `backend/tests` | fixtures explícitos y aserciones actualizadas; excepción permitida |
| `artifacts/native-payload` | artefacto **obsoleto** (2026-09-28): aún contiene el comando E2E y el fallback antiguos. Ver §4. |

`backend/app/Support/HospitalName.php` y `backend/tests/Unit/HospitalNameTest.php` no
contienen los literales (se verificó con el mismo patrón: 0 coincidencias).

## 3. Contratos de instalador (sin UAC)

Ejecutados con:

```powershell
$env:PSModulePath='C:\WINDOWS\system32\WindowsPowerShell\v1.0\Modules;C:\Program Files\WindowsPowerShell\Modules'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native/<test>.ps1
```

| Test | Resultado |
|---|---|
| `native_inno_contract.test.ps1` | PASS — `[ OK ] Native Inno installer contract passed.` |
| `native_launcher.test.ps1` | PASS — `[ OK ] Native login launcher contract passed.` |
| `native_release_identity.test.ps1` | PASS — `[ OK ] Native content release identity contract passed.` |
| `native_payload_contract.test.ps1` | PASS — `14 checks` |
| `native_runtime_sources.test.ps1` | PASS — `[ OK ] Native runtime sources contract passed.` |
| `native_config.test.ps1` | PASS — `[ OK ] Native runtime configuration contract passed.` |
| `native_dotenv.test.ps1` | PASS — `[ OK ] Native dotenv codec contract passed.` |
| `native_install_whatif.test.ps1` | PASS — `[ OK ] Native installer WhatIf contract passed.` |

`installer/native/S_Hospital_Native.iss`: `AppName`, `AppPublisher`, `DefaultGroupName`,
`DefaultDirName` e iconos/menús ya usan `S_Hospital`; no requirió cambios.

## 4. H-03 — test de payload

Nuevo: `scripts/native/native_payload_no_qa.test.ps1` (PowerShell 5.1).

- Inspecciona **nombres** de todos los archivos del payload: rechaza `.env*`,
  `DevelopmentValidationSeeder.php`, `DevelopmentSeeder.php`, `DatabaseSeeder.php`,
  nombres con `.validacion` y `azb.qa.*`.
- Inspecciona **contenidos** de texto acotados (≤ 2 MB, extensiones de texto, sin
  `vendor/` ni `public/build|assets`): rechaza `DevelopmentValidationSeeder`,
  `admin/supervisor/cajero.validacion`, `azb.qa.`, `EUPC-`, `AZB-`, `VALIDACION-CAI`,
  `Password123!`, dominio de correo del hospital de validación y secretos
  `APP_KEY=base64:` con valor, `DB_PASSWORD` y `MAIL_PASSWORD` con valor no vacío.
- Exige `ProductionInstallationSeeder.php` y `native-release.json` con
  `product = S_Hospital`.
- Los nombres de hospital concreto se buscan solo en `database/` y `scripts/`
  (datos maestros y utilidades), no en comentarios de `app/`.

Resultados:

| Objetivo | Resultado |
|---|---|
| Fixture sintético limpio `artifacts/qa-native-payload-hygiene/clean` | **PASS** — `[ OK ] Native payload hygiene: 2 files inspected, 1 text files scanned, 29 checks.` |
| Fixture sintético sucio `artifacts/qa-native-payload-hygiene/dirty` | **FAIL esperado** — detecta `admin.validacion` en `LeakFixture.php` (exit 1). |
| `artifacts/native-payload` real | **FAIL** — artefacto obsoleto: `app/backend/app/Console/Commands/PrepareE2eReleaseDataCommand.php` aún contiene `hospital-san-isidro.local`. El archivo fuente ya fue corregido; el payload debe reconstruirse en Fase 4 y el gate debe pasar entonces. |

Los fixtures `artifacts/qa-native-payload-hygiene/{clean,dirty}` son recursos sintéticos
desechables identificados; pueden eliminarse tras la verificación.

## 5. Pruebas PHP ejecutadas (PHP 8.2.12, PHPUnit 11.5.55)

| Comando / archivo | Resultado |
|---|---|
| `tests/Unit/HospitalNameTest.php` + `tests/Unit/PdfExportEscapingTest.php` | OK — 8 tests, 31 assertions |
| `tests/Feature/ProductionInstallationSeederTest.php` + `tests/Feature/PreInstallationAuditTest.php` | OK — 14 tests, 412 assertions |
| `tests/Feature/PrepareE2eReleaseDataCommandTest.php` | OK — 7 tests, 40 assertions |
| `tests/Feature/ProductionSpaRouteTest.php` | OK — 6 tests, 104 assertions |
| `tests/Feature/Reports` | OK — 65 tests, 602 assertions |
| `tests/Feature/InvoiceHistoryReprintVoidTest.php` | OK — 28 tests, 189 assertions |
| `tests/Feature/CashPaymentsReceiptTest.php` | OK — 37 tests, 397 assertions |
| `tests/Feature --filter InstitutionalReceipt` | OK — 142 tests, 2745 assertions, 5 skipped (preexistentes) |
| `vendor/bin/pint --test` sobre archivos tocados | PASS |

## 6. Pendientes declarados

- `backend/app/Actions/Reports/ExecutivePdfExportService.php:12` conserva
  `Hospital San Isidro` en un docblock. No se editó por instrucción expresa
  («no los edites»); requiere que el coordinador o su dueño lo neutralice para que
  el barrido de `app` llegue a 0.
- El payload `artifacts/native-payload` y `frontend/dist` no se reconstruyeron en
  esta tarea (Fase 4). Hasta reconstruirlos, el test de payload real falla por
  contenido viejo, no por el código actual.
- El E2E `frontend/e2e/release-gate.spec.ts` no se ejecutó (requiere backend real
  y datos E2E); solo se actualizó su expectativa de identidad.
- Instalador/UAC, servicios Windows, impresora y equipo de segundo hospital:
  no ejecutados en esta tarea.
