# Hallazgos UX propuestos (IDs HS-UX-*)

Autor: hs-ux, 2026-09-13. Base: lectura estática del código en `C:\Projects\S_Hospital_AI`. Nada aquí es inspección visual ni prueba ejecutada.
Estados permitidos (PROMPT_MAESTRO §9): `PENDIENTE_VERIFICAR`, `CONFIRMADO`, `EN_CURSO`, `CORREGIDO_SIN_VALIDAR`, `VERIFICADO`, `BLOQUEADO_EXTERNO`, `DECISION_NEGOCIO`, `DESCARTADO_CON_EVIDENCIA`, `MEJORA_OPCIONAL_NO_REQUERIDA`.
Los hallazgos nuevos conviven con la numeración F001-F035; se citan relaciones con F002, F012, F024, F029, F033, HS-PRINT-DELIVERY.

---

## HS-UX-01 · Configuración de recibos inaccesible: ruta retirada, enlace circular y vista huérfana — P0

- **Estado**: CONFIRMADO (estático).
- **Evidencia**
  - `frontend/src/AppRoutes.tsx:244-247` redirige `/settings/institutional-receipts` → `/settings/fiscal`.
  - `frontend/src/features/settings/FiscalSettingsView.tsx:88` botón "Administrar recibos" apunta a esa URL → vuelve a la misma pantalla (enlace circular).
  - `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx:134` exporta la vista real, pero `AppRoutes.tsx` no la importa (grep: solo la importan sus tests y `preInstallationAudit.test.ts` la lee como texto).
  - `frontend/src/navigation/appNavigation.ts:170-185` conserva la definición con migas ambas a `/settings/fiscal`.
  - Specs E2E que esperan la pantalla en esa URL: `e2e/accessibility.spec.ts:173`, `e2e/all-buttons-smoke.spec.ts:242`, `e2e/clinical-receipts.spec.ts:30`, `e2e/print-profiles.spec.ts:33,73,106`, `e2e/production-readiness.spec.ts:1147`, `e2e/rbac.spec.ts:40`, `e2e/refactor-total.spec.ts:46`, `e2e/settings-flow.spec.ts:58-60`, `e2e/v1-1-full-a11y.spec.ts:262`, `e2e/v1-2-full-a11y.spec.ts:262`, `e2e/v1-2-visible-ui-a11y.spec.ts:300,520`.
- **Justificación**: el operador no puede alcanzar la configuración de recibos desde ningún camino; el enlace de Configuración es una promesa falsa. Bloquea F002/F012 (hs-receipts) y la campaña de rediseño.
- **Impacto**: P0 operativo (configuración de copias/formato/serie inaccesible).
- **Propuesta de decisión (UX)**: una sola entrada canónica. Opción A: restaurar la ruta con `PermissionGate` `receipt_settings.view` y convertir `/settings/fiscal` en el punto de entrada sin duplicar formularios; conservar redirección útil si luego se decide sección. Opción B: sección dentro de Configuración con URL propia que no re-renderice el resumen. En ambos casos eliminar la miga autorreferente.
- **Dueños**: hs-receipts (vista/contrato), hs-frontend (`AppRoutes.tsx` y navegación), coordinación con hs-qa por specs (F024).
- **Criterio de cierre**: enlace de Configuración navega a una pantalla funcional; no hay ciclos; guard coherente con `receipt_settings.view`; specs alineados o marcados (sin ejecutar navegador).

## HS-UX-02 · Tokens operativos definidos solo para impresión; 20+ componentes los usan en pantalla — P1

- **Estado**: CONFIRMADO estáticamente; pendiente de build para confirmar el efecto exacto en CSS generado.
- **Evidencia**
  - Definición única: `frontend/src/printing/styles/receipt-print.css:353-367` (dentro de `@media print`).
  - Sin registro `@theme`: grep de `--color-operational-(bg|surface|panel|border):` en `frontend/src/**/*.{css,ts,tsx}` solo devuelve esas líneas de `receipt-print.css`.
  - Usos en pantalla: `NewInvoiceViewLayout.tsx:214`, `InvoiceCart.tsx:76,110,118,161-162`, `PaymentModal.tsx:311`, `ServiceSearch.tsx:162,311,328,346`, `CashClosingPanel.tsx:69`, `CashDenominationCounter.tsx:88`, `FiscalSummary.tsx:52`, `HospitalSettingsView.tsx:360`, `FiscalNumerationView.tsx:203,214,295,337,354`, `ReportsAudit.tsx:268,337,357,366,376`, `ExecutiveSummary.tsx:201-230`, `CashSessionReportPanel.tsx:236`, `BackupSupportStatusPanel.tsx:209,296`, `BillingBottomBar.tsx:17`, `RoleFormDialog.tsx:197-204`, `UserFormDialog.tsx:236,272`, `InstitutionalReceiptPreviewFrame.tsx:43`, `AppErrorBoundary.tsx:50`.
- **Justificación**: si Tailwind v4.3 no genera la utilidad (variable de tema ausente), los paneles pierden borde/superficie previstos en la mayoría de las pantallas operativas; la jerarquía visual depende de ese color. No se ejecutó `npm run build` (no hay `node_modules` en el worktree) — por eso el estado es "pendiente de confirmar con build", no una afirmación de fallo visual.
- **Impacto**: P1 visual transversal (POS, caja, informes, configuración, respaldos).
- **Propuesta**: registrar los cuatro tokens en el bloque `@theme` de `frontend/src/design-system/tokens/institutional-tokens.css` (o eliminar las utilidades y usar `--color-border`/`--color-card`); mantener overrides de impresión. Decisión de implementación de hs-frontend.
- **Criterio de cierre**: build CSS contiene las utilidades o ya no se usan; captura manual en claro/oscuro (pendiente de inspección).

## HS-UX-03 · Atajos anunciados F2/F4/F6/F8 sin implementación; hook de atajos huérfano — P1

- **Estado**: CONFIRMADO (estático).
- **Evidencia**
  - Catálogo: `frontend/src/lib/shortcuts.ts:42` (F6 POS), `:58` (F2 caja), `:63` (F4 nueva factura), `:68` (F8 reimprimir última).
  - Búsqueda de handlers `F2/F4/F6/F8`: solo aparecen en `lib/shortcuts.ts` y en tests de catálogo/ayuda (`HelpView.test.tsx:42` espera ver F6). No hay `keydown` que los implemente.
  - `frontend/src/hooks/useKeyboardShortcuts.ts:16` no se usa en ninguna pantalla (solo su test).
  - La paleta de ayuda/atajos los muestra al operador (`keyboard-shortcuts-palette.tsx:19-94`; `HelpView`).
- **Justificación**: el operador memoriza teclas que no responden; la ayuda contradice el comportamiento. Impacta confianza y capacitación.
- **Impacto**: P1 operativo de bajo riesgo de implementación.
- **Propuesta**: implementar las teclas donde aplique (F4 global a POS, F2 solo en caja, F6 foco de escaneo en POS, F8 última factura en historial) o retirarlas del catálogo y la ayuda. Mantener una única fuente (`shortcuts.ts`) y test que garantice catálogo ↔ handlers.
- **Dueños**: hs-frontend.
- **Criterio de cierre**: no existe atajo listado sin handler ni handler sin listar; ayuda actualizada.

## HS-UX-04 · Lista móvil de usuarios sin estado vacío — P2

- **Estado**: CONFIRMADO.
- **Evidencia**: `frontend/src/features/admin/components/UsersTable.tsx:28` renderiza `<ul>` sin mensaje cuando `users.length === 0`; el caso escritorio sí maneja vacío (`:30`).
- **Justificación**: en móvil, una búsqueda sin coincidencias deja un panel en blanco sin explicación ni acción.
- **Impacto**: P2 (claridad).
- **Criterio de cierre**: móvil muestra título/causa ("Sin coincidencias ...") igual que escritorio.

## HS-UX-05 · Gates E2E de accesibilidad/rutas desalineados con la UI actual — P1 (relacionado con F024)

- **Estado**: CONFIRMADO (estático; no ejecutable por restricción de navegador).
- **Evidencia**
  - `/settings/institutional-receipts` esperada (`accessibility.spec.ts:173`) vs redirección actual (`AppRoutes.tsx:244-247`).
  - `/backups` esperada con h1 "Respaldos|Backups" (`accessibility.spec.ts:171`) vs actual "Protección y recuperación" (`BackupsView.tsx:167`).
  - `/login` esperada con h1 del hospital (`accessibility.spec.ts:368`) vs actual h1 "Iniciar sesión" (`LoginView.tsx:93`).
  - `settings-flow.spec.ts:49-56` espera h1 exacto "Configuración" y pestaña "Marca" vs actual "Configuración hospitalaria" (`FiscalSettingsView.tsx:64`) y pestañas Resumen/Hospital/Numeración/Operativa (`:79-82`).
- **Justificación**: sin alinear rutas/encabezados, cualquier corrida futura del gate (cuando haya autorización) fallará por expectativa, no por regresión; y el inventario de pantallas queda contradictorio.
- **Impacto**: P1 de proceso (bloquea certificación de la matriz a11y).
- **Propuesta**: al definir la ruta canónica de recibos (HS-UX-01) y los encabezados finales, actualizar specs como código (hs-qa dueño de `frontend/e2e/**`; PROMPT_MAESTRO permite corregir specs sin ejecutar). No cambiar etiquetas a PASSED ni desactivar assertions.
- **Criterio de cierre**: lista de expectativas ruta↔h1 coincide con `AppRoutes.tsx` y las vistas; documentado en `hospital-ai/progreso/PRUEBAS.md` por el coordinador.

## HS-UX-06 · Diálogos de motivo duplicados e inconsistentes — P2 (mejora justificada)

- **Estado**: CONFIRMADO.
- **Evidencia**
  - Historial: `LocalConfirmDialog` con motivo obligatorio ≥5 y retorno de foco (`InvoiceHistoryView.tsx:1104-1182`).
  - Catálogo: `ConfirmDialog` con prop `requireReasonTextarea` declarada (`CatalogView.tsx:436`) pero no consumida; siempre renderiza textarea (`:443-444`).
  - Usuarios: `UserStatusToggleDialog` con motivo; Caja: diálogos propios; POS: `AlertDialog` de limpieza sin motivo.
- **Justificación**: cuatro implementaciones del mismo patrón divergen en validación, foco y semántica; el prop muerto invita a errores futuros. No es un bug visible hoy, pero sí deuda que el rediseño puede cerrar sin cambiar contratos.
- **Impacto**: P2 (mantenibilidad/consistencia).
- **Propuesta**: un único `ConfirmReasonDialog` en `frontend/src/design-system/patterns/` usado por catálogo, historial, caja y usuarios, con motivo mínimo configurable y restauración de foco; no tocar la lógica de negocio.
- **Dueño**: hs-frontend (patrones compartidos bajo su ownership).

## HS-UX-07 · Permiso `receipt_settings.view` sin superficie alcanzable — P2

- **Estado**: CONFIRMADO (estático).
- **Evidencia**: `frontend/src/app/useHospitalSession.ts:46` mapea `receipt_settings.view` (y nadie lo consume: `canViewReceiptSettings` solo alimenta `hasAnyOperationalPermission` `:261`); el guard de `/settings/fiscal` exige `settings.fiscal.view` | `settings.operational.update` (`appNavigation.ts:165-168`), por lo que un usuario con solo `receipt_settings.view` no puede entrar a ninguna configuración.
- **Justificación**: el rol de solo-receptores no tiene camino a su tarea; es la otra cara de HS-UX-01.
- **Impacto**: P2 (coherencia permisos↔superficie).
- **Propuesta**: al decidir HS-UX-01, definir el guard del destino (p. ej. `receipt_settings.view` para la sección de recibos) y no exigir permisos fiscales para consultar recibos; no cambiar reglas backend.
- **Criterio de cierre**: una cuenta de prueba con solo `receipt_settings.view` llega a la configuración de recibos y ve solo lectura.

## HS-UX-08 · Validación del POS sin foco en el campo a corregir (carrito vacío) — P2

- **Estado**: CONFIRMADO.
- **Evidencia**: `frontend/src/features/invoices/hooks/useNewInvoiceValidation.ts:48-52` publica alerta "Seleccione al menos un servicio..." sin mover el foco a la búsqueda; en cambio el error de paciente sí enfoca (`:42-46`).
- **Justificación**: el estándar del repo (NHS/GOV.UK citado en `docs/ux/2026-07-15-...:83-90`) pide llevar al usuario al punto de corrección; con teclado, `Ctrl+Enter` con carrito vacío deja al operador sin acción guiada.
- **Impacto**: P2 (eficiencia del cajero).
- **Propuesta**: enfocar el buscador de servicios (o el primer ítem faltante) al fallar esa validación; mantener la alerta.
- **Dueño**: hs-frontend.

---

## Relaciones con hallazgos existentes (no duplicar)

| Hallazgo existente | Relación |
|---|---|
| F002 / F012 / F024 | HS-UX-01 y HS-UX-05 los complementan con evidencia de UI/rutas; ownership hs-receipts/hs-qa |
| F033 (rutas informativas sin gate) | `/support`, `/help`, `/about` sin `PermissionGate` (`AppRoutes.tsx:266-289`); decisión de hs-security, el contrato UX solo exige que no expongan datos sensibles |
| F019 / HS-BK-KEY / PROMPT §7F | Contrato de Respaldos (ADM-2) exige no afirmar copia/recuperación no verificada |
| HS-PRINT-DELIVERY | Contrato de reimpresión (HIST-6) exige no equiparar evento digital con salida física de papel |
| F030 (`receipts.void` sin operación) | No se detectó superficie UI asociada; sin contrato UX nuevo |
