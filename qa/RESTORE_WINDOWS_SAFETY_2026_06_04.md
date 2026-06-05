# Restore Windows safety evidence - 2026-06-04

## Scope

Guardar el contrato seguro de `scripts\restore_hospital_windows.ps1` para
instalaciones Windows/XAMPP sin tocar una base productiva ni depender de memoria
del operador.

## Command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_restore_windows_safety.ps1
```

## Result

```text
RESTORE_WINDOWS_SAFETY: YES
```

## What the guard verifies

- `scripts\restore_hospital_windows.ps1` conserva `-SelfTest`.
- El self-test declara que no toca base de datos ni backups reales.
- El helper rechaza nombres de base productivos como `hospital`, `shospital`,
  `prod` o `production`.
- La restauracion requiere una base descartable con `test`, `restore`,
  `validation` o `disposable` en el nombre.
- La contrasena se solicita con `Read-Host -AsSecureString` y se libera con
  `ZeroFreeBSTR`.
- El helper valida conexion segura antes de restaurar y solo acepta `.sql` o
  `.tar.gz`.
- Las guias de respaldo/restauracion y checklist exigen restore descartable,
  self-test y `qa\FINAL_RESTORE_PROOF.md`.

## Safety notes

Esta evidencia no restaura datos, no lee secretos reales y no reemplaza la
prueba final de restore en el servidor del hospital. Antes de `PRODUCTION_READY`
debe completarse `qa\FINAL_RESTORE_PROOF.md` contra una base descartable en el
entorno final.
