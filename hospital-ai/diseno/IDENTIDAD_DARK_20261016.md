# Hospital Operations — Dark Institutional Workspace (identidad vinculante)

**Fecha:** 2026-10-16 · **Estado: DEFINIDO** (contenido vinculado, código producto aún sin tocar)
**Raíz escribible verificada:** `C:\Projects\S_Hospital_AI` · **Autor:** hs-ux (entrega a coordinador)
**Ámbito:** toda superficie de pantalla del modo "Admin API/base" (auth, Resumen, Cobrar, Recibos, Caja, Reportes, Administración, shell, primitivos). Excepción declarada: recibos/documentos sobre papel blanco (§4).

## 0. Registro de sustitución (par APR/RCP)

| Documento | Papel | Situación |
|---|---|---|
| `hospital-ai/diseno/IDENTIDAD_DEV.md` (2026-09-20) | APR anterior: identidad "Panel administrativo" light-first azul-blanco | Sustituida como identidad de pantalla a partir de hoy |
| `hospital-ai/diseno/REVISION_IDENTIDAD.md`, `REVISION_SKILLS.md` | Revisión de la APR anterior | Históricas: referencia de lo revocado |
| `hospital-ai/diseno/TOKENS_V2.md` | Contrato v2 light (sombras claras, azul-blanco) | Histórico; §1 de este archivo lo reemplaza como valores canónicos |
| **Este archivo** | **RCP: identidad vigente única** | Dark institucional; recibos en papel blanco residenciales **estables**, no participan de la sustitución |

**Decisión:** la identidad azul-blanco/light queda revocada por el propietario (hoy). La identidad de pantalla pasa a ser **dark institucional** con los valores del briefing del coordinador (2026-10-16): base `#090A0C`, superficie `#111318`, superficie elevada `#191C22`, bordes `#2A2E36`, texto `#F5F7FA`, secundario `#A1A8B3`, acento cobalto accesible. Sometida a WCAG 2.2 AA (todas las ratios de §8 fueron calculadas con la fórmula oficial de luminancia, no estimadas). Radios 6/8/12/14, press `scale(0.96)`, curvas custom, reduced-motion, foco 2 px/offset 2 px y prohibición de `transition-all` **no se revocan**: permanecen idénticos.

Nota de trazabilidad: el encargo cita `hospital-ai/PROMPT_MAESTRO.md` §3 como fuente, pero ese archivo es histórico (fechado 2026-09-17, encabezado "superado") y su §3 no contiene la dirección dark; los valores arriba son la autoridad delegada del briefing del coordinador de hoy. Ver supuestos.

---

## 1. Paleta dark — tokens `--ui-*` (valores hex canónicos)

Todos los valores verificados con ratio WCAG computado (ver tabla completa en §8).

### 1.1 Neutros

| Token | Valor | Rol | Verificación |
|---|---|---|---|
| `--ui-paper` | `#090A0C` | Fondo de aplicación (base, lo más oscuro) | — |
| `--ui-surface` | `#111318` | Superficie de tarjetas, tablas, paneles, sidebar | — |
| `--ui-surface-alt` | `#151A21` | Filas alternas, pies de panel, relleno sutil dentro de superficie | ink 16.28 / soft 7.30 / faint 4.64 |
| `--ui-surface-hover` | `#14181F` | Hover de filas y controles dentro de superficie | ink 16.58 / soft 7.43 / faint 4.72 |
| `--ui-elevated` | `#191C22` | Superficie elevada: overlays (diálogo, cajón, popover, toast) y elementos flotantes | ink 15.90 / soft 7.12 / faint 4.53 |
| `--ui-line` | `#2A2E36` | Separador estructural hairline (solo estructura; nunca límite de control) | 1.45 vs paper / 1.36 vs surface / 1.25 vs elevated (decorativo, permitido) |
| `--ui-line-strong` | `#464E5A` | Estructura reforzada no interactiva (bloques vacíos, dashed de zonas muertas) | 2.21 / 2.03 (decorativo, permitido) |

**Nota sobre briefing:** los cuatro neutros entregados (`090A0C/111318/191C22/2A2E36`) se conservan sin ajuste: la fórmula de ratios los confirma como sistema de niveles correcto y no obliga a separación ≥3:1 entre superficies (la jerarquía se lee por luminancia relativa + borde, no por contraste AA entre fondos).

### 1.2 Tinta

| Token | Valor | Rol | Ratios vs paper / surface / elevated |
|---|---|---|---|
| `--ui-ink` | `#F5F7FA` | Texto principal, dinero, título de métricas | 18.45 / 17.31 / 15.90 |
| `--ui-ink-soft` | `#A1A8B3` | Texto secundario, etiquetas, descripciones | 8.27 / 7.76 / 7.12 |
| `--ui-ink-faint` | `#7B8494` | Terciario: hints, metadatos, iconos de vacío | 5.25 / 4.93 / **4.53** (≥4.5 en las tres superficies; objetivo del sistema: nunca por debajo en ningún uso de texto) |

Nota AA: el candidato más cercano al neutro natural, `#6F7A89`, suspende sobre surface (4.27 < 4.5); el valor elegido no cede el margen de AA para acercarse al tono pedido.

### 1.3 Acento de acción (cobalto, hue 217 ✅ dentro de 217–222)

| Token | Valor | Rol | Ratios clave |
|---|---|---|---|
| `--ui-action` | `#70A8FF` | Texto/enlace/estado activo, relleno de botón primario, pestaña activa, icono de acción | 7.73 vs `#111318` (texto normal ≥4.5 ✅), 7.10 vs elevated, 8.24 vs paper; hue 217 |
| `--ui-action-hover` | `#8FBAFF` | Texto ENLACE/estado al hover (más claro sobre dark, no más oscuro) | 9.41 / 8.64 |
| `--ui-action-active` | `#5B9EFF` | Texto presionado (selección/active) | 6.88 / 6.32 |
| `--ui-action-subtle` | `rgb(112 168 255 / 0.14)` | Fondo de chip/pestaña/inventario activo (tinte translúcido, **nunca** un sólido claro) | acción sobre él 6.17 / 5.54 (elev), ink 13.82, soft 6.19 |
| `--ui-action-subtle-strong` | `rgb(112 168 255 / 0.22)` | Variante fuerte del sutil (hover de chip) | action 5.21, ink 11.68, soft 5.23 |
| `--ui-action-border` (nuevo) | `rgb(112 168 255 / 0.36)` | Borde de chips/controles outline de acción (30–40 % del tono) | 2.04 vs surface (decorativo; la identidad del chip la da texto+fondo) |
| `--ui-action-foreground` (nuevo) | `#0B0E14` | Etiqueta sobre **relleno** `--ui-action` (y hover/active) | 8.03 / 9.78 / 7.16 ✅ |
| `--ui-focus` | `var(--ui-action)` | Anillo de foco 2 px + offset 2 px | 7.73 vs surface (≥3 ✅) |

Reglas del acento en dark:
1. `hover` = **más claro**, no más oscuro; en dark el acento oscurecido desaparece. `active` puede bajar un paso (`#5B9EFF`).
2. Prohibido texto blanco `#FFFFFF` sobre relleno de acción en dark (2.20 FAIL AA; en light funcionaba, en dark no). Toda etiqueta sobre relleno de acción usa `--ui-action-foreground`. El puente shadcn ya resolverá `--primary-foreground` compatible; en modo dark debe apuntar a `var(--ui-action-foreground)` (hoy proxy `var(--ui-surface)` `#111318` ≈ equivalente: 7.9).
3. Prohibido reintroducir `#EFF6FF` / `#DBEAFE` (azules de la identidad revocada) como "subtle": en dark ese par carece de función y rompe AA de texto.
4. El relleno sólido `--ui-action` solo para la acción primaria por pantalla (botón de cobro, pestaña activa de navegación, skip link). El tinte translúcido (`subtle`) es el lenguaje por defecto de selección y énfasis.
5. `ink-faint` no puede instalarse sobre `subtle` (3.93): los chips llevan texto `action` o `ink`, nunca `faint`.

### 1.4 Series de datos (gráficas)

Sin morado. En `styles.css` (puente): `--chart-1: var(--ui-action)`, `--chart-2: var(--ui-success)`, `--chart-3: #67CBF0` (sky distinguible del cobalto; hue 196; 10.07 vs surface), `--chart-4: var(--ui-warn)`, `--chart-5: var(--ui-ink-soft)`. El `#6366F1` indigo actual se retira con la identidad.

---

## 2. Semánticos dark

Fórmula uniforme (briefing): texto = tinta clara del tono; fondo-subtle = 10–14 % del tono translúcido **sobre superficie propia**; borde = 30–40 % del tono translúcido.

| Token | Valor | Uso | AA del texto de badge |
|---|---|---|---|
| `--ui-success` | `#5BD697` | Texto/badge de cobro válido, documento pagado | 10.18 vs surface / 9.35 vs elevated |
| `--ui-success-subtle` | `rgb(91 214 151 / 0.13)` | Fondo de badge/avisos de éxito | tono sobre sí 8.00 / 7.18 (elev); ink sobre él 13.60 |
| `--ui-success-border` | `rgb(91 214 151 / 0.36)` | Borde del badge | decorativo |
| `--ui-warn` | `#F0B657` | Advertencia moderada: diferencia de caja, aviso de vista previa incompleta | 10.21 / 9.37 |
| `--ui-warn-subtle` | `rgb(240 182 87 / 0.13)` | Fondo de badge/avisos | 8.01 / 7.18 (elev) |
| `--ui-warn-border` | `rgb(240 182 87 / 0.36)` | Borde | decorativo |
| `--ui-danger` | `#F87171` | Error, anulación, fallo de gravedad clínica/fiscal | 6.72 / 6.17 |
| `--ui-danger-subtle` | `rgb(248 113 113 / 0.13)` | Fondo de callout/badge de error | 5.66 / 5.12 (elev) — AA texto normal ✅ |
| `--ui-danger-border` | `rgb(248 113 113 / 0.36)` | Borde | decorativo |
| `--ui-info` | `var(--ui-action)` | Informativo = acento (no cuarta marca) | igual §1.3 |

Los composites de fondo translúcido sobre `#111318` resultan (verificado): success `#1B2C29`, warn `#2E2820`, danger `#2F1F24`. Los badges nunca dependen solo del color: siempre van con etiqueta textual (`StatusStamp` ya lo garantiza).

**Gratuidad / regla EPO:** el violeta `--ui-free` de la identidad anterior queda **retirado** (no-go: segundas marcas). La línea sin cobro y el chip "Solo el medicamento — regla aplicada" usan `--ui-action` + `--ui-action-subtle` con etiqueta textual explícita. Si el hospital definiera otro matiz formal para gratuidad, es una decisión externa: no se inventa hoy.

---

## 3. Elevación y supervisión de overlays

Principio (better-ui, `surfaces.md`): **sombra para profundidad, borde para estructura; en dark la profundidad es "sombra-como-borde blanca", no sombras gigantes negras** que son invisibles sobre `#090A0C`.

Jerarquía de niveles: `paper` → `surface` → `elevated`. Nunca invertir: una capa no puede ser más "base" que el propio panel.

| Elemento | Superficie | Receta |
|---|---|---|
| Botón primario, tarjeta "raised" (AuthLayout) | `surface` + `--shadow-border` | anillo blanco único (ya en `styles.css` `.dark`: `0 0 0 1px oklch(1 0 0 / 0.08)`) |
| Tarjetas con hover | `surface` + `--shadow-border-hover` | `0.13` |
| Diálogo / AlertDialog | `elevated` + `--shadow-overlay` (dark) | `0 0 0 1px oklch(1 0 0 / 0.08), 0 12px 32px -12px oklch(0 0 0 / 0.55), 0 24px 64px -24px oklch(0 0 0 / 0.45)` (ambiente corto, no pantalla completa de sombra) |
| Popover / dropdown / select | `elevated` + `--shadow-overlay` + `--ui-action-border` en sus chips | `transform-origin` del disparador (conservado) |
| Cajón (drawer/sheet) | `elevated`, borde lateral `--ui-line`, sin glow | desplazamiento corto conservado (2.5rem, salida más rápida) |
| Toast | `elevated` + `--shadow-overlay`; rol por tono semántico en barra lateral 3 px (borde izquierdo del tono, 36 %) | texto del cuerpo `ink`/`soft`, nunca solo color |
| **Scrim** | `--ui-scrim: rgb(3 5 9 / 0.66)` (token nuevo) | el alpha 0.30–0.35 actual es invisible sobre dark y no declara la capa; 0.66 sí la declara |
| Backdrop-blur | **Prohibido** en dark (glassmorphism); `drawer.tsx` lo lleva hoy y sale con el mapeo (§10) | — |

Los modales permanecen centrados (sin transform-origin disparador); los popovers conservan `--transform-origin`; `@starting-style` y las transiciones por `data-state` se conservan tal cual (emil/better-ui: interrumpibles, salida más rápida que entrada).

---

## 4. Excepción papel: recibos y documentos siguen en blanco

Regla `paper`: los documentos con valor fiduciario —el borrador de vista previa, el detalle del comprobante institucional, el marco `InstitutionalReceiptPreviewFrame`, la vista `ReceiptPreview`, `receipt-preview-frame`, y toda plantilla Blade PDF/carta/A5/media carta— **permanecen sobre superficie blanca canónica**, sin inversión, sin "dark mode" impreso.

Tokens `paper` (nuevos, sin participar de la inversión):

| Token | Valor | Uso |
|---|---|---|
| `--ui-doc-surface` | `#FFFFFF` | Papel del documento/matriz del logo |
| `--ui-doc-ink` | `#111827` | Texto sobre papel (17.74 sobre sí) |
| `--ui-doc-muted` | `#4B5563` | Texto secundario del papel (7.56) |
| `--ui-doc-border` | `#E2E5EB` | Marco hairline del documento sobre superficie de app |

Dónde aplica (medido hoy):
- `features/cobrar/components/DocumentPreviewDialog.tsx:61` — el `<iframe>` del borrador conserva `bg-white`: es papel, no se sustituye (solo puede re-vincularse a `var(--color-receipt-paper)` sin cambiar el valor).
- `features/receipts/InstitutionalReceiptPreviewFrame.tsx` y `styles.css:149-152` (`--color-receipt-paper: #FFFFFF`) — intactos.
- `printing/styles/receipt-print.css` y plantillas Blade — declaración de medios: el papel no conoce la identidad dark y al imprimir se fuerza fondo blanco (media print de `styles.css:282-286`).
- `design-system/admin/AuthLayout.tsx:65` — el mat del logo es papel institucional: la matriz blanca se conserva; solo sale el uso de `--ui-doc-surface` como token en lugar del literal, y el contorno pasa a blanco/10 % (§10).

Delimitación: **solo contenido fiduciario/documental**. La app nunca "viste" un widget de UI como papel para justificar blanco (los chips, callouts y toasts son dark).

---

## 5. Estados

- **Vacío (`AdminEmpty`):** icono `--ui-ink-faint` (4.53 +), título `--ui-ink` con label real del dominio, descripción `--ui-ink-soft`, acción secundaria `--ui-action-border` outline. Sin ilustraciones, sin hero card, sin texto moralizante permanente.
- **Fallo:** callout danger (§2) junto al bloque afectado; `Reintentar` como acción secundaria. En tablas, fila de error con icono + texto; la página jamás pantalla-completa de error por un dato no crítico.
- **Carga / esqueleto:** receta única: `--ui-skel-from: #111318` → `--ui-skel-to: #1A1E26` (delta 1.11, sutil), pulso de opacidad 1.6 s `ease-in-out` (0.55→1), **sin** barrido de gradiente luminoso ("shimmer"), sin ondas. Reduced-motion: esqueleto estático (sin pulso). Spinner existente se conserva; nunca reemplaza el estado vacío.
- **Cero legítimo:** `L 0.00` por regla/aplicación se muestra en `--ui-ink` con chip textual "Sin cobro (regla)" (sobre `--ui-action-subtle`); **jamás** en danger, jamás `L 0.00` para un dato ausente o por parseo fallido. Saldo cero por conciliación = `--ui-ink-soft`, no verde ni rojo.
- **Deshabilitado:** opacidad 0.55 sobre `surface` (no introduce un color nuevo); foco no visible en deshabilitados (estándar).

---

## 6. Cifras monetarias

- `MoneyText` / métricas: `tabular-nums` (regla ya en `styles.css:80-83`), alineación a la **derecha** en tablas y centrado solo en chips de catálogo (por diseño de componente actual).
- Jerarquía: métricas de Resumen `--ui-text-metric` (28–30 px) en `--ui-ink`; totales de pie `24px`; totales de cobro `24–28px`; dinero de fila `base` `--ui-ink`.
- Cambios de saldo / vuelto: el color es **complemento** y siempre acompañado de etiqueta: diferencia de caja warn (con texto), factura pagada success (con texto). Nunca solo color (no-solo-color).
- Ratio del texto dinero = ratio de `ink` (17.31 en surface; 15.90 en elevated): siempre AA por construcción — se prohíbe instalar dinero en `soft`/`faint` deliberadamente "atenuado".
- La jerarquía del dinero no depende de funciones decorativas: sin gradiente, sin glow; solo tipografía, alineación y la etiqueta textual del estado.

---

## 7. No-go list (identidad oscura)

1. Sin gradientes decorativos (las recetas son de color sólido o translúcido; el skeleton usa un gradiente neutro exclusivamente técnico, de dos tonos del sistema).
2. Sin glassmorphism ni backdrop-blur en overlays.
3. Sin glows, neones ni sombras coloreadas; ningún "brillo de luz" de adorno construye peso visual nuevo.
4. Sin tarjetas hero/marketing; sin bloques de arranque que ocupen media pantalla.
5. Sin segundas marcas: no morado (gratuidad violeta retirada), no verde como marca EPO, no teal, no la paleta institucional R2 revocada ni cajones de color (`indigo` para series fuera del §1.4).
6. Sin textos técnicos permanentes, sin moral narrativa, sin frases automáticas que aparenten motivo del operador.
7. Sin sombras exageradas/anudadas (el `shadow-[0_24px_80px_-24px_rgba(15,23,42,0.4)]` de `components.tsx:1471` y `alert-dialog.tsx:63` es un valor de la identidad light y sale con el mapeo).
8. **Test de escala de grises:** la jerarquía (panel > card > fila > texto terciario) debe poder leerse con saturación a 0; los roles de L* lo garantizan (§8, tabla).

---

## 8. Accesibilidad — tabla de combinaciones (ratios computados con fórmula WCAG 2.x)

| Combinación (texto sobre fondo) | Ratio | Requisito | Resultado |
|---|---|---|---|
| `ink` / paper `#090A0C` | 18.45 | ≥4.5 | ✅ |
| `ink` / surface `#111318` | 17.31 | ≥4.5 | ✅ |
| `ink` / elevated `#191C22` | 15.90 | ≥4.5 | ✅ |
| `ink-soft` / paper | 8.27 | ≥4.5 | ✅ |
| `ink-soft` / surface | 7.76 | ≥4.5 | ✅ |
| `ink-soft` / elevated | 7.12 | ≥4.5 | ✅ |
| `ink-faint` / surface | 4.93 | ≥4.5 | ✅ |
| `ink-faint` / elevated | 4.53 | ≥4.5 | ✅ (margen mínimo: prohibido usar faint fuera de las cuatro superficies declaradas) |
| `action` `#70A8FF` / surface | 7.73 | ≥4.5 texto normal | ✅ |
| `action` / elevated | 7.10 | ≥4.5 | ✅ |
| `--ui-action-foreground` `#0B0E14` / relleno `#70A8FF` | 8.03 | ≥4.5 | ✅ |
| `--ui-action-foreground` / relleno hover `#8FBAFF` | 9.78 | ≥4.5 | ✅ |
| `--ui-action-foreground` / relleno active `#5B9EFF` | 7.16 | ≥4.5 | ✅ |
| texto `action` sobre `action-subtle` (14 %) | 6.17 | ≥4.5 | ✅ |
| texto `action` sobre `action-subtle` (sobre elevated) | 5.54 | ≥4.5 | ✅ |
| `soft`/`ink` sobre `action-subtle-strong` (22 %) | 5.23 / 11.68 | ≥4.5 | ✅ |
| `success` / surface | 10.18 | ≥4.5 | ✅ |
| `success` sobre `success-subtle` | 8.00 | ≥4.5 | ✅ |
| `warn` / surface | 10.21 | ≥4.5 | ✅ |
| `warn` sobre `warn-subtle` | 8.01 | ≥4.5 | ✅ |
| `danger` / surface | 6.72 | ≥4.5 | ✅ |
| `danger` sobre `danger-subtle` | 5.66 | ≥4.5 | ✅ |
| `--ui-control-border` `#616A79` / surface | 3.40 | ≥3 (1.4.11 límite de control) | ✅ |
| `--ui-control-border` / elevated | 3.13 | ≥3 | ✅ |
| `--ui-focus` / surface | 7.73 | ≥3 (1.4.11 anillo) | ✅ |
| Doc: `#111827` / papel `#FFFFFF` | 17.74 | ≥4.5 | ✅ |
| Doc: `#4B5563` / papel | 7.56 | ≥4.5 | ✅ |

Resto del paquete accesibilidad:
- **Foco en dark:** anillo `--ui-action` 2 px, offset 2 px; en `paper` el anillo se dibuja igual (8.24) sin cambiar la regla. Nunca `outline: none` sin sustituto (regla vigente).
- **Selección de texto:** `::selection { background: rgb(112 168 255 / 0.28); color: var(--ui-ink); }` — ink sobre el composite = 10.46 ✅. Sobre papel (documento) se hereda el mismo tintado; el texto del papel sigue `#111827` y sigue legible sin cambiar el fondo.
- **Scrollbars / scroll-area:** `color-scheme: dark` fijo — los controles nativos (scrollbars, date/number/select popups nativos) se renderizan en dark automáticamente; para `ScrollArea` de Radix: thumb `var(--ui-line-strong)`, hover `var(--ui-control-border)`, track transparente.
- **Color-scheme dark con fijación (obligatorio):** el dark es la identidad, no un toggle. `tokens.css:115` (`color-scheme: light` de `.ui-root`) y `:138` (`color-scheme: light` de `.ui-portal`) y `styles.css:39` (body) pasan a `color-scheme: dark`; la regla `html.dark body { color-scheme: dark }` queda absorbida por la declaración base del body. Fijación automática de date/scrollbar/select nativos sin costo por widget.
- **No-solo-color:** calidad de estado siempre con icono+texto (`StatusStamp`, callouts con título); asegurado con los tonos que ya existen.
- **Movimiento reducido:** sin cambios del paquete actual (press sin transición, overlays sin zoom/desplazamiento, solo fundido global). Cero cambios en motion.

---

## 9. Impacto en pruebas (enumeración; sin ediciones de código en esta tarea)

### 9.1 Tests contráctiles (Vitest) a actualizar por el dueño del código (hs-frontend)

| Prueba | Qué congela hoy | Cambio esperado |
|---|---|---|
| `frontend/src/design-system/tokens/styles-contract.test.ts:16-21` | "sombra-como-borde **de 3 capas (claro)** y el anillo único (oscuro)" con regex de `oklch(0 0 0 / 0.06)` y `oklch(1 0 0 / 0.08)` | Invertir la expectativa: dark canónico (anillo blanco), claro como excepción de papel/imprenta |
| `frontend/src/design-system/tokens/styles-contract.test.ts:38-43` | Enlace puente `--primary`/`--ring` a `--ui-*` | Se mantiene; añadir las verificaciones del bloque dark (sin `#EFF6FF`/`#DBEAFE`/morado/teal) |
| `frontend/src/design-system/tokens/institutional-tokens.test.ts:41-58` | Bloque `.dark` de `--institutional-*` (#60A5FA, #93C5FD...) | Si `institutional-tokens.css` queda desmontada de la cadena de imports (decisión de hs-frontend; hoy solo alimenta `@theme` de `--color-receipt-*`/operational), el test se retira junto con esa remoción; si el archivo permanece, sus valores dark deben re-verificarse contra §8 (pendiente, no decidido aquí) |
| `frontend/src/design-system/admin/motion-contract.test.ts` | Curvas, duraciones, press 0.96, reduced motion, sin `transition-all`, `@starting-style` | **Sin cambios requeridos** (no tiene aserciones de color) |
| `frontend/src/hooks/useTheme.test.tsx` / `ThemeProvider.test.tsx` | Persisten 'light'/'dark' y toggle con localStorage | Con dark-fijado: default 'dark', eliminación del default light y del toggle; localStorage queda solo como compatibilidad |
| `frontend/src/design-system/providers/FeedbackProvider.test.tsx` | `Toaster` según `isDark` | Fijo `theme="dark"` (resuelve a la vez el hallazgo LOW histórico de `AUDITORIA_CALIDAD_UI.md:35`) |
| Otros (spot-check): `AdminShell.test.tsx:124` (espera `bg-[var(--ui-action)]`), `PaymentModal.test.tsx:604` (forza `.dark`) | Var-based, no hex | No requieren cambio por identidad. |

### 9.2 E2E que pasan a validarse contra tokens oscuros

- `frontend/e2e/azul-blanco-producto.spec.ts`, `azul-blanco-capturas.spec.ts`, `azul-blanco-entrega-un-pc.spec.ts` + helpers `azul-blanco-helpers.ts` y config `playwright.azul-blanco.config.ts` — medidas por `getComputedStyle`/ratios (p. ej. `capturas:158-188`): pasan a medir los hex canónicos de §1/§2; el nombre de suite "azul-blanco" queda como marcador histórico o se renombra (decisión del dueño de la suite), ya no afirma la identidad clara.
- `frontend/e2e/visual-capture.spec.ts` + `fixtures/visual-surfaces.ts` — capturas de referencia deben **regenerarse** contra el render dark (el hueco: pasar de golden PNGs light a hex canónicos oscuros de §1/§10; el número de pantallas no cambia).
- `frontend/e2e/redisenio-integral.spec.ts:67,877` — aserciones de estilos computados (overflow/scroll/página); sin cambios de color relevantes; solo puede requerir ajuste de fixture donde el test asuma que el contenido corre sobre papel.
- `frontend/e2e/a11y-audit.spec.ts`, `a11y-admin.spec.ts`, `a11y-command-palette.spec.ts` — axe corre sobre el tema renderizado; con dark fijo los ratios auditados son los de §8.
- `frontend/e2e/c3-dialog-diagnosis.spec.ts:98-162` — valida alpha de overlay y de contenido (`overlayAlpha>0`, `backgroundAlpha(content)===1`); el cambio 0.35→0.66 del scrim es compatible, pero conviene re-ejectutar ese diagnóstico tras el mapeo (no verificado hoy).
- `frontend/e2e/ux-estados-final.spec.ts` — revisa vacíos/carga/fallo con estados de §5.

**Hueco que cambia en general:** las suites pasaban por identidad azul-blanco/fondo claro con fixture de login y por reglas de "tokens light"; ahora validan hex canónicos oscuros (§1), tokens nuevos (`--ui-scrim`, `--ui-doc-*`, `--ui-action-foreground`, `--ui-skel-*`), y capturas de referencia regeneradas. Ninguna suite nueva crece por identidad.

---

## 10. Aplicación en código (guía literal para hs-frontend; esta tarea NO edita código)

### 10.1 Mapeo de tokens (`tokens.css`)

El bloque de tokens pasa a dark-first (canónico y único). Valores exactos:

```css
:root {
  /* Neutros */
  --ui-paper: #090A0C;
  --ui-surface: #111318;
  --ui-surface-alt: #151A21;
  --ui-surface-hover: #14181F;
  --ui-elevated: #191C22;
  --ui-line: #2A2E36;
  --ui-line-strong: #464E5A;
  --ui-control-border: #616A79;

  /* Tinta */
  --ui-ink: #F5F7FA;
  --ui-ink-soft: #A1A8B3;
  --ui-ink-faint: #7B8494;

  /* Acento (cobalto hue 217, AA verificado) */
  --ui-action: #70A8FF;
  --ui-action-hover: #8FBAFF;
  --ui-action-active: #5B9EFF;
  --ui-action-subtle: rgb(112 168 255 / 0.14);
  --ui-action-subtle-strong: rgb(112 168 255 / 0.22);
  --ui-action-border: rgb(112 168 255 / 0.36);
  --ui-action-foreground: #0B0E14;
  --ui-navy: var(--ui-action);            /* alias de compatibilidad, sin nuevos usos */
  --ui-navy-strong: var(--ui-action-active);

  /* Semánticos */
  --ui-success: #5BD697;
  --ui-success-subtle: rgb(91 214 151 / 0.13);
  --ui-success-border: rgb(91 214 151 / 0.36);
  --ui-warn: #F0B657;
  --ui-warn-subtle: rgb(240 182 87 / 0.13);
  --ui-warn-border: rgb(240 182 87 / 0.36);
  --ui-danger: #F87171;
  --ui-danger-subtle: rgb(248 113 113 / 0.13);
  --ui-danger-border: rgb(248 113 113 / 0.36);

  --ui-focus: var(--ui-action);
  --ui-scrim: rgb(3 5 9 / 0.66);          /* token nuevo */
  --ui-doc-surface: #FFFFFF;              /* papel (excepción) */
  --ui-doc-ink: #111827;
  --ui-doc-muted: #4B5563;
  --ui-doc-border: #E2E5EB;
  --ui-skel-from: #111318;
  --ui-skel-to: #1A1E26;

  /* color-scheme */
  /* .ui-root y .ui-portal: color-scheme: dark (sustituye los "light" de tokens.css:115 y :138) */

  /* Radios 6/8/12/14, alturas, tipografía, curvas, press 0.96: SIN CAMBIO */
}
```

En `styles.css` (puente):
- `:root { color-scheme: dark; }` (reemplaza el `light` del body); `html.dark body { color-scheme: dark; }` conserva por compatibilidad pero ThemeProvider ha de fijar `.dark` siempre.
- Bloque `.dark` de sombras ya presente (línea 425-428) es **el canónico**; añadir el `.dark`-canónico de `--shadow-overlay` (§3) y de `--shadow-border` / `--shadow-border-hover` ya cubierto.
- Serie `--chart-*`: `1 action / 2 success / 3 #67CBF0 / 4 warn / 5 ink-soft` (retirar `#6366F1`).
- `--primary-foreground: var(--ui-action-foreground)` en dark; `--border-strong: var(--ui-ink-soft)` (3:1+ sobre app, ya la fórmula lo mantiene).

Y en `useTheme.ts`: default `'dark'` (no `localStorage || 'light'`), permitir solo `dark` como valor útil; el toggle light se retira de consumo (los tests indicados en §9.1 se actualizan por su dueño).

### 10.2 Uso duro hostiles (4 del briefing, con decisión literal) + sustituciones medidas requeridas por el mapeo

| # | Archivo:línea | Antes (medido hoy) | Después (decisión) | Clase |
|---|---|---|---|---|
| 1 | `design-system/admin/components.tsx:1463` | `bg-slate-950/35` | `bg-[var(--ui-scrim)]` | Velo |
| 2 | `design-system/admin/AuthLayout.tsx:65` | `bg-white` + `outline-black/10` | `bg-[var(--ui-doc-surface)]` + `outline-[oklch(1_0_0/0.1)]` (regla better-ui: contorno de imagen blanca pura en dark, nunca near-black/tintado) | Mat papel del logo |
| 3 | `components/ui/alert-dialog.tsx:41` | `bg-slate-950/35` | `bg-[var(--ui-scrim)]` | Velo |
| 4 | `features/cobrar/components/DocumentPreviewDialog.tsx:61` | `bg-white` | **SE CONSERVA** (papel institucional; opcional: re-vincular a `var(--color-receipt-paper)` sin cambiar el valor) | Papel |
| 5 | `components/ui/dialog.tsx:45` | `bg-black/30` | `bg-[var(--ui-scrim)]` | Velo (medido extra) |
| 6 | `shell/admin/AdminShell.tsx:157` | `bg-black/30` | `bg-[var(--ui-scrim)]` | Velo (medido extra) |
| 7 | `shell/admin/CommandPalette.tsx:355` | `bg-black/30` | `bg-[var(--ui-scrim)]` | Velo (medido extra) |
| 8 | `components/ui/sheet.tsx:38` | `bg-black/10` | `bg-[var(--ui-scrim)]` | Velo (medido extra) |
| 9 | `components/ui/drawer.tsx:38` | `bg-black/10 supports-backdrop-filter:backdrop-blur-xs` | `bg-[var(--ui-scrim)]` **y quitar backdrop-blur** (no-go glassmorphism) | Velo (medido extra) |
| 10 | Sombra de diálogo light | `shadow-[0_24px_80px_-24px_rgba(15,23,42,0.4)]` en `components.tsx:1471` y `alert-dialog.tsx:63` | `--shadow-overlay` dark (§3) — sin sombra de 80px sobre fondo casi negro | Sombra |
| 11 | Etiquetas `text-white` sobre relleno de acción (medido: `AdminShell.tsx:79`, `AdminSidebar.tsx:81-82`, `AuthLayout.tsx:70`) | `text-white` | `text-[color:var(--ui-action-foreground)]` (2.20 FAIL con blanco; 8.03 con token) | Etiqueta de relleno |

### 10.3 Orden de integración (cada ítem con su gate)

1. **tokens.css** (`:root` canónico dark + tokens nuevos + `color-scheme: dark` en `.ui-root`/`.ui-portal`) — gate: `tokens/styles-contract.test.ts`, `institutional-tokens.test.ts`, `motion-contract.test.ts` (no debe regresar) + `npm run typecheck` inalterado.
2. **styles.css** (puente: sombras dark canónicas, series `--chart-*` sin indigo, `--border-strong`, body `color-scheme: dark`, `::selection`, receta de scrollbar) — gate: `styles-contract` actualizado + `build` limpio.
3. **ThemeProvider/useTheme** (dark fijo; `Toaster` dark) — gate: `useTheme.test.tsx`, `ThemeProvider.test.tsx`, `FeedbackProvider.test.tsx`.
4. **Shell** (`AdminShell`, `AdminSidebar`, `CommandPalette`, `AuthLayout`): scrim, sombra del cajón, mat de logo, etiquetas de relleno, skip-link, anillo de foco visible en dark — gate: `AdminShell.test.tsx` + `a11y-admin` E2E.
5. **Primitivos** (`dialog`, `alert-dialog`, `sheet`, `drawer`, `select`, `popover`, `dropdown-menu`, `scroll-area`, toasts): scrim unificado, sombra overlay dark, sin backdrop-blur; sin tocar duraciones ni curvas — gate: `motion-contract.test.ts` (regresión cero) + `c3-dialog-diagnosis.spec.ts` recomprobado.
6. **Módulos** en orden de recorrido: `features/auth` → `resumen` → `cobrar` (con `DocumentPreviewDialog` papel intacto) → `recibos` + `invoices/history` → `caja` + `cash` → `reportes` → `administracion`/`admin`/`catalog`/`settings`/`receipt-settings`/`backups`. Gate por módulo: Vitest del módulo, typecheck, espécimen Playwright de la punta (comparación del render contra §1/§2).
7. **QA integrador:** `npm run typecheck/lint/test/build`, backend intacto (la identidad es frontend), E2E flows (cobrar/caja/recibos), `visual-capture` con referencias regeneradas, `a11y-*` dark, revisión visual real con capturas antes/después (no presumida por tests).

Reglas transversales durante la integración (no revocadas): radios 6/8/12/14, `press` 0.96 omitido con foco de teclado, curvas y duraciones existentes, sin `transition-all`, foco 2 px/offset 2, `@starting-style` para entradas, transform-origin solo en popovers.

---

## Reglas aplicadas (cierre de skills: better-ui + emil-design-eng)

| Antes | Después | Principio | Evidencia |
|---|---|---|---|
| Velo `bg-black/30` o `bg-slate-950/35` invisible sobre fondo `#090A0C` | `--ui-scrim` rgb(3 5 9 / 0.66) que declara la capa | better-ui: sombra para profundidad / borde para estructura; la capa debe ser percibida | Medición del composite sobre paper/surface (§3); `dialog.tsx:45`, `components.tsx:1463`, `alert-dialog.tsx:41` |
| Sombras de 80 px y `rgba(15,23,42,…0.4)` sobre fondo casi negro | Anillo blanco 1 px (0.08) + ambiente corto | better-ui/surfaces.md (`TOKENS_V2 §6`): en dark la elevación es sombra-como-borde | `components.tsx:1471`, `alert-dialog.tsx:63`, `styles.css .dark:426-427` |
| `outline-black/10` en dark | `outline` blanco 10 % | better-ui "Image outlines": blanco puro en dark, nunca near-black/tintado | `AuthLayout.tsx:65` |
| `text-white` sobre relleno azul en dark (~2.0) | etiqueta `--ui-action-foreground` (8.03) | WCAG 1.4.3 / emil: contraste real, no el hábito del modo light | Cálculo §8; `AdminSidebar.tsx:81`, `AdminShell.tsx:79` |
| `#EFF6FF`/`#DBEAFE` como "subtle" (herencia light) | tinte translúcido 14/22 % cobalto + borde 36 % | briefing no-go §1.3; el sutil dark es un alfa, no un sólido claro | Mapeo §10.1; verificación AA chips |
| Hover con acento **más oscuro** (`#1D4ED8` en dark desaparece) | hover **más claro** (`#8FBAFF`), active un paso abajo | emil: en dark el feedback se lee subiendo luminancia | Ratios §1.3 |
| Skeleton con gradiente moviéndose por franja (shimmer) | delta de 2 tonos + pulso de opacidad, sin barrido | better-ui "interruptible animations" + motion restraint (alta frecuencia) | §5 |
| Modales con zoom desde disparador | conservado: modales centrados; popovers sí origin-aware | emil (transform-origin por disparador; excepción: modales) | `tokens.css:240-243`, `styles.css:329-331`, `motion-contract.test.ts:72-79` |
| `transition: all` / keyframes en elementos rápidos | transiciones por `data-state` + `@starting-style`; teclado sin animación (`:not(:focus-visible):active`) | better-ui/emil (interactividad interrumpible; Enter de alta frecuencia no anima) | `tokens.css:203-213`, `styles.css:208-331` — preservadas sin cambios |
| Reduced motion = cero animación | menos movimiento (solo color/opacity), nunca cero color | emil `prefers-reduced-motion` | `tokens.css:245-280`, `styles.css:85-94` — preservadas |
| Segundas marcas: violeta de gratuidad, teal institucional, indigo de gráficas | un solo acento cobalto + 3 semánticos; series de datos solo en §1.4 | briefing (no-go segundas marcas) + coherencia institucional | §1.4, §2 |
| Tests light-first congelando plumas/valores claros | contráctiles pasan a fijar dark canónico | hs-ux: revisión estática ≠ inspección visual; los tests no conceden aprobación visual | §9 con lista puntual (sin ediciones aquí) |

Declaración de comprobaciones: todas las ratios se calcularon con la fórmula WCAG 2.x ejecutada hoy sobre los hex del documento (composites incluidos). No se ejecutó ningún test, ni build, ni revisión visual renderizada en esta tarea (es especificación, no implementación); las pendientes quedan enumeradas en §9/§10.3 y son de los dueños de código.

## Estado y supuestos

**Estado: DEFINIDO.** La identidad dark de este documento es vinculante para pantalla; sustituye a IDENTIDAD_DEV/azul-blanco; los recibos en papel blanco conservan su identidad sin cambios.

Supuestos declarados:
1. La autoridad de los valores base (`#090A0C/#111318/#191C22/#2A2E36/#F5F7FA/#A1A8B3`) es el briefing del coordinador de hoy; `PROMPT_MAESTRO.md` es histórico y su §3 no contiene la dirección dark (discrepancia registrada, no resuelta aquí).
2. El dark es identidad **única** (dark-first, sin toggle visible); si el propietario quería un toggle claro/oscuro, esa condición externa reabriría §8/color-scheme.
3. `institutional-tokens.css` puede salir de la cadena de imports (decisión de hs-frontend); su `@theme` actual alimenta `--color-receipt-*` que la regla papel conserva.
4. Solo el dueño de código (hs-frontend / especialistas hs-ui-*) edita archivos producto; esta tarea entregó únicamente este documento.
5. No hubo acceso a ejecutar el navegador en esta sesión: no hay inspección visual real; la revisión de render (Playwright/a11y) corresponde a la integración de §10.3.
6. La navegación/estructura actual (shell, módulos, radios, movimiento) se preserva: se revoca identidad de color, no composición. `MANDATO_DEV.md` no ordena de nuevo el layout aquí.
7. Los imports `@fontsource-variable/geist` y la carga local de fuentes se mantienen (offline LAN).
8. No se requiere un escudo o logo nuevo para esta identidad: el nombre del hospital existente se mantiene sin fabricar sello ni firma.
