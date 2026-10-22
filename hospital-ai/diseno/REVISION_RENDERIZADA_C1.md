# REVISION_RENDERIZADA_C1 — Revisión visual renderizada de todas las superficies

Tarea: **C1-UX-01** · Agente: **hs-ux** · Fecha: 2026-09-17
Raíz: `C:\Projects\S_Hospital_AI` (worktree aislado; **no** se tocó `C:\Projects\S_Hospital`).
Mandato: continuación §4; `MANDATO_DEFINITIVO.md` §8, §9, §10, §22.
Navegador real: **Chromium 141 vía Playwright 1.61** (autorizado, runner acotado).

> **Este documento no declara aprobación visual del dueño ni una nota.** Es un veredicto técnico con evidencia reproducible. Lo que no se ejecutó queda **NOT VERIFIED** en su casilla.

---

## 0. Método y límites

| Aspecto | Qué se hizo |
|---|---|
| Laboratorio | Backend `http://127.0.0.1:18080`, frontend `http://127.0.0.1:15173`, base desechable `sh_ai_lab_local` (MariaDB 10.4.32). No se detuvo ni reinició el laboratorio. |
| Usuario | `admin.validacion` (sintético del seeder de laboratorio) y `cajero.validacion` para los estados sin permiso. |
| Datos | Se crearon 4 facturas y 4 pagos sintéticos en la base **desechable** para poder revisar historial, éxito de cobro, consolidado y detalle. Ningún dato de producción. |
| Capturas | **204 PNG** en `hospital-ai/evidencia/C1-UX-01/shots/`. |
| Datos crudos | `review-data.json` (673 KB), `flows-data.json`, `states-data.json`, `verify-data.json`, `payment-enter-data.json`, `payment-final2-data.json`, `double-submit-data.json`. |
| Límites | No se editó código de producto. No se generó ni inspeccionó ningún PDF. No hay lector de pantalla disponible en este entorno. No se ejecutó zoom real del navegador (ver §7). |

### 0.1 Skills y contratos releídos (SHA-256 completo)

| Ruta | SHA-256 |
|---|---|
| `.agents/skills/better-ui/SKILL.md` | `c7cb0156f6f4e85b3030d36b74463c5fdefe740a0810b817e39fa00af80f9fdb` |
| `.agents/skills/better-ui/surfaces.md` | `cfa523043dae1e9c0750a93cf91ef5cb6a379bb22e93adcf2684f6142c1c84cd` |
| `.agents/skills/better-ui/icons.md` | `9e9e1c67101e206b364e96dc03937eafc25fcca9385884b5d763a6d31913246b` |
| `.agents/skills/better-ui/animations.md` | `90d4f16e9e2f4a63853c225c5abe0f81377f368701b1c15cffdfcb5651092581` |
| `.agents/skills/better-ui/enter-exit.md` | `4e74be10aa3f8b466d0dac18e177ddf214a38d6c5386df30dc0807b0b467bde3` |
| `.agents/skills/better-ui/icon-transitions.md` | `55d6b3420b63fc9b09870c8c0ec7d2c4336c87834a9d4b4443311829648d11ed` |
| `.agents/skills/better-ui/performance.md` | `66aee12872572ca72b5f8e1676f71efeaf62df93d32599b1b32def6461e95c8a` |
| `.agents/skills/emil-design-eng/SKILL.md` | `a2ee9da0840c23b509a27e742edbc8f8fdb4416ca7d6ffde67d79023bfb8a5bf` |
| `hospital-ai/diseno/TOKENS_V2.md` | `08baf59f97f16ed8490dd722008b175f9133b38930918279b9e15703b82bd10f` |
| `hospital-ai/diseno/CONTRATO_PANTALLAS_V2.md` | `74903b975592f49fe8e84c33c5cae29fda2a5deec5ac24ef3caec6efc2f7463f` |
| `hospital-ai/diseno/CRITERIOS_RECIBO_V2.md` | `90c4b5d018d2ffc35178ddb8d71b5ae89921133b015fd74545ebfc5778d0afa9` |
| `hospital-ai/progreso/VISUAL.md` (antes de esta revisión) | `670c919adcf840dd85ecbe6e911b2bae332725843c66bcceb7dd80a4bad85caf` |

Ningún valor de escala, número de componentes ni «cero infracciones de una regla CSS» se usó como sustituto de la evaluación visual: los juicios de §4–§8 salen de capturas renderizadas y mediciones hechas en el DOM vivo.

---

## 1. Inventario de rutas reales y alcanzabilidad

Recorrido hecho **con clics reales** sobre el rail y las pestañas de Reportes, no sólo por declaración de `AppRoutes.tsx`.

### 1.1 Rail de `admin.validacion` (10 enlaces) — todos alcanzables

| Navegación | `href` | Clic → URL final | ¿OK? |
|---|---|---|---|
| Inicio | `/dashboard` | `/dashboard` | ✔ |
| Nueva factura | `/billing/new` | `/billing/new` | ✔ |
| Caja | `/cashbox` | `/cashbox` | ✔ |
| Catálogo | `/catalog` | `/catalog` | ✔ |
| Historial | `/invoices` | `/invoices` | ✔ |
| Reportes | `/reports` | `/reports?from=…&to=…` | ✔ |
| Respaldos | `/backups` | `/backups` | ✔ |
| Configuración | `/settings/fiscal` | `/settings/fiscal` | ✔ |
| Usuarios | `/admin/users` | `/admin/users` | ✔ |
| Ayuda | `/help` | `/help` | ✔ |

### 1.2 Subnavegación de Reportes (4 pestañas) — todas alcanzables

| Pestaña | Clic → URL | `h1` renderizado | ¿OK? |
|---|---|---|---|
| Resumen | `/reports/executive?from=…&to=…` | "Resumen del período" | ✔ |
| Caja | `/reports/cash` | "Operación de caja" | ✔ |
| **Consolidado (nuevo)** | `/reports/consolidated?from=…&to=…` | "Consolidado por caja" | ✔ |
| Auditoría | `/reports/audit` | "Auditoría" | ✔ |

### 1.3 Superficies sin entrada en el rail pero alcanzables

| Superficie | Cómo se llega | Evidencia |
|---|---|---|
| Soporte | URL directa `/support` (no está en el rail; `navigation: false`) | `soporte-1366x768-datos.png` |
| Acerca de | URL directa `/about` (`navigation: false`) | `acerca-1366x768-datos.png` |
| **Recibos institucionales** | Botón "Administrar recibos" en Configuración → `FiscalSettingsView.tsx:99`; el rail no la muestra para admin (por diseño) | `config-recibos-1366x768-datos.png` |
| Detalle de factura | Drawer en `/invoices` (`?invoice=<id>`) | `historial-detalle-drawer-1366x768.png` |
| Ruta inexistente | `/ruta-inexistente-c1ux01` → "Ruta no encontrada" | `notfound-1366x768.png` |
| Login / cambio de clave | Render condicional en `App.tsx` (sin ruta) | `probe-login*.png`, §3 |

**Rutas inalcanzables: ninguna.** Las dos superficies fuera del rail (Soporte, Acerca de) tienen ruta válida y se alcanzan por URL directa; no tienen entrada de navegación y eso es coherente con `appNavigation.ts:233,244` (`navigation: false`). Queda como observación de producto, no como defecto: para un operador sin marcador, `/support` y `/about` no son descubribles desde la interfaz salvo por el enlace de Ayuda. Se registra como **LOW** (ver §4).

---

## 2. Matriz de ejecución real

| Comprobación | Ejecutado | Cobertura |
|---|---|---|
| Revisión visual renderizada | **Sí** | 18 rutas × 6 configuraciones de viewport = **108 renders**; 204 capturas |
| Overflow horizontal de documento | **Sí** | 108/108 medidos (`scrollWidth` vs `clientWidth`) |
| `h1` único y orden de encabezados | **Sí** | 18/18 rutas |
| Contraste de texto (render, fondo efectivo) | **Sí** | 18/18 rutas a 1366 px |
| Contraste del anillo de foco | **Sí** | Medición del `box-shadow` computado + composición alfa + ratio WCAG |
| axe-core (WCAG 2.0/2.1/2.2 A+AA) | **Sí** | 18 rutas en claro + 9 en oscuro = 27 corridas |
| Teclado (recorrido Tab) | **Sí** | 26 pasos por ruta, 18 rutas |
| Zoom real del navegador (150/200 %) | **No** | Ver §7 — limitación del arnés, documentada |
| Reflow por zoom (equivalente) | **Sí** | 18 rutas × 2 configuraciones |
| Lector de pantalla | **No** | No hay NVDA/JAWS/VoiceOver disponibles |
| PDF / recibo impreso | **No** | Fuera de esta tarea (hs-receipts) |

---

## 3. Revalidación del Enter seguro (mandato §4) — **revalidado, cumple**

Secuencia completa ejecutada en navegador real con Playwright, contando peticiones `POST` de red. Evidencia: `payment-enter-data.json`, `payment-final2-data.json`, `double-submit-data.json`, capturas `pos-pago-*.png`.

| # | Comprobación | Resultado medido | Veredicto |
|---|---|---|---|
| 1 | Emisión de factura con **Enter sobre el botón explícito** "Emitir y abrir cobro" enfocado (`InvoiceConfirmation`) | `POST /api/invoices` = **1**; `POST …/payments` = **0** | ✔ el Enter del diálogo no cobra |
| 2 | **Enter desnudo en el campo de monto** (`#payment-amount`) | `POST` de pago = **0**; el modal sigue abierto; monto conservado (`100.00`) | ✔ **no hay envío implícito** |
| 3 | **Enter desnudo en el campo de referencia** (método Tarjeta) | `POST` de pago = **0**; modal abierto; referencia conservada (`REF-C1UX01-0001`) | ✔ no hay envío implícito |
| 4 | Barra espaciadora en el monto | `POST` de pago = **0** | ✔ |
| 5 | **Botón explícito de confirmación con teclado** (foco + `Enter`) | `POST /api/invoices/3/payments` = **1**; aparece el diálogo de éxito | ✔ operable sin ratón |
| 6 | **Botón explícito con ratón** | Cobro registrado (facturas 1, 2 y 4) | ✔ operable con ratón |
| 7 | **No obliga a memorizar `Ctrl/Cmd+Enter`** | El flujo completo se completó sin usar `Ctrl+Enter` (pasos 1, 5, 6). `Ctrl+Enter` sigue funcionando en el monto y registra el pago (`payment-final2-data.json: ctrlEnter.posts = 1`) y está documentado en la ayuda | ✔ |
| 8 | **No se anulan `Enter`/`Espacio` en controles nativos** | Los botones, radios (`role="radio"` en `PaymentModal`) y checkboxes conservan activación nativa; el `preventDefault` de `PaymentModal.tsx:222-231` sólo aplica a los dos `input` de texto | ✔ |
| 9 | **Revisión previa de paciente/importe antes de confirmar** | El diálogo de confirmación muestra Paciente, Caja, Servicios con importes, Subtotal y **Total estimado** antes de emitir (`pos-confirmacion-1366x768.png`) | ✔ |
| 10 | **Doble activación** | **3 pulsaciones rápidas** de Enter sobre el botón explícito → **1** `POST …/payments` | ✔ sin doble cobro |
| 11 | **Recuperación tras error** (500 controlado en el POST de pago) | El modal permanece abierto, el monto **se conserva** (`50.00`) y se muestra "No se completó el cobro — … Revise los datos y vuelva a intentar." | ✔ sin pérdida de datos |

Código responsable (no se editó): `PaymentModal.tsx:217-231` (guarda del Enter), `PaymentModal.tsx:213` (`submitLockRef`), `NewInvoiceView.tsx:61,420` (`submitPaymentInFlightRef`), `NewInvoiceView.tsx:445-451` (clave de idempotencia por payload).

**Conclusión §4: la corrección del Enter se mantiene.** El cobro no se dispara por envío implícito desde monto/referencia, el botón explícito funciona con teclado y con ratón, no hace falta memorizar `Ctrl/Cmd+Enter`, y la doble activación no duplica el pago.

---

## 4. Hallazgos

### 4.1 Tabla de polish (formato `better-ui`)

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | `frontend/src/components/ui/button.tsx:8`, `input.tsx:11`, `select.tsx:45`, `checkbox.tsx:17`, `switch.tsx:18`, `radio-group.tsx:29`, `accordion.tsx:45`, `textarea.tsx:10`, `toggle.tsx:10`, `input-group.tsx:15` | `focus-visible:ring-3 focus-visible:ring-ring/50` → anillo de 3 px al 50 % de `#0F766E` = **2,15:1** sobre blanco / 2,11:1 sobre `#F8FAFC` | `focus-visible:ring-ring` a opacidad plena (5,47:1), o `2px solid var(--color-ring)` como ya hace `styles.css:66-69` para enlaces | `TOKENS_V2.md §7` fija `--focus-ring-contrast-min: 3` y WCAG 1.4.11 exige ≥3:1:1 al indicador de foco. Los enlaces sí cumplen (outline 2 px `#0F766E` = 5,47:1); los controles shadcn no |
| MEDIUM | `frontend/src/components/ui/tabs.tsx:82` | `outline-none` en el `TabsContent` (`role="tabpanel"`, `tabIndex=0`) sin sustituto `focus-visible` → `outline-style: none`, `box-shadow: none` al enfocar | `focus-visible:ring-2 focus-visible:ring-ring` o `outline: 2px solid var(--color-ring)` | `better-ui/SKILL.md`: nunca quitar el outline sin reemplazo. En `Configuración` y en `Recibos institucionales` el tabpanel recibe foco real por Tab y no hay señal visible (medido: `details.txt`, claves `config-fiscal` y `config-recibos`) |
| MEDIUM | `frontend/src/features/invoices/components/InvoiceCart.tsx` (`div[data-billing-cart-lines="true"]`) | Contenedor `overflow-y-auto` desplazable (`scrollHeight 138` / `clientHeight 89`) sin `tabindex` ni contenido enfocable en el estado "carrito vacío" → axe `scrollable-region-focusable`, impact **serious** | Añadir `tabIndex={0}` + `role="region"` rotulado al contenedor de líneas | Un usuario de teclado no puede desplazar la cuenta; sólo apareció en el estado de carrito vacío (con líneas el contenido interno es enfocable y axe pasa: `pos-final-data.json`, `axePosWithItems = []`) |
| MEDIUM | `frontend/src/features/reports/components/AuditSummaryPanel.tsx:20` | `<dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">` con `<dt>`, `<dd>` **y un `<p>` extra** dentro del grupo `<div>` → axe `definition-list`, impact **serious** | Mover el `<p>` auxiliar dentro del `<dd>` | HTML inválido en una lista de definiciones; rompe la relación término/definición para lectores de pantalla |
| MEDIUM | `frontend/src/features/reports/ReportsExecutive.tsx` (tarjetas de gráfico) | A **390 px** la sección "Tendencia diaria" mide **544 px** dentro de una columna de 366 px, sin contenedor con scroll: el documento no desborda (`scrollWidth = 390`) y el gráfico/etiquetas quedan **recortados e inalcanzables** | `min-width: 0` + `overflow-x: auto` contenido en la tarjeta (o reducir a la altura/ancho del contenedor antes del primer render de `ResponsiveContainer`) | `CONTRATO_PANTALLAS_V2 §8` móvil: "gráficos con altura acotada; tablas apilables; sin scroll horizontal de documento". Evidencia: `reportes-movil-grafico-tendencia.png` (eje cortado en `09-11`, encabezado "Cobrado" cortado) |
| MEDIUM | `frontend/src/features/receipt-settings/InstitutionalReceiptSettingsView.tsx:234-242,312-339,777` | Al abrir `/settings/institutional-receipts` **sin editar nada**: la alerta "Hay cambios sin guardar" está presente de forma persistente y la tarjeta **COPIAS = 1** contradice al propio motor, que dice "Contiene **3** páginas (una por copia)" | Inicializar el formulario con el perfil persistido antes de calcular `hasUnsavedChanges`, y derivar la tarjeta de copias de la misma fuente que el motor | La superficie se declara sucia y se contradice a sí misma en el primer render; el operador no sabe si guardar ni cuántas copias saldrán (evidencia: `probe-receipts.mjs` → `dirty=true` a 0,5/1,5/3/6/10 s; `config-recibos-1366x768-datos.png`) |
| LOW | `frontend/src/features/invoices/components/BillingBottomBar.tsx:25`, `frontend/src/features/invoices/components/InvoiceCart.tsx:82` | `truncate` sobre el nombre del paciente (con `title` como consuelo) | `WrapText` / `overflow-wrap: anywhere` y envolver en 2 líneas | `CONTRATO_PANTALLAS_V2 §3.2`: "Paciente = segunda jerarquía, **nombre completo sin truncar**". En 390 px el nombre largo se corta (`movil-pos-390.png`) |
| LOW | `frontend/src/features/invoices/components/PaymentModal.tsx:379` | "Use hasta dos decimales. Se **registrara** el monto aplicado a la factura." | "Se **registrará**" | Copy institucional sin tilde en el paso de cobro |
| LOW | `frontend/src/shell/navigation/InstitutionalMobileNav.tsx` / dock móvil | Etiqueta "Nueva factura" se muestra como "Nueva fac…" a 390 px | Abreviar de forma intencional ("Facturar") o permitir 2 líneas | Cosmético; el dock sigue siendo legible (`movil-*-390.png`) |

### 4.2 Defectos funcionales/visuales serios (criterio propio, con evidencia)

| Severidad | Superficie | Defecto | Evidencia |
|---|---|---|---|
| **MEDIUM** | `/settings/institutional-receipts` | Estado "sucio" falso + contradicción de copias (fila MEDIUM de la tabla) | `probe-receipts.mjs`, `config-recibos-1366x768-datos.png` |
| **MEDIUM** | `/reports/consolidated` con `cajero.validacion` | La URL se **sustituye en silencio** por "Operación de caja" sin explicar que falta `reports.managerial.view`; `/reports/executive` hace lo mismo | `flows-data.json → denied.views`; `denied-_reports_consolidated-1366x768.png` |
| **MEDIUM** | Perfiles de papel | El perfil **global por defecto sigue siendo "Media carta horizontal" (apaisado)**; los perfiles `carta_vertical` (612×792 pt) y `a4_vertical` existen pero no son el principal | `ReceiptPrintProfileSeeder.php:96` (`is_global_default => true`), `paperPolicy.ts:101-104,138-142` (fallback `half_letter`), `config-recibos-1366x768-datos.png` (tarjeta PAPEL = "Media carta") |
| **LOW** | `/support`, `/about` | Rutas válidas sin entrada de navegación: sólo alcanzables escribiendo la URL | `appNavigation.ts:233,244`; `flows-data.json → nav.railLinks` |

> **Nota de higiene.** Durante la revisión, un patrón de intercepción demasiado amplio (`**/api/backups**`) bloqueó por error el módulo `/src/lib/api/backups.ts` y produjo una pantalla en blanco. Se detectó y **se descartó como defecto del producto**: con el patrón corregido (`/api/backups` y `/api/backups/*`), la ruta muestra correctamente "Error al cargar respaldos" con el shell intacto (`estado-respaldos-error-1366x768.png`). Se documenta para que nadie lo reporte como fallo real.

### 4.3 Lo que **sí** se confirmó correcto en render (no requiere acción)

- **1 solo `h1` por ruta** en las 18 rutas (excepto la ruta inexistente, que también lo cumple).
- **Cero desbordamiento horizontal de documento** en las 108 combinaciones ruta×viewport, incluido 683 px (zoom 200 % equivalente) y 390 px.
- **Cero incumplimientos de contraste de texto** medidos en 1366 px sobre fondo efectivo (los ratios de `TOKENS_V2.md §3` se sostienen en el render).
- **Importes**: ya no hay `font-mono` en dinero; el único monoespaciado restante son identificadores (RTN `08011999123456`, atajos `Ctrl K`) — coherente con `TOKENS_V2.md §2.4`.
- **Radios**: `--radius-2xl/3xl/4xl` acotados a 14/15/16 px (`styles.css:194-196`) → el gate ≤16 px se cumple a nivel de token.
- **Iconos**: `stroke-width` ya es 1.5/2/2.5 por contexto (`styles.css:52-64`); el `1.75` global desapareció.
- **Movimiento**: 0 `transition-all`, 0 `will-change` en `frontend/src/**` (grep con ripgrep); `check-ui-rules.mjs` pasa (418 archivos conformes).
- **Modo oscuro**: 9 superficies clave con **0 violaciones axe** y el tema aplicado (`documentElement.classList.contains('dark') === true`).
- **Detalle de factura**: el drawer cierra con `Esc` y devuelve el foco al disparador (medido, `pos-final-data.json`).
- **Barra inferior del POS a 390 px**: total siempre visible ("0 servicios · L 0.00 · Ver cuenta") — `CONTRATO_PANTALLAS_V2 §3.5`.

---

## 5. Estados por superficie

Ejecutados con fallos controlados (intercepción de red) y con el estado real del laboratorio. Capturas `estado-*.png`, `denied-*.png`.

| Superficie | Carga | Vacío | Error | Sin permiso | Datos largos |
|---|---|---|---|---|---|
| POS `/billing/new` | ✔ skeleton + `role=status` ("Cargando módulo…") | ✔ "No hay servicios agregados" + causa | ✔ "No se pudieron cargar los servicios" + Reintentar, **borrador conservado** | ✔ (cajero conserva acceso; POS requiere 5 permisos) | ✔ nombre de 106/180 caracteres sin desbordar (`datos-largos-pos-nombre-largo-full.png`) |
| Historial `/invoices` | ✔ | ✔ "0 registros" + Limpiar filtros | ✔ "No se pudo cargar el historial" + Reintentar | ✔ botones de acción no se montan sin permiso | ✔ 3 facturas con nombre largo |
| Caja `/cashbox` | ✔ "Cargando caja…" | ✔ "No hay una caja abierta actualmente" + apertura | ✔ (ver catálogo/historial como patrón común) | ✔ modo consulta explícito (`CashBoxView.tsx:611`) | — |
| Consolidado `/reports/consolidated` | ✔ `role=status` "Cargando consolidado por caja" | ✔ "Sin sesiones de caja en el período" (visto en vivo antes de abrir caja) | ✔ "No se pudo cargar el consolidado" + Reintentar | ✔ `RouteState kind="denied"` textual (cuando el servidor responde 403) | ✔ con datos: "Total cobrado consolidado" + "Desglose por caja" |
| Catálogo `/catalog` | ✔ | ✔ "0 servicios en el catálogo" / sin coincidencias | ✔ "No se pudo cargar el catálogo" + Reintentar | ✔ (admin con `catalog.manage`) | ✔ precios `L 45.00` sin truncar |
| Reportes ejecutivo / caja / auditoría | ✔ | ✔ por período | ✔ por bloque | ✔ | ⚠ recorte del gráfico a 390 px (MEDIUM) |
| Usuarios `/admin/users` | ✔ | ✔ "No hay usuarios cargados" / sin coincidencias | ✔ | ✔ | — |
| Configuración `/settings/fiscal` | ✔ | — | ✔ error junto al campo | ✔ sólo lectura | ✔ RTN y nombre en mono/envuelto |
| Recibos `/settings/institutional-receipts` | ✔ | ✔ "Sin perfil de impresión" | ✔ "No se pudo preparar la vista previa" + Reintentar | ✔ sólo lectura | ⚠ "sucio" falso + copias contradictorias (MEDIUM) |
| Respaldos `/backups` | ✔ | ✔ "Sin respaldo" + acción de crear | ✔ "Error al cargar respaldos" | ✔ sólo estado | ✔ fechas completas |
| Soporte / Ayuda / Acerca de | ✔ | — | ✔ error de diagnóstico con causa | n/a (sólo sesión) | ✔ texto en ancho de lectura |

Estados **sin permiso**: `cajero.validacion` recibe `h1` "Sin permisos" en `/admin/users`, `/backups` y `/settings/fiscal` (el rail deja de mostrar esos destinos, coherente con `CONTRATO_PANTALLAS_V2 §0.2`). La excepción es Reportes (§4.2).

---

## 6. Viewports

| Viewport | Resultado |
|---|---|
| **1366×768** | Sin desbordamiento; POS con las 2 columnas (paciente+servicios / cuenta con **Total L 0.00** de 24 px) y barra de estado de caja visible sin desplazar. Caja, historial, catálogo y consolidado muestran su primer bloque de trabajo. |
| **1920×1080** | Sin desbordamiento; columnas de acción no se estiran; el panel de cuenta del POS conserva su ancho. |
| **Tablet 834×1112** | Sin desbordamiento en ninguna ruta; el POS pasa a una columna con barra inferior y total visible. |
| **Móvil 390×844** | Sin scroll horizontal de documento en 18/18. Tablas de historial, catálogo y consolidado se apilan correctamente; la única excepción es el gráfico de Reportes (§4.2) y la tabla de auditoría, que sí tiene scroll-x **contenido** en `div.overflow-x-auto` (713 px dentro de 322 px). |

Artefacto del arnés a declarar: el dock móvil muestra "Nueva fac…" truncado (LOW, §4.1).

---

## 7. Zoom

**Zoom real del navegador: NOT VERIFIED.** No es accionable en este arnés y se comprobó empíricamente:

- `Control+=` (repetido) en Chromium headless y headed → `innerWidth` y `devicePixelRatio` **no cambian** (`probe.mjs`, `probe2.mjs`).
- `--force-device-scale-factor=2` y `--default-zoom-level=200` como flags de lanzamiento → Playwright impone el viewport y **no** alteran el reflow (`probe4.mjs`).
- `Emulation.setPageScaleFactor` es zoom visual (pinch), **no** produce reflow.
- Escribir la preferencia `partition.default_zoom_level` en el perfil persistente no tuvo efecto (`probe3.mjs`).

**Sustituto ejecutado y declarado como equivalente parcial:** viewport CSS reducido + `deviceScaleFactor` proporcional, que es como el zoom de página se manifiesta en el documento (menos px CSS + más DPR):

| Configuración | Viewport CSS | DPR | Resultado |
|---|---|---|---|
| zoom 150 % | 911×512 | 1.5 | 0 desbordamientos de documento; botón de emisión del POS alcanzable; total no tapado por la barra inferior |
| zoom 200 % | 683×384 | 2 | 0 desbordamientos (**reflow hasta 683 px CSS**); el conteo de caja y la diferencia no se cortan; el visor de recibo mantiene proporción |

Capturas: `pos-zoom150.png`, `pos-zoom200.png`, `caja-zoom150/200.png`, `reportes-consolidado-zoom150/200.png`, `config-recibos-zoom150/200.png`.

Lo que el sustituto **no** prueba: comportamiento del zoom del chrome del navegador, escalado de la interfaz del sistema, y desenfoque/render subpíxel a zoom real. Queda **NOT VERIFIED**.

---

## 8. Teclado y foco

Recorrido de 26 tabulaciones por ruta con captura del `outline`/`box-shadow` computado y comprobación de solapamiento con barras fijas.

| Comprobación | Resultado |
|---|---|
| **Skip link como primer Tab** | ✔ en 16/18 rutas. En **POS** y **Caja** el producto enfoca un campo al montar (`PatientStep`/`OpenSessionForm`), así que el primer Tab continúa desde ahí; el skip link sigue siendo el primer elemento del DOM y se alcanza al ciclar. Es comportamiento intencional, no un defecto. |
| **Orden lógico de tabulación** | ✔ rail → contexto → contenido → acciones; sin `tabindex` positivos. |
| **Foco visible** | ✔ en enlaces, botones, radios, selects y diálogos (todos con anillo). ✗ en los `TabsContent` de Radix (`tabs.tsx:82`) y anillo por debajo de 3:1 en controles shadcn (§4.1). |
| **Ningún elemento fijo tapa el foco** | ✔ 0 casos de foco oculto por barras `fixed`/`sticky` en las 18 rutas (`obscured = 0`). |
| **`Esc` cierra overlay y devuelve foco** | ✔ verificado en el drawer de detalle de factura. |
| **`prefers-reduced-motion`** | No ejecutado en render (**NOT VERIFIED**); la regla global existe en `styles.css:76-85`. |
| **Rejilla de atajos (`?`), `Ctrl+K`, `F4`** | No recorridos en esta revisión (**NOT VERIFIED**). |

---

## 9. axe y contraste

- **27 corridas de axe** (18 rutas en claro, 9 en oscuro) con las etiquetas `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.
- **2 violaciones, ambas `serious`:** `scrollable-region-focusable` (POS, estado carrito vacío) y `definition-list` (Auditoría). Detalle y ubicación en §4.1.
- **0 violaciones en modo oscuro** en las 9 superficies auditadas.
- **Contraste de texto**: 0 incumplimientos en las 18 rutas a 1366 px, calculado en el navegador con el fondo efectivo compuesto.
- **Contraste del anillo de foco**: 2,15:1 (50 % de `#0F766E` sobre blanco) en controles shadcn; 5,47:1 en enlaces. Ver §4.1.
- **Lector de pantalla: NOT VERIFIED.** No hay NVDA/JAWS/VoiceOver en este entorno, por lo que no se afirma nada sobre la experiencia con lector de pantalla — ni a favor ni en contra.

---

## 10. Lo que NO se verificó (explícito)

1. **Zoom real del navegador** a 150/200 % (§7).
2. **Lector de pantalla** en ninguna superficie, overlay ni tour.
3. **`prefers-reduced-motion`** en render y el panel de animaciones de DevTools a velocidad reducida.
4. **PDF del recibo institucional** (dimensiones 612×792 pt, paginación, copias, monocromo) y cualquier impresión física.
5. **Medición de movimiento/animación**: se leyó el código (0 `transition-all`, duraciones por token) pero no se reprodujo ninguna animación en cámara lenta.
6. **Sesión vencida / reconexión de red** en navegador nuevo.
7. **Estado "sin coincidencias por filtros" del historial**: el laboratorio ya tenía facturas tras las pruebas de cobro; no se borró nada para forzarlo.
8. **Comportamiento de la barra inferior del POS con teclado virtual** en un dispositivo móvil real.
9. **Atajos globales** `?`, `Ctrl+K`, `F4`, `F2`, `F6` y la paleta de comandos.

---

## 11. Índice de evidencia

- `hospital-ai/evidencia/C1-UX-01/shots/` — 204 capturas:
  - `*-1366x768-datos.png`, `*-1920x1080.png`, `*-tablet-834.png`, `movil-*-390.png` — superficies por viewport.
  - `*-zoom150.png`, `*-zoom200.png` — equivalente de zoom.
  - `estado-*-carga|vacio|error-*.png` — estados forzados con fallos controlados.
  - `denied-*.png` — sin permiso (`cajero.validacion`).
  - `dark-*.png` — modo oscuro.
  - `pos-confirmacion*.png`, `pos-pago-*.png`, `pos-exito*.png`, `historial-detalle-drawer*.png` — flujo de cobro y detalle.
  - `reportes-movil-grafico-tendencia.png` — evidencia del recorte a 390 px.
  - `foco-*.png` — foco en los campos de fecha de reportes.
- `hospital-ai/evidencia/C1-UX-01/*.json|*.txt` — datos crudos (`review-data.json`, `summary.txt`, `details.txt`, `states-data.json`, `flows-data.json`, `verify-data.json`, `payment-*-data.json`, `double-submit-data.json`).
- `hospital-ai/evidencia/C1-UX-01/runner/` — runner Playwright acotado y reutilizable (login, capturas, axe, teclado, POS y Enter seguro). No forma parte del producto.

---

## 12. Veredicto

- **Block** para la fila MEDIUM de `tabs.tsx:82` y para el anillo de foco por debajo de 3:1: son incumplimientos medibles de `TOKENS_V2.md §7` y de WCAG 1.4.11 / 2.4.7 sobre la mayoría de controles.
- **Sin bloqueo** para el resto: los hallazgos MEDIUM son de layout móvil, semántica y derivación de estado; los LOW son polish y copy.
- **El mandato §4 (Enter seguro) queda revalidado con evidencia de red.**
- El trabajo de corrección pertenece a **hs-frontend** (y a **hs-receipts** para el perfil de papel). hs-ux no editó código de producto.
