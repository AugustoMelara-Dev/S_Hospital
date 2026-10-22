# VISUAL — Revisión de interfaz (evidencia permitida)

Actualizado por hs-ux en M-W1-UX-01 (2026-09-17). Raíz: `C:\Projects\S_Hospital_AI`.
Contratos nuevos: `diseno/TOKENS_V2.md`, `diseno/CONTRATO_PANTALLAS_V2.md`, `diseno/CRITERIOS_RECIBO_V2.md`.

## Estado general

**No se inspeccionó ninguna pantalla renderizada en esta campaña.** No se abrió navegador, no se generó PDF, no se levantó backend. Todo lo de abajo es revisión estática de código + cálculo de contraste WCAG sobre hex declarados. La aprobación visual del dueño no se presume por tests ni por este documento.

## Método y límites

- Lectura directa del código del worktree (rutas, componentes, CSS, tokens) y de los contratos previos `diseno/01..11`.
- Ratios de contraste calculados con la fórmula WCAG 2.x sobre los hex declarados (script temporal en `C:\Users\melar\AppData\Local\Temp\opencode\contrast*-m-w1-ux-01.mjs`). No son medición en render.
- Cero ediciones a `frontend/src/**` o `backend/**`.

---

## A. Superficies con contrato v2 revisadas estáticamente en esta campaña

| Superficie | Contrato | Referencias verificadas | Observación |
|---|---|---|---|
| Login / cambio de clave | `CONTRATO_PANTALLAS_V2 §1` | `LoginView.tsx`, `PasswordChangeView.tsx` | `h1` 30 px en cambio de clave; sin `PageHeader` unificado |
| Operativa (Inicio) | `§2` | `DashboardView.tsx` | métricas y ledger existen; primera ventana sin verificar |
| Nueva factura / cobro POS | `§3` | `NewInvoiceViewLayout.tsx`, `InvoiceCart.tsx`, `ServiceSearch.tsx`, `BillingBottomBar.tsx` | 2 columnas ≥1280 px; total 24 px/700; `h1` en `font-bold` a migrar |
| Pago / éxito / recuperación | `§4` | `PaymentModal.tsx`, `InvoiceConfirmation.tsx`, `InvoiceSuccess.tsx` | contraste roto en `PaymentModal.tsx:249` |
| Historial / detalle / anulación | `§5` | `InvoiceHistoryView.tsx`, `InvoiceHistoryTable.tsx`, `InvoiceDetailDrawer.tsx` | estados carga/vacío/error presentes |
| Caja / arqueo / cierre | `§6` | `CashBoxView.tsx`, `CashClosingPanel.tsx`, `CashDenominationCounter.tsx` | métricas y bloqueos presentes |
| Catálogo | `§7` | `CatalogView.tsx` | diálogo de motivo propio, no unificado |
| Reportes | `§8` | `ReportsView.tsx`, `ReportsExecutive.tsx`, `ReportsCash.tsx` | títulos: "Informes y auditoría" (raíz), "Control ejecutivo" (subruta) |
| Auditoría | `§9` | `ReportsAudit.tsx` | vacío textual presente |
| Usuarios / roles | `§10` | `UsersView.tsx`, `UsersTable.tsx`, `PermissionMatrix.tsx` | vacío móvil presente |
| Configuración fiscal | `§11` | `FiscalSettingsView.tsx` | `h1` crudo a unificar con `PageHeader` |
| Configuración de recibos | `§12` | `InstitutionalReceiptSettingsView.tsx`, `ReceiptSettingsPreview.tsx`, `paperPolicy.ts` | perfiles **apaisados** vs carta vertical del mandato |
| Respaldos | `§13` | `BackupsView.tsx`, `BackupHistoryTable.tsx` | título sin la palabra "respaldos" |
| Soporte / ayuda / about | `§14` | `SupportCenterView.tsx`, `HelpView.tsx`, `AboutView.tsx` | sin `PermissionGate` (F033, hs-security) |

---

## B. Pendientes heredados (T1-004 / T2 / T3) — revalidación estática 2026-09-17

Se mantienen como **NOT VERIFIED** (sin inspección renderizada), pero su estado de código cambió:

| # | Pendiente heredado | Estado de código hoy | Evidencia |
|---|---|---|---|
| 1 | Utilidades `border-operational-border`/`bg-operational-surface` | **Corregido**: tokens operativos registrados en `@theme` | `institutional-tokens.css:112-115` |
| 2 | Contraste real claro/oscuro y 5 variantes de marca | **Pendiente de render**; cálculo WCAG hecho | `TOKENS_V2.md §3` |
| 3 | Densidad POS a 1366×768 con carrito lleno | **NOT VERIFIED** | — |
| 4 | Guard sticky de Configuración a 390×844 | **NOT VERIFIED** | — |
| 5 | Tablas a 1366 px con datos largos | **NOT VERIFIED** | — |
| 6 | Lector de pantalla en overlays y tour | **NOT VERIFIED** | — |
| 7 | Entrada condicional "Recibos institucionales" (rail/dock) | **Corregido en código** (`appNavigation.ts:317-340`), sin ver | — |
| 8 | Contraste/aria del ítem condicional | **NOT VERIFIED** | — |
| 9 | Vacío móvil de usuarios | **Corregido en código** | `UsersTable.tsx:28-31` |
| 10 | Ítem activo "Configuración" con perfil solo-recibos | **Corregido en código**, sin ver | `appNavigation.ts:178` |
| 11 | Primera ventana de arqueo/cierre e informe ejecutivo | **NOT VERIFIED** | — |
| 12 | Contraste de deltas y sticky con estado sucio | **NOT VERIFIED** | — |
| 13 | Tour "1 de 1" y retorno de foco | **NOT VERIFIED** | — |

Hallazgos `HS-UX-*` revalidados estáticamente:

| Hallazgo | Estado hoy | Evidencia |
|---|---|---|
| HS-UX-01 (ruta de recibos retirada / enlace circular) | **Corregido**: ruta montada con `PermissionGate` | `AppRoutes.tsx:252-265` |
| HS-UX-02 (tokens operativos solo en print) | **Corregido** | `institutional-tokens.css:112-115` |
| HS-UX-03 (atajos F2/F4/F6/F8 sin handler) | **Corregido**: F4 shell, F2 caja, F6 POS; F8 retirado | `InstitutionalShell.tsx:86`, `CashBoxView.tsx:249`, `useNewInvoiceShortcuts.ts:48`, `shortcuts.test.ts:108` |
| HS-UX-04 (vacío móvil de usuarios) | **Corregido** | `UsersTable.tsx:28-31` |
| HS-UX-05 (gates E2E desalineados) | **Parcial**: recibos y usuarios alineados; `/backups` sigue divergente | `accessibility.spec.ts:171` vs `BackupsView.tsx:167` |
| HS-UX-06 (diálogos de motivo duplicados) | **Parcial**: historial usa `ConfirmReasonDialog`; catálogo conserva `ConfirmDialog` propio | `InvoiceHistoryActionDialogs.tsx:63`; `CatalogView.tsx:348,425` |
| HS-UX-07 (`receipt_settings.view` sin superficie) | **Corregido**: guard y entrada condicional | `appNavigation.ts:317-340` |
| HS-UX-08 (validación POS sin foco guiado) | **Corregido**: `Ctrl+Enter` valida y enfoca búsqueda | `useNewInvoiceShortcuts.ts:61-71` |

Todas las correcciones de la tabla anterior son **de código, no verificadas en render**.

---

## C. Problemas concretos detectados o reafirmados en M-W1-UX-01

| Severidad | Ubicación | Antes | Después propuesto | Por qué |
|---|---|---|---|---|
| HIGH | `frontend/src/printing/styles/receipt-print.css:491-504` + `frontend/src/modules/receipts/paperPolicy.ts:21-50` + `backend/database/seeders/ReceiptPrintProfileSeeder.php:96-101` | Carta/A5/media carta **apaisadas** (`letter landscape`, `A5 landscape`, ratios 11/8.5, 210/148) | Carta **vertical 215.9×279.4 mm (612×792 pt)** principal y A4 210×297 configurable; conservar compatibilidad | §12: el diseño principal propuesto es carta vertical; media carta y A5 no son sinónimos |
| HIGH | `frontend/src/features/invoices/components/PaymentModal.tsx:249` | `text-primary-foreground` (blanco) sobre `bg-surface` (blanco) → texto invisible | `text-muted-foreground`; el blanco se reserva a `bg-primary` | Contraste/legibilidad en el paso de cobro |
| MEDIUM | `frontend/src/styles.css:52-54` | `[data-icon] { stroke-width: 1.75 }` global | 1.5 px junto a 400 / 2 px junto a 500–600 / 2.5 px junto a 700 | `better-ui/icons.md`: un icono fino junto a texto semibold se ve roto |
| MEDIUM | Montos con `font-mono` (`InvoiceCart.tsx:151,165,169,173,177`, `PaymentModal.tsx:267,273,278,284`, tablas de historial/caja/reportes) | Dinero en monoespaciada | Dinero en sans + `tabular-nums`; `font-mono` solo para identificadores | Alineación y cohesión tipográfica; cifras tabulares son el requisito, no mono |
| MEDIUM | `frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx:168`, `frontend/src/features/auth/PasswordChangeView.tsx:43`, `frontend/src/features/settings/FiscalSettingsView.tsx:75` | `h1` crudos (`font-bold` 24 px / 30 px) | `PageHeader` con `--type-h1` (24 px/600) | Un solo patrón de encabezado; un `h1` por ruta |
| MEDIUM | `frontend/src/styles.css:176-178` | `--radius-2xl/3xl/4xl` derivan a 18/22/26 px | `--radius-control/surface/overlay` (8/12/16) en superficies del gate | El gate E2E exige ≤16 px (`accessibility.spec.ts:452`) |
| MEDIUM | `frontend/src/printing/styles/receipt-print.css:270-276` | Encabezado de tabla con `background: #F3F4F6` | Negrita + tracking + borde inferior | §12: no consumir tinta en fondos decorativos |
| MEDIUM | `frontend/src/features/backups/BackupsView.tsx:167` | `h1` "Protección y recuperación" | `title="Respaldos"` + descripción de protección/recuperación | Gate espera `/respaldos|backups/i`; claridad de ruta |
| LOW | `frontend/src/features/invoices/components/PaymentModal.tsx:277` | Etiqueta "Cambio:" con dos puntos | "Cambio" sin dos puntos | Consistencia de etiquetas del resumen |
| LOW | `frontend/src/features/catalog/CatalogView.tsx:348,425` | `ConfirmDialog` propio | `ConfirmReasonDialog` compartido | HS-UX-06: una sola implementación de motivo |
| LOW | `frontend/src/design-system/patterns/RouteState.tsx:66` | Título de estado a 30 px (`sm:text-3xl`) | `--type-h1`/`--type-h2` según `headingLevel` | Densidad coherente con el contexto de estado |

Ninguna de estas filas se declara corregida: son propuestas con ubicación y valor exacto. La corrección la ejecutan hs-frontend/hs-receipts.

---

## D. NOT VERIFIED (explícito)

No se verificó en render, y por lo tanto no se aprueba:

1. Contraste real en navegador (claro/oscuro y 5 variantes de marca) de ninguna pantalla.
2. Densidad, primera ventana, overflow y jerarquía visual del POS, caja, historial, informes, configuración y respaldos a 1366×768 / 1920×1080 / 390 px / zoom 125–200 %.
3. Foco visible, orden de tabulación, atrapado/retorno de foco y `Enter` seguro en overlays (solo lectura de código).
4. Lector de pantalla, `axe` y pruebas manuales de teclado (no ejecutadas).
5. Cualquier PDF o vista previa de recibo real: dimensiones (612×792 pt), paginación, cortes, copias y totales.
6. Impresión física, impresora, papel y bandejas.
7. Estados de red reales (servidor no disponible, sesión vencida, reconexión) en navegador nuevo.
8. Las 10 correcciones de `HS-UX-*` marcadas "corregido": se revalidaron en código, no visualmente.

## E. Evidencia de esta actualización

- Contratos: `hospital-ai/diseno/TOKENS_V2.md`, `CONTRATO_PANTALLAS_V2.md`, `CRITERIOS_RECIBO_V2.md`.
- Cálculo de contraste: script temporal `contrast*-m-w1-ux-01.mjs` (fuera del repo).
- Skills releídas con hash: ver `TOKENS_V2.md §1`.
- Cero archivos de producto modificados por hs-ux en esta tarea.

---

# FASE 2 — REVISIÓN RENDERIZADA (C1-UX-01, 2026-09-17)

> Las secciones A–E de arriba son la **fase 1: inspección estática** y se conservan íntegras como registro de esa fase distinta. Todo lo que sigue es la **fase 2: revisión renderizada con navegador real**, que sustituye los "NOT VERIFIED" que le correspondan. Informe completo: `hospital-ai/diseno/REVISION_RENDERIZADA_C1.md`.

## F. Alcance real ejecutado

- Chromium real (Playwright 1.61) contra el laboratorio local: backend `127.0.0.1:18080`, frontend `127.0.0.1:15173`, base desechable `sh_ai_lab_local`.
- Usuarios sintéticos `admin.validacion` y `cajero.validacion`.
- **18 rutas × 6 configuraciones de viewport = 108 renders**, 204 capturas en `hospital-ai/evidencia/C1-UX-01/`.
- Se crearon 4 facturas y 4 pagos sintéticos en la base desechable para poder revisar historial, éxito de cobro, consolidado y detalle. Nada de producción.

## G. Resultados que cambian el estado de los pendientes heredados

| Pendiente (sección B) | Estado tras la revisión renderizada | Evidencia |
|---|---|---|
| 2. Contraste real claro/oscuro | **Verificado en render**: 0 incumplimientos de contraste de texto en 18 rutas; 0 violaciones axe en 9 superficies en oscuro. **Nuevo defecto**: anillo de foco a 2,15:1 (contrato pide ≥3:1) | `review-data.json`, `focus-contrast.mjs`, `dark-*.png` |
| 3. Densidad POS a 1366×768 | **Verificado**: paciente, servicios y **Total** en la primera ventana; 0 desbordamientos | `pos-1366x768-datos.png` |
| 4. Guard sticky de Configuración a 390×844 | **Verificado**: sin desbordamiento; el guard no tapa el foco | `movil-config-fiscal-390.png` |
| 5. Tablas a 1366 px con datos largos | **Verificado**: precios y fechas sin truncar; historial/catálogo/consolidado se apilan en móvil | `catalogo-1366x768-datos.png`, `movil-historial-390.png` |
| 6. Lector de pantalla en overlays y tour | **Sigue NOT VERIFIED** (no hay lector disponible en el entorno) | — |
| 7/8/10. Entradas condicionales de navegación | **Verificadas por clic**: el rail de admin no muestra "Recibos"; el enlace "Administrar recibos" de Configuración sí llega a la ruta | `flows-data.json → nav.clicks`, `config-recibos-1366x768-datos.png` |
| 9. Vacío móvil de usuarios | **Verificado** | `usuarios-movil-390.png` |
| 11. Primera ventana de arqueo/cierre e informe | **Verificado**: métricas y primer bloque visibles a 1366; gráfico de Reportes **recortado a 390 px** (defecto nuevo) | `caja-1366x768-datos.png`, `reportes-movil-grafico-tendencia.png` |
| 12. Contraste de deltas / sticky con estado sucio | Parcial: contraste OK; **`/settings/institutional-receipts` abre en estado "sucio" falso** y con copias contradictorias | `probe-receipts.mjs`, `config-recibos-1366x768-datos.png` |
| 13. Tour "1 de 1" y retorno de foco | **Sigue NOT VERIFIED** | — |

## H. Hallazgos `HS-UX-*` con estado renderizado

| Hallazgo | Antes (fase 1) | Ahora (fase 2) |
|---|---|---|
| HS-UX-01 (enlace circular a recibos) | Corregido en código | **Confirmado en render**: "Administrar recibos" abre `/settings/institutional-receipts` con `h1` "Recibos institucionales" |
| HS-UX-02 (tokens operativos) | Corregido en código | **Confirmado**: fondos/contornos operativos visibles y coherentes |
| HS-UX-03 (atajos sin handler) | Corregido en código | **NOT VERIFIED** (los atajos globales no se recorrieron) |
| HS-UX-04 (vacío móvil de usuarios) | Corregido en código | **Confirmado** |
| HS-UX-05 (gates E2E desalineados) | Parcial (`/backups` divergente) | **Confirmado alineado**: `/backups` titula "Respaldos"; `/settings/fiscal` titula "Configuración hospitalaria" |
| HS-UX-06 (diálogos de motivo duplicados) | Parcial | **Confirmado**: catálogo conserva `ConfirmDialog` propio (deuda vigente) |
| HS-UX-07 (`receipt_settings.view` sin superficie) | Corregido en código | **Confirmado en render** |
| HS-UX-08 (validación POS sin foco guiado) | Corregido en código | **Confirmado**: el botón explícito se enfoca y funciona con Enter |

## I. Nuevos hallazgos de la fase renderizada

| Severidad | Ubicación | Defecto | Evidencia |
|---|---|---|---|
| MEDIUM | `components/ui/{button,input,select,checkbox,switch,radio-group,accordion,textarea,toggle,input-group}.tsx` | Anillo de foco `ring-ring/50` de 3 px = **2,15:1** (< 3:1 de `TOKENS_V2 §7`) | medición DOM + composición alfa |
| MEDIUM | `components/ui/tabs.tsx:82` | `outline-none` en el `tabpanel` de Radix sin sustituto → foco invisible | `details.txt` (`config-fiscal`, `config-recibos`) |
| MEDIUM | `features/invoices/components/InvoiceCart.tsx` (`data-billing-cart-lines`) | Contenedor desplazable no enfocable → axe `scrollable-region-focusable` (serious) | `verify-data.json` |
| MEDIUM | `features/reports/components/AuditSummaryPanel.tsx:20` | `<p>` dentro del grupo `<dt>/<dd>` → axe `definition-list` (serious) | `verify-data.json` |
| MEDIUM | `features/reports/ReportsExecutive.tsx` | Gráfico "Tendencia diaria" de 544 px dentro de 366 px a 390 → **recortado e inalcanzable** | `reportes-movil-grafico-tendencia.png` |
| MEDIUM | `features/receipt-settings/InstitutionalReceiptSettingsView.tsx:234-242,312-339,777` | "Hay cambios sin guardar" en el primer render y COPIAS=1 contra "3 páginas" del motor | `probe-receipts.mjs` |
| MEDIUM | `ReceiptPrintProfileSeeder.php:96` + `paperPolicy.ts:101-104,138-142` | El perfil **global por defecto** sigue siendo media carta **apaisada**; carta vertical existe pero no es principal | `config-recibos-1366x768-datos.png` |
| MEDIUM | `features/reports/ReportsView.tsx:100-144` | `/reports/executive` y `/reports/consolidated` se sustituyen en silencio por "Operación de caja" sin `denied` textual | `flows-data.json → denied.views` |
| LOW | `BillingBottomBar.tsx:25`, `InvoiceCart.tsx:82` | Nombre del paciente truncado (contra `§3.2`) | `movil-pos-390.png` |
| LOW | `PaymentModal.tsx:379` | "Se registrara" sin tilde | captura del modal |
| LOW | `appNavigation.ts:233,244` | `/support` y `/about` sin entrada de navegación | `flows-data.json` |

## J. Mandato §4 (Enter seguro) — revalidado

Ejecutado con contadores de red sobre el flujo real de cobro:

- Enter desnudo en **monto** y en **referencia**: **0** `POST` de pago; el modal permanece abierto y conserva los datos.
- Botón explícito de confirmación: operable **con teclado y con ratón**; registra el cobro (**1** `POST`).
- **3 pulsaciones rápidas** de Enter → **1** solo `POST`: sin doble cobro.
- Error de servidor controlado: el monto se conserva y se muestra causa + reintento.
- Revisión previa de paciente/importe: el diálogo de confirmación muestra paciente, caja, servicios y total estimado antes de emitir.
- `Ctrl/Cmd+Enter` no es obligatorio para operar; sigue funcionando en el monto.

## K. NOT VERIFIED de la fase 2 (explícito)

1. Zoom **real** del navegador 150/200 % (no accionable en el arnés; se usó viewport CSS reducido + DPR como equivalente parcial).
2. Lector de pantalla (no hay NVDA/JAWS/VoiceOver en el entorno).
3. `prefers-reduced-motion` en render y animaciones a velocidad reducida.
4. PDF/impresión del recibo institucional.
5. Atajos globales `?`, `Ctrl+K`, `F2`, `F4`, `F6` y paleta de comandos.
6. Sesión vencida / reconexión de red.
7. Estado "sin coincidencias por filtros" del historial (el laboratorio ya tenía facturas y no se borró nada).
8. Cualquier aprobación visual del dueño: **no se presume** por esta revisión.

## L. Evidencia de la fase 2

`hospital-ai/evidencia/C1-UX-01/` (204 capturas PNG en `shots/`, más `review-data.json`, `summary.txt`, `details.txt`, `states-data.json`, `flows-data.json`, `verify-data.json`, `pos-final-data.json`, `payment-enter-data.json`, `payment-final2-data.json`, `double-submit-data.json` y el runner acotado en `runner/`). Ningún archivo de producto fue modificado por hs-ux.

---

# FASE 3 — REDISEÑO ESTRUCTURAL R2 (R2-UX-01, 2026-09-17/18)

> Las secciones A–E (fase 1, estática) y F–L (fase 2, renderizada C1-UX-01) se conservan **íntegras** como
> registro de esas fases. Esta fase 3 es distinta: el usuario **rechazó el resultado visual**, se autorizó
> reemplazar el diseño global y el encargo exige **especificaciones de layout montables**, no documentos.
> Entregables: `hospital-ai/diseno/PLAN_ESTRUCTURAL_R2.md` (especificación montable por superficie) y
> `hospital-ai/diseno/BEFORE_RENDER_R2.md` (diagnóstico medido). Evidencia: `hospital-ai/evidencia/R2-UX-01/`.

## M. Responsabilidad asumida y su límite

`hs-ux` mide **render real** con Playwright contra el laboratorio (`127.0.0.1:18080` / `127.0.0.1:15173`,
base desechable `sh_ai_lab_local`, usuario sintético `admin.validacion`). **No edita código de producto.** El
plan entrega valores exactos (px, clases, selectores) para que **hs-frontend** monte sin adivinar, y `hs-ux`
**vuelve a medir** cuando el lote esté montado. La segunda pasada sigue **pendiente** en este momento.

## N. Correcciones a afirmaciones heredadas (medido, no asumido)

| Afirmación | Resultado medido |
|---|---|
| `--press-scale: 0.96` sin consumidores y sin `active:scale` | **Confirmado**: 1 sola aparición de `press-scale` (su declaración) y 0 de `active:scale`. Existe otro feedback de press: `active:…:translate-y-px` en `components/ui/button.tsx:8` |
| "Resumen y cobro con cifras incompatibles" | **No reproducido**: total del resumen = etiqueta de la acción = total del servidor. Lo accionable es el estado **no confirmado** (una API caída se ve como `L 0.00` + catálogo vacío) |
| "Ayuda extensa con vocabulario de implementación" | **Parcial**: 1 ocurrencia dura (`HelpView.tsx:369`, la palabra "rail"); el resto de términos técnicos = 0 |
| "Títulos duplicados y varios estilos de encabezado" | **Confirmado y cuantificado**: barra 64 px, 2 patrones, 4 rutas con texto idéntico barra↔`h1` y 3 casi-duplicados, hasta 6 tamaños de encabezado por ruta |
| Fase 2 afirmó "paciente, servicios y Total en la primera ventana" en el POS 1366×768 | **Discrepancia declarada**: con `scrollY === 0` hay **0 filas de servicio visibles** (primera fila en `top 836`). La captura previa era posterior a un clic que desplaza la página |

## O. Hallazgos nuevos de la fase 3 (todos medidos en render)

| Sev. | Ubicación | Defecto medido | Evidencia |
|---|---|---|---|
| **HIGH** | `components/ui/dialog.tsx:62` + `InvoiceConfirmation.tsx:22` | Diálogo de confirmación sin `max-height` ni scroll: con 10 líneas mide 834 px (`top −33`) y con 30 líneas 1329 px (`top −280`); `Cancelar`/`Emitir y abrir cobro` quedan **fuera del viewport** | `before/d-confirm-30-lines.png`, `criteria.json S5.1–S5.6` |
| **HIGH** | `NewInvoiceViewLayout.tsx` (región del paciente 190 px; rejilla de categorías 96 px; encabezado de `ServiceSearch`) | A 1366×768 con carrito con datos y `scrollY=0` hay **0 filas de servicio visibles** (primera fila en `top 836`; la búsqueda empieza en `top 513`) | `before/c-pos-1366-cart-noscroll.png`, `criteria.json S2.1–S2.5` |
| **HIGH** | `ServiceSearch.tsx:298-308` vía `NewInvoiceView.tsx:206-207` | Con `/api/services` caído el POS muestra `SERVICIOS (0)` + "No hay servicios agregados", **sin error ni `Reintentar`**: una falla de API se ve igual que un catálogo vacío | `before/i-pos-services-error.png`, `measurements-probe7.json` |
| MEDIUM | `components/ui/button.tsx:25-34` | La variante por defecto es `sm:h-8` (32 px): la acción primaria del cobro mide **32 px**; 27 controles del POS miden 32 px | `measurements-probe5.json` (histograma), `criteria.json S4.2` |
| MEDIUM | `InvoiceCart.tsx` | Línea de carrito de **167–168 px** (6 badges/4 líneas); el viewport interno de 193 px muestra **1** línea de 4 | `criteria.json S3.1–S3.3` |
| MEDIUM | `ContextBar.tsx` | 4 rutas con el texto de la barra **idéntico** al `h1` (`/billing/new`, `/cashbox`, `/backups`, `/settings/institutional-receipts`) y 3 casi-duplicados | `criteria.json S1.2` |
| MEDIUM | `CatalogView.tsx` | **4,13 etiquetas por fila** (62/15); 3 de ellas son el valor por defecto de toda la tabla | `before/b-catalog.png`, `measurements-probe2.json` |
| MEDIUM | `ReportsView.tsx` | La primera fila de tabla aparece en `top` **1621 px** ⇒ **0 filas** de informe en el primer viewport a 1366×768 | `criteria.json S6.4/S6.5` |
| MEDIUM | `BackupsView.tsx` | Sin estado tipado explícito y sin la **última copia recuperable**; con la salud caída quedan métricas `No disponible` junto a un bloque tranquilizador de "Recuperación protegida" | `before/h-backups-unknown-state.png`, `measurements-probe4.json` |
| MEDIUM | `ContextBar.tsx:24-26,43-50` | Durante la carga de la sesión de caja la barra pinta `Mi caja cerrada` **aunque la sesión esté abierta**: "desconocido" se representa como "cerrado" | `measurements-probe7.json` |
| LOW | `HelpView.tsx:369` | Única frase con vocabulario interno en la ayuda ("el rail") | `measurements.json → helpVocabulary` |

## P. Lo que la fase 3 NO verifica (explícito)

1. **La segunda pasada (medición "después")**: el árbol estaba siendo editado por `hs-frontend` durante la
   medición (Vite HMR remonta la app y reinicia el POS a mitad de flujo). Queda **pendiente y obligatoria**
   para cerrar la responsabilidad de hs-ux.
2. Lector de pantalla (no disponible en el entorno).
3. Zoom real del navegador con `Ctrl+`+ (se usó viewport CSS reducido = equivalente de reflow).
4. `prefers-reduced-motion` en render y replay a velocidad reducida.
5. Recorrido manual completo de teclado en las 16 rutas (solo se probó `Esc` en el diálogo de confirmación).
6. Tema oscuro. 7. Impresión física, papel y PDF.
8. **La aprobación visual del dueño no se presume** por este documento ni por los `PASS` del verificador.

## Q. Evidencia y contrato ejecutable de la fase 3

`hospital-ai/evidencia/R2-UX-01/before/` (38 PNG + 6 JSON), `antes/criteria.json` (**10/40 PASS** en el
snapshot medido), `REVISION_SNAPSHOT.txt` (HEAD + hashes + mtimes) y
`tools/measure-r2.mjs` (verificador reutilizable: `node … --label=despues` ⇒ objetivo **40/40** sin desactivar
criterios). Especificación: `hospital-ai/diseno/PLAN_ESTRUCTURAL_R2.md`.
**Ningún archivo de producto fue modificado por hs-ux en esta fase.**
