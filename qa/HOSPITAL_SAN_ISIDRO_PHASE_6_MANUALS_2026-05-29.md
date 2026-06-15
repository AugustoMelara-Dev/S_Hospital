# Fase 6 - Manuales no tecnicos y checklist fisico

Fecha: 2026-05-29
Branch: `codex/hospital-san-isidro-rc`

## Alcance ejecutado

- Se reescribio el manual de cajero con flujo diario completo.
- Se reescribio el manual de administrador con configuracion, reportes, anulaciones y respaldos.
- Se actualizo la guia de instalacion operativa para servidor Windows/LAN sin puerto de desarrollo como referencia principal.
- Se actualizo la guia de respaldos/restauracion con verificacion SHA256 y base descartable.
- Se actualizo checklist de capacitacion con impresora, LAN, reinicio Windows, acceso directo, respaldos y restore.
- Se actualizo `README.md` y `SYSTEM_REQUIREMENTS.md` para alinear recibo institucional en papel y acceso LAN.

## Archivos principales

- `docs/manuales/MANUAL_CAJERO.md`
- `docs/manuales/MANUAL_ADMINISTRADOR.md`
- `docs/manuales/GUIA_INSTALACION_OPERATIVA.md`
- `docs/manuales/GUIA_RESPALDOS_Y_RESTAURACION.md`
- `docs/manuales/CHECKLIST_CAPACITACION.md`
- `README.md`
- `SYSTEM_REQUIREMENTS.md`

## Verificacion ejecutada

- `cd frontend && npm.cmd run check:branding`
  - Resultado: paso sin hallazgos.
- `git diff --check`
  - Resultado: sin errores.
- Revision textual con `rg` sobre manuales, README y requisitos para detectar lenguaje demo, puertos de desarrollo, recibo termico, QR/barcode como flujo principal y variables tecnicas.

## Criterios de aceptacion

- Cajero puede seguir un flujo de abrir caja, facturar, cobrar, imprimir, reimprimir y cerrar caja.
- Administrador tiene guia para configuracion, usuarios, reportes, respaldos y restauracion segura.
- Instalacion cubre servidor Windows, IP LAN, acceso directo, reinicio y falla comun.
- Checklist fisico cubre impresora real, LAN, reinicio Windows, acceso directo, respaldos y restauracion.
