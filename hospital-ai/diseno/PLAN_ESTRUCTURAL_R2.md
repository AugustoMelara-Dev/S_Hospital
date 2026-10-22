# PLAN_ESTRUCTURAL_R2 — Especificación montable del reemplazo de superficies

**TASK_ID:** R2-UX-01 · **Autor:** hs-ux · **Fecha:** 2026-09-17/18
**Raíz:** `C:\Projects\S_Hospital_AI` (worktree aislado, detached). **No se tocó** `C:\Projects\S_Hospital`.
**Estado del trabajo:** especificación medida sobre **render real**. `hs-ux` **no editó ningún archivo de producto**.
La implementación pertenece a **hs-frontend** (shell/POS/tablas) y **hs-receipts** (recibos).

> Este plan reemplaza el layout actual de las superficies listadas. Las restricciones heredadas que obligaban a
> conservar el layout rechazado quedan superadas por el encargo R2. No es un documento de intención: cada
> apartado trae **medidas exactas**, **estado antes medido** y un **criterio observable ejecutable**.

---

## 0. Cómo se monta y cómo se verifica

| Pieza | Ruta | Uso |
|---|---|---|
| Verificador de criterios | `hospital-ai/evidencia/R2-UX-01/tools/measure-r2.mjs` | `node …/measure-r2.mjs --label=despues` imprime `PASS/FAIL` por criterio y escribe `criteria.json` |
| Capturas y medidas "antes" | `hospital-ai/evidencia/R2-UX-01/before/**` | 38 PNG + `measurements*.json` |
| Informe del antes | `hospital-ai/diseno/BEFORE_RENDER_R2.md` | Diagnóstico medido con cifras |
| Revisión de la revisión | `hospital-ai/evidencia/R2-UX-01/REVISION_SNAPSHOT.txt` | HEAD, hashes y mtimes del árbol medido |

**Laboratorio:** backend `127.0.0.1:18080`, frontend `127.0.0.1:15173`, base **desechable** `sh_ai_lab_local`,
usuario sintético `admin.validacion`. Arranque: `scripts\lab_local_up.ps1`.

**Aviso de árbol en movimiento:** durante la toma del "antes", `frontend/src/**` estaba siendo editado por
`hs-frontend` (p. ej. `NewInvoiceView.tsx` a las 23:20:10 del 17/09). Las cifras corresponden al snapshot
`REVISION_SNAPSHOT.txt`. Vite HMR remonta la app al guardar: dos corridas consecutivas del arnés pueden dar
estados distintos a mitad de flujo. **El "después" debe medirse con el árbol quieto.**

**Método de zoom:** viewport CSS a la mitad (`1366×768 → 683×384`) = reflow real de zoom 200 % (WCAG 1.4.10).
**Prohibido** en el producto y en la medición: `zoom` CSS de la página, `transform: scale()` global o reducir
tipografía para "hacer caber".

### 0.1 Skills releídas (hash SHA-256 del archivo)

| Ruta | SHA-256 | Qué se conserva literalmente en este plan |
|---|---|---|
| `.agents/skills/better-ui/SKILL.md` | `C7CB0156F6F4E85B…` | radios concéntricos `outer = inner + padding`; `scale(0.96)` al presionar (nunca <0.95); sombra para profundidad / borde para estructura; `transition-property` explícito; hover de alta frecuencia ≤150 ms; stagger ~100 ms **solo** en entradas poco frecuentes; cross-fade de iconos `scale .25→1 / opacity 0→1 / blur 4→0` a `cubic-bezier(.2,0,0,1)` |
| `.agents/skills/better-ui/surfaces.md` | `CFA523043DAE1E9C…` | las 3 capas exactas de `box-shadow` (light) y el anillo blanco único (dark) |
| `.agents/skills/better-ui/icons.md` | `9E9E1C67101E206B…` | `1.5px` junto a 400 · `2px` junto a 500–600 · `2.5px` junto a 700; una librería por superficie; `currentColor` |
| `.agents/skills/better-ui/enter-exit.md` | `4E74BE10AA3F8B46…` | salida más suave que la entrada: `y −12px`, `150 ms`, `ease-out` |
| `.agents/skills/better-ui/animations.md` | `90D4F16E9E2F4A63…` | transiciones CSS para estado interactivo; keyframes solo en secuencias de una vez |
| `.agents/skills/emil-design-eng/SKILL.md` | `A2EE9DA0840C23B5…` | `--ease-out: cubic-bezier(0.23,1,0.32,1)`; `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`; nunca `ease-in`; UI < 300 ms; **nunca animar acciones de teclado**; frecuencia 100+/día ⇒ sin animación; `prefers-reduced-motion` conserva opacidad/color; stagger 30–80 ms |

**Regla de frecuencia aplicada a este plan (§1 del SKILL de emil, tabla de frecuencia):** el POS, el cobro, los
steppers de cantidad y la fila de servicio se usan **decenas o cientos de veces por turno** ⇒ **sin animación de
entrada**, y feedback de press **instantáneo** (≤150 ms de color/transform). El escalonado de entradas y el
cross-fade de iconos se reservan a superficies poco frecuentes (éxito de cobro, vacíos, primer render de
informes).

**Conflicto de recetas resuelto sin promediar:** `better-ui` fija `0.96` y `emil-design-eng` sugiere `0.97`.
Se adopta **`0.96`** y **solo** en acciones primarias/destructivas de baja frecuencia. Los controles de alta
frecuencia conservan el feedback actual de `button.tsx` (`active:not-aria-[haspopup]:translate-y-px`), que es
instantáneo y no retrasa la operación. El defecto del contrato anterior no fue el valor `0.96`: fue que
`--press-scale` tenía **0 consumidores** (medido: 1 sola aparición = su propia declaración) y `active:scale` tenía
**0 ocurrencias**. Un token sin consumidor no es una implementación.

---

## 1. Inventario real de rutas (verificado en el código y recorrido en el render)

Fuente: `frontend/src/AppRoutes.tsx:118-309` + `frontend/src/navigation/appNavigation.ts:58-250`.
Todas se recorrieron renderizadas a 1366×768 en esta tarea.

| # | Ruta | Vista | Guard | Superficie R2 que cubre |
|---|---|---|---|---|
| 1 | `/` | `Navigate` → `/dashboard` | — | — |
| 2 | `/login` | `Navigate` → ruta por defecto | — | — |
| 3 | `/dashboard` | `DashboardView` | sesión + algún permiso operativo | Inicio |
| 4 | `/billing/new` | `NewInvoiceView` | `invoices.create+catalog.view+cash.view+payments.create+receipts.view` (all) | POS, confirmación, pago, éxito |
| 5 | `/cashbox` | `CashBoxView` | `cash.view` | Caja: apertura/movimientos/arqueo/cierre |
| 6 | `/catalog` | `CatalogView` | `catalog.view` | Catálogo |
| 7 | `/invoices` | `InvoiceHistoryView` | `invoices.view` | Historial + detalle (`?invoice=`) |
| 8 | `/reports/*` | `ReportsView` | `reports.managerial.view` \| `reports.cash_session.view` \| `audit.view` (any) | Reportes: resumen, caja, consolidado, auditoría |
| 9 | `/backups` | `BackupsView` | `backups.view` | Respaldos |
| 10 | `/settings/fiscal` | `FiscalSettingsView` | `settings.fiscal.view` \| `settings.operational.update` (any) | Ajustes |
| 11 | `/settings/institutional-receipts` | `InstitutionalReceiptSettingsView` | `receipt_settings.view` | Recibos / impresión |
| 12 | `/admin/users` | `UsersView` | `users.view` | Usuarios/roles |
| 13 | `/support` | `SupportCenterView` | sesión | Soporte |
| 14 | `/help` | `HelpView` | sesión | Ayuda |
| 15 | `/about` | `AboutView` | sesión | Acerca de |
| 16 | `*` | `NotFoundView` | — | No encontrada |

Subrutas reales de `/reports` (`ReportsView.tsx`): `/reports`, `/reports/executive`,
`/reports/consolidated`, `/reports/cash`, `/reports/audit`.

**Superficies sin ruta propia (condicionales), también cubiertas:**
acceso (`LoginView` cuando no hay sesión), cambio obligatorio de contraseña (`PasswordChangeView`),
caja rápida en diálogo (`App.tsx:158-179`), paleta de comandos (`Ctrl+K`), paleta de atajos (`?`),
tour guiado, detalle de factura en drawer, diálogo de comprobante, `NotFoundView`.

**Fuera de alcance de este plan (especificación propia):** el contenido del recibo/PDF
(`CRITERIOS_RECIBO_V2.md`, hs-receipts). Aquí solo se especifica **la superficie de la aplicación** que lo
previsualiza y lo dispara.

---

## 2. Presupuesto de tokens y primitivas (lo mínimo que hay que añadir)

Solo tokens **con consumidor obligatorio**. El error anterior fue declarar tokens sin uso.

```css
:root {
  --header-h: 56px;                  /* barra de contexto S1 */
  --rail-w: 232px;                   /* rail expandido (antes 256px) */
  --rail-w-collapsed: 56px;
  --row-service: 56px;               /* fila de servicio S2 (antes 65px) */
  --row-cart: 72px;                  /* linea de carrito S3 (antes 167-168px) */
  --row-table: 44px;                 /* fila densa S6 (antes 49-61px) */
  --control-h-operational: 44px;     /* accion monetaria S4 (antes 32px) */
  --control-h-default: 36px;
  --control-h-compact: 32px;
  --dialog-max-h: 85dvh;             /* S5 */
  --press-scale: 0.96;               /* SOLO acciones primarias de baja frecuencia */
  --duration-press: 150ms;
  --duration-state: 120ms;
}
[data-control-size="operational"] { min-height: var(--control-h-operational); }
[data-dialog-scroll] { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
```

**Cambio obligatorio en `frontend/src/components/ui/button.tsx:25-34`** (causa raíz medida del botón de 32 px):

```diff
- default: "h-11 gap-1.5 px-2.5 sm:h-8 …"
+ default: "h-11 gap-1.5 px-2.5 sm:h-9 …"
- sm: "h-11 gap-1 rounded-[…] px-2.5 text-[0.8rem] sm:h-7 …"
+ sm: "h-11 gap-1 rounded-[…] px-2.5 text-[0.8rem] sm:h-8 …"
```

Con `size` por defecto y `sm:h-9` (36 px), una clase `h-11` en el llamador **ya no se colapsa**: hoy
`className="h-11"` se fusiona como `h-11 sm:h-8` y en escritorio el botón **mide 32 px**. Verificado: histograma
de alturas del POS = `{32px: 27 controles, 44px: 8, 64px: 24}`. La acción primaria del cobro es uno de los 27.

> **Riesgo para hs-frontend:** cambiar la altura por defecto toca todas las pantallas. Revisar
> `frontend/e2e/accessibility.spec.ts` y `all-buttons-smoke.spec.ts` por si asumen `sm:h-8`. Si algún gate la
> fija, actualizarlo en el mismo cambio con la justificación de 2.5.8 (24 px) y de la ergonomía de caja.

**Radios:** se mantiene `outer = inner + padding` con `--radius-control 8 / --radius-surface 12 /
--radius-overlay 16`. **Corrección de un dato heredado:** `TOKENS_V2.md` decía que `--radius-2xl/3xl/4xl`
derivaban a 18/22/26 px; el código **hoy** declara `0.875rem/0.9375rem/1rem` (14/15/16 px,
`styles.css:194-196`) ⇒ **ya cumplen el máximo de 16 px** del gate E2E. No hay migración pendiente ahí.

**Bordes y foco:** no se retira el borde de `Input` (`components/ui/input.tsx:11` conserva `border border-input`)
ni su `focus-visible:ring-3`. El `outline-none` del input **tiene sustituto** (borde + anillo) y se conserva.
La corrección pendiente es que el anillo mida ≥3:1 (hallazgo C1-UX-01: `ring-ring/50` = 2,15:1): pasar a
`ring-ring` sin alfa o a `--color-ring` sólido.

---

## 3. Superficie S1 — Shell: un encabezado operativo, un patrón de navegación

### 3.1 Antes (medido)

| Medición | Valor | Evidencia |
|---|---|---|
| Alto de `[data-audit-panel="context-bar"]` | **64 px** en las 11 rutas | `criteria.json S1.5` |
| Patrones de encabezado simultáneos | **2** (`context-bar` + `[data-slot="page-header"]`) | `measurements.json → shell.headerLike` |
| Título duplicado barra vs `h1` | **4/11 rutas**: `/billing/new` ("Nueva factura" = "Nueva factura"), `/cashbox` ("Caja" = "Caja"), `/backups` ("Respaldos" = "Respaldos"), `/settings/institutional-receipts` ("Recibos institucionales" = "Recibos institucionales") | `criteria.json S1.2`, `measurements-probe2.json` |
| Casi-duplicados | `/catalog` "Catálogo"/"Catálogo institucional"; `/invoices` "Historial"/"Historial de facturas"; `/settings/fiscal` "Configuración"/"Configuración hospitalaria" | idem |
| Rail expandido | **256 px** fijos | `measurements.json → shell.rail` |
| Tamaños de encabezado distintos por ruta | hasta **5** (24/20/18/16/14/12) en `/billing/new` y `/reports/executive` | `measurements.json → distinctHeadingSizes` |
| `h1` por ruta | 1 ✔ (ya correcto) | `criteria.json S1.1` |
| Desbordamiento horizontal | 0 en las 16 rutas ✔ | `criteria.json S1.4` |

### 3.2 Sustitución

1. **La barra de contexto deja de mostrar el título de la ruta.** Pasa a mostrar **ámbito + sección** en
   `--type-xs` (12 px/500, mayúsculas, tracking 0.02em, color `--color-muted-foreground`), y **nunca** el texto
   del `h1`. El título de la ruta queda **solo** en el `h1` de la página.
   Mapa sección (una línea por ruta en `appNavigation.ts`, campo nuevo `sectionLabel`):

   | Ruta | Texto de la barra |
   |---|---|
   | `/dashboard` | `OPERACIONES · INICIO` |
   | `/billing/new` | `OPERACIONES · FACTURACIÓN` |
   | `/cashbox` | `OPERACIONES · CAJA` |
   | `/catalog` | `OPERACIONES · CATÁLOGO` |
   | `/invoices` | `OPERACIONES · HISTORIAL` |
   | `/reports/*` | `OPERACIONES · INFORMES` |
   | `/backups` | `ADMINISTRACIÓN · RESPALDOS` |
   | `/settings/fiscal` | `ADMINISTRACIÓN · CONFIGURACIÓN` |
   | `/settings/institutional-receipts` | `ADMINISTRACIÓN · RECIBOS` |
   | `/admin/users` | `ADMINISTRACIÓN · USUARIOS` |
   | `/help` · `/support` · `/about` | `ASISTENCIA · AYUDA` / `· SOPORTE` / `· ACERCA DE` |

2. **Alto de la barra: 56 px** (`h-14`), sticky `top-0 z-20`, `border-b border-border`, `bg-surface`.
3. **Estado usuario/caja discreto y tipado.** El chip de caja pasa de 2 estados a **3**: `abierta` (success,
   `Mi caja #N`), `cerrada` (muted, `Sin caja abierta`) y **`desconocida`** mientras carga (muted + spinner
   inline, texto `Consultando caja…`). Hoy el primer render muestra `Mi caja cerrada` **aunque la sesión esté
   abierta** (medido: primer pintado de `/billing/new`, `measurements-probe7.json`). El chip y el aviso
   `Caja no abierta` comparten la misma fuente de estado: mientras sea `desconocida` **no** se muestra el aviso.
4. **Un único patrón de navegación:** el rail (232 px) + `InstitutionalMobileNav` para `<1024px`. La paleta de
   comandos y los atajos siguen siendo **aceleradores**, no un segundo patrón.
5. **Un solo estilo de encabezado de página:** el `PageHeader` pierde el `border-b` (`PageHeader.tsx:12`) —
   produce una segunda línea horizontal a 8 px del borde de la barra sticky — y la `description` se limita a
   **una** línea (`line-clamp-1` + `title`), porque hoy compite con el `h1`.
6. **Escala tipográfica cerrada a 4 pasos por ruta**: `--type-h1 24/600`, `--type-h2 18/600`,
   `--type-body 14/400`, `--type-sm 13/400` (+`--type-xs` solo para rótulos). Prohibido usar 20 px y 16 px como
   pasos intermedios sueltos.

### 3.3 Criterio observable

- `S1.1` `h1` ≤1 por ruta · `S1.2` ninguna ruta con el texto de la barra igual al `h1` ·
  `S1.3` ≤4 tamaños de encabezado por ruta · `S1.4` overflowX ≤2 px ·
  `S1.5` alto de la barra ≤60 px (objetivo 56).
- **Reconocible sin leer textos técnicos:** en toda ruta, la barra muestra `OPERACIONES|ADMINISTRACIÓN|ASISTENCIA`
  + sección; el `h1` nombra la tarea; la acción principal está en el `PageHeader` o en el panel de la propia
  tarea. **Sin controles inactivos**: si una acción no tiene handler/href, no se renderiza.

---

## 4. Superficie S2 — POS: paciente compacto y servicios inmediatamente debajo

### 4.1 Antes (medido a 1366×768, `scrollY === 0`, carrito con 4 líneas)

| Elemento | Medido | Criterio R2 |
|---|---|---|
| `[data-billing-region="patient"]` | `top 226 → bottom 416` = **190 px** | ≤80 px |
| `#service-search` | `top` **513 px** (67 % del viewport) | ≤300 px |
| `[data-filter-priority="primary"]` (categorías) | **96 px** (rejilla de 2 filas) | ≤48 px |
| Primera fila de servicio | `top` **836 px** ⇒ **0 filas visibles** | ≤430 px |
| Filas de servicio visibles antes de desplazar | **0** | ≥5 |
| Alto de fila de servicio | **65 px** | ≤56 px |
| Desglose por ruta | `/billing/new`: `rowsInFold = 0` | — |

Evidencia: `before/c-pos-1366-cart-noscroll.png`, `measurements-probe3.json`, `criteria.json S2.1–S2.6`.

> **Discrepancia declarada:** `REVISION_RENDERIZADA_C1.md §G` afirmó "paciente, servicios y Total en la primera
> ventana". Mi medición con `scrollY === 0` da **0 filas de servicio visibles**. La captura previa se tomó
> después de pulsar una fila, y ese clic desplaza la página (en `measurements.json → pos1Line` la región del
> paciente aparece en `top −220`, es decir con scroll). Se reporta la discrepancia; no se acusa al gate.

### 4.2 Sustitución (objetivo: `top` de la primera fila ≤ 430 px)

Bloque superior, de arriba hacia abajo, con **gap 12 px**:

1. **Tira de paciente (≤80 px, objetivo 72).** Una sola fila flex:
   `<h2 class="sr-only">Paciente</h2>` + `label` visible a la izquierda (14/500, "Paciente *") +
   `Input#patient-name` (`min-height:44px`, `flex:1`) + chip inline `Paciente identificado` (13/500, success) +
   `Caracteres: n/180` a `--type-xs` **solo** cuando el input tiene foco o el uso supera el 80 %.
   `Datos opcionales` sale de la fila y pasa a un `<details>` dentro del mismo bloque ("Más datos") que **no
   aporta altura cuando está cerrado**.
   *Conservar* `autoComplete="name"`, `aria-describedby`, `aria-invalid` y el `role="alert"` del error.
2. **Búsqueda + filtros en una franja de 2 renglones (≤104 px).**
   - Renglón 1 (44 px): `input#service-search` (`min-h-12`, icono lupa) + botón fantasma `Limpiar filtros`
     (`size="icon"`, 44×44, `aria-label="Limpiar filtros"`) + contador `Servicios (N)` a `--type-xs` al extremo
     derecho. **Se elimina** el bloque `Selección de servicios` (h2 18 px) y el badge `0 filtros` (no es acción).
   - Renglón 2 (44 px): **una** fila horizontal desplazable de categorías (`overflow-x:auto`,
     `scroll-snap-type:x proximity`, `overscroll-behavior-x:contain`), cada chip `min-h-9` (36 px) y
     `role="radio"` dentro del `radiogroup` existente. Se conserva la navegación con flechas/Home/End que ya
     implementa `ServiceSearch.tsx:114-143`. `Ver todas las categorías` se convierte en el último chip
     `+N más` (abre el popover), no en un `Button variant="link"` que añade una fila de 44 px.
   - `Área` deja de ser un `Collapsible` en el flujo: pasa a un **popover** colgado de un botón fantasma
     `Filtros` (`aria-expanded`, `aria-controls`) en el renglón 1. Cierra con `Esc` y devuelve el foco.
3. **Lista de servicios inmediatamente debajo**, con `overscroll-contain`. Fila de **56 px**:
   `nombre` (14/600, 1 línea, `[overflow-wrap:anywhere]`) + `categoría · área` (12, muted, 1 línea, `title`
   completo) + `precio` (14/600, `tabular-nums`, derecha) + zona de acción `+` 44×44.
   El estado de cuenta (`3 en la cuenta`) se mueve a un chip `--type-xs` a la derecha del precio, sin borde
   lateral de 12 px que hoy roba ancho.
4. **Alto del viewport:** se mantiene `billing-account-viewport` para la columna de cuenta, pero se recalcula
   `height: calc(100dvh - 11rem)` (antes `- 13rem`, `styles.css:100-102`), porque la cabecera y el bloque de
   paciente son ahora más bajos.

### 4.3 Criterio observable

`S2.1` paciente ≤80 px · `S2.2` `#service-search.top` ≤300 px · `S2.3` categorías ≤48 px ·
`S2.4` primera fila ≤430 px · `S2.5` **≥5 servicios visibles** con carrito con datos a 1366×768 ·
`S2.6` fila de servicio ≤56 px. Todo con `window.scrollY === 0`.

---

## 5. Superficie S3 — Filas compactas del carrito

### 5.1 Antes (medido)

| Medición | Valor |
|---|---|
| Alto de `li` en `[data-billing-cart-list]` | **167–168 px** (uniforme con 4, 9 y 20 líneas) |
| Etiquetas por línea | **6 badges en 4 líneas** (categoría + área en cada una) |
| Viewport interno del carrito | `clientHeight 193 px` / `scrollHeight 671 px` con 4 líneas ⇒ **1 línea visible** |
| Sección del carrito | 420 px de ancho, `p-5` |

Evidencia: `criteria.json S3.1–S3.3`, `before/c-pos-1366-cart-noscroll.png`.

### 5.2 Sustitución — línea de **≤72 px** (objetivo 64)

Dos renglones de 28 px con `padding: 8px 12px` y `gap 4px`:

- **Renglón 1 (28 px):** `nombre del servicio` (14/600, 1 línea, `title` con el texto completo) a la izquierda ·
  `importe de línea` (14/600, `tabular-nums`, `white-space:nowrap`) a la derecha.
- **Renglón 2 (28 px):** stepper `−` (32×32) · `Input` de cantidad (44×28, `tabular-nums`, centrado,
  `inputMode="decimal"`, `aria-label="Cantidad de {servicio}"`) · `+` (32×32) · `precio unitario` (12 px, muted,
  `L 45.00 c/u`) · `Quitar` (`size="icon-sm"`, 32×32, `aria-label="Quitar {servicio}"`) al extremo derecho.

Reglas:
- **Se eliminan los 2 `Badge` de categoría/área de cada línea.** Esa información vive en la lista de servicios.
  Objetivo: **0 badges por línea de carrito**.
- El checkbox de receta de diálisis de eritropoyetina **no** se mueve a la línea: permanece como bloque propio
  del carrito (es una regla de dinero, no un dato de línea) pero se muestra **solo si hay eritropoyetina en la
  cuenta** (ya es así, `InvoiceCart.tsx:95`).
- `data-billing-cart-lines` conserva `tabIndex={0}`, `role="region"`, `aria-label`, y **además** `tabIndex={0}`
  con `:focus-visible` visible (hoy axe lo marca `scrollable-region-focusable`).
- Con 5 líneas y `--row-cart 64px`, el viewport interno debe mostrar **≥3 líneas**: subir
  `[data-billing-cart-lines]` a `min-height: 216px` y bajar el resumen (S4) para liberar 74 px.

### 5.3 Criterio observable

`S3.1` alto de línea ≤72 px · `S3.2` 0 badges por línea · `S3.3` ≥3 líneas simultáneamente visibles en el
carrito a 1366×768 con 5 líneas cargadas. El nombre completo siempre accesible por `title` y por lector de
pantalla (no truncado con `ellipsis` sin alternativa).

---

## 6. Superficie S4 — Resumen y cobro: fijo, verificado y de 44 px

### 6.1 Antes (medido)

| Medición | Valor |
|---|---|
| Bloque `[data-billing-cart-action]` | 208 px de alto |
| Botón primario | **32 px** de alto (los 27 controles de 32 px del POS incluyen este) |
| Total | **24 px / 700**, `tabular-nums` ✔ |
| Coherencia total ↔ acción ↔ servidor | **Correcta**: total `L 189.75` = botón `Emitir y cobrar · L 189.75`; factura `000-001-01-00000002` = `120.75` en UI y en `GET /api/invoices` ✔ |
| Botón con carrito vacío | `Agregue servicios`, **`disabled`** ✔ (no hay cobro con cero) |
| Fallo de `/api/services` | `SERVICIOS (0)` + "No hay servicios agregados", **sin error ni reintento**: una API caída se ve igual que un catálogo vacío ✗ |

Evidencia: `criteria.json S4.1–S4.3`, `measurements-probe5.json` (histograma de alturas),
`measurements-probe7.json` (`servicesError`), `before/i-pos-services-error.png`.

> **Corrección de una afirmación del encargo:** *no* medí cifras incompatibles entre resumen, confirmación y
> servidor. En el estado actual coinciden. Lo que sí medí es que **el resumen no tiene estado de "no
> confirmado"**: si el origen de datos falla, el resumen igual muestra `L 0.00` y no distingue
> "0" de "desconocido". Esa es la parte accionable.

### 6.2 Sustitución

1. **Resumen fijo con jerarquía de contrato.** Un solo bloque, siempre visible, en este orden:
   `Total` (24/700, `tabular-nums`, alineado a la derecha) + botón de **44 px** (`data-control-size="operational"`).
   `Subtotal` / `Exento` / `ISV` van dentro de un `<details>` **"Ver desglose"** (cerrado por defecto).
   `Exento` solo se renderiza si es distinto de `L 0.00`. El bloque completo baja de 208 px a **≤116 px**.
2. **Estados del dinero tipados y no confundibles:**
   - `listo` → total + botón habilitado.
   - `incompleto` → botón `disabled` con la razón **y** `aria-describedby` al bloque de razones (ya existe
     `#invoice-submit-blockers`; se conserva).
   - `no_confirmado` (**nuevo**) → cuando `pointOfSaleLoadError` o el preview no tiene un total confirmado, el
     `dd` del total muestra `—` (nunca `L 0.00`), con `Estado del total: no confirmado` a `--type-sm`,
     `role="status"`, y el botón `disabled`. **Nunca `L 0.00` por ausencia o error.**
   - `error de catálogo` (**corregido**) → `ServiceSearch` debe renderizar la `Alert` destructiva existente
     (`ServiceSearch.tsx:298-308`) **siempre** que el fetch falle, con botón `Reintentar` de 44 px. Hoy el
     estado de error no llega a la vista (medido).
3. **Cifras iguales en los 3 lugares:** acción = resumen = diálogo de confirmación. La confirmación sigue
   mostrando `Total estimado` y el aviso de que el definitivo lo confirma el servidor
   (`InvoiceConfirmation.tsx:26-27`); **conservar** el guard `revisionGuard.hasCartChangedSince` y el aviso
   "La cuenta cambió…" (`NewInvoiceView.tsx:334-339`).
4. **Movimiento:** cero animación en el cobro y en la confirmación. Feedback del botón primario:
   `transition-property: transform; transition-duration: 150ms; transition-timing-function: var(--ease-out);`
   con `:active { transform: scale(0.96) }` (`better-ui`). El resto de botones conserva `active:translate-y-px`.
5. **`Enter` seguro:** se conserva el comportamiento medido por C1-UX-01 (Enter desnudo en monto/referencia
   ⇒ 0 POST; 3 Enters rápidos ⇒ 1 POST). Ninguna de las recetas de este plan puede introducir un cobro por
   `Enter` en un campo.

### 6.3 Criterio observable

`S4.1` resumen + acción dentro del primer viewport · `S4.2` botón primario ≥44 px ·
`S4.3` total ≥24 px y **la misma cifra** que la etiqueta de la acción.
Además, prueba manual de la pasada "después": con `/api/services` abortado, el total **no** debe mostrar
`L 0.00` sino `—` + `no confirmado`, y debe aparecer `Reintentar`.

---

## 7. Superficie S5 — Diálogos: alto máximo, cuerpo desplazable, acciones alcanzables

### 7.1 Antes (medido, `before/d-confirm-*.png`)

| Caso | Alto del diálogo | `top` | `bottom` | `max-height` | `overflow-y` |
|---|---|---|---|---|---|
| Confirmación 1 línea | 474 px | 147 | 621 | `none` | `visible` |
| Confirmación 10 líneas | **834 px** | **−33** | 801 | `none` | `visible` |
| Confirmación 30 líneas | **1329 px** | **−280** | 1049 | `none` | `visible` |
| Confirmación 30 líneas @ zoom 200 % (683×384) | 1329 px | **−472** | 857 | `none` | `visible` |
| `PaymentModal` | 643 px | 63 | 706 | `768px` (`max-h-screen`) | `auto` ✔ |
| Éxito de cobro | 598 px | 85 | 683 | `none` | `visible` ✔ |

**Defecto HIGH confirmado visualmente:** con ≥10 líneas el diálogo de confirmación **no cabe** y **no
desplaza**; las acciones `Cancelar` / `Emitir y abrir cobro` quedan **fuera del viewport** y no hay forma de
alcanzarlas sin desplazar la página, que está bloqueada por el overlay modal.
Evidencia: `before/d-confirm-30-lines.png` (captura) + `criteria.json S5.1–S5.6`.

Base del defecto: `components/ui/dialog.tsx:62` no declara `max-height` ni `overflow`; cada vista lo parchea
(por eso `PaymentModal` sí funciona y `InvoiceConfirmation` no).

### 7.2 Sustitución (plantilla obligatoria para todo `DialogContent`)

```tsx
<DialogContent className="flex max-h-[var(--dialog-max-h)] flex-col overflow-hidden sm:max-w-xl">
  <DialogHeader className="shrink-0" />
  <div data-dialog-scroll className="min-h-0 flex-1">   {/* único scroller */}
    …cuerpo…
  </div>
  <DialogFooter className="shrink-0 border-t pt-3" />
</DialogContent>
```

Aplicación a `InvoiceConfirmation.tsx`:

- `DialogContent`: `flex max-h-[var(--dialog-max-h)] flex-col overflow-hidden sm:max-w-xl` (antes
  `sm:max-w-xl` a secas).
- `DialogHeader`, el `dl` de paciente/caja, el `dl` de totales y la `Alert` de "total definitivo" quedan
  **fijos** (`shrink-0`).
- `<ul aria-label="Servicios por confirmar">` pasa a ser el **único** scroller:
  envolverlo en `<div data-dialog-scroll className="min-h-0 flex-1">`; el `li` se mantiene en 40 px
  (`py-2.5`) para que 30 líneas = 1200 px de contenido desplazable con encabezado y pie siempre visibles.
- `DialogFooter`: `shrink-0 border-t pt-3`, `grid grid-cols-1 sm:grid-cols-2`; **conservar** el foco inicial en
  el botón de confirmar (`InvoiceConfirmation.tsx:17`) y `Ctrl+Enter` (`:18`).
- Con 1 línea el diálogo **no** debe crecer más de lo necesario: `max-height` sin `height` fija.

Aplicación general (una vez, en `dialog.tsx`):
- `max-h-[var(--dialog-max-h)]` por defecto en `DialogContent` (85 `dvh`), y `--dialog-max-h: 85dvh` usa `dvh`
  (no `vh`) para no quedar tapado por la barra del navegador en portátil.
- `PaymentModal.tsx:250`: cambiar `max-h-screen` → `max-h-[var(--dialog-max-h)]`.
- **Regla del plan:** todo diálogo con contenido variable declara `data-dialog-scroll` en **exactamente un**
  descendiente. Sin excepciones. Queda cubierto también el diálogo de comprobante
  (`NewInvoiceViewLayout.tsx:340`, hoy `max-h-screen overflow-y-auto` con el `DialogContent` entero como
  scroller, es decir el encabezado se va con el scroll).

### 7.3 Criterio observable

| Criterio | Umbral |
|---|---|
| `S5.1` 1 línea | `top ≥ 0` y `bottom ≤ 768` |
| `S5.2` 10 líneas | idem |
| `S5.3` 30 líneas | idem |
| `S5.4` 30 líneas | `[data-dialog-scroll].scrollHeight > clientHeight` |
| `S5.5` 30 líneas | el **último** botón del diálogo tiene `bottom ≤ 768` |
| `S5.6` 30 líneas @ zoom 200 % (683×384) | cabe + desplaza + `overflowX ≤ 2` |
| `S5.7` `Esc` | cierra y devuelve el foco a un control visible |
| Teclado (manual) | `Tab` desde el cuerpo llega a `Cancelar` y a confirmar **sin** que el foco salga del diálogo (`focus trap` de Radix conservado) |

---

## 8. Superficie S6 — Reportes, catálogo y usuarios: tabla principal, filtros compactos

### 8.1 Antes (medido a 1366×768)

| Superficie | Tabla | Filas en el 1.er viewport | Filas visibles | Etiquetas/fila | Tarjetas | Alto fila |
|---|---|---|---|---|---|---|
| `/catalog` | 1 | primera fila en `top 449`, **5–6** | 5 | **4,13** (`62 badges / 15 filas`) | 0 | **49 px** |
| `/admin/users` | 1 | 3 | 3 | 2,67 | 4 | — |
| `/reports/executive` | 4 | primera fila en `top` **1621 px** | **0** | — | **17** | — |
| `/reports/audit` | 1 | 0 | 0 | 26 badges | 1 | — |

Detalle de la fila de catálogo (idéntica en 6 filas consecutivas): `Abdomen Simple · Radiología · Rayos X ·
L 45.00 · [Activo] [Visible en facturación] [Facturable] [Tarifa configurada]` — 4 etiquetas de las cuales 3
son el valor por defecto de toda la tabla.
Evidencia: `before/b-catalog.png`, `before/b-reports-executive.png`, `measurements-probe2.json`,
`criteria.json S6.1–S6.6`.

### 8.2 Sustitución

**Catálogo**
- `Estado` pasa a **un solo token textual**: `Activo` (14/400, `--color-muted-foreground`, punto verde
  `aria-hidden`). El color **no** es el único canal: el texto `Activo`/`Inactivo` siempre está.
- Las 3 etiquetas por defecto (`Visible en facturación`, `Facturable`, `Tarifa configurada`) **no se
  renderizan** cuando tienen el valor por defecto. Solo aparece la **excepción** en una columna
  `Excepciones` con tono `warning` y `title` explicativo (p. ej. `Sin tarifa`, `No facturable`,
  `Oculto en facturación`). Objetivo: **≤1 etiqueta por fila**.
- Barra de filtros: una sola franja de **44 px** (`búsqueda flex-1` + `Categoría` + `Estado` + `Limpiar` icono).
  Se elimina la `SectionCard "Filtros del catálogo"` (≈100 px) y el bloque `Servicios disponibles / Precio
  vigente, disponibilidad…`; el conteo `122 servicios` pasa a `--type-xs` junto a la barra.
- Alto de fila **44 px** (`py-2`), precio `tabular-nums` a la derecha, acciones en un `DropdownMenu` de icono
  (44×44) con `aria-label="Acciones de {servicio}"`.
- Objetivo: **≥6 filas** en el primer viewport y `firstRow.top ≤ 300 px`.

**Usuarios**
- Los 4 indicadores (`RBAC activo`, `Usuarios activos`, `Cambio pendiente`, `Roles editables`) dejan de ser
  tarjetas: pasan a **una línea de 32 px** con `dl` horizontal (`--type-sm`). Mantener ≤2 etiquetas por fila
  (rol + estado) — hoy ya cumple (2,00).
- `Crear usuario` sigue siendo la acción primaria del `PageHeader`.

**Reportes (`/reports/*`)**
- Las **4 tarjetas de resumen** (`Resumen / Caja / Consolidado / Auditoría`, 92 px de alto, 17 nodos
  card-like) se sustituyen por un **control segmentado** de 36 px (`Tabs`/`ToggleGroup` con
  `aria-label="Sección de informes"`), un solo `role="tablist"` y un panel por sección.
- La tarjeta de filtros (≈110 px) baja a **una fila de 44 px**: `Período rápido` (select 44) + `Desde` +
  `Hasta` + `Aplicar` (44) + `Exportar` (44, `DropdownMenu`). La línea de metadatos
  (`PERÍODO · ALCANCE · ÚLTIMA ACTUALIZACIÓN`) pasa a `--type-xs` en una sola línea de 20 px.
- Objetivo: **`firstRow.top ≤ 430 px` y ≥4 filas de tabla** en el primer viewport. Hoy: `1621 px` / 0 filas.
- Los gráficos con `height` fija no pueden exceder su contenedor (defecto ya reportado a 390 px); usar
  `aspect-ratio` + `min-height` y permitir scroll horizontal **contenido** en el SVG, no recorte.

### 8.3 Criterio observable

`S6.1` catálogo ≥6 filas en el primer viewport · `S6.2` ≤1 etiqueta por fila de catálogo ·
`S6.3` fila ≤44 px · `S6.4` `firstRow.top ≤ 430` en `/reports/executive` · `S6.5` ≥4 filas visibles ·
`S6.6` ≤2 etiquetas por fila en usuarios.
Además (manual): al abrir el detalle y volver, **los filtros y la página se conservan** (hoy se conservan en
historial vía `invoiceHistoryParams`; extender el mismo patrón a catálogo y reportes si aplica).

---

## 9. Superficie S7 — Respaldos: salud tipada, última copia recuperable, acciones claras

### 9.1 Antes (medido)

- `/backups`: **7 `SectionCard`**, **0 tablas**, contenido **1300 px** de alto, `h1 "Respaldos"` ✔.
- Estado normal: `Ultimo exitoso: Sin respaldo` + `ESTADO OPERATIVO: Requiere revision [Atención]` ✔ (no
  miente en el caso normal).
- Estado con `/api/system/health/detail` caído: `Ultimo exitoso / Pendientes / Fallidos: No disponible`
  ✔ y `healthyWords: []` ⇒ **no** declara salud con datos ausentes. Pero el bloque inferior sigue diciendo
  `Restauración local · Recuperación protegida … Sin pendientes de preparación detectados` junto a métricas
  `No disponible`, y **no existe** un estado tipado explícito ni mención de la **última copia recuperable**.
- Evidencia: `before/b-backups.png`, `before/h-backups-unknown-state.png`, `measurements-probe4.json`,
  `criteria.json S7.1–S7.4`.

### 9.2 Sustitución

1. **Un solo bloque `Salud del respaldo`** al tope, con `role="status"`, 4 celdas de `<dl>`:
   `Estado` · `Última copia recuperable` · `Automatismo` · `Pendientes/Fallidos`.
   - `Estado` es un **estado tipado** con 4 valores y texto siempre visible:
     `Verificado` (success) · `Requiere prueba` (warning) · `Error` (destructive) · **`Sin verificar` (warning,
     nuevo)**. `Sin verificar` es obligatorio cuando la fuente de salud no responde o algún campo es `null`.
   - `Última copia recuperable`: `fecha · tamaño · "Restaurable: sí/no"`. Si no hay dato:
     **`Sin verificar`**, nunca una fecha sustituta.
   - Prohibido que un valor ausente se pinte con tono success. Color + texto + icono (3 canales).
2. **Una tabla principal de respaldos** (`fecha`, `tipo`, `resultado`, `tamaño`, `checksum`, `acciones`), fila
   44 px, orden por fecha desc, con el `DataTable` compartido. Objetivo: **≥5 filas** en el primer viewport.
3. Las 5 tarjetas restantes (`GUIA DE SOPORTE`, `Recuperación con soporte`, `Restauración local`, …) se
   agrupan en **un bloque `Mantenimiento`** dentro de un `<details>` cerrado, con `Requiere soporte` rotulado
   como acción separada de `Crear respaldo` / `Actualizar` (que permanecen en el `PageHeader` a 44 px).
4. **Separación de riesgo (§14 del mandato):** `Restaurar` **no** puede estar al lado de `Crear respaldo`.
   Se mueve al bloque `Mantenimiento`, con `variant="destructive"`, confirmación por motivo y enlace al
   procedimiento local. Sin controles inactivos: si restaurar no está disponible en este equipo, se explica y
   **no** se renderiza el botón.
5. Objetivo de altura del contenido: **≤900 px** (hoy 1300 px).

### 9.3 Criterio observable

`S7.1` existe un estado tipado explícito (`Sin verificar|Verificado|Requiere prueba|Error`) ·
`S7.2` con la fuente de salud caída **no** aparece `saludable|todo bien|protegido` ·
`S7.3` se menciona la **última copia recuperable** · `S7.4` contenido ≤900 px.
Prueba manual "después": abortar `/api/system/health` ⇒ el bloque de salud muestra `Sin verificar` y **no**
aparece ningún mensaje tranquilizador fuera del bloque de mantenimiento cerrado.

---

## 10. Superficie S8 — Ayuda: tareas breves, búsqueda alineada, sin vocabulario de implementación

### 10.1 Antes (medido)

- `h1 "Ayuda institucional"`, **30 encabezados** de tarea, 1340 palabras, búsqueda presente (`type="search"`) ✔,
  **12 rutas reales enlazadas** ✔.
- Vocabulario de implementación: **1 ocurrencia dura** — `HelpView.tsx:369`:
  *"No duplican el **rail**: la navegación principal prioriza las acciones operativas."*
  El resto de términos (`componente`, `endpoint`, `framework`, `API`, `hook`, `token`, `React`, `backend`)
  = 0 ocurrencias.
- Evidencia: `criteria.json S8.1–S8.3`, `measurements.json → helpVocabulary`, `measurements-probe4.json → helpRail`.

> **Corrección de una afirmación del encargo:** la ayuda **no** es "extensa con vocabulario de
> implementación". Es un índice de tareas ya bastante alineado; el defecto real es **una** frase con
> vocabulario interno y la ausencia de enlace entre cada tarea y **el estado real** de la operación.

### 10.2 Sustitución

1. Sustituir la frase de `HelpView.tsx:369` por: *"No duplican la navegación principal: las acciones
   operativas tienen prioridad."*
2. **Regla de vocabulario** (gate automático en `S8.1`): el texto visible de `/help` no puede contener
   `rail, componente, endpoint, framework, React, backend, frontend, hook, token, API, router, deploy, build`
   con límite de palabra. Los términos del dominio (`caja`, `arqueo`, `recibo`, `correlativo`) sí.
3. **Tarea → estado real.** Cada ítem de tarea cuya acción dependa de un estado debe mostrar **una** línea de
   estado resuelta contra la fuente real y un enlace:
   - `Abrir caja` → `Sin caja abierta` + `[Ir a Caja]` (`/cashbox`) o `Caja #N abierta`.
   - `Nueva factura`/`Cobrar` → `Caja abierta: lista para facturar` + `[Nueva factura]` (`/billing/new`).
   - `Respaldos` → estado de la última copia (`Verificado | Sin verificar`) + `[Ir a Respaldos]`.
   Si el estado no se puede resolver, se muestra `Sin verificar` y **no** se inventa un texto.
4. **Densidad:** el `h2` de sección a 18/600; cada tarea en `Accordion` con el título a 14/600 y el cuerpo a
   14/400 con `max-width: 72ch`. Se elimina cualquier `SectionCard` decorativa; objetivo ≤6 bloques visibles
   en el primer viewport.
5. Título de la página: `Ayuda` (el `h1`), con `eyebrow "ASISTENCIA · AYUDA"` en la barra (S1).

### 10.3 Criterio observable

`S8.1` 0 términos de implementación · `S8.2` búsqueda presente · `S8.3` ≥3 anclas a rutas reales.
Manual: escribir en la búsqueda `cerrar caja` filtra tareas sin perder el foco; abrir la tarea `Abrir caja`
muestra un enlace que navega a `/cashbox` y **no** un texto genérico.

---

## 11. Superficies restantes cubiertas por el mismo lenguaje visual

| Superficie | Sustitución concreta | Criterio |
|---|---|---|
| **Acceso** (`LoginView`) | El `h1` pasa a ser el **nombre del hospital** (identidad, ya presente en `InstitutionalIdentity`); `Iniciar sesión` baja a `h2` 18/600. Tarjeta única, `max-w-md`, inputs 44 px, botón 44 px. Sin cambios de seguridad. | `h1` contiene el nombre del hospital; 1 `h1`; errores con `role="alert"` y foco al resumen |
| **Cambio de contraseña** | `h1` con `PageHeader` (24/600) y las 3 reglas de contraseña como lista de verificación estática (no animada). | 1 `h1`; `--type-*` del sistema; requisitos visibles antes de enviar |
| **Inicio** (`/dashboard`) | `h1` "Inicio" (hoy "Continuar operación") y una **tira plana** de 4 métricas (sin `Card` dentro de `Card`: hoy hay 3 nodos card-like anidados). Acción primaria única `Nueva factura` en el `PageHeader`. | 0 tarjetas anidadas; primera ventana muestra métricas + próxima acción |
| **Historial** | Tabla 44 px de fila (hoy 61 px), 1 token de estado, acciones en `DropdownMenu`; filtros en franja de 44 px con chips de filtro activo; detalle en `Drawer` con el mismo patrón de `data-dialog-scroll`. | ≥8 filas visibles; volver del detalle conserva filtros |
| **Caja** | La tira de 5 métricas (`cashbox-status-grid`) se mantiene en una fila a ≥1280 px y 2 filas a 768–1279; `Resumen/Movimientos/Arqueo/Cierre` como `ToggleGroup` de 36 px con `aria-label` ↦ panel `role="tabpanel"`; movimientos en tabla 44 px; arqueo como bloque con la diferencia en `--type-total`. | 3 estados de caja tipados (abierta/cerrada/desconocida); ≥6 movimientos visibles; diferencia con texto, no solo color |
| **Ajustes fiscales** | `h1` "Configuración" (hoy "Configuración hospitalaria", casi-duplicado con la barra) + pestañas con `role="tablist"` y el mismo control segmentado de 36 px. | 1 `h1`; sin etiquetas repetidas; foco visible en el panel (`tabs.tsx:82` `outline-none` sin sustituto — corregir) |
| **Recibos** | Se mantiene la estructura; se aplican S1 (barra), S5 (diálogo/preview con `data-dialog-scroll`) y el control segmentado. El contenido del documento es de hs-receipts. | preview sin desbordar el viewport; copias y páginas visibles antes de imprimir |
| **No encontrada** | `RouteState kind="not-found"` con `h1` 24/600 (hoy `RouteState.tsx:66` pinta `text-xl sm:text-2xl` = 20/24 px, un `h1` con **dos** tamaños según el ancho). | 1 `h1` a `--type-h1`; acción `Ir al inicio` de 44 px |

---

## 12. Accesibilidad como parte de la construcción (no como auditoría posterior)

1. **Semántica nativa.** `h1` único por ruta; jerarquía sin saltos; tablas reales con `<th scope>`; `radio`
   con `role="radiogroup"` (ya existe en `ServiceSearch`); listas con `<ul>/<li>` (ya existe en el carrito).
2. **Foco.** `:focus-visible` con `outline: 2px solid var(--color-ring); outline-offset: 2px`; **nunca** se
   retira el outline sin sustituto. Los anillos de Radix deben llegar a **≥3:1** (`ring-ring`, sin `/50`).
   Todo overlay atrapa el foco y lo devuelve al disparador (`Esc` incluido) — ya funciona; no romperlo.
3. **Controles.** Objetivo **≥44×44** en acciones monetarias y de caja; **≥24×24** absoluto. Los steppers del
   carrito (32×32) cumplen 2.5.8 pero deben llevar `aria-label` con el nombre del servicio y separación de
   ≥8 px entre sí.
4. **Errores.** Junto al campo (`aria-describedby`) y, cuando bloquean el cobro, en `#invoice-submit-blockers`
   con `role="alert"`. Sin `toast` para errores de validación de dinero.
5. **Reflow / zoom.** A 200 % (683×384 CSS) ninguna superficie con scroll horizontal; el POS ya conmuta a
   barra inferior + drawer (`BillingBottomBar`), comportamiento **correcto** que debe conservarse. Los
   diálogos deben seguir el §7. **No** usar `zoom` ni escalado global para "hacer caber".
6. **Movimiento reducido.** `@media (prefers-reduced-motion: reduce)` conserva opacidad/color y elimina
   transformaciones (ya global en `styles.css:76-82`): no re-declarar por componente.
7. **Sin controles inactivos.** Prohibido renderizar botones/chips sin handler o `href` "para completar" una
   maqueta. Si una capacidad no está disponible, se explica en texto y no se dibuja el control.

---

## 13. Presupuesto de movimiento (definitivo y acotado)

| Elemento | Frecuencia | Decisión |
|---|---|---|
| Cobro, confirmación de emisión, guardar | baja, crítica | **sin animación**; feedback de color/estado ≤120 ms |
| Botón primario / destructivo | baja | `:active { scale(0.96) }`, `transform` 150 ms `--ease-out`, `prefers-reduced-motion` lo anula |
| Resto de botones, chips de categoría, filas | alta (100+/día) | se conserva `active:translate-y-px` (instantáneo) — **no** se añade escala |
| Diálogos y drawer | ocasional | entrada `opacity + translateY(8px)` 220 ms; salida `opacity + translateY(−12px)` 150 ms `ease-out` |
| Stagger de entradas | raro | **solo** éxito de cobro y estados vacíos/primer load, 50 ms entre bloques (rango emil 30–80 ms), nunca bloquea interacción |
| Cross-fade de iconos | raro | `scale .25→1`, `opacity 0→1`, `blur 4px→0`, 300 ms `cubic-bezier(.2,0,0,1)`, ambos iconos en el DOM |
| `transition-all` | — | **prohibido**; siempre `transition-property` explícito |

---

## 14. Qué NO hacer

1. No conservar el layout rechazado "porque los tests ya pasan".
2. No introducir `zoom`, `transform: scale()` global ni tipografía <13 px para que quepa.
3. No quitar bordes de inputs ni el foco para cumplir una receta de sombras.
4. No convertir el resumen del POS en una **fila de total a 14 px**: el total es jerarquía superior.
5. No poner animación en `Enter`, en el cobro ni en los steppers.
6. No declarar "cerrado"/"vacío"/"0.00" cuando el estado real es **desconocido**.
7. No añadir controles sin acción.
8. No re-declarar `prefers-reduced-motion` por componente ni eliminar la regla global.
9. No cambiar el significado de `--press-scale` a otro valor ni promediar `0.96` con `0.97`.
10. No tocar `frontend/src/printing/**` (recibos) sin coordinación con hs-receipts.

---

## 15. Orden de implementación sugerido (dependencias reales)

1. `components/ui/button.tsx` (altura) + `dialog.tsx` (alto máximo + `data-dialog-scroll`) + tokens del §2.
   Bloquea a los demás.
2. `ContextBar.tsx` + `PageHeader.tsx` (S1) — cambia la altura disponible en todas las páginas.
3. `InvoiceConfirmation.tsx` + `PaymentModal.tsx` (S5) — corrección HIGH independiente y de alto valor.
4. `NewInvoiceViewLayout.tsx` + `PatientStep.tsx` + `ServiceSearch.tsx` (S2).
5. `InvoiceCart.tsx` (S3) + resumen y estado del dinero (S4).
6. `CatalogView.tsx` / `ReportsView.tsx` / `UsersView.tsx` (S6).
7. `BackupsView.tsx` (S7) + `HelpView.tsx` (S8) — S8 incluye la corrección de `HelpView.tsx:369`.
8. Resto de §11.

---

## 16. Riesgos, dependencias y límites

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Cambiar `button.tsx` altera todas las pantallas | medio | revisar `e2e/accessibility.spec.ts`, `all-buttons-smoke.spec.ts`; actualizar el gate si asume `sm:h-8` |
| El árbol está siendo editado por hs-frontend en paralelo | alto para medir | medir el "después" con el árbol quieto y registrar hash; Vite HMR remonta la app y resetea el POS a mitad de flujo (observado) |
| `criteria.json` "antes" es de un snapshot concreto | medio | `REVISION_SNAPSHOT.txt` fija HEAD + hashes + mtimes |
| Duplicar título barra/h1 puede afectar gates E2E que buscan el `h1` por texto | bajo | el `h1` **no** cambia de texto en S1; solo desaparece el texto de la barra |
| Achicar el paciente puede ocultar `Datos opcionales` | bajo | el `<details>` conserva el contenido y su `aria-expanded/aria-controls` |
| 44 px en `/billing/new` reduce filas de servicio | bajo | el presupuesto del §4.2 deja el `top` de la primera fila en ≤430 px |

---

## 17. Estado y NOT VERIFIED de este plan

**Verificado en render por hs-ux (con evidencia en `hospital-ai/evidencia/R2-UX-01/`):** S1 (altura de barra,
duplicación, `h1`, overflow), S2 y S3 (geometría del POS a 1366×768 y 1920×1080 con `scrollY=0`), S4 (altura
del botón, coherencia de cifras, comportamiento con carrito vacío y con `/api/services` abortado), S5
(diálogos de 1/10/30 líneas y zoom 200 %), S6 (filas/tarjetas/etiquetas de catálogo, usuarios, reportes),
S7 (respaldos normal y con health caído), S8 (vocabulario, búsqueda, anclas), y la comprobación transversal de
nombre accesible y frontera de inputs.

**NOT VERIFIED (explícito; no se declara corregido ni aprobado):**
1. **Lectura con lector de pantalla** (NVDA/JAWS/VoiceOver): no disponible en el entorno.
2. **Zoom real del navegador** (150 %/200 % con `Ctrl+`+): no accionable en el arnés; se usó viewport CSS
   reducido (equivalente de reflow) y se declara como tal.
3. **`prefers-reduced-motion` en render** y replay a velocidad reducida: no ejecutado.
4. **Teclado manual completo** en diálogos/tablas/popovers de las 16 rutas: no recorrido (solo `Esc` en el
   diálogo de confirmación).
5. **Impresión física, papel, bandejas y PDF**: fuera de alcance de este plan.
6. **Tema oscuro**: no forma parte de esta pasada estructural (no se midió en oscuro).
7. **La aprobación visual del dueño no se presume** por este plan ni por `PASS` del verificador.
8. **La segunda pasada (medición "después") no está hecha todavía**: el árbol estaba siendo editado durante
   esta tarea. Queda **pendiente y obligatoria** para cerrar la responsabilidad de hs-ux; se ejecuta con
   `measure-r2.mjs --label=despues` y `criteria.json` como evidencia.

## 18. Handoff a hs-frontend

- Este documento es la especificación. **No hay que adivinar ningún valor**: cada superficie trae px, clases y
  selectores.
- El verificador `hospital-ai/evidencia/R2-UX-01/tools/measure-r2.mjs` es el contrato ejecutable: hoy da
  **10/40 PASS** en el snapshot "antes". Objetivo de aceptación: **40/40** sin desactivar ningún criterio.
- Cuando el implementador avise que el lote está montado, hs-ux vuelve a medir en render, publica
  `hospital-ai/diseno/AFTER_RENDER_R2.md` y reporta **antes/después** con las mismas cifras.
