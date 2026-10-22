# REVISION_IDENTIDAD — ¿la identidad nueva se aleja de R2?

**TASK_ID:** T-UX-02 · **Autor:** hs-ux · **Fecha:** 2026-09-18
**Raíz:** `C:\Projects\S_Hospital_AI` (worktree aislado, detached).
**Skills aplicadas:** `better-ui` (`surfaces.md`, `animations.md`, `icons.md` leídas) y `emil-design-eng`, cargadas con la herramienta nativa `skill`.
**Contrato de destino:** `hospital-ai/diseno/IDENTIDAD_DEV.md` + `hospital-ai/diseno/CONTRATOS_PANTALLA.md`.

**Alcance de esta revisión:** ahora **existe** el código de la identidad nueva
(`frontend/src/design-system/ledger/**`, `frontend/src/shell/ledger/**`,
`frontend/src/features/{cobrar,resumen,recibos,caja,reportes,administracion}/**`).
Esta T-UX-02 se hace **leyendo el código**; **no hay navegador conectado a la
sesión**, por lo que no hay capturas nuevas ni medición renderizada. La revisión
T-UX-01 (solo contrato) queda como histórico del mismo archivo; se sustituye por
evidencia de código real.

## 0. Qué es "Antes" y qué es "Después" aquí

- **Antes** = identidad R2 (rechazada), con render inspeccionado en T-UX-01
  (`hospital-ai/evidencia/R2-UX-01/despues/`) y medidas en `BEFORE_RENDER_R2.md`.
- **Después** = identidad "Libro de Caja" **implementada**, verificada **por
  lectura de código** (`ruta:línea`). La composición renderizada, el zoom 200 %,
  el contraste medido con herramienta, `prefers-reduced-motion` real e impresión
  **no se verifican aquí** (ver `hospital-ai/evidencia/T-UX-02/INFORME.md`).

## 1. Tabla `Antes | Después | Principio | Evidencia`

| Antes (R2, inspeccionado/medido) | Después (código "Libro de Caja") | Principio | Evidencia |
|---|---|---|---|
| Riel lateral de iconos de 256 px permanente; drawer móvil de iconos. | `LedgerShell` monta barra superior horizontal; `TopLedgerBar` pinta secciones como texto con `border-b-2` en la activa (`aria-current`). Sin riel en el shell renderizado. | better-ui › una sola dirección de acción; `IDENTIDAD_DEV.md` §Navegación. | `frontend/src/shell/ledger/LedgerShell.tsx:48-59`; `frontend/src/shell/ledger/TopLedgerBar.tsx:71-96`. |
| El riel R2 sigue en el árbol (`InstitutionalRail`, `InstitutionalMobileNav`) con tokens `--sidebar-*` y `--rail-w: 232px` vivos. | No se importa desde `App.tsx` (solo tests lo referencian): riel **no renderizado**, pero es superficie de regresión. | Mandato §5/§6 (no conservar el riel). | `frontend/src/shell/InstitutionalShell.tsx:148,169`; `frontend/src/styles.css:209-216,299-306,287`. |
| Títulos triplicados (eyebrow + eyebrow + `h1`). | Un `h1` por superficie; la franja de contexto no repite el título. | better-ui › jerarquía; mandato §16. | `ResumenView.tsx:78-87`, `CobrarView.tsx:216-221`, `RecibosView.tsx:150-158`, `CajaView.tsx:43-51`, `ReportesFiltrosPanel.tsx:92-100`, `AdministracionView.tsx:80-89`. |
| Dashboard de tarjetas gigantes (17 tarjetas en `/reports/executive`). | Franja de métricas como texto: `LedgerMetric` con borde izquierdo y números `tabular-nums`; sin rejilla de tarjetas. | better-ui › sombra vs borde; `CONTRATOS_PANTALLA.md` §2/§6. | `frontend/src/design-system/ledger/components.tsx:115-134`; `ResumenView.tsx:118-139`; `ReporteResumen.tsx:39-68`. |
| Acento teal/verde institucional y badges `rounded-full` en toda la UI. | Paleta ledger cálida con un acento de acción naranja y violeta reservado; sellos con borde (radio 6), sin píldoras. | better-ui › concentric radius; `IDENTIDAD_DEV.md` §Paleta. | `tokens.css:16-32`; `components.tsx:301-339`. |
| Barra de contexto + `PageHeader` simultáneos (64 px). | Franja de contexto única de 32–36 px (`LedgerContextStrip`) bajo barra de 52 px. | better-ui › surfaces. | `LedgerContextStrip.tsx:93-139`; `tokens.css:53`. |
| POS: paciente 190 px, 0 filas de servicio visibles a 1366×768; líneas de 167 px. | Tres zonas en una vista, líneas de 44 px (`--led-row-h`), total móvil fijo (`sticky bottom-0`). | Emil › densidad/percepción; `CONTRATOS_PANTALLA.md` §3.2. | `CobrarView.tsx:233-311`; `tokens.css:56`; `components.tsx:546-553`. |
| Diálogo de 30 líneas sin scroll dejaba acciones fuera del viewport. | `LedgerDialog` con `max-h-[85vh] overflow-y-auto`; confirmación con cuerpo scrolleable; acciones al final. | Emil › evita cortes de interfaz. | `ConfirmDialog.tsx:59-87`. |
| Estados ausentes/mezclados; error como `L 0.00`. | `MoneyText` devuelve `null` → "No disponible"; estados explícitos VAC/CAR/ERR/INV/SIN/SRV tipados. | better-ui › señal estática; `CONTRATOS_PANTALLA.md` §0.4. | `moneyCents.ts:113-124`; `components.tsx:202-231`; `cobrar/state/status.ts:59-254`. |
| Gratuidad como booleano que teñía toda la factura. | Regla por línea: `lineIsFree` exige `dialysisPrescription === true` **y** medicamento elegible; etiqueta textual violeta reservada. | mandato §8; precisión sobre estética. | `cobrar/state/domain.ts:12-19,56-73`; `AccountZone.tsx:57-62`; `FreeMedicationBadge` `components.tsx:318-339`. |
| Foco heredado 2,15:1 (<3:1). | Anillo 2 px `--led-focus` con offset 2 px en `.ledger-root`; los portales usan el anillo institucional (ver H-05). | better-ui › foco visible. | `tokens.css:82-86`; `cobrarUi.ts:3-8`. |
| `--press-scale` sin consumidores; press por `translate-y-px`. | `scale(0.96)` en `:active` con transición 140 ms y desactivación en `motion-reduce`. | better-ui › scale on press. | `tokens.css:90-106`; `cobrarUi.ts:8-10`; `recibosUi.ts:16-20`. |

**Contraste de tokens (computado, no medido en navegador).** Pares texto/fondo
AA ≥ 4,5:1 y foco ≥ 3:1: `ink/paper 15,43` · `ink/surface 17,40` · `ink-soft/paper 6,07`
· `ink-soft/surface 6,85` · `white/action 5,56` · `white/navy 12,85` ·
`focus/surface 12,85` · `focus/paper 11,39`. Todos cumplen por cálculo WCAG.
**No verifica** el render (antialiasing/opacidades reales) ni `bg-*/opacity`.

## 2. Hallazgos concretos (severidad · ubicación · por qué)

Formato `better-ui`. Severidad HIGH = rompe una interacción/queda fuera del
mandato; MEDIUM = inconsistencia visible de superficies/tokens; LOW = pulido.

| Sev. | Ubicación | Hallazgo | Por qué importa |
|---|---|---|---|
| **HIGH** | `frontend/src/features/auth/PasswordChangeView.tsx:5-12,37-81` | La pantalla **obligatoria** de cambio de contraseña (justo tras login) es R2 completo: `Card`, `Badge`, `Button`, `Alert`, `Field`, `InputGroup`, `Separator`, `bg-muted/30`, `border-primary/20`, `text-primary`. No usa ni un token `--led-*`. | La identidad nueva no cubre un paso bloqueante del flujo; contradice "no hereda R2". Es la prueba de que **no** es R2 solo re-tematizada, pero la cobertura es parcial. |
| **HIGH** | `frontend/src/features/recibos/RecibosView.tsx:304-355` → `features/invoices/components/PaymentModal.tsx:3-6,240-441`; `features/invoices/history/InvoiceHistoryReceiptDialog.tsx:3-4,41-70`; `features/invoices/history/InvoiceHistoryActionDialogs.tsx:3,66-203` → `design-system/patterns/ConfirmReasonDialog.tsx:2-4,76-138` | El **cobro de saldo, la impresión y la anulación/reversa** de Recibos se renderizan con primitivos shadcn y tokens institucionales (`bg-card`, `bg-muted`, `text-primary`, `text-destructive`, `Button`), no con ledger. La acción monetaria más sensible de la pantalla es R2. | `CONTRATOS_PANTALLA.md` §0.2 permite primitivos **debajo** de ledger, no como lenguaje principal. La identidad no controla sus overlays críticos. |
| **HIGH** | `frontend/src/design-system/ledger/components.tsx:544-564` | `LedgerTable` con `onRowClick` pinta `cursor-pointer` y click de ratón, pero **no** añade `tabIndex`, `role`, `onKeyDown` ni activación con Enter/Espacio. | `CONTRATOS_PANTALLA.md` §4/§0.5 exigen fila activable por teclado. Un usuario de teclado no puede abrir el detalle desde la fila (solo desde un botón interno). |
| **MEDIUM** | `recibosUi.ts:16` (navy) vs `cobrarUi.ts:8` (naranja) vs `components.tsx:458` (navy) vs `ReportesFiltrosPanel.tsx:276-279` (shadcn = institucional/teal) | Hay **tres "botones primarios" distintos**: acción naranja en Cobrar/Login, navy en Recibos/Ayuda/búsqueda, e institucional en Reportes. | `CONTRATOS_PANTALLA.md` §0.2: "un solo acento de acción". La jerarquía de acción no es estable entre pantallas. |
| **MEDIUM** | `administracion/AdministracionView.tsx:104-135`; `catalog/CatalogView.tsx:5-11,21,322`; `admin/UsersView.tsx:10-20`; `settings/FiscalSettingsView.tsx`; `receipt-settings/InstitutionalReceiptSettingsView.tsx`; `backups/BackupsView.tsx`; `cash/CashBoxView.tsx:447,457,478` | Caja y Administración **envuelven vistas R2**: `PageHeader` (eyebrow + `--type-h1`), `Card`, `Badge`, `Accordion rounded-lg bg-card`, `rounded-xl shadow-xs`, `bg-muted`, `text-primary`. El shell ledger se monta sobre pantallas heredadas. | Es la brecha de identidad más grande: la composición nueva vive en el encabezado, el trabajo sigue en R2 (tarjetas/pills), justo lo que el mandato prohíbe. |
| **MEDIUM** | `styles.css:82-86` + `components/ui/dialog.tsx:56-82` | Los tokens `--led-*` viven en `.ledger-root`, pero Radix **portalea a `body`**: el `DialogContent` usa `bg-popover`, `rounded-xl`, `ring-foreground/10`, `text-popover-foreground` y foco global institucional. Incluso `LedgerDialog`/`ConfirmDialog` heredan superficie R2 en el portal. | El overlay de confirmación de cobro no usa la superficie ledger; sin navegador no puedo medir cuánto difiere visualmente (tarea de `hs-qa`). |
| **MEDIUM** | `tokens.css:15-71` (sin bloque `.dark`) + `hooks/useTheme.ts:27-49` | El ledger es light-only: no reacciona a `.dark`. Con tema oscuro, la app queda clara en `.ledger-root` y los overlays portaleados cambian a oscuro. | `IDENTIDAD_DEV.md` §Paleta dice "light-first", pero el toggle R2 existe; la mezcla de temas es una inconsistencia visible. Requiere navegador para confirmar severidad real. |
| **MEDIUM** | `cobrar/components/AccountZone.tsx:79-90` (y `RecibosFilters.tsx:86-103,105-123`) | `aria-invalid` en cantidad no lleva **texto de error** ni `aria-describedby`; los `hint` de `LedgerField` no se asocian programáticamente al input. | `CONTRATOS_PANTALLA.md` §0.4 (`INV`) exige error con texto útil, no solo borde rojo. |
| **MEDIUM** | `resumen/ResumenView.tsx:249-252` | `toCents` usa `Number(value)` en vez del `parseCents` canónico; `Number('')`/`Number(' ')` es `0`, así que un valor vacío se muestra como `L 0.00`. | `moneyCents.ts:17-24` prohíbe "un dato mal formado disfrazado de cero". Riesgo de error-como-cero (latente). |
| **MEDIUM** | `components.tsx:509-514` + `components.tsx:53` | `LedgerTable` (radio 8) se anida en `LedgerPanel` (radio 8) con `p-4` (16 px). | `surfaces.md`: `radio_exterior = interior + padding`; con delta de tokens 6/8/10 el anidamiento no puede ser concéntrico. Tensión visible en las tablas. |
| **MEDIUM** | `auth/LoginView.tsx:130-132` vs `:106-108` | El panel de identidad pinta el nombre desde branding (`hospitalName`) pero el pie **hardcodea** "Hospital General San Isidro · uso interno autorizado" (y la dirección "Tocoa, Colón, Honduras" en `:117`). | Dos fuentes de identidad institucional en la misma pantalla; un cambio de ajustes no actualiza el pie. (Los literales coinciden con el fallback del backend, no son inventados.) |
| **LOW** | `auth/LoginView.tsx:113-140` | El `h1` es "Libro de caja hospitalario" (identidad) y la acción vive en `h2` "Iniciar sesión". | `CONTRATOS_PANTALLA.md` §1 pide `h1` = "Iniciar sesión". Desviación de jerarquía menor. |
| **LOW** | `tokens.css:64-65,68-69` | `--led-ease-in-out`, `--led-ease-drawer`, `--led-duration-overlay-in/out` no tienen consumidores en `frontend/src` (solo definición). | Tokens sin uso = deuda; el contrato pide tokens reutilizables, no declarativos. |
| **LOW** | `resumen/ResumenView.tsx:127-131` | El fallback "No disponible" de una métrica se pinta con `--led-text-base` dentro de un contenedor de `--led-text-metric`. | Salto de altura/layout al pasar de valor a fallback. |

### 2.1 Respuesta directa a "¿es R2 re-tematizada?"

**Parcialmente.** El **shell** (`TopLedgerBar`/`LedgerContextStrip`), **Cobrar**
(las tres zonas + confirmación), **Resumen**, **Recibos** (tabla/panel/filtros) y
**Reportes** (resumen/tablas) son composición ledger genuina: navegación de
texto, subrayado activo, `MoneyText` con fallback, sellos sin píldoras, estados
tipados y `scale(0.96)`. Pero **PasswordChange, los overlays monetarios de
Recibos, Caja y todo Administración** siguen siendo R2 (tarjetas, pills,
institucional teal, `PageHeader`), y el **portal de Radix** saca los diálogos del
`.ledger-root`. La identidad no es un re-tema del verde, pero **tampoco está
aplicada de forma uniforme**: convive con la capa semántica R2 que sigue viva en
`styles.css:233-311`.

## 3. Veredicto (declarado)

- **Dirección:** el código nuevo **se aleja de R2** en el shell, la navegación,
  la tipografía/figuras de dinero y la superficie de Cobrar/Resumen/Reportes —
  verificado por código.
- **No hay aprobación visual:** no se renderizó, no se midió contraste con
  herramienta, no se probó zoom 200 %, `prefers-reduced-motion` real, foco
  renderizado ni impresión. **No se aprueba por cantidad de tests.**
- **Bloqueo para aprobar:** los hallazgos **HIGH** (PasswordChange R2, overlays
  monetarios de Recibos R2, filas de tabla sin teclado) y la ausencia de
  inspección renderizada. Veredicto: **`Block`** para "identidad lista"; el
  estado de comprobación queda **`Not verified`** en lo visual.
