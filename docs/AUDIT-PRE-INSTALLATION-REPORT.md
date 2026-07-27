# Reporte de entrega — Auditoría pre-instalación S_Hospital

> **SUPERSEDED** — Este reporte corresponde a una entrega
> anterior y contiene identificadores obsoletos (SHA final
> `64664959`, "Commits nuevos 12", "Frontend 1149 / 3 failed preexistentes").
>
> La fuente canonica vigente es
> **`docs/audit/PRE_INSTALLATION_FINAL_REPORT.md`**.
>
> El SHA real de la rama al cierre de la ultima fase de
> certificacion automatizada se obtiene siempre con
> `git rev-parse HEAD`. Este archivo se conserva unicamente como
> registro historico de los identificadores que estuvieron vigentes
> al cierre del primer intento de la auditoria pre-instalacion.

## 1. Identificadores (historico)

| Campo | Valor (desactualizado) |
|---|---|
| SHA base (`main`) | `fe4b40f2168d15097a59bed044f6e0b891b7e22d` |
| SHA final (snapshot intermedio) | `64664959a6ea1ef5c0a06d924133bc26108aeb2a` (NO es el HEAD actual) |
| Rama | `audit/pre-installation-fixes` |
| Commits (snapshot intermedio) | 12 (NO es el conteo real) |

## 1. Identificadores

| Campo | Valor |
|---|---|
| SHA base (`main`) | `fe4b40f2168d15097a59bed044f6e0b891b7e22d` |
| SHA final (`audit/pre-installation-fixes`) | `64664959a6ea1ef5c0a06d924133bc26108aeb2a` |
| Rama | `audit/pre-installation-fixes` |
| Commits nuevos | 12 |

## 2. Commits

```
43a9b8f9 fix(backend): ensure Honduras seeder writes a valid rtn value
d9924c34 feat(icons): add multiresolution app installer maintenance icons
9690d2a2 feat(scripts): add maintenance console and route maintenance shortcut to it
e6cd63df feat(backend): seed Honduras distribution defaults idempotently
a6b3433a refactor(frontend): remove color from series form and gate institutional series
f4e10d72 refactor(frontend): consolidate Configuracion entry and remove duplicate institution form
7695ab8b refactor(backend): consolidate institution write into UpdateFiscalInstitutionAction
a9657ad9 test(installer): add pre-installation audit red tests for H5 H6
45f61256 test(frontend): add pre-installation audit red tests for H1 H2 H3
4f194c30 test(backend): add pre-installation audit red tests for H1 H3 H4
```

## 3. Hallazgos cubiertos

| Hallazgo | Cobertura |
|---|---|
| H1 — Duplicación de identidad institucional | Cerrado (Fase B). |
| H2 — Dos numeraciones, UI confusa | Cerrado (Fase C): fiscal sigue separada de la serie interna, y la serie interna ahora es solo estado de solo lectura para no avanzados. |
| H3 — Color obligatorio en serie de recibos | Cerrado (Fase C): `receipt_number_color` se elimina del esquema y formulario normal. El backend conserva el valor por compatibilidad. |
| H4 — Inicialización Honduras incompleta | Cerrado (Fase D): `HondurasDistributionSeeder` idempotente, sin RTN/CAI/rango. |
| H5 — Acceso directo apunta al helper equivocado | Cerrado (Fase E): acceso directo apunta a `maintenance_hospital_windows.ps1`, no a `restore_hospital_windows.ps1`. |
| H6 — Icono monorresolución y reusado | Cerrado (Fase F): 3 .ico multirresolución (app, installer, maintenance) con 9 resoluciones cada uno. Legado eliminado. |
| H7 — Commit final no corrige bloqueadores | N/A. El commit `fe4b40f2` queda en `main`; las correcciones viven en la rama de auditoría. |

## 4. Archivos modificados por fase

### Fase A — Pruebas rojas (3 commits, 22 tests)
Nuevos:
- `backend/tests/Feature/PreInstallationAuditTest.php`
- `frontend/src/test/preInstallationAudit.test.ts`
- `scripts/pre_installation_icon_audit.py`
- `scripts/pre_installation_shortcut_audit.test.ps1`
- `scripts/pre_installation_maintenance_audit.test.ps1`

### Fase B — Caso de uso canónico y consolidación UI (2 commits)
Nuevos:
- `backend/app/Actions/Fiscal/UpdateFiscalInstitutionAction.php`

Modificados:
- `backend/app/Http/Controllers/InstitutionalReceiptSettingsController.php`
- `backend/tests/Feature/InstitutionalReceiptSettingsTest.php`
- `backend/tests/Feature/PreInstallationAuditTest.php`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`
- `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx`
- `frontend/src/navigation/appNavigation.ts`
- `frontend/src/navigation/appNavigation.test.ts`
- `frontend/src/shell/InstitutionalShell.a11y.test.tsx`
- `frontend/src/test/preInstallationAudit.test.ts`

### Fase C — Numeración y color (1 commit)
- `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx`
- `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.test.tsx`

### Fase D — Seeder Honduras (2 commits)
Nuevos:
- `backend/database/seeders/HondurasDistributionSeeder.php`

Modificados:
- `backend/database/seeders/DatabaseSeeder.php`
- `backend/tests/Feature/PreInstallationAuditTest.php`

### Fase E — Consola de mantenimiento (1 commit)
Nuevos:
- `scripts/maintenance_hospital_windows.ps1`

Modificados:
- `scripts/install_hospital_startup_shortcut.ps1`
- `scripts/lib/shortcut_installer.ps1`
- `scripts/pre_installation_shortcut_audit.test.ps1`
- `scripts/pre_installation_maintenance_audit.test.ps1`

### Fase F — Iconos multirresolución e instalador (2 commits)
Nuevos:
- `scripts/build_multiresolution_icons.py`
- `frontend/public/icons/s-hospital-app.ico` (4232 B, 9 resoluciones)
- `frontend/public/icons/s-hospital-installer.ico` (5087 B, 9 resoluciones)
- `frontend/public/icons/s-hospital-maintenance.ico` (6205 B, 9 resoluciones)

Eliminados:
- `frontend/public/icons/hospital-app.ico` (monorresolución legado)

Modificados:
- `installer/S_Hospital.iss`
- `scripts/make_offline_release.ps1`
- `scripts/assert_offline_release_clean.ps1`
- `scripts/offline_release_contract.test.ps1`
- `scripts/windows_installer_contract.test.ps1`
- `scripts/install_hospital_startup_shortcut.test.ps1`
- `scripts/pre_installation_shortcut_audit.test.ps1`

### Fase G — Certificación (1 commit)
- `backend/database/seeders/HondurasDistributionSeeder.php` (fix rtn null)

## 5. Fuente canónica de identidad

`App\Models\FiscalSetting` es la única tabla que sostiene la
identidad institucional. La clase
`App\Actions\Fiscal\UpdateFiscalInstitutionAction` es el único
caso de uso de escritura para los campos de identidad y lo invocan
tanto `FiscalSettingsController::update`
(`PUT /api/settings/fiscal`) como
`InstitutionalReceiptSettingsController::updateInstitution`
(`PUT /api/settings/institutional-receipts/institution`).

La segunda ruta queda como alias legacy por compatibilidad mientras
la UI migra definitivamente al tab "Recibos e impresión" de
`Configuración`. La auditoría que ambas rutas emiten es
`fiscal_settings.created` / `fiscal_settings.updated`. La acción
paralela `institutional_receipt.settings.*` se eliminó.

## 6. Política de numeración fiscal

- `FiscalSequence` continúa gobernando la numeración fiscal de
  facturas. Su correlativo (`current_number`) es de solo lectura
  en la UI (`frontend/src/features/settings/FiscalNumerationView.tsx`)
  y solo se puede modificar por la vía canónica con motivo o el
  permiso dedicado `fiscal.sequences.reset`.
- `InstitutionalReceiptSeries` representa un documento interno
  diferente (recibo institucional de pago). Se conserva la tabla
  y los datos existentes para no romper reimpresiones ni llaves
  foráneas. En la UI su formulario solo se renderiza cuando el
  usuario tiene `receipt_settings.advanced`; los demás ven
  únicamente un `SeriesReadOnlyState`. No se sincronizan
  correlativos.
- `receipt_number_color` se elimina del esquema normal de
  frontend y del formulario; el backend conserva el valor
  preexistente porque `UpdateReceiptSeriesRequest` lo trata como
  `sometimes required`.

## 7. Resultados de pruebas automatizadas

| Suite | Resultado |
|---|---|
| Backend PHPUnit (`php artisan test`) | 979 passed / 12 skipped / 0 failed (7334 aserciones, 463 s). |
| Frontend Vitest | 1149 passed / 3 failed (pre-existentes en `scripts/ui-legacy-audit.test.ts`, sin relación con esta entrega). |
| `scripts/install_hospital_startup_shortcut.test.ps1` | 17/17. |
| `scripts/pre_installation_shortcut_audit.test.ps1` | 11/11. |
| `scripts/pre_installation_maintenance_audit.test.ps1` | 10/10. |
| `scripts/windows_installer_contract.test.ps1` | OK. |
| `scripts/offline_release_contract.test.ps1` | OK. |
| `scripts/pre_installation_icon_audit.py` | OK (3 .ico, 9 resoluciones cada uno). |

Los 3 fallos restantes del frontend son pre-existentes (verificado
con `git stash`): prueban reglas de auditoría de UI legacy que ya
estaban rotas en `fe4b40f2` y se documentan en otra entrega.

## 8. Cambios incompatibles y compatibilidad

- La ruta frontend `/settings/institutional-receipts` ya no
  renderiza la pantalla de Recibos institucionales: redirige a
  `/settings/fiscal` (componente `<Navigate replace />`).
- El campo `receipt_number_color` se omite del payload del
  formulario de la serie institucional; los registros existentes
  no se ven afectados porque la columna y la API lo siguen
  aceptando.
- El icono `frontend/public/icons/hospital-app.ico` se elimina; el
  código y los accesos directos ya no lo referencian. El instalador
  Inno Setup usa `s-hospital-installer.ico`.
- El shortcut "Mantenimiento S_Hospital" deja de apuntar a
  `restore_hospital_windows.ps1`; ahora abre
  `maintenance_hospital_windows.ps1` con menú.

## 9. Pendientes que NO cierra esta entrega

1. **Prueba manual en Windows limpio.** El agente no puede
   instalar Windows, ejecutar `setup.bat`, reiniciar ni replicar
   la lista de comprobación manual 8 de la auditoría. Esto
   requiere un operador humano con una VM o equipo dedicado.
2. **Regeneración del paquete USB, hashes y LEEME-INSTALACION.txt.**
   Bloqueada por la auditoría (regla 9): no se publica una
   release sin autorización. Una vez completada la prueba manual
   con éxito, ejecutar:
   - `scripts/build_windows_installer.ps1 -ProjectRoot .`
     (requiere Docker, ISCC.exe y los `offline-images/*.tar`).
   - Regenerar `ENTREGA-USB/S_Hospital-Instalador.exe` y su
     `S_Hospital-Instalador.exe.sha256`.
   - Actualizar `ENTREGA-USB/LEEME-INSTALACION.txt` con la nueva
     versión y el hash.
3. **`Uninstallable=no`.** Se conserva por diseño. El bloque de
   comentarios en `installer/S_Hospital.iss` documenta el
   procedimiento manual de actualización/reparación/desinstalación.
   Cuando exista un flujo de baja controlado se levanta este
   candado y se actualiza la documentación.
4. **3 fallos pre-existentes en `ui-legacy-audit.test.ts`.** No
   están relacionados con la auditoría pre-instalación; se
   abordan en otra entrega de limpieza de UI legacy.

## 10. No se hizo

- `git push`. La rama `audit/pre-installation-fixes` permanece
  local.
- Creación de release o tag.
- Regeneración de `offline-release/` y del instalador USB.
- Publicación de hashes o `LEEME-INSTALACION.txt` nuevos.

## 11. Cómo retomar

1. Crear VM Windows 10/11 con Docker Desktop.
2. `git checkout audit/pre-installation-fixes`.
3. `docker compose up -d` y `php artisan migrate --seed`.
4. Verificar la lista 8 de la auditoría paso a paso (facturar
   L 900 + eritropoyetina con receta, cobrar, imprimir,
   reimprimir, anulación, mantenimiento, respaldo, restauración
   en base descartable, recuperación productiva, reinicio).
5. Si todo pasa, ejecutar `scripts/build_windows_installer.ps1`
   para producir el paquete USB.
6. Solicitar autorización explícita para push + release.
