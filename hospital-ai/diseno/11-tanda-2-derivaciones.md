# Tanda 2 — Derivaciones de hs-ux a hs-frontend, hs-receipts y hs-qa

Base: contratos 02-08 y hallazgos `10-hallazgos-hs-ux.md`. Ownership vigente: `hospital-ai/progreso/OWNERSHIP.json` (AppRoutes/tokens/shell → hs-frontend; receipt-settings → hs-receipts; e2e → hs-qa).
Regla: hs-ux no edita `frontend/**`; estas listas son propuestas con evidencia y criterio de aceptación. Un solo escritor por archivo.

## 1. Orden recomendado (respeta dependencias)

### Bloque A — Decisiones habilitantes (coordinador + hs-receipts)
1. **Ruta canónica de recibos** (HS-UX-01): elegir sección dentro de Configuración o ruta propia; definir guard (`receipt_settings.view`). Consecuencia directa para `AppRoutes.tsx`, `appNavigation.ts`, `FiscalSettingsView.tsx` y specs E2E (F024).
2. **Confirmar destino de `InstitutionalReceiptSettingsView`**: reutilizar la vista existente (878 líneas) o extraer sus secciones; no reescribir dos formularios.
3. **Aceptar o rechazar registro de tokens operativos** (HS-UX-02) para que hs-frontend aplique en un solo commit de tokens.

### Bloque B — hs-frontend (rediseño operativo)
Orden por riesgo y dependencia. Cada ítem indica archivos y criterio.

| # | Cambio | Archivos principales | Aceptación | Hallazgo |
|---|---|---|---|---|
| B1 | Conectar ruta de recibos y eliminar enlace circular + migas autorreferentes | `AppRoutes.tsx`, `navigation/appNavigation.ts`, `features/settings/FiscalSettingsView.tsx` | enlace navega a pantalla funcional; sin ciclos; guard coherente | HS-UX-01/07 |
| B2 | Registrar/limpiar tokens operativos y declaración de fuente IBM Plex muerta | `design-system/tokens/institutional-tokens.css`, `styles.css`, usos listados en HS-UX-02 | build CSS coherente; sin utilidades fantasma | HS-UX-02 |
| B3 | Atajos: implementar F2/F4/F6/F8 o retirarlos del catálogo/ayuda; eliminar hook huérfano | `lib/shortcuts.ts`, `hooks/useKeyboardShortcuts.ts`, POS/caja/historial, `HelpView` | catálogo = handlers; un test lo garantiza | HS-UX-03 |
| B4 | POS: foco guiado al fallar validación de carrito; conservar recuperación y doble submit | `features/invoices/hooks/useNewInvoiceValidation.ts`, `NewInvoiceView.tsx` | `Ctrl+Enter` con carrito vacío enfoca búsqueda; no se pierde nada | HS-UX-08 |
| B5 | Historial: revisar densidad/primera ventana a 1366x768; conservar etiquetas de estado textuales; no cambiar política de acciones | `features/invoices/InvoiceHistoryView.tsx`, `history/*` | contrato HIST-10 | — |
| B6 | Caja: primera ventana del arqueo/cierre; conservar bloqueos y clasificación de errores | `features/cash/*` | contrato CAJA-9 | — |
| B7 | Configuración: consistencia de pestañas, guard sticky y estado sucio; alinear títulos si se decide ruta canónica | `features/settings/*` | contrato SET-1 | HS-UX-05 |
| B8 | Usuarios: estado vacío móvil; guard de doble submit en alta/edición; matriz de permisos navegable | `features/admin/components/UsersTable.tsx`, `UsersView.tsx`, `UserFormDialog.tsx` | HS-UX-04; contrato ADM-1 | HS-UX-04 |
| B9 | Unificar diálogo de motivo (historial/catálogo/caja/usuarios) | `design-system/patterns/` nuevo componente + consumidores | un solo patrón, foco restaurado | HS-UX-06 |
| B10 | Shell: verificar skip link, retorno de foco, overlay mobile y tour filtrado por permisos | `shell/*`, `features/onboarding/GuidedTour.tsx` | contrato SHELL-1/3 | — |
| B11 | Informes: paridad gráfico/tabla, deltas con signo y texto, primera ventana | `features/reports/*` | contrato REP-7 | — |

### Bloque C — hs-receipts
- C1. Vista de recibos: montar/reemplazar por la decisión de Bloque A; separar edición administrativa de acciones del cajero (PROMPT §7C).
- C2. Reimpresión: mantener etiqueta "Imprimir recibo" vs "Reimprimir"; motivo humano obligatorio en todas las rutas; contador visible; no falsificar primera impresión (HIST-6; F012; HS-PRINT-DELIVERY).
- C3. Copias ORIGINAL/PRIMERA COPIA/SEGUNDA COPIA: UI de perfil de entrega explícita, sin sobrescribir perfiles activos existentes.
- C4. Recuperación `receipt_outcome=recovery_required`: conservar mensaje y camino desde Historial; nunca cobrar de nuevo.

### Bloque D — hs-qa (specs, sin ejecutar navegador)
- D1. Alinear `routeExpectations` y encabezados con la decisión de Bloque A y el código final (HS-UX-05; F024).
- D2. Corregir expectativas de `/backups`, `/login` y `settings-flow.spec.ts` (pestañas/títulos) según el rediseño, sin rebajar assertions.
- D3. Mantener la matriz de viewports y axe como gate; no quitar suites ni marcar PASSED sin ejecución.

## 2. Qué NO debe cambiar en Tanda 2 (contratos intocables)

- Aritmética de dinero y reglas de redondeo: el frontend solo previsualiza (`AGENTS.md`; `posMath.ts` ya opera en centavos).
- Idempotencia, locks, snapshots, auditoría y numeración: los refs y claves de idempotencia actuales se conservan (POS-5, HIST-5/7, CAJA-3/5).
- Regla EPO: sin descuentos/exenciones nuevas; el flag raíz `dialysis_prescription` no se mueve.
- Semántica de reimpresión y contador persistente.
- Bloqueo de cierre de caja con pendientes/recibos pendientes.
- Sin QR/códigos en recibo institucional; sin fabricar sellos/firmas.
- Sin agregar dependencias visuales fuera de Tailwind/Radix/shadcn ya presentes.

## 3. Evidencia que hs-frontend debe adjuntar al cerrar B1-B11

- `npm run typecheck`, `npm run lint`, `npm run test` (si el entorno lo permite; declarar si no).
- Lista de archivos tocados y capturas manuales permitidas si el usuario las autoriza; si no, declarar la verificación visual como pendiente en `hospital-ai/progreso/VISUAL.md` (coordinador).
- Para cada pantalla del contrato: confirmación de estados implementados (carga/vacío/error/éxito/largos) y de la diferenciación no-solo-color.

## 4. Bloqueos o decisiones externas detectadas

| Tema | Tipo | Quién decide |
|---|---|---|
| Ruta canónica de recibos | Técnica/UX con impacto en specs | Coordinador + hs-receipts |
| Número de copias a imprimir por puesto | Decisión hospitalaria (no inventar) | Hospital; la UI debe ser configurable y explícita |
| Destino real de copia externa de respaldos | Decisión externa | Hospital; la UI no debe prometerla (ADM-2) |
| Categorías de permisos visibles en UI (F030 `receipts.void`) | Seguridad | hs-security |
| Gate de rutas informativas `/support`, `/help`, `/about` | Seguridad (F033) | hs-security; UX exige no exponer datos sensibles |
