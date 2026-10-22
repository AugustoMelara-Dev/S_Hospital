# REVISION_SKILLS — Auditoría de conformidad `better-ui` + `emil-design-eng`

- **Tarea**: T-UX-03
- **Fecha**: 2026-09-19
- **Raíz**: `C:\Projects\S_Hospital_AI` (worktree aislado, detached)
- **Ámbito de escritura**: `hospital-ai/diseno/**`, `hospital-ai/evidencia/T-UX-03/**`
- **Naturaleza**: revisión **estática de código** apoyada en los PNG ya existentes en
  `hospital-ai/evidencia/VISUAL/` (generados por Playwright contra mock sintético).
  **No es aprobación visual de píxeles en vivo** ni del dueño/hospital. Ver
  `hospital-ai/evidencia/T-UX-03/INFORME.md` para el límite exacto de lo verificado.
- **Skills cargadas**: `better-ui` (surfaces/animations/enter-exit/icon-transitions/icons/performance)
  y `emil-design-eng`.

## Método

1. Carga de las dos skills y lectura de sus referencias.
2. Lectura de `frontend/src/AppRoutes.tsx` y `frontend/src/navigation/ledgerNavigation.ts` para fijar
   las superficies activas.
3. Barrido con `grep` de anti-patrones en `frontend/src`: `transition: all`,
   `transition-all`, `will-change`, `scale(0)`, `@keyframes`, `ease-in`, `active:scale`,
   `prefers-reduced-motion`, imports de `@/components/ui/*`, clases semánticas R2
   (`text-primary`, `text-muted-foreground`, `bg-card`, `border-border`, `ring-ring`, …),
   `strokeWidth`/`data-icon`, y uso real de tokens `--led-*`.
4. Lectura completa de las vistas enrutadas y de los componentes que éstas renderizan
   (grafo de imports, no solo el nombre del directorio).
5. Contraste con PNG 06 (Caja), 07 (Reportes) y 08 (Catálogo) ya presentes.

**Hechos base verificados**: no existe `transition: all` ni `transition-all` en producción
(solo en la aserción del contrato `design-system/tokens/styles-contract.test.ts:30`); no existe
`will-change` en ninguna superficie; no existe `scale(0)`; no existe `@media (hover:hover) and (pointer:fine)`
en ningún archivo.

---

## Hallazgos

Severidad según `better-ui`: `HIGH` rompe una interacción o deja un estado visible solo mientras
corre la animación; `MEDIUM` es inconsistencia visible de superficie/icono/movimiento;
`LOW` es pulido aislado. **No se encontró ningún `HIGH`.**

| Severidad | Superficie | Ubicación | Antes | Después propuesto | Principio (skill) | Impacto |
|---|---|---|---|---|---|---|
| MEDIUM | Caja | `frontend/src/features/cash/CashBoxView.tsx:33-39,445,476,496-503,680-690` | `Alert`/`Badge`/`Button`/`Dialog`/`Empty`/`Input`/`Spinner` R2 y `Badge variant="default"` (primario teal) | `LedgerPanel`/`LedgerCallout`/`StatusStamp` + tokens `--led-*` | Identidad ledger (better-ui/surfaces) | PNG 06 muestra una píldora **teal** ("Caja abierta") junto a la acción naranja y a la tinta navy; dos lenguajes visuales en una sola pantalla |
| MEDIUM | Caja — subpaneles | `features/cash/components/CashMethodSummary.tsx:11`, `CashMovementsTable.tsx:35`, `SessionSummary.tsx:25`, `OpenSessionForm.tsx:21-22`, `CashClosingPanel.tsx:73-75`, `CashDenominationCounter.tsx:90`, `CloseSessionDialog.tsx:121-140,377` | `rounded-xl border-border bg-card shadow-xs` + `text-muted-foreground`/`text-primary`/`text-warning-foreground` | `rounded-[var(--led-radius-panel)] border-[var(--led-line)] bg-[var(--led-surface)]` y tokens ledger de tinta/aviso | Radios concéntricos y sombra vs borde (better-ui/surfaces) | El área operativa de Caja sigue siendo "tarjetas R2" anidadas en el shell ledger |
| MEDIUM | Caja — arqueo | `frontend/src/modules/accounting/components/AccountingControlPanel.tsx:3-5,132` | `Alert`/`Card`/`Button` R2 + `hover:bg-accent/20` | Panel/callout/acción ledger | Identidad ledger | Tercera identidad dentro de Caja |
| MEDIUM | Reportes | `features/reportes/components/ReportesFiltrosPanel.tsx:2-5,276-288`, `ReportesView.tsx:191,209`, `components/ReporteTablas.tsx:13,48` | `Button`/`Field`/`Input`/`Select` R2 (alto `h-8` = 32 px, foco `ring-ring` teal) | Clases de control ledger (`--led-control-h` 36 px, `--led-focus`, acento de acción) | Identidad + geometría (better-ui/surfaces) | PNG 07: el botón "Aplicar" se pinta **teal** en una identidad de acento naranja; los controles miden 32 px frente a los 36 px ledger |
| MEDIUM | Recibos — diálogo de comprobante | `features/invoices/history/InvoiceHistoryReceiptDialog.tsx:3,45` + `features/receipts/ReceiptPreview.tsx:3-6,79-98,306` + `features/receipts/InstitutionalReceiptPreviewFrame.tsx:2-4,33,38` | `Dialog`/`Card`/`Button`/`Alert`/`Badge` R2 + `border-border bg-muted/20` dentro de un contenedor ya ledger | Panel/callout/botones ledger y contenedor de vista previa con tokens `--led-*` | Identidad ledger | El diálogo se abre en ledger y su cuerpo revierte a R2 |
| MEDIUM | Overlays ledger (cobro/confirmación/éxito) | `features/invoices/components/PaymentModal.tsx:3`, `InvoiceConfirmation.tsx:3`, `InvoiceSuccess.tsx:4` + `components/ui/dialog.tsx:62,68-80` | El `DialogContent` R2 inyecta su botón de cierre `Button variant="ghost"` con `<span className="sr-only">Close</span>` (inglés) y `focus-visible:ring-ring` teal | `showCloseButton={false}` y cierre ledger propio con `aria-label="Cerrar"` (como `design-system/ledger/components.tsx:775-787`) | Accesibilidad (nombre accesible) + identidad | Lector de pantalla anuncia "Close" en un producto en español; anillo de foco teal en overlay ledger |
| MEDIUM | Overlays (todos) | `design-system/ledger/components.tsx:749,758`; `components/ui/dialog.tsx:40,62`; `components/ui/sheet.tsx:38,63`; `components/ui/dropdown-menu.tsx:46` | `data-[state=open]:animate-in … zoom-in-95` / `animate-out` (keyframes de `tw-animate-css`) | Transiciones CSS sobre `opacity`/`scale` con `@starting-style` (interrumpibles) | Animaciones interrumpibles (better-ui/animations, emil) | Abrir/cerrar rápido reinicia la animación desde cero; no es retargeteable |
| MEDIUM | Overlays (todos) | `design-system/ledger/components.tsx:749-758`; `components/ui/dialog.tsx:40,62`; tokens `design-system/ledger/tokens.css:72-73`, `design-system/tokens/institutional-tokens.css:66-67` | Enter y exit con la **misma** duración (`duration-100`; sin duración explícita en `LedgerDialog`); `--led-duration-overlay-in:200ms`/`-out:150ms` declarados y **sin consumidor** | Exit con `transition-duration:var(--led-duration-overlay-out)` y enter con `--led-duration-overlay-in` | Exits más rápidos que enters; transición por propiedad (better-ui/enter-exit, performance) | Las salidas no son más suaves que las entradas; tokens muertos |
| MEDIUM | Todas las superficies con hover | `features/recibos/recibosUi.ts:16-24`, `features/invoices/history/ledgerOverlayUi.ts:46-60`, `features/cobrar/components/cobrarUi.ts:8-12`, `features/catalog/components/catalogUi.ts:23-31`, `features/admin/adminUi.ts:22-30`, `features/settings/settingsUi.ts:17-19`, `features/backups/backupsUi.ts:10-16`, `features/receipt-settings/receiptLedgerUi.ts:23-27`, `shell/ledger/TopLedgerBar.tsx:91,158`, `features/administracion/AdministracionView.tsx:40` | `hover:` plano (sin media query) | Envolver los estados hover en `@media (hover: hover) and (pointer: fine)` | Hover en táctil (better-ui, emil) | En tablet, tocar deja un hover "pegado" hasta el siguiente toque |
| MEDIUM | Feedback de presión | `design-system/ledger/tokens.css:146-156` (`[data-ledger-press]`) vs `components/ui/button.tsx:8` (`active:not-aria-[haspopup]:translate-y-px`) | Dos lenguajes de press: `scale(0.96)` ledger donde se agrega `data-ledger-press`, `translate-y-px` en R2 | `active:scale-[0.96]` como único feedback en pressables ledger | Scale on press 0.96 (better-ui/animations) | Feedback táctil distinto entre control ledger y control R2 |
| LOW | Cobro | `features/invoices/components/PaymentModal.tsx:503` | Icono `Printer` en el botón "Cobrar …" | `Banknote` o `CircleCheck` | Icono contextual = acción (better-ui/icons) | El botón de cobro se lee como impresión |
| LOW | Iconografía global | `styles.css:55-65` (`[data-icon]`) vs 46 usos explícitos de `strokeWidth={1.5}` (p. ej. `features/cobrar/components/AccountZone.tsx:82,101,140`) | Dos mecanismos para el grosor de icono | Un solo mecanismo (token `[data-icon]` o `strokeWidth` explícito) | Un set / stroke acorde al peso (better-ui/icons) | Deriva de mantenimiento; los iconos sin `data-icon` quedan en 2 px por defecto |
| LOW | Caja — drawer de movimientos | `components/ui/sheet.tsx:63` | `transition duration-200 ease-in-out` (propiedad genérica) + keyframes `slide-in-from-*` | Propiedades exactas + `--led-ease-drawer`, transición interrumpible | Transición por propiedad / interrumpible | Drawer R2 dentro de Caja |
| LOW | `styles.css` | `styles.css:10-13` | `@keyframes fade-in` sin consumidor | Eliminar | Higiene de movimiento | Código muerto |
| LOW | i18n accesible | `components/ui/spinner.tsx:6` + `features/reportes/ReportesView.tsx:200` | `aria-label="Loading"` (inglés) sin override | `aria-hidden` + texto visible en español | Accesibilidad / idioma | Lector de pantalla anuncia en inglés |
| LOW | Legacy sin ruta viva | `features/invoices/history/InvoiceHistoryTable.tsx:3-6,93-330` (Badge/Button/`DataTable` + `text-primary`/`text-warning`), `features/invoices/components/InvoiceCart.tsx:3-8`, `features/onboarding/GuidedTour.tsx:82-101` | Primitivas R2 fuera de ruta | Migrar a ledger o eliminar | Identidad / deuda | No se renderizan en rutas activas (`RecibosView` usa `RecibosTable`; de `InvoiceHistoryTable` solo se importa el helper `issuedInstitutionalReceipt`), pero reintroduce R2 al copiar |

### Conforme verificado (sin acción)

- `styles.css:77-86`: regla global `prefers-reduced-motion: reduce` (anima/transición a `0.001ms`).
- `design-system/ledger/tokens.css:158-164`: reduced motion desactiva `scale` y transición de `[data-ledger-press]`.
- `design-system/ledger/tokens.css:140-144` y `:99-103`: foco visible 2 px con offset 2 px (`--led-focus`) en `.ledger-root` y portales.
- `design-system/ledger/components.tsx:130-182`: `LedgerField` asocia `label`/`htmlFor` y `error` con `role="alert"`.
- `design-system/ledger/components.tsx:488-589`: filas de tabla activables con Enter/Espacio y `aria-label`.
- `shell/ledger/TopLedgerBar.tsx:67-70`, `features/auth/LoginView.tsx:96-99`: `outline` negro/blanco al 10 % en imágenes (regla better-ui).
- `components/ui/dropdown-menu.tsx:46`, `popover.tsx:31`, `select.tsx:70`, `tooltip.tsx:45`: `origin-(--radix-*-transform-origin)` (popover desde el disparador); los modales conservan centro.
- `design-system/ledger/components.tsx:752-758` y `components/ui/dialog.tsx:62`: entrada desde `scale(0.95)`, nunca `scale(0)`.
- Tokens `--led-press-scale:0.96` (`tokens.css:70`) y `enabled:active:scale-[0.96]` en las clases compartidas de botón.

---

## Inventario de superficies

| Superficie (ruta real) | Estado | Nota |
|---|---|---|
| `shell/ledger/**` (TopLedgerBar, LedgerShell, LedgerContextStrip) | conforme | Barra/contexto ledger; enlaces de nav sin press (alta frecuencia, correcto) |
| `features/auth/LoginView` | conforme | Panel navy + acción naranja; sin gradiente |
| `features/auth/PasswordChangeView` | conforme | `LedgerPanel`/`LedgerField`; errores textuales |
| `features/resumen/**` | conforme | Métricas ledger y `StatusStamp` |
| `features/cobrar/**` | conforme | `ConfirmDialog` usa `LedgerDialog` |
| `features/invoices/components/{PaymentModal,InvoiceConfirmation,InvoiceSuccess}` | parcial | Cuerpo ledger; cierre R2 en inglés y keyframes (F6/F7/F8) |
| `features/recibos/{RecibosView,RecibosTable,RecibosDetailPanel,RecibosFilters,recibosUi}` | conforme | Tabla/paneles ledger; foco y press correctos |
| `features/invoices/history/{InvoiceHistoryActionDialogs,InvoiceHistoryReceiptDialog,InvoicePagination}` | parcial | Confirmaciones ledger; `InvoicePagination` es R2 y el diálogo de recibo revierte a R2 |
| `features/invoices/history/InvoiceHistoryTable.tsx` | no conforme (legacy, sin ruta) | R2 (`Badge`/`Button`/`DataTable`); no renderizado |
| `features/caja/CajaView` | conforme | Chrome ledger correcto |
| `features/cash/**` | no conforme | Paneles y estados en R2 (F1–F3); PNG 06 muestra teal |
| `features/reportes/**` | parcial | Paneles/tablas/métricas ledger; filtros y botones R2 (PNG 07 teal) |
| `features/administracion/**` (Ajustes/Mantenimiento/Ayuda) | conforme | Ledger; `AyudaView` con callouts y enlaces |
| `features/admin/UsersView` + `components/**` | conforme | `LedgerDialog`; `Select`/`DropdownMenu` R2 con overrides `ledger-portal` (revisión VISUAL anterior decía R2: ya migrado) |
| `features/catalog/**` | conforme | `LedgerTable`/`LedgerDialog`; PNG 08 ledger |
| `features/settings/**` | conforme | `settingsUi` ledger; `FiscalSettingsView` con `LedgerTabs` |
| `features/backups/**` | conforme | `backupsUi` ledger; `ToggleGroup` R2 con overrides ledger |
| `features/receipt-settings/**` | conforme | `receiptLedgerUi` ledger; `data-ledger-press` |
| `design-system/ledger/**` | conforme (con salvedad) | Tokens y componentes ledger; overlays con keyframes y tokens de overlay sin consumir (F8/F9) |
| `styles.css` | parcial | Reduced motion global correcto; `@keyframes fade-in` muerto |
| `design-system/tokens/institutional-tokens.css` | parcial | Puente shadcn con primario teal `#0f766e` que las superficies R2 heredan; `--duration-overlay-*`/`--ease-drawer`/`--ease-icon` sin consumidor |

---

## Veredicto

- **Por superficie**: conforme en 12 superficies (shell, auth, resumen, cobrar, recibos base, caja-chrome,
  administración, admin, catálogo, settings, backups, receipt-settings); **parcial** en overlays de cobro,
  historial y reportes; **no conforme** en `features/cash/**` y en el legacy `InvoiceHistoryTable`.
- **Global**: **sin `HIGH`** → no hay bloqueo por el criterio de `better-ui`. Queda trabajo `MEDIUM`
  (Caja, Reportes, overlays) y `LOW`. No se emite `Approve` porque hay cobertura no inspeccionada:
  zoom 200 %, contraste medido, Firefox/Safari e impresión física (ver `INFORME.md`).
- La presencia de tests no se usa como sustituto de aprobación visual; la única evidencia de imagen
  usada son los PNG ya existentes, y se declara cuáles se miraron y cuáles no.
