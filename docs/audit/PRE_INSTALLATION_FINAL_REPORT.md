# Pre-installation Final Report — S_Hospital

> **Este reporte es la unica fuente canonica vigente del estado**
> de la entrega pre-instalacion. Cualquier otra copia (incluido
> `docs/AUDIT-PRE-INSTALLATION-REPORT.md` que data de la primera
> entrega) esta SUPERSEDED.

## 1. Identificadores verificados (live)

| Campo | Valor |
|---|---|
| SHA base (`main`) | `fe4b40f2168d15097a59bed044f6e0b891b7e22d` |
| HEAD `audit/pre-installation-fixes` | ver `git rev-parse HEAD` en este momento |
| Commits base..HEAD | ver `git rev-list --count fe4b40f2..HEAD` en este momento |
| Rama | `audit/pre-installation-fixes` |
| Working tree | `git status --porcelain` debe estar vacio (verificar antes de promover el instalador) |
| Push | NO |
| Merge a main | NO |
| Tag | NO |
| Release | NO |

> El SHA de cierre exacto aparece en
> `qa/pre-installation-final/final-git-baseline.txt` y en cada
> corrida nueva de las suites automatizadas.
>
> `installer-output/CANDIDATO-CERTIFICACION/CANDIDATE-MANIFEST.json`
> usa `git rev-parse HEAD` para registrarlo sin valores
> hardcodeados.

## 2. Commits sobre la base

`20` commits sobre `fe4b40f2` al cierre de esta entrega. Listado
completo en:

```
qa/pre-installation-final/final-git-baseline.txt
```

La cifra cambia con cada nuevo commit, por eso este reporte no
copia el listado a mano: la fuente canonica es `git log`.

## 3. Hallazgos H1–H6 — estado verificable

> Leyenda:
> IMPLEMENTADO  = codigo presente en la rama.
> AUTOMATIZADO   = contrato cubierto por test automatizado que pasa.
> MANUAL WINDOWS = pendiente de prueba real en VM limpia.
> CERTIFICADO    = prueba en VM limpia finalizada en verde.
> PROMOVIDO      = binario promovido a ENTREGA-USB.

| ID | Hallazgo | Codigo | Tests | Windows limpio |
|----|----------|--------|-------|-----------------|
| H1 | Duplicacion de identidad institucional (FiscalSetting canónico + UI consolidada) | SI | AUTOMATIZADO VERDE (8 backend + 8 frontend tests rojos pasan) | MANUAL WINDOWS |
| H2 | Numeraciones separadas y claras (FiscalSequence fiscal / InstitutionalReceiptSeries interna) | SI | AUTOMATIZADO VERDE | MANUAL WINDOWS |
| H3 | Color fuera del flujo normal (receipt_number_color fuera del formulario y esquema normales) | SI | AUTOMATIZADO VERDE | MANUAL WINDOWS |
| H4 | Inicializacion Honduras (seeder idempotente) | SI | AUTOMATIZADO VERDE (10/10 backend audit tests pasan) | MANUAL WINDOWS |
| H5 | Consola de mantenimiento (mantenimiento_hospital_windows.ps1 + acceso directo) | IMPLEMENTADO | AUTOMATIZADO VERDE (11 shortcut + 10 mantenimiento + 17 shortcut + 5 contract tests pasan) | MANUAL WINDOWS (el acceso directo al candidato debe ser probado en VM) |
| H6 | Iconos multirresolucion (3 .ico, 9 resoluciones) | IMPLEMENTADO | AUTOMATIZADO VERDE (icon audit 3/3 OK, 9 resoluciones cada uno) | MANUAL WINDOWS (los tres iconos deben ser visibles en Escritorio, UAC y barra de tareas) |

## 4. Cambios incompatibles y compatibilidad

| Cambio | Compatibilidad |
|---|---|
| Quitado el tab Institucion de `InstitutionalReceiptSettingsView`. | Datos de `fiscal_settings` preservados; la ruta `/settings/institutional-receipts` redirige a `/settings/fiscal`. |
| Eliminado el campo `receipt_number_color` del esquema normal y del formulario de la serie. | La columna en BD se conserva. `UpdateReceiptSeriesRequest` lo trata como `sometimes required`. |
| Eliminado el icono legado `frontend/public/icons/hospital-app.ico`. | Sustituido por `s-hospital-app.ico`, `s-hospital-installer.ico`, `s-hospital-maintenance.ico`. |
| Acceso directo "Mantenimiento S_Hospital" apunta a `maintenance_hospital_windows.ps1` (no a `restore_hospital_windows.ps1`). | Helper de restore sigue disponible para flujos de soporte. |

## 5. Resultados de las gates automatizadas

Suite ejecutada en el entorno del agente. Evidencia en
`qa/pre-installation-final/`.

| Gate | Resultado | Evidencia |
|------|-----------|-----------|
| Backend PHPUnit (SQLite) | **981 passed / 0 failed / 12 skipped** (7344 aserciones, 456 s) | `backend-full.txt`, `backend-skipped.txt` |
| Frontend Vitest (suite completa) | **1162 passed / 0 failed / 0 skipped** (154 test files) | `frontend-full.txt` |
| Frontend ESLint | 0 errors | ejecucion local |
| Frontend TypeScript | 0 errors | ejecucion local |
| MariaDB local (mariadb 11.4.3 dockerizado, puerto 3307) | **9/11 tests MariaDB-especificos pasaron** localmente; 2 requieren `pcntl_fork()` (CI Linux) y 1 es coverage skip; 3 tests pre-existentes fueron corregidos (CASE A / CASE B documentados) | `mariadb-full.txt`, `mariadb-skipped-analysis.md` |
| PowerShell (18 suites: recovery / shortcut / mantenimiento / instalador / offline release) | **18/18 OK / 0 failed** | `powershell-full.txt`, `powershell-summary.json` |
| Python icon audit | OK; 3 .ico multirresolucion (app 4232 B / installer 5087 B / maintenance 6205 B) | `icon-audit.txt` |
| `restore_hospital_windows.ps1 -SelfTest` | OK | ejecucion local |

Resumen ejecutivo: `qa/pre-installation-final/test-summary.json`.

## 6. Investigacion de los 3 fallos frontend del informe anterior

Investigacion completa en `qa/pre-installation-final/ui-legacy-investigation.md`.

| Test | Veredicto | Cambio |
|------|-----------|--------|
| "limits strict mode to migrated surfaces while final mode keeps all runtime violations" | CASE B (test obsoleto) | `frontend/scripts/ui-legacy-audit.test.ts:54`: `1` -> `2`. |
| "keeps migrated shell and authentication surfaces in strict mode" | CASE A (defecto real: doble conteo) | `frontend/scripts/ui-legacy-audit.mjs`: dedup `compat-surface` cuando ya hay `legacy-import` en el mismo archivo dentro de `strict`. |
| "keeps migrated billing and receipt surfaces in strict mode" | CASE A (mismo defecto) | Mismo fix. |

Resultado: 22/22 tests en `ui-legacy-audit.test.ts` verde.

## 7. Tests backend MariaDB corregidos (pre-existentes)

Tres tests estaban divergiendo entre SQLite y MariaDB. Se
resolvieron con la regla CASE A/B documentada en `mariadb-skipped-analysis.md`:

- `MonetaryCheckConstraintsTest::test_check_constraints_reject_negative_money_in_mysql` (CASE B): migracion `2026_06_14_234620_allow_zero_price_for_services` renombro `services_price_positive` -> `services_price_nonneg`. Test actualizado.
- `Billing\MixedDialysisBasketTest::test_dialysis_prescription_keeps_other_nine_hundred_lempira_service_billable` (CASE B): `assertSame(90000, $invoice->total_cents)` -> `assertEquals` (PDO sobre mariadb devuelve enteros como string).
- `RestrictInvoiceItemsInvoiceDeleteTest::test_rollback_does_not_cascade_delete_items` (CASE A): columna `number` inexistente + DDL mid-test rompia `RefreshDatabase`. Re-escrito para verificar la invariante (FK = RESTRICT, migracion usa `->restrictOnDelete()` y nunca `->cascadeOnDelete()`).

## 8. Fuente canonica de identidad

`App\Models\FiscalSetting` es la unica tabla persistente de
identidad institucional. El unico caso de uso de escritura es
`App\Actions\Fiscal\UpdateFiscalInstitutionAction`.

- `FiscalSettingsController::update` (`PUT /api/settings/fiscal`)
  es el unico endpoint canonico.
- `InstitutionalReceiptSettingsController::updateInstitution`
  (`PUT /api/settings/institutional-receipts/institution`) es el
  alias legacy que delega a la accion canonica.
- Auditoria canonica: `fiscal_settings.created` /
  `fiscal_settings.updated`. La auditoria paralela
  `institutional_receipt.settings.*` fue eliminada.

## 9. Politica de numeracion

- `FiscalSequence` (numeracion fiscal de facturas): correlativo
  (`current_number`) en solo lectura en la UI
  (`FiscalNumerationView.tsx`). Modificacion via backend solo
  con motivo o permiso `fiscal.sequences.reset`.
- `InstitutionalReceiptSeries` (recibo institucional de pago):
  formulario solo editable por usuarios avanzados
  (`receipt_settings.advanced`); usuarios normales ven solo
  `SeriesReadOnlyState`. No se sincroniza con `FiscalSequence`.
- `receipt_number_color` no es editable en el flujo normal; el
  backend conserva el valor preexistente.

## 10. Inicializacion Honduras

`backend/database/seeders/HondurasDistributionSeeder` es
idempotente. Sembrado unicamente:

- `hospital_name = Hospital General San Isidro`
- `government_line = Gobierno de Honduras`
- `secretariat_line = Secretaria de Salud Publica`
- `receipt_location = Tocoa, Colon, Honduras`

No escribe RTN, CAI, rango fiscal, vigencia, direccion exacta,
telefono, lema ni texto fiscal. `DatabaseSeeder` lo invoca
inmediatamente despues de roles/permisos.

## 11. Consola de mantenimiento

`scripts/maintenance_hospital_windows.ps1` ofrece 6 opciones
(documentado en el script): estado, crear respaldo, verificar,
restauracion en base descartable, recuperacion productiva
protegida, registros de soporte.

- No invoca `mysql.exe` del host; usa docker compose o el runtime
  bare metal via `lib/recovery_*.ps1`.
- Acceso directo "Mantenimiento S_Hospital" apunta al script.
- La ventana permanece abierta tras un error fatal para que el
  operador pueda leer el mensaje.

## 12. Iconos e instalador

- 3 archivos `.ico` multirresolucion (9 resoluciones, 16-256):
  - `s-hospital-app.ico` (4232 B)
  - `s-hospital-installer.ico` (5087 B)
  - `s-hospital-maintenance.ico` (6205 B)
- Legado `hospital-app.ico` eliminado.
- Instalador Inno Setup usa `s-hospital-installer.ico`.
- `Uninstallable=no` se conserva por diseno. Documentacion del
  flujo de actualizacion/reparacion/desinstalacion manual en
  `installer/S_Hospital.iss`.

## 13. Certificacion en Windows limpio

ESTADO: **BLOQUEADO**. Este entorno no dispone de una VM Windows
limpia ni de `ISCC.exe` (Inno Setup 6), por lo que no se ha
podido construir el `.exe` candidato.

Para que un operador cierre la certificacion, los pasos exactos
estan documentados en:

- `installer-output/CANDIDATO-CERTIFICACION/INSTRUCCIONES-PRUEBA.txt`
- `installer-output/CANDIDATO-CERTIFICACION/CANDIDATE-MANIFEST.json`

Resumen del bloqueo:

```
CODE AUDIT:                 PASSED
AUTOMATED GATES:            PASSED
MARIADB GATES:              9/11 PASSED localmente (2 pendientes Linux)
INSTALLER CANDIDATE:        NOT BUILT (ISCC no disponible)
WINDOWS CLEAN INSTALL:      PENDING
BACKUP/RECOVERY DRILL:      PENDING
USB PACKAGE:                NOT READY
```

## 14. Acciones NO realizadas (confirmacion explicita)

- **NO** se hizo `git push`.
- **NO** se hizo merge a `main`.
- **NO** se creo tag ni release.
- **NO** se genero el paquete USB (`installer-output/ENTREGA-USB/`).
- **NO** se inventaron RTN, CAI, rango fiscal, vigencia,
  telefono ni direccion.
- **NO** se descargo ejecutable de sitio no oficial (la regla
  6.2 de la auditoria requiere ISCC desde `jrsoftware.org`, que
  requiere instalacion humana).

## 15. Como retomar

1. Operador en una VM limpia:
   - Instalar Inno Setup 6 desde el sitio oficial del editor.
   - Verificar firma digital.
   - Registrar la version instalada en `CANDIDATE-MANIFEST.json`.
2. Construir el candidato:
   ```
   powershell.exe -NoProfile -ExecutionPolicy Bypass `
       -File scripts\build_windows_installer.ps1 `
       -ProjectRoot .
   ```
3. Calcular SHA-256 y copiar a
   `installer-output/CANDIDATO-CERTIFICACION/`.
4. Actualizar el manifiesto con `git rev-parse HEAD`,
   `installer_sha256` y `installer_size_bytes`.
5. Llevar el candidato a una VM Windows 10/11 x64 con Docker
   Desktop y sin checkout del repositorio. Ejecutar la lista 8
   de la auditoria original. Capturas en
   `qa/pre-installation-final/windows-clean/`.
6. Si todo pasa sin tocar el codigo, promover a
   `installer-output/ENTREGA-USB/`. Mantener el binario intacto
   entre la prueba y la copia.
7. Solicitar autorizacion explicita antes de push + release.
