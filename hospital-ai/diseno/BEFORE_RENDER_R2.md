# BEFORE_RENDER_R2 — Estado renderizado "antes" del rediseño estructural

**TASK_ID:** R2-UX-01 · **Autor:** hs-ux · **Fecha:** 2026-09-17/18
**Raíz:** `C:\Projects\S_Hospital_AI` · **Nada de producto fue modificado por hs-ux.**
**Plan asociado:** `hospital-ai/diseno/PLAN_ESTRUCTURAL_R2.md`
**Evidencia:** `hospital-ai/evidencia/R2-UX-01/before/` (38 PNG + 6 JSON de medidas)

## 0. Método y límites

- Chromium real (Playwright 1.61.1) headless contra el laboratorio local:
  backend `127.0.0.1:18080`, frontend `127.0.0.1:15173`, base **desechable** `sh_ai_lab_local`,
  usuario sintético `admin.validacion` (seed de laboratorio). Ningún dato de producción, ningún secreto.
- Se crearon facturas y pagos **sintéticos** en la base desechable para poder medir historial, confirmación,
  cobro y éxito.
- **Mutaciones acotadas** a la base del laboratorio identificada en el propio runner.
- Zoom 200 % = viewport CSS reducido a la mitad (683×384). Sin `zoom` CSS, sin escalado de página.
- **Árbol en movimiento:** `frontend/src/**` estaba siendo editado por `hs-frontend` durante la medición
  (`NewInvoiceView.tsx` 23:20:10). Snapshot del árbol medido: `REVISION_SNAPSHOT.txt`
  (HEAD `baa41f97…`, hashes SHA-256 y mtimes por archivo).
- **Artefacto de laboratorio declarado:** con Vite en modo dev, el HMR remonta la aplicación al guardar un
  archivo, lo que **reinicia el estado del POS** (carrito y paciente) a mitad de un flujo automatizado. Se
  observó dos veces. No se reporta como defecto de producto.

## 1. Rutas recorridas (16)

`/` · `/login` · `/dashboard` · `/billing/new` · `/cashbox` · `/catalog` · `/invoices` · `/reports` ·
`/reports/executive` · `/reports/cash` · `/reports/audit` · `/backups` · `/settings/fiscal` ·
`/settings/institutional-receipts` · `/admin/users` · `/support` · `/help` · `/about` · ruta inexistente.
Más los estados condicionales: acceso, caja rápida, confirmación, pago, éxito, detalle de factura,
movimientos/arqueo/cierre de caja.

## 2. Medidas del "antes" que sustentan el plan

### 2.1 Shell

| Medición | Valor |
|---|---|
| Alto de la barra de contexto | 64 px en las 11 rutas medidas |
| Patrones de encabezado simultáneos | 2 (`context-bar` + `page-header`) |
| Rutas con **título duplicado** barra ↔ `h1` | 4 (`/billing/new`, `/cashbox`, `/backups`, `/settings/institutional-receipts`) |
| Rutas con casi-duplicado | 3 (`/catalog`, `/invoices`, `/settings/fiscal`) |
| Rail expandido | 256 px |
| Tamaños de encabezado distintos por ruta | hasta 6 (24/20/18/16/14/12) |
| `h1` por ruta | 1 en las 16 rutas (correcto) |
| Overflow horizontal | 0 en las 16 rutas (correcto) |

### 2.2 POS a 1366×768 con `scrollY === 0` y carrito con 4 líneas

| Elemento | Valor medido |
|---|---|
| Bloque paciente | `226 → 416` = **190 px** |
| `#service-search` | `top` **513 px** |
| Rejilla de categorías | **96 px** (2 filas) |
| Primera fila de servicio | `top` **836 px** ⇒ **0 filas visibles** |
| Filas de servicio visibles antes de desplazar | **0** (objetivo ≥5) |
| Alto de fila de servicio | 65 px |
| Alto de línea de carrito | **167–168 px** |
| Líneas visibles en el carrito | **1** de 4 (`clientHeight 193` / `scrollHeight 671`) |
| Etiquetas en las líneas del carrito | 6 badges / 4 líneas |
| Bloque resumen + acción | 208 px |
| **Botón primario** | **32 px** de alto (27 controles del POS miden 32 px) |
| Total | 24 px/700 `tabular-nums` ✔ |
| Coherencia total ↔ acción ↔ servidor | ✔ `L 189.75` = `Emitir y cobrar · L 189.75`; factura `000-001-01-00000002` = `120.75` en UI y en `GET /api/invoices` |
| Carrito vacío | botón `disabled` con `Agregue servicios` ✔ (no hay cobro en cero) |
| `/api/services` abortado | `SERVICIOS (0)` + "No hay servicios agregados", **sin error ni reintento** ✗ |

### 2.3 Diálogo de confirmación

| Caso | Alto | `top` | `bottom` | `max-height` | `overflow-y` |
|---|---|---|---|---|---|
| 1 línea | 474 px | 147 | 621 | `none` | `visible` |
| 10 líneas | **834 px** | **−33** | 801 | `none` | `visible` |
| 30 líneas | **1329 px** | **−280** | 1049 | `none` | `visible` |
| 30 líneas @ zoom 200 % (683×384) | 1329 px | **−472** | 857 | `none` | `visible` |
| `PaymentModal` | 643 px | 63 | 706 | `768px` | `auto` ✔ |

Con 30 líneas, `Cancelar` y `Emitir y abrir cobro` quedan **fuera del viewport** y el cuerpo **no** desplaza.
Confirmado también en la captura `d-confirm-30-lines.png`.

### 2.4 Tablas, tarjetas y etiquetas

| Superficie | Tabla | Filas en el 1.er viewport | Etiquetas/fila | Tarjetas | Alto de fila |
|---|---|---|---|---|---|
| `/catalog` | 1 | 5–6 (primera fila en `top 449`) | **4,13** (62 / 15) | 0 | 49 px |
| `/admin/users` | 1 | 3 | 2,67 | 4 | — |
| `/reports/executive` | 4 | **0** (primera fila en `top` **1621 px**) | — | **17** | — |
| `/reports/audit` | 1 | 0 | 26 badges | 1 | — |
| `/backups` | **0** | 0 | 3 | **7** | — |

Fila de catálogo repetida 6 veces seguidas:
`Abdomen Simple · Radiología · Rayos X · L 45.00 · [Activo] [Visible en facturación] [Facturable] [Tarifa configurada]`
— 3 de las 4 etiquetas son el valor por defecto de toda la tabla.

### 2.5 Respaldos

- Normal: `Ultimo exitoso: Sin respaldo`, `ESTADO OPERATIVO: Requiere revision [Atención]` — **no** miente.
- Con `/api/system/health/detail` abortado: `Ultimo exitoso / Pendientes / Fallidos = No disponible`
  (`healthyWords: []` ⇒ no declara salud), pero **no** hay estado tipado explícito, **no** se muestra la
  última copia recuperable, y el bloque `Restauración local · Recuperación protegida … Sin pendientes de
  preparación detectados` queda junto a métricas `No disponible`.
- Contenido: 1300 px de alto, 0 tablas, 7 `SectionCard`.

### 2.6 Ayuda

- `h1 "Ayuda institucional"`, 30 encabezados de tarea, 1340 palabras, búsqueda presente, 12 rutas enlazadas.
- **1** ocurrencia de vocabulario de implementación: `HelpView.tsx:369` → *"No duplican el **rail**: la
  navegación principal prioriza las acciones operativas."*
- El resto de términos técnicos: 0 ocurrencias.

### 2.7 Comprobaciones transversales

| Comprobación | Resultado |
|---|---|
| Controles visibles sin nombre accesible | **0** en 10 rutas ✔ |
| Inputs con frontera visible (borde o anillo) | 100 % ✔ (el `outline-none` de `input.tsx` tiene sustituto) |
| Overflow horizontal a 1366×768 | 0 en 16 rutas ✔ |
| Anillo de foco ≥3:1 | **No** (heredado de C1-UX-01: `ring-ring/50` = 2,15:1) — pendiente |

## 3. Discrepancias declaradas (no se ocultan)

1. `REVISION_RENDERIZADA_C1.md §G-3` afirmó "paciente, servicios y Total en la primera ventana" en el POS a
   1366×768. Mi medición con `scrollY === 0` da **0 filas de servicio visibles** (la primera fila empieza en
   `top 836`). La captura previa se tomó **después** de pulsar una fila de servicio, y ese clic desplaza la
   página (con el clic, la región del paciente aparece en `top −220`, es decir con scroll). Se reporta como
   discrepancia de método, no como contradicción del gate.
2. El encargo R2 describe "resumen y cobro con cifras incompatibles". **No lo reproduje**: en el estado
   actual el total del resumen, la etiqueta de la acción y el total del servidor coinciden. Lo accionable es
   el estado `no confirmado` (una API caída se ve como `L 0.00` + catálogo vacío).
3. El encargo describe "ayuda extensa con vocabulario de implementación". El defecto real medido es **una**
   frase; el resto del vocabulario técnico no aparece.
4. El encargo menciona `--press-scale: 0.96` sin consumidores y ausencia de `active:scale`: **confirmado**
   (1 sola aparición de `press-scale` = su declaración; 0 ocurrencias de `active:scale` en `frontend/src`).
   El botón sí tiene un feedback de press distinto: `active:not-aria-[haspopup]:translate-y-px`
   (`components/ui/button.tsx:8`).

## 4. Índice de evidencia

| Archivo | Contenido |
|---|---|
| `before/a1-login.png` | Acceso sin sesión |
| `before/b-*.png` (16) | Las 16 rutas a 1366×768 |
| `before/c-pos-1366-empty-noscroll.png` | POS vacío, `scrollY=0` |
| `before/c-pos-1366-cart-noscroll.png` | POS con 4 líneas, `scrollY=0` (el defecto de densidad) |
| `before/c-pos-zoom200-cart.png` | POS a zoom 200 % (683×384) |
| `before/d-confirm-1-line.png` · `d-confirm-10-lines.png` · `d-confirm-30-lines.png` | Diálogo de confirmación (el HIGH visual) |
| `before/d-confirm-30-lines-zoom200.png` | El mismo diálogo a zoom 200 % |
| `before/e-confirm-final.png` · `e-payment-modal.png` · `e-payment-success.png` | Emisión → cobro → éxito |
| `before/f-invoices-with-data.png` · `f-invoice-detail.png` | Historial con datos y detalle |
| `before/g-cashbox-summary.png` · `-movements.png` · `-reconciliation.png` · `-close.png` | Las 4 vistas de caja |
| `before/h-backups-unknown-state.png` | Respaldos con la salud caída (estado desconocido) |
| `before/i-pos-services-error.png` | POS con `/api/services` abortado |
| `before/measurements.json` | Medición base: shell, POS, diálogos, ayuda, respaldos, tablas, consola |
| `before/measurements-probe2.json` | Encabezados por ruta, POS a 3 resoluciones, filas de catálogo, primer viewport |
| `before/measurements-probe3.json` | POS a 1366×768 sin desplazar (vacío y con carrito) + zoom 200 % |
| `before/measurements-probe4.json` | Encabezados de rutas lazy, respaldos desconocido, ayuda |
| `before/measurements-probe5.json` | Histograma de alturas de controles y totales del servidor |
| `before/measurements-probe6.json` · `measurements-probe7.json` | Estado del POS con `/api/services` caído |
| `antes/criteria.json` | Ejecución del verificador: **10/40 PASS** |
| `REVISION_SNAPSHOT.txt` | HEAD, hashes y mtimes del árbol medido |
| `tools/measure-r2.mjs` | Verificador de criterios reutilizable (contrato ejecutable del plan) |
| `tools/capture-before.mjs`, `tools/probe-before-{2..7}.mjs` | Runners acotados del "antes" |

## 5. Lo que este informe NO verifica

Lectura con lector de pantalla; zoom real del navegador con `Ctrl+`; `prefers-reduced-motion` en render;
recorrido manual completo de teclado en las 16 rutas; tema oscuro; impresión física y PDF; y la aprobación
visual del dueño. Nada de eso se declara aprobado.
