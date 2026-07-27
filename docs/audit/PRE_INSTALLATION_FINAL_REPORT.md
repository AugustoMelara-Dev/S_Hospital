# Pre-installation Final Report — S_Hospital

> **Este reporte es la unica fuente canonica vigente del estado**
> de la entrega pre-instalacion. Cualquier otra copia (incluido
> `docs/AUDIT-PRE-INSTALLATION-REPORT.md`) esta SUPERSEDED.

## 1. Identificadores verificados (live)

| Campo | Valor |
|---|---|
| SHA base (`main`) | `fe4b40f2168d15097a59bed044f6e0b891b7e22d` |
| SOURCE_COMMIT (commit congelado para el build) | `5e7d48ecd6b7d8a0f647d8892e90fe8ac1b91c3e` |
| HEAD `audit/pre-installation-fixes` | `5e7d48ec...` (igual a SOURCE_COMMIT; sin commits posteriores) |
| Commits base..HEAD | `git rev-list --count fe4b40f2..HEAD` -> ver runtime |
| Rama | `audit/pre-installation-fixes` |
| Working tree | `git status --porcelain` -> vacio al cierre |
| Push | **NO** |
| Merge a main | **NO** |
| Tag | **NO** |
| Release | **NO** |

> Las cifras exactas aparecen en `qa/pre-installation-final/final-git-baseline.txt`
> y en `installer-output/CANDIDATO-CERTIFICACION/CANDIDATE-MANIFEST.json`
> (regenerado por `regenerate.ps1` con `git rev-parse HEAD`).

## 2. Binario candidato (compilado y verificado)

| Campo | Valor |
|---|---|
| Ruta del build | `installer-output/build/S_Hospital-Instalador.exe` |
| Ruta de la copia en ENTREGA-USB | `installer-output/ENTREGA-USB/S_Hospital-Instalador.exe` |
| Tamano | 404,209,817 bytes (385.48 MB) |
| SHA-256 | `0a2947fd88d6ee4415b5bac314bbf4da6d7f89a72c570088116ffb54832b8559` |
| Verificacion build == USB | IDENTICOS (mismo SHA-256) |
| Product version | 1.0.2072 |
| Created | 2026-07-27T22:40:24Z |
| LastWriteTime | 2026-07-27T22:42:12Z |
| Authenticode (binario) | **NotSigned** (Inno Setup no firma el binario por defecto) |

> Inno Setup 6 (ISCC.exe) usado para compilar:
> `C:\Users\melar\AppData\Local\Programs\Inno Setup 6\ISCC.exe`
> v6.x (Copyright 1997-2026 Jordan Russell), firmado digitalmente por
> Pyrsys B.V. (editor oficial), cadena Sectigo Public Code Signing CA R36,
> valido hasta 2028-03-09.

## 3. Estado de las gates automatizadas

Suite ejecutada en el entorno del agente. Evidencia en
`qa/pre-installation-final/`.

| Gate | Resultado | Evidencia |
|------|-----------|-----------|
| Backend PHPUnit (SQLite) | **981 passed / 0 failed / 12 skipped** (7344 aserciones, 456 s) | `backend-full.txt`, `backend-skipped.txt` |
| Frontend Vitest (suite completa) | **1162 passed / 0 failed / 0 skipped** (154 test files) | `frontend-full.txt` |
| Frontend ESLint | 0 errors | local |
| Frontend TypeScript | 0 errors | local |
| MariaDB local (mariadb 11.4.3 dockerizado, puerto 3307) | **9/11 tests MariaDB-especificos pasaron** localmente; 2 requieren `pcntl_fork()` (CI Linux) y 1 es coverage skip; 3 tests pre-existentes fueron corregidos (CASE A / CASE B documentados) | `mariadb-full.txt`, `mariadb-skipped-analysis.md` |
| PowerShell (18 suites: recovery / shortcut / mantenimiento / instalador / offline release) | **18/18 OK / 0 failed** | `powershell-full.txt`, `powershell-summary.json` |
| Python icon audit | OK; 3 .ico multirresolucion (app 4232 B / installer 5087 B / maintenance 6205 B) | `icon-audit.txt` |
| Offline release validator | **YES** (regenerado desde SOURCE_COMMIT) | `offline-release-validator.txt` |
| `restore_hospital_windows.ps1 -SelfTest` | OK | local |
| Installer build (ISCC) | **OK** (110 s, exit code 0) | `installer-build.txt` |
| Candidate evidence (binary integrity) | **VERIFIED** (SHA-256 match build/ vs ENTREGA-USB/) | `candidate-evidence.txt` |

Resumen ejecutivo: `qa/pre-installation-final/test-summary.json`.

## 4. Hallazgos H1–H6 — estado verificable

> Leyenda:
> IMPLEMENTADO  = codigo presente en la rama.
> AUTOMATIZADO   = contrato cubierto por test automatizado que pasa.
> MANUAL WINDOWS = pendiente de prueba real en VM limpia.
> CERTIFICADO    = prueba en VM limpia finalizada en verde.

| ID | Hallazgo | Codigo | Tests | Windows limpio |
|----|----------|--------|-------|-----------------|
| H1 | Duplicacion de identidad institucional (FiscalSetting canónico + UI consolidada) | SI | AUTOMATIZADO VERDE (8 backend + 8 frontend tests rojos pasan) | MANUAL WINDOWS |
| H2 | Numeraciones separadas y claras (FiscalSequence fiscal / InstitutionalReceiptSeries interna) | SI | AUTOMATIZADO VERDE | MANUAL WINDOWS |
| H3 | Color fuera del flujo normal (receipt_number_color fuera del formulario y esquema normales) | SI | AUTOMATIZADO VERDE | MANUAL WINDOWS |
| H4 | Inicializacion Honduras (seeder idempotente) | SI | AUTOMATIZADO VERDE (10/10 backend audit tests pasan) | MANUAL WINDOWS |
| H5 | Consola de mantenimiento (mantenimiento_hospital_windows.ps1 + acceso directo) | IMPLEMENTADO | AUTOMATIZADO VERDE | MANUAL WINDOWS (el acceso directo al candidato debe ser probado en VM) |
| H6 | Iconos multirresolucion (3 .ico, 9 resoluciones) | IMPLEMENTADO | AUTOMATIZADO VERDE (3/3 .ico OK) | MANUAL WINDOWS |

## 5. Cambios incompatibles y compatibilidad

| Cambio | Compatibilidad |
|---|---|
| Quitado el tab Institucion de `InstitutionalReceiptSettingsView`. | Datos de `fiscal_settings` preservados; la ruta `/settings/institutional-receipts` redirige a `/settings/fiscal`. |
| Eliminado el campo `receipt_number_color` del esquema normal y del formulario de la serie. | La columna en BD se conserva. `UpdateReceiptSeriesRequest` lo trata como `sometimes required`. |
| Eliminado el icono legado `frontend/public/icons/hospital-app.ico`. | Sustituido por `s-hospital-app.ico`, `s-hospital-installer.ico`, `s-hospital-maintenance.ico`. |
| Acceso directo "Mantenimiento S_Hospital" apunta a `maintenance_hospital_windows.ps1` (no a `restore_hospital_windows.ps1`). | Helper de restore sigue disponible para flujos de soporte. |

## 6. Fuente canonica de identidad

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

## 7. Politica de numeracion

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

## 8. Inicializacion Honduras

`backend/database/seeders/HondurasDistributionSeeder` es
idempotente. Sembrado unicamente:

- `hospital_name = Hospital General San Isidro`
- `government_line = Gobierno de Honduras`
- `secretariat_line = Secretaria de Salud Publica`
- `receipt_location = Tocoa, Colon, Honduras`

No escribe RTN, CAI, rango fiscal, vigencia, direccion exacta,
telefono, lema ni texto fiscal. `DatabaseSeeder` lo invoca
inmediatamente despues de roles/permisos.

## 9. Consola de mantenimiento

`scripts/maintenance_hospital_windows.ps1` ofrece 6 opciones:
estado, crear respaldo, verificar, restauracion en base
descartable, recuperacion productiva protegida, registros de
soporte.

- No invoca `mysql.exe` del host; usa docker compose o el runtime
  bare metal via `lib/recovery_*.ps1`.
- Acceso directo "Mantenimiento S_Hospital" apunta al script.
- La ventana permanece abierta tras un error fatal para que el
  operador pueda leer el mensaje.

## 10. Iconos e instalador

- 3 archivos `.ico` multirresolucion (9 resoluciones, 16-256):
  - `s-hospital-app.ico` (4232 B)
  - `s-hospital-installer.ico` (5087 B)
  - `s-hospital-maintenance.ico` (6205 B)
- Legado `hospital-app.ico` eliminado.
- Instalador Inno Setup usa `s-hospital-installer.ico`.
- `Uninstallable=no` se conserva por diseno. Documentacion del
  flujo de actualizacion/reparacion/desinstalacion manual en
  `installer/S_Hospital.iss`.

## 11. Certificacion en Windows limpio

ESTADO: **BLOQUEADO**. Este entorno (Dell G15 5520 dentro de
Hyper-V) tiene el checkout completo del repositorio, herramientas
de desarrollo (PHP, Node, pnpm, Git), Docker Desktop y todo el
toolchain de auditoria. NO es una VM limpia para certificar el
instalador.

Reglas aplicadas:
- No se simula la prueba en Windows limpio.
- El binario candidato esta en
  `installer-output/build/S_Hospital-Instalador.exe` (verificado
  por SHA-256) y duplicado en `installer-output/ENTREGA-USB/`
  con el mismo SHA-256.
- El manifiesto marca `certification_status =
  BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION`.
- El operador con una VM Windows 10/11 x64 limpia debe:
  1. Calcular SHA-256 en la VM y comparar con el del manifiesto
     (`0a2947fd88d6ee4415b5bac314bbf4da6d7f89a72c570088116ffb54832b8559`).
  2. Instalar el `.exe`. Verificar icono, UAC, accesos directos.
  3. Configurar con datos de prueba aprobados. NO usar RTN, CAI
     ni rango fiscal reales.
  4. Abrir caja, facturar L 900, cobrar, imprimir, reimprimir,
     anular.
  5. Mantenimiento: estado, respaldo, verificacion, restauracion
     en base descartable, recuperacion productiva protegida,
     rollback.
  6. Reiniciar Windows. Inicio posterior. Persistencia.
  7. Capturar evidencia en
     `qa/pre-installation-final/windows-clean/`.
  8. Si todo pasa sin tocar el codigo, promover el MISMO binario
     (verificado por SHA-256 antes y despues) a
     `installer-output/ENTREGA-USB/`.

## 12. Acciones NO realizadas (confirmacion explicita)

- **NO** se hizo `git push`.
- **NO** se hizo merge a `main`.
- **NO** se creo tag ni release.
- **NO** se inventaron RTN, CAI, rango fiscal, vigencia,
  telefono ni direccion.
- **NO** se descargo `ISCC.exe` desde un sitio no oficial. La
  regla 6.2 de la auditoria lo prohibe; ISCC fue instalado
  por el operador y verificado por firma digital (Pyrsys B.V.).
- **NO** se reutilizo el `.exe` antiguo. El nuevo fue compilado
  desde `5e7d48ec` (SOURCE_COMMIT congelado) y se reemplazo
  cualquier `.exe` previo en `installer-output/`.
- **NO** se simulo la prueba en Windows limpio.
- El binario `.exe` no esta firmado (NotSigned). Inno Setup no
  firma el binario por defecto. Esto se documenta en
  `installer/S_Hospital.iss`; el hospital debe obtener un
  certificado de firma de codigo institucional antes del
  despliegue productivo.

## 13. Como retomar

1. Operador en una VM Windows 10/11 x64 limpia:
   - Instalar Docker Desktop (sin checkout del repo).
   - Copiar `installer-output/ENTREGA-USB/S_Hospital-Instalador.exe`
     a la VM limpia.
   - Calcular SHA-256 en la VM y verificar que coincide con el del
     manifiesto.
2. Instalar el `.exe`. Seguir la lista 8 de la auditoria
   original. Capturas en
   `qa/pre-installation-final/windows-clean/`.
3. Si todo pasa, el MISMO binario (sin recompilar) se queda en
   `installer-output/ENTREGA-USB/`. El manifiesto pasa a
   `certification_status = CLEAN_WINDOWS_CERTIFIED`.
4. Solicitar autorizacion explicita antes de push + release.
