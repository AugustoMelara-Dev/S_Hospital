# Fase 1 - Identidad institucional y lenguaje visible

Fecha: 2026-05-29
Branch: `codex/hospital-san-isidro-rc`

## Alcance ejecutado

- Se centralizo el nombre visible del hospital con fallback institucional: `Hospital San Isidro`.
- Se ocultaron nombres internos o heredados cuando vienen vacios, de pruebas o desde configuracion antigua.
- Se corrigio el lenguaje visible del login, nueva factura, ayuda, acerca de y comentarios de estilos globales.
- Se amplio el `check:branding` para bloquear nombres heredados en superficie visible de frontend y manuales principales.
- Se fortalecio el smoke visual para fallar si reaparece `Caja hospitalaria` en pantallas principales.

## Archivos principales

- `frontend/src/lib/hospital-name.ts`
- `frontend/src/lib/hospital-name.test.ts`
- `frontend/src/features/auth/LoginView.tsx`
- `frontend/src/features/about/AboutView.tsx`
- `frontend/src/features/invoices/NewInvoiceView.tsx`
- `frontend/src/features/help/HelpView.tsx`
- `frontend/src/features/settings/FiscalSettingsView.tsx`
- `frontend/src/features/settings/components/FiscalStatusCard.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/styles.css`
- `scripts/check-branding.ps1`
- `qa/visual-smoke/field-qa-current-screenshots.mjs`

## Verificacion ejecutada

- `cd frontend && npm.cmd run test -- hospital-name.test.ts App.test.tsx`
  - Resultado: 2 archivos, 13 tests pasaron.
- `cd frontend && npm.cmd run typecheck`
  - Resultado: paso.
- `cd frontend && npm.cmd run lint`
  - Resultado: paso.
- `cd frontend && npm.cmd run check:branding`
  - Resultado: paso sin hallazgos.
- `cd frontend && npm.cmd run build`
  - Resultado: paso. Vite reporto advertencia de chunk `index` mayor a 500 kB; no bloquea esta fase.
- `node qa\visual-smoke\field-qa-current-screenshots.mjs`
  - Resultado: paso contra `http://127.0.0.1:8000`.
  - Capturas actualizadas en `qa/screenshots/field-qa-2026-05-29-fixed/`.

## Evidencia visual

- `qa/screenshots/field-qa-2026-05-29-fixed/01-login.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/02-dashboard.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/03-fiscal-settings.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/04-backups.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/05-catalog.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/06-billing-new.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/07-reports.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/08-cashbox.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/09-invoices.png`
- `qa/screenshots/field-qa-2026-05-29-fixed/10-receipt-preview.png`

## Riesgos y pendientes

- Esta fase solo cubre identidad visible y guardias de branding. No resuelve recibo institucional, pagos parciales, reportes, restauracion ni manuales finales.
- Quedan textos tecnicos y documentos legacy fuera del alcance de Fase 1; se atenderan en fases de respaldos, instalacion y capacitacion.
- El smoke visual usa la base local actual. La validacion final debe repetirse despues de cada fase y en servidor Windows/LAN.

## Criterios de aceptacion

- Pantallas principales ya no muestran nombres comerciales heredados ni `Caja hospitalaria` como marca principal.
- El fallback visible ante configuracion vacia o antigua es `Hospital San Isidro`.
- Hay pruebas automatizadas para el normalizador de nombre y el login.
- Branding check y smoke visual bloquean regresiones visibles.
