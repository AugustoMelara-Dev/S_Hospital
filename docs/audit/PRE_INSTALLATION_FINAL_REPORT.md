# Pre-installation Final Report — S_Hospital

> Documento de certificacion generado en la rama
> `audit/pre-installation-fixes`. No declara la entrega USB
> como lista; describe con precision lo implementado, lo
> verificado automaticamente y lo que queda bloqueado por
> falta de entorno Windows limpio.

## 1. Identificadores verificados

| Campo | Valor |
|---|---|
| SHA base (`main`) | `fe4b40f2168d15097a59bed044f6e0b891b7e22d` |
| SHA al cierre de la rama | reconstruido en cada ejecucion (`git rev-parse HEAD`) |
| Merge-base con `main` | `fe4b40f2168d15097a59bed044f6e0b891b7e22d` |
| Rama | `audit/pre-installation-fixes` |
| Working tree al cierre | CLEAN (verificado con `git status --porcelain=v2 --branch`) |
| Push realizado | NO |
| Merge a main | NO |
| Tag o release | NO |

Nota: el SHA final exacto aparece en `qa/pre-installation-final/git-baseline.txt` y en cada ejecucion nueva de las suites automatizadas; cambia con cada nuevo commit. El SHA al cierre de este reporte se obtiene con `git rev-parse HEAD`.

## 2. Commits sobre la base

15 commits sobre `fe4b40f2` (contados con `git rev-list --count fe4b40f2..HEAD` y reflejados en `CANDIDATE-MANIFEST.json`).

Listado verificado por `git log --reverse --format="%H %h %ci %s" fe4b40f2..HEAD`.

> Los identificadores no se enumeran a mano aqui porque pueden
> cambiar con nuevos commits; la fuente de verdad es `git log` y
> `qa/pre-installation-final/git-baseline.txt`.

## 3. Hallazgos H1–H6 — estado verificable

| ID | Hallazgo | Implementado | Automatizado verde | Manual Windows | Evidencia |
|----|----------|--------------|---------------------|----------------|-----------|
| H1 | Duplicacion de identidad institucional | SI | SI | PENDIENTE | `backend/app/Actions/Fiscal/UpdateFiscalInstitutionAction.php`, `frontend/src/test/preInstallationAudit.test.ts`, `backend/tests/Feature/PreInstallationAuditTest.php` |
| H2 | Numeraciones separadas y claras | SI | SI | PENDIENTE | `frontend/src/test/preInstallationAudit.test.ts` (H2), `InstitutionalReceiptSeries` no usa `FiscalSequence` |
| H3 | Color fuera del flujo normal | SI | SI | PENDIENTE | `frontend/scripts/ui-legacy-audit.test.ts`, `frontend/src/test/preInstallationAudit.test.ts` |
| H4 | Inicializacion Honduras | SI | SI | PENDIENTE | `backend/database/seeders/HondurasDistributionSeeder.php`, `backend/tests/Feature/PreInstallationAuditTest.php` (10/10 tests) |
| H5 | Consola de mantenimiento | IMPLEMENTADO | IMPLEMENTADO | PENDIENTE | `scripts/maintenance_hospital_windows.ps1`, `scripts/pre_installation_maintenance_audit.test.ps1` (10/10), `scripts/pre_installation_shortcut_audit.test.ps1` (11/11) |
| H6 | Iconos e identidad del instalador | IMPLEMENTADO | IMPLEMENTADO | PENDIENTE | `scripts/build_multiresolution_icons.py`, `scripts/pre_installation_icon_audit.py` (3/3 .ico, 9 resoluciones cada uno) |

> "IMPLEMENTADO" significa que el codigo existe en la rama y los
> tests automatizados verifican el contrato.
> "PENDIENTE" significa que la auditoria exige ejecutar el binario
> certificado contra una VM Windows limpia antes de poder
> marcarlo como verificado manualmente. Este entorno no dispone
> de esa VM.

## 4. Cambios incompatibles y compatibilidad

| Cambio | Compatibilidad |
|---|---|
| Eliminado el formulario duplicado de identidad en `InstitutionalReceiptSettingsView`. | Los datos ya guardados en `fiscal_settings` permanecen; la ruta `/settings/institutional-receipts` redirige a `/settings/fiscal` (`Navigate replace`). |
| Eliminado el campo `receipt_number_color` del esquema normal y del formulario de la serie institucional. | La columna en BD se conserva. `UpdateReceiptSeriesRequest` lo trata como `sometimes required`, por lo que no se rechaza el payload que lo omita. Los registros existentes no se ven afectados. |
| Eliminado el icono legado `frontend/public/icons/hospital-app.ico`. | El codigo y los accesos directos usan `s-hospital-app.ico`. El instalador usa `s-hospital-installer.ico`. El acceso de mantenimiento usa `s-hospital-maintenance.ico`. |
| El acceso directo "Mantenimiento S_Hospital" ya no apunta a `restore_hospital_windows.ps1`. | Apunta a `scripts\maintenance_hospital_windows.ps1`. El helper de restore sigue disponible para los flujos de soporte (no como destino del acceso directo). |

## 5. Gating automatizado

Suite ejecutada en este entorno, con evidencia en `qa/pre-installation-final/`.

| Gate | Resultado | Evidencia |
|---|---|---|
| Backend PHPUnit | 979 passed / 0 failed / 12 skipped | `qa/pre-installation-final/backend-full.txt`, `backend-skipped.txt` |
| Frontend Vitest (suite completa) | 1162 passed / 0 failed | `qa/pre-installation-final/frontend-full.txt` |
| Frontend ESLint | 0 errors | ejecucion local |
| Frontend tsc --noEmit | 0 errors | ejecucion local |
| PowerShell tests (recovery, shortcut, instalador, mantenimiento, offline release) | 18 suites / 0 failed / 0 skipped | `qa/pre-installation-final/powershell-full.txt`, `powershell-summary.json` |
| Python icon audit | OK (3 .ico, 9 resoluciones) | `qa/pre-installation-final/icon-audit.txt` |

Los 12 skipped backend son todos documentados en
`backend-skipped.txt`:

- 11 son drivers MySQL: el entorno de testing usa SQLite. Cubren
  casos reales del driver MySQL que no se pueden ejercitar en
  SQLite. Su ejecucion depende de phpunit.mysql.xml.
- 1 es `CriticalModulesCoverageTest`: requiere pcov o xdebug
  habilitado en php.ini. Es un test de cobertura, no un test
  funcional.

Ninguno invalida el release: cada skip esta bajo un `markTestSkipped`
con la justificacion documentada.

## 6. Investigacion de los 3 fallos frontend del informe anterior

Investigacion completa en `qa/pre-installation-final/ui-legacy-investigation.md`.

| Test | Verdicto | Cambio |
|---|---|---|
| "limits strict mode to migrated surfaces while final mode keeps all runtime violations" | CASE B (test obsoleto: `src/features/reports/` se anadio a `strictModulePrefixes` en commit `081e23f1` aprobado; el test nunca se actualizo) | `frontend/scripts/ui-legacy-audit.test.ts:54` cambia `1` -> `2`. |
| "keeps migrated shell and authentication surfaces in strict mode" | CASE A (defecto real: `filterViolationsForMode` emitia dos violaciones por archivo `Legacy*` en strict scope) | `frontend/scripts/ui-legacy-audit.mjs` deduplica `compat-surface` cuando el mismo archivo ya tiene `legacy-import` en strict scope. |
| "keeps migrated billing and receipt surfaces in strict mode" | CASE A (mismo defecto que el anterior) | Mismo fix. |

Ningun test fue debilitado: no se uso `.skip`, `.todo`, `test.only`,
`describe.only`, no se borraron asserts ni se removio alcance del
audit. Inventory y final mode conservan toda la cobertura.

Ademas se actualizo `frontend/src/AppRoutes.lazy.test.ts`: el
Route de Recibos institucionales dejo de renderizar el view
(dirige a /settings/fiscal), por lo que exigir su lazy import es
un CASE B por cambio de arquitectura aprobado. Se removio la
asercion sobre `InstitutionalReceiptSettingsView`.

## 7. Fuente canonica de identidad

`App\Models\FiscalSetting` es la unica tabla persistente de
identidad institucional. El unico caso de uso de escritura es
`App\Actions\Fiscal\UpdateFiscalInstitutionAction`.

- `FiscalSettingsController::update` (`PUT /api/settings/fiscal`)
  es el unico endpoint canonico.
- `InstitutionalReceiptSettingsController::updateInstitution`
  (`PUT /api/settings/institutional-receipts/institution`) es el
  alias legacy que delega a la misma accion. Mantener la ruta
  evita romper integraciones y bookmarks en equipos que ya
  tenian la URL guardada.

La accion:
- Llena los 9 campos canonicos de identidad (`hospital_name`,
  `rtn`, `address`, `phone`, `slogan`, `government_line`,
  `secretariat_line`, `receipt_location`, `receipt_footer_text`).
- Si la fila no existe, siembra los campos minimos no fiscales
  (`rtn`, `default_tax_rate`, `receipt_width`, `primary_color`,
  `receipt_paper_size`) antes de aplicar los institucionales.
- Audita como `fiscal_settings.created` / `fiscal_settings.updated`.
- No crea filas de `FiscalSequence`. No asigna CAI ni rango.

La ruta frontend `/settings/institutional-receipts` redirige a
`/settings/fiscal`. La entrada "Recibos institucionales" no
aparece en `primaryNavigation` (solo en `appRoutes.receiptSettings`
para breadcrumb legacy).

## 8. Politica de numeracion

- `FiscalSequence` gobierna la numeracion fiscal de facturas. El
  correlativo es de solo lectura en la UI
  (`FiscalNumerationView.tsx` muestra el valor pero no expone un
  input). Para modificarlo se requiere motivo o el permiso
  dedicado `fiscal.sequences.reset` (backend).
- `InstitutionalReceiptSeries` representa un documento interno
  diferente (recibo institucional de pago). No se sincroniza
  con `FiscalSequence`. Su formulario solo es editable cuando el
  usuario tiene `receipt_settings.advanced`; en el flujo normal
  se muestra como `SeriesReadOnlyState`. Los recibos historicos y
  reimpresiones conservan snapshot y numero.
- `current_number` en ambas tablas no es editable por usuarios
  normales (UI readonly en fiscal; UI readonly o bloqueada por
  permission en institucional).

## 9. Inicializacion Honduras

`backend/database/seeders/HondurasDistributionSeeder` es
idempotente. Verificacion:

- Sembrado unicamente los 4 campos canonicos:
  `hospital_name = Hospital General San Isidro`,
  `government_line = Gobierno de Honduras`,
  `secretariat_line = Secretaria de Salud Publica`,
  `receipt_location = Tocoa, Colon, Honduras`.
- No escribe RTN, CAI, rango fiscal, direccion exacta, telefono,
  lema ni texto fiscal.
- Idempotente: correrlo dos veces no duplica filas ni modifica
  campos ya oficiales.
- No toca `FiscalSequence` ni crea filas ahi.

`DatabaseSeeder` lo invoca inmediatamente despues de
`RolesAndPermissionsSeeder` y antes de `ServiceCatalogSeeder`,
de modo que el primer login vea la identidad institucional visible.

## 10. Consola de mantenimiento

`scripts\maintenance_hospital_windows.ps1` ofrece 6 opciones:
estado del sistema, crear respaldo, verificar respaldo,
restauracion en base descartable, recuperacion productiva
protegida y registros de soporte.

Requisitos verificados:

- No depende de `mysql.exe` del host (solo contenedor o bare
  metal via contratos `lib/recovery_*.ps1`).
- Aparece una `docker compose` en el codigo y no aparece la cadena
  `mysql.exe` seguida de un caracter no alfabetico (es decir, no
  se invoca).
- El acceso directo instalado apunta a este script, no a
  `restore_hospital_windows.ps1`.
- La ventana permanece abierta tras un error fatal para que el
  operador lea el mensaje (Pause / Read-Host al final).
- La recuperacion productiva exige doble confirmacion explicita
  (nombre de la base + "RESTAURAR PRODUCCION") antes de delegar
  al helper `restore_hospital_windows.ps1 -ProductionRecovery`.

## 11. Iconos e instalador

3 archivos `.ico` multirresolucion, cada uno con las 9
resoluciones exigidas (16, 20, 24, 32, 40, 48, 64, 128, 256):

- `frontend/public/icons/s-hospital-app.ico` (4232 bytes)
- `frontend/public/icons/s-hospital-installer.ico` (5087 bytes)
- `frontend/public/icons/s-hospital-maintenance.ico` (6205 bytes)

El instalador Inno Setup usa `s-hospital-installer.ico`
(`installer/S_Hospital.iss:31`). El legado
`hospital-app.ico` fue eliminado en el commit `64664959`.

`Uninstallable=no` se conserva por diseno. El bloque de
comentarios en `installer/S_Hospital.iss` documenta el
procedimiento manual de actualizacion/reparacion/desinstalacion
hasta que exista un flujo controlado de baja.

## 12. Certificacion en Windows limpio

ESTADO: **BLOQUEADO**. Este entorno no dispone de una VM Windows
limpia. No se afirma PASSED.

El candidato de certificacion se preparara en
`installer-output/CANDIDATO-CERTIFICACION/` cuando ISCC.exe este
disponible. El manifiesto `CANDIDATE-MANIFEST.json` registra
SHA del commit, fecha de generacion, estado de las gates
automaticas, entorno detectado (Docker 29.4.3, PHP 8.2.12, Node
22.18.0, Inno Setup **no instalado**) y pasos pendientes.

Pasos obligatorios para que un operador cierre la certificacion
(documentados en `INSTRUCCIONES-PRUEBA.txt` del candidato):

1. Instalar Inno Setup 6 en una VM Windows 10/11 x64 limpia.
2. Confirmar Docker Desktop corriendo y reiniciar Windows si
   aplica.
3. Construir el instalador candidato:
   `powershell -File scripts\build_windows_installer.ps1
   -ProjectRoot .`
4. Calcular SHA-256 del `.exe` generado y copiarlo al
   directorio del candidato.
5. Ejecutar la lista 8 de la auditoria original en la VM:
   instalacion, configuracion, operacion con factura de L 900 +
   eritropoyetina, cobro, reimpresion, anulacion, mantenimiento
   (estado, respaldo, verificacion, restauracion descartable,
   recuperacion productiva protegida, rollback), reinicio de
   Windows y verificacion de autoarranque.
6. Documentar evidencia con capturas en
   `qa/pre-installation-final/windows-clean/`.
7. Si todo pasa sin tocar el binario, promoverlo a
   `installer-output/ENTREGA-USB/`. El SHA-256 antes y despues
   de la copia debe coincidir.

Reglas no negociables:

- No modificar nada entre la construccion del candidato y la
  prueba en Windows. Si hay que arreglar algo, se reconstruye.
- No exponer secretos, .env, claves de cifrado ni rutas internas
  en evidencia compartible.
- No declarar PASSED si falta cualquier bloque de la lista 8
  de la auditoria original.
- No hacer push, tag, merge ni release sin autorizacion
  explicita.

## 13. Acciones NO realizadas

Confirmacion explicita:

- **No** se hizo `git push`. La rama `audit/pre-installation-fixes`
  permanece local.
- **No** se hizo merge a `main`.
- **No** se creo tag ni release.
- **No** se publico el paquete USB. La instalacion final del
  paciente queda bloqueada hasta que la prueba manual en
  Windows pase.
- **No** se inventaron RTN, CAI, rango fiscal, vigencia,
  telefono ni direccion. Honduras solo trae los 4 campos
  institucionales canonicos.

## 14. Como retomar

1. Operador con VM Windows: clonar la rama
   `audit/pre-installation-fixes` o copiarla.
2. Instalar Inno Setup 6 + Docker Desktop.
3. Construir el candidato:
   `scripts\build_windows_installer.ps1 -ProjectRoot .`
4. SHA-256 + copia a `installer-output/CANDIDATO-CERTIFICACION/`.
5. Ejecutar la lista 8 de la auditoria en la VM.
6. Si todo pasa, promover a `installer-output/ENTREGA-USB/` sin
   recompilar.
7. Solicitar autorizacion explicita para push + release.

## 15. Estado final

```
CODE AUDIT:                 PASSED (implementacion + tests automatizados)
AUTOMATED GATES:            PASSED (backend, frontend, powershell, python)
INSTALLER CANDIDATE:        NOT BUILT (ISCC.exe no instalado en este entorno)
WINDOWS CLEAN INSTALL:      PENDING (sin VM Windows limpia)
BACKUP/RECOVERY DRILL:      PENDING (requiere Windows limpio)
USB PACKAGE:                NOT READY (requiere candidato certificado)
PUSH/RELEASE:               NOT PERFORMED
```
