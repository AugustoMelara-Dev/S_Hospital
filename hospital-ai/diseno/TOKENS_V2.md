# TOKENS_V2 — Contrato de tokens visuales para wave 2

Autor: hs-ux. Fecha: 2026-09-17. Raíz escribible: `C:\Projects\S_Hospital_AI` (worktree aislado; NO se tocó `C:\Projects\S_Hospital`).
Mandato vigente: `hospital-ai/MANDATO_DEFINITIVO.md` §5, §8, §9, §10, §12, §14.
Alcance: contrato de diseño accionable. **No se editó ningún archivo de `frontend/src/**`.** La implementación pertenece a hs-frontend (tokens/shell) y hs-receipts (recibos).

Prioridad aplicada (§5): seguridad/corrección > accesibilidad > requisitos del mandato > contratos funcionales > recetas de skills > criterio visual. Cuando una receta de skill da un valor exacto apropiado, se conserva su valor literal y se cita.

---

## 1. Skills releídas y citadas (revisión/hash SHA-256, primeros 12 hex)

| Ruta | SHA-256 (12) | Valores exactos que se conservan aquí |
|---|---|---|
| `.agents/skills/better-ui/SKILL.md` | `C7CB0156F6F4` | `scale(0.96)` al presionar; radio concéntrico `outer = inner + padding`; stroke de icono según peso del texto (`1.5px`/`2px`/`2.5px`); pausa de transiciones en cambio de tema |
| `.agents/skills/better-ui/surfaces.md` | `CFA523043DAE` | shadow-as-border de 3 capas exactas (light) y anillo blanco único (dark); `oklch(0 0 0 / 0.10)` para contorno de imágenes; sombras para profundidad, bordes para estructura |
| `.agents/skills/better-ui/icons.md` | `9E9E1C67101E` | `1.5px` junto a 400, `2px` junto a 500–600, `2.5px` junto a 700; una librería por superficie; `currentColor`; tamaños nativos `16/20/24` |
| `.agents/skills/better-ui/animations.md` | `90D4F16E9E2F` | `scale(0.96)` (nunca <0.95); transiciones CSS para estado interactivo, keyframes solo para secuencias de una vez; `transition-property` explícito; hover de alta frecuencia ≤150 ms |
| `.agents/skills/better-ui/enter-exit.md` | `4E74BE10AA3F` | stagger `~100 ms` solo en entradas poco frecuentes; salida más suave: `y -12px`, `150 ms`, `ease-out` |
| `.agents/skills/better-ui/icon-transitions.md` | `55D6B3420B63` | cross-fade CSS `scale 0.25→1`, `opacity 0→1`, `blur(4px)→blur(0px)`, `cubic-bezier(0.2,0,0,1)`, 300 ms; sin librería `motion` (no está en `frontend/package.json`) |
| `.agents/skills/better-ui/performance.md` | `66AEE1287257` | prohibido `transition-all`; `will-change` solo `transform/opacity/filter` y solo ante stutter real |
| `.agents/skills/emil-design-eng/SKILL.md` | `A2EE9DA0840C` | `--ease-out: cubic-bezier(0.23,1,0.32,1)`; `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`; `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`; duraciones (<300 ms UI); nunca `ease-in`; animar `transform`/`opacity`; no animar acciones de teclado; `prefers-reduced-motion` conserva opacidad/color |

**Conflicto resuelto (no promediado):** `better-ui` fija `scale(0.96)` para press y `emil-design-eng` sugiere `0.97`. Se adopta **`0.96`** en todo elemento presionable (valor absoluto de `better-ui/SKILL.md`), con salida `static` para controles donde el movimiento distrae. No se usa otra cifra.

**Estado actual de implementación (verificado estático):** `frontend/package.json` no incluye `motion`/`framer-motion` → el cross-fade de iconos se especifica con CSS. `frontend/src/styles.css:52-54` fija `stroke-width: 1.75` global: es un valor intermedio que no sigue la tabla de `icons.md`; se documenta como migración (§9).

---

## 2. Tipografía

Familia única: **Geist Variable** (`@fontsource-variable/geist`, ya instalado y cargado; `frontend/src/styles.css:5,140`). Sin descarga de fuentes externas (§8). Fallback `system-ui, -apple-system, sans-serif`.

| Token | Tamaño / interlineado | Peso | Tracking | Uso |
|---|---|---|---|---|
| `--type-display` | 30px / 36px | 600 | −0.02em | Monto de éxito, única métrica grande por pantalla |
| `--type-metric` | 28px / 34px | 600 | −0.02em | Métricas de caja/informes (`OperationalMetric`) |
| `--type-total` | 24px / 30px | 700 | −0.02em | Total del POS y total del cobro |
| `--type-h1` | 24px / 30px (390 px: 22 px / 28 px) | 600 | −0.02em | Un solo `h1` por ruta (`PageHeader`) |
| `--type-h2` | 18px / 26px | 600 | −0.01em | Sección/bloque (`SectionCard`) |
| `--type-h3` | 16px / 24px | 600 | 0 | Subsección, título de tarjeta |
| `--type-body-lg` | 16px / 24px | 400 | 0 | Login, ayuda, texto de lectura, diálogos |
| `--type-body` | 14px / 22px | 400 | 0 | Cuerpo operativo por defecto |
| `--type-body-strong` | 14px / 22px | 600 | 0 | Etiquetas, encabezados de tabla, `dt` |
| `--type-sm` | 13px / 20px | 400 | 0 | Metadatos, ayudas, descripciones |
| `--type-xs` | 12px / 16px | 500 | 0.02em | Eyebrow mayúsculas, badges de estado |
| `--type-micro` | 11px / 14px | 600 | 0.04em | Solo etiquetas de copia del recibo |

Reglas:
1. Cuerpo en **14 px** (operativo) o **16 px** (lectura); el mandato fija 14–16 px. No bajar de 13 px en texto de interfaz; 11 px solo en el papel del recibo.
2. Un solo `h1` por ruta; jerarquía sin saltos `h1→h2→h3` (`styles.css:43-46` ya aplica `letter-spacing` negativo; se conserva).
3. **Cifras tabulares obligatorias** en todo monto, cantidad, número de factura/recibo y columnas numéricas: `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "lnum" 1`. Ya existe base en `styles.css:56-58` y `DataTable.tsx:42-43` (`data-numeric`).
4. **Monto en sans (Geist), no mono.** `--font-mono` se reserva para **identificadores**: n.º de factura, n.º de recibo, referencia de pago, IP, serie. `font-mono` en columnas de dinero se retira (migración §10). El montón conserva alineación derecha y `tabular-nums`.
5. Envoltura: `text-wrap: balance` en títulos (ya `styles.css:45`), `overflow-wrap: anywhere` en identificadores y nombres largos (`WrapText`, `InstitutionalComponents.tsx:20-22`); nunca truncar un monto.

---

## 3. Color (modo claro)

Ratios medidos con contraste WCAG 2.x (fórmula de luminancia relativa sRGB; evidencia: `C:\Users\melar\AppData\Local\Temp\opencode\contrast*-m-w1-ux-01.mjs`). `AA-text` = ≥4.5:1; `AA-UI` = ≥3:1 (1.4.11).

| Rol | Token | Hex | Ratio vs `#FFFFFF` (surface) | Ratio vs `#F8FAFC` (background) |
|---|---|---|---|---|
| Fondo de app | `--color-background` | `#F8FAFC` | — | — |
| Superficie | `--color-surface` | `#FFFFFF` | — | 1.05:1 |
| Superficie secundaria | `--color-muted` | `#F1F5F9` | 1.10:1 | 1.05:1 |
| Texto principal | `--color-foreground` | `#172033` | **16.27:1 AA-text** | **15.55:1 AA-text** |
| Texto secundario | `--color-muted-foreground` | `#475569` | **7.58:1 AA-text** | **7.24:1 AA-text** |
| Borde sutil (filas) | `--color-border-subtle` **(nuevo)** | `#E2E8F0` | 1.23:1 (no-textual decorativo) | 1.18:1 |
| Borde estructural | `--color-border` | `#CBD5E1` | 1.48:1 (solo estructura) | 1.42:1 |
| Borde de control | `--color-border-strong` **(nuevo)** | `#64748B` | **4.76:1 AA-text** | **4.55:1 AA-text** |
| Acento (azul petróleo) | `--color-primary` | `#0F766E` | **5.47:1 AA-text** | **5.23:1 AA-text** |
| Texto sobre acento | `--color-primary-foreground` | `#FFFFFF` | — | sobre `#0F766E` = **5.47:1** |
| Acento tenue | `--color-accent` | `#ECFDF5` | — | `#0F766E` sobre él = **5.20:1** |
| Foco (anillo) | `--color-ring` | `#0F766E` | **5.47:1** | **5.23:1** |
| Éxito | `--color-success` | `#15803D` | **5.02:1 AA-text** | 4.79:1 |
| Éxito texto | `--color-success-foreground` | `#14532D` | **9.11:1 AA-text** | — |
| Éxito fondo | `--color-success-surface` **(nuevo)** | `#F0FDF4` | `#14532D` sobre él = **8.70:1** | — |
| Advertencia | `--color-warning` | `#B45309` | **5.02:1 AA-text** | 4.84:1 |
| Advertencia texto | `--color-warning-foreground` | `#78350F` | **9.07:1 AA-text** | — |
| Advertencia fondo | `--color-warning-surface` **(nuevo)** | `#FFFBEB` | `#78350F` sobre él = **8.75:1** | — |
| Error | `--color-error` | `#B91C1C` | **6.47:1 AA-text** | 6.18:1 |
| Error texto | `--color-error-foreground` | `#7F1D1D` | **10.02:1 AA-text** | — |
| Error fondo | `--color-error-surface` **(nuevo)** | `#FEF2F2` | `#7F1D1D` sobre él = **9.16:1** | — |
| Información | `--color-info` | `#0369A1` | **5.93:1 AA-text** | 5.58:1 |
| Información texto | `--color-info-foreground` | `#0C4A6E` | **9.46:1 AA-text** | — |
| Información fondo | `--color-info-surface` **(nuevo)** | `#F0F9FF` | `#0C4A6E` sobre él = **8.87:1** | — |

Reglas de uso:
- **Un solo acento institucional por superficie.** El acento es de acción/estado, no decorativo. Márgenes, tarjetas y fondos no llevan el acento.
- `--color-border` (1.48:1) es **solo estructura** (separadores, bordes de tarjeta). Todo control interactivo (input, select, textarea, botón `outline`, casilla) usa `--color-border-strong` para cumplir 1.4.11 ≥3:1. Esto es la corrección del hallazgo de contraste no textual.
- Prohibido usar `--color-primary-foreground` como texto sobre superficie clara. Caso real a corregir: `PaymentModal.tsx:249` (`text-primary-foreground` sobre `bg-surface`) → `text-primary-foreground` debe ser solo sobre `bg-primary`; en superficie clara usar `--color-muted-foreground`.
- Prohibido `text-secondary` como color de contenido (`check-ui-rules.mjs:31-33` ya lo prohíbe).

### 3.1 Modo oscuro (mismo producto, no un tema distinto)

| Rol | Token | Hex | Ratio |
|---|---|---|---|
| Fondo | `--color-background` | `#0F172A` | — |
| Superficie | `--color-surface` | `#1E293B` | `#F8FAFC` sobre él = **13.98:1** |
| Superficie secundaria | `--color-muted` | `#263449` | `#F8FAFC` sobre él = **12.02:1** |
| Texto | `--color-foreground` | `#F8FAFC` | **17.06:1** sobre fondo |
| Texto secundario | `--color-muted-foreground` | `#CBD5E1` | **12.02:1** fondo / **9.85:1** superficie |
| Borde estructural | `--color-border` | `#475569` | 2.36:1 (solo estructura) |
| Borde de control | `--color-border-strong` **(nuevo)** | `#94A3B8` | **6.96:1** fondo / **5.71:1** superficie |
| Acento | `--color-primary` | `#2DD4BF` | **9.59:1** |
| Foco | `--color-ring` | `#5EEAD4` | **12.07:1** |
| Éxito / Advert. / Error / Info | — | `#4ADE80` / `#FBBF24` / `#F87171` / `#38BDF8` | 10.25 / 10.69 / 6.45 / 8.33 |

`--color-border` oscuro actual `#475569` da 2.36:1: válido como separador decorativo, **inválido** como contorno único de control; de ahí `--color-border-strong`.

### 3.2 Reglas de color de estado (no-solo-color, §10)
- Todo estado lleva **texto** además de color (badge textual ya en `InvoiceHistoryTable.tsx:303-330`).
- El color de marca configurable (`colorThemes.ts`) solo cambia `primary/ring/accent`; **no** redefine éxito/advertencia/error/info, que son semánticos y fijos.
- Las 5 variantes deben pasar contraste en claro y oscuro (gate `accessibility.spec.ts:208-230`); los pares de este contrato son los del tema `teal` (por defecto) y los semánticos.

---

## 4. Espaciado y densidad

Unidad base **4 px**. Escala cerrada: `2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Uso | Valor |
|---|---|
| Gap entre controles en una fila | 8 px |
| Gap vertical entre secciones | 24 px (`gap-6`, ya `InstitutionalShell.tsx:162`) |
| Gap interno de tarjeta | 16 px |
| Padding de panel operativo | 16 px; secciones amplias 24 px |
| Padding de celda de tabla | 12 px vertical / 16 px horizontal |
| Alto de fila de tabla | 44 px (densa) / 52 px (cómoda) |
| Alto de control secundario | 32 px |
| Alto de control por defecto | 36 px |
| Alto de control operativo/crítico | **44 px mínimo** (caja, POS, cobro; botón primario POS ya `h-11` = 44 px en `InvoiceCart.tsx:183`) |
| Alto de campo de monto | **48 px** (`PaymentModal.tsx:360` ya usa `min-h-12`) |
| Área táctil mínima | 44×44 px en móvil; 24×24 px mínimo absoluto (WCAG 2.5.8) |

Densidad: en 1366×768 la primera pantalla debe mostrar paciente, servicios y total (POS) o métricas + primer bloque de trabajo. No usar "density modes"; una sola densidad de escritorio.

---

## 5. Radios concéntricos

Regla: **`outer = inner + padding`** (`better-ui/surfaces.md`). Pasados 24 px de padding, tratar las capas como superficies separadas y elegir radios independientes.

| Token | Valor | Uso |
|---|---|---|
| `--radius-control` | 8 px | input, select, botón, badge cuadrado, casilla |
| `--radius-surface` | 12 px | tarjeta, panel, tabla, alerta |
| `--radius-overlay` | 16 px | diálogo, drawer, hoja móvil, popover |
| `--radius-pill` | 999 px | badges y chips |

Aplicación:
- Tarjeta con `padding 8px` y control interior `8px` → exterior `16px` (concéntrico).
- Tarjeta con `padding 16px`: el hijo interior deja de ser concéntrico (16 > 24 no aplica, pero el hijo con 8 px se ve bien como superficie propia); no forzar 24 px porque el gate E2E exige **≤16 px** en `[data-slot=button|input|select-trigger|dialog-content|sheet-content|dropdown-menu-content|alert|table|skeleton|progress]` (`accessibility.spec.ts:191-196,452`). Cualquier radio >16 px en esos selectores es FAIL.
- Radios actuales: `--radius` 10 px con derivados `--radius-2xl = 1.8×0.625rem` (18 px), `--radius-3xl` (22 px) y `--radius-4xl` (26 px) superan el máximo de 16 px si se aplican a superficies del gate. Sustituir por la escala de esta tabla.
- No mezclar radios distintos en superficies anidadas visibles con inset uniforme.

---

## 6. Sombras (shadow-as-border) — valores exactos

Sombra para **profundidad**; borde para **estructura**. No aplicar sombra a separadores, celdas ni `border-b/t/l/r` (`surfaces.md`).

```css
:root {
  /* 3 capas exactas de better-ui/surfaces.md (light) */
  --shadow-border:
    0px 0px 0px 1px oklch(0 0 0 / 0.06),
    0px 1px 2px -1px oklch(0 0 0 / 0.06),
    0px 2px 4px 0px oklch(0 0 0 / 0.04);
  --shadow-border-hover:
    0px 0px 0px 1px oklch(0 0 0 / 0.08),
    0px 1px 2px -1px oklch(0 0 0 / 0.08),
    0px 2px 4px 0px oklch(0 0 0 / 0.06);
}
.dark {
  --shadow-border: 0 0 0 1px oklch(1 0 0 / 0.08);
  --shadow-border-hover: 0 0 0 1px oklch(1 0 0 / 0.13);
}
```

- Transición: `transition-property: box-shadow; transition-duration: 150ms; transition-timing-function: ease-out`. Nunca `transition-all` (regla activa en `check-ui-rules.mjs:12`).
- Overlays (diálogo/popover/drawer): `--shadow-border` + capa ambiente declarada explícitamente:
  `--shadow-overlay: 0 0 0 1px oklch(0 0 0 / 0.08), 0 8px 16px -4px oklch(0 0 0 / 0.10), 0 16px 32px -8px oklch(0 0 0 / 0.08);` (extensión sobre la receta base; se declara como tal).
- En impresión toda sombra se anula (`box-shadow: none`, ya `receipt-print.css:471`).
- Imágenes/avatares/logos: `outline: 1px solid oklch(0 0 0 / 0.10); outline-offset: -1px` (nunca un gris tintado, nunca el color de acento).
- No usar `will-change` preventivamente.

---

## 7. Foco y teclado (tokens)

```css
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
--focus-ring-color: var(--color-ring);   /* #0F766E claro / #5EEAD4 oscuro */
--focus-ring-contrast-min: 3;            /* 1.4.11: el anillo debe medir ≥3:1 contra la superficie adyacente */
```

- `:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }`. **Nunca `outline: none` sin sustituto.**
- Sobre `bg-primary`, el anillo es blanco (`#FFFFFF` sobre `#0F766E` = 5.47:1) o se cambia el offset.
- Elementos fijos (barras sticky, bottom bar móvil) no deben tapar el foco: `scroll-margin-block: 80px` en `main` y en anclas (`InstitutionalShell.tsx:149` ya usa `scroll-mt-20`).
- `Esc` cierra overlay y devuelve el foco al disparador.
- Skip link existente (`InstitutionalShell.tsx:143-145`) se conserva y debe ser el primer Tab.
- Enter seguro: ver §8 del contrato de pantallas; resumen de token: `--action-confirm-gesture: Ctrl+Enter` (nunca Enter solo).

---

## 8. Movimiento (tokens exactos y cuándo NO animar)

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* emil-design-eng */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* emil-design-eng */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* emil-design-eng */
--ease-icon: cubic-bezier(0.2, 0, 0, 1);         /* better-ui/icon-transitions.md */
--duration-press: 150ms;                          /* 100–160 ms */
--duration-hover: 100ms;                          /* filas/alto uso ≤150 ms */
--duration-overlay-in: 220ms;                     /* modales/drawers 200–500 ms */
--duration-overlay-out: 150ms;                    /* salida < entrada */
--duration-icon: 300ms;                           /* solo cross-fade de iconos */
--press-scale: 0.96;
```

Reglas:
1. **No animar** el cobro, la confirmación irreversible, los atajos de teclado ni la navegación por teclado (§10; `emil-design-eng/SKILL.md` §1). Feedback instantáneo o `≤150 ms` de opacidad/color.
2. `transition-property` explícito; prohibido `transition: all`/`transition-all`.
3. Overlays entran con `opacity + translateY(8px)` a 220 ms `--ease-out`; salen con `opacity + translateY(-12px)` a 150 ms (valor de `enter-exit.md`). Modales: `transform-origin: center`; popovers: `transform-origin: var(--transform-origin)` (del disparador).
4. Stagger `~100 ms` solo en entrada de estados poco frecuentes (éxito, vacío, primer load). Filas, hover y teclado no escalonan.
5. Cross-fade de iconos: `scale 0.25→1`, `opacity 0→1`, `blur(4px)→0`, 300 ms, `--ease-icon`, ambos iconos en el DOM (sin `motion`). No animar iconos de navegación estáticos.
6. `prefers-reduced-motion: reduce`: conservar opacidad/color, eliminar movimiento (ya global en `styles.css:60-69`; no volver a declarar por componente ni desactivar la regla global).
7. La animación nunca es el único canal de feedback: siempre hay color/ícono/etiqueta estática.

---

## 9. Iconografía

Librería única: **lucide-react** (`frontend/package.json:50`). Ninguna otra. Todos los iconos en SVG, `stroke="currentColor"`, relleno vacío.

| Texto adyacente | Stroke (grid 24) | Token |
|---|---|---|
| Regular (400), 14–16 px | `1.5px` | `--icon-stroke-regular` |
| Medium/Semibold (500–600) | `2px` | `--icon-stroke-medium` |
| Bold (700) o standalone enfatizado | `2.5px` | `--icon-stroke-strong` |

- Tamaños en la grilla nativa: `16` (inline, `size-4`), `20` (`size-5`), `24` (`size-6`). Icono inline con texto ≈ `1em–1.25em`.
- Estado por CSS: hover/seleccionado/deshabilitado cambian `color`/`opacity`; nunca assets distintos. Deshabilitado `opacity: 0.4`.
- Outline por defecto; **fill solo para estado activo** (pestaña activa, toggle). El swap usa el cross-fade del §8.
- Un icono por acción; **icono solo sin texto requiere `aria-label`** (clave en `DataTable` sort icons, `PaymentModal` banknote, rail colapsado).
- **Migración:** `styles.css:52-54` fuerza `1.75` a todo `[data-icon]`. Sustituir por la tabla: los botones con etiqueta 500/600 usan 2 px; el 1.75 desaparece. No mezclar 1.5 y 2 en la misma barra.

---

## 10. Registro de tokens y migraciones (choques con el código actual)

Mantener los nombres `--institutional-*` y el puente Tailwind v4 (`@theme` / `@theme inline`) ya existentes. Añadir en `frontend/src/design-system/tokens/institutional-tokens.css` (claro) y `.dark`:

| Token nuevo | Claro | Oscuro | Motivo |
|---|---|---|---|
| `--institutional-border-subtle` | `#E2E8F0` | `#334155` | separadores de fila |
| `--institutional-border-strong` | `#64748B` | `#94A3B8` | contorno de control ≥3:1 |
| `--institutional-success-surface` | `#F0FDF4` | `#052E16` | fondo de estado |
| `--institutional-warning-surface` | `#FFFBEB` | `#451A03` | fondo de estado |
| `--institutional-error-surface` | `#FEF2F2` | `#450A0A` | fondo de estado |
| `--institutional-info-surface` | `#F0F9FF` | `#082F49` | fondo de estado |
| `--shadow-border`, `--shadow-border-hover`, `--shadow-overlay` | §6 | §6 | profundidad |
| `--radius-control/surface/overlay/pill` | §5 | — | radios concéntricos |

Migraciones detectadas (hs-frontend decide y ejecuta; hs-ux no edita):
1. **`--font-mono` en montos**: retirar de columnas monetarias y conservar solo en identificadores. Archivos con `font-mono tabular-nums` para dinero: `InvoiceCart.tsx:151,165,169,173,177`, `PaymentModal.tsx:267,273,278,284`, `LempiraAmount.tsx` (revisar), tablas de historial/caja/reportes.
2. **`text-primary-foreground` sobre superficie clara**: `PaymentModal.tsx:249`.
3. **`font-bold` en `h1` del POS**: `NewInvoiceViewLayout.tsx:168` (`text-2xl font-bold`) → `h1` de 24 px/600 (`--type-h1`). Igual en `PasswordChangeView.tsx:43` (30 px) y `InstitutionalReceiptSettingsView` si usa display.
4. **Radios >16 px** en superficies del gate (`--radius-2xl/3xl/4xl` de `styles.css:176-178`) → sustituir en esas superficies.
5. **`stroke-width: 1.75` global** (`styles.css:53`) → tabla de §9.
6. **Tokens operativos** ya registrados (`institutional-tokens.css:112-115`); se mantienen y no se re-declaran.
7. **`--institutional-secondary` oscuro `#CBD5E1`**: no usarlo como texto sobre fondo oscuro (`check-ui-rules.mjs:31-33`); texto secundario es `--color-muted-foreground`.

---

## 11. Criterios de aceptación medibles (para hs-frontend/QA)

1. Contraste AA (≥4.5:1 texto, ≥3:1 UI) en claro y oscuro, incluidas las 5 variantes de marca.
2. Radio ≤16 px en los 10 selectores del gate E2E.
3. Todo monto con `tabular-nums`, alineado a la derecha, sin truncar.
4. Foco visible ≥3:1 en cada control y retorno de foco tras cada overlay.
5. Sin `transition-all`, sin `will-change: all`, sin gradientes decorativos, sin landing/hero, sin tarjetas anidadas.
6. Cero animación en cobro y en acciones de teclado.
7. Un `h1` por ruta proveniente de `PageHeader`.

**NOT VERIFIED:** ningún ratio fue medido en navegador sobre el render; los ratios son cálculo WCAG sobre los hex declarados en el código y este contrato. La inspección renderizada corresponde a QA/frontend con evidencia.
