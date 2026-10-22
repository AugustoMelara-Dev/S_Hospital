# Tokens, densidad y shell — propuesta para aplicación administrativa de escritorio

Autor: hs-ux (solo propuesta; los archivos `frontend/src/**` pertenecen a hs-frontend/hs-receipts). Sin edición de código de producto.

## 1. Viewport objetivo (citado de fuentes reales)

| Fuente | Requisito |
|---|---|
| `SYSTEM_REQUIREMENTS.md:79` | Estación de caja: pantalla 1366x768 mínimo |
| `SYSTEM_REQUIREMENTS.md:80-81` | Chrome/Edge/Firefox 120+; teclado con bloque numérico para pagos |
| `SYSTEM_REQUIREMENTS.md:75-78` | 2 núcleos, 4 GB RAM, LAN 100 Mbps: la UI debe ser liviana |
| `frontend/e2e/accessibility.spec.ts:181-189` | Matriz visual: 1366x768 (claro/oscuro), 1920x1080 (claro/oscuro), 390x844 (claro/oscuro), 1366x768 zoom 125 % |
| `frontend/e2e/accessibility.spec.ts:333-344` | Reflow extra: 320, 768, 1024, 1280, 1600, 1920 px y equivalentes de zoom 125/200 |
| `frontend/src/styles.css:21` | `body { min-width: 320px }` |
| `docs/ux/2026-07-15-operational-ux-research-decisions.md:94-106` | WCAG 2.2: reflow a 320 CSS px, foco no obstruido por sticky, targets ≥24x24 y 44 px para controles críticos, sin re-entrada redundante |
| `docs/accessibility-checklist.md:59-68` | QA manual pendiente: skip link, `Ctrl+Enter`, zoom 125 % sin scroll horizontal |

**Decisión propuesta**: primario **1366x768** (hardware mínimo) con densidad de escritorio; secundario **1920x1080** (aprovechar ancho en tablas); soporte reducido **1024x768** y **390x844** por si se usa una laptop pequeña/tablet en administración; reflow obligatorio hasta **320 px**. No diseñar para móvil como caso principal, pero no romperlo.

## 2. Inventario de tokens actual (verificado)

- **Semánticos institucionales**: `frontend/src/design-system/tokens/institutional-tokens.css:1-31` (claro) y `:46-76` (oscuro) definen background/surface/text/border/primary/success/warning/error/info + sidebar.
- **Puente Tailwind v4**: `institutional-tokens.css:78-129` (`@theme`) y `frontend/src/styles.css:138-179` (`@theme inline`) exponen `--color-*`; `styles.css:181-214` asigna los alias shadcn (`--background`, `--card`, `--primary`, charts, sidebar).
- **Radios**: `--radius` 0.625rem y derivados (sm 0.375, md 0.5, lg 0.625, xl 0.75) (`institutional-tokens.css:120-126`; `styles.css:172-178`). El gate E2E exige radios ≤16 px en superficies modernas (`accessibility.spec.ts:452`).
- **Tipografía**: `styles.css:5,139-140` Geist Variable (paquete `@fontsource-variable/geist` instalado) con fallback `system-ui`. `institutional-tokens.css:117` declara "IBM Plex Sans Variable" que **no está instalado** (no aparece en `frontend/package.json`); el `@theme inline` posterior gana, así que el texto es Geist. Limpiar la declaración muerta en Tanda 2 (hs-frontend).
- **Mono**: `--font-mono: "Cascadia Code", ui-monospace, monospace` (`institutional-tokens.css:118`); Cascadia no se empaqueta: en Windows sin Cascadia cae a `ui-monospace`. Aceptable si el fallback conserva `tabular-nums`.
- **Gaps confirmados (HS-UX-02)**: `--color-operational-bg/surface/panel/border` solo se asignan dentro de `@media print` (`frontend/src/printing/styles/receipt-print.css:353-367`) y no están registrados en ningún `@theme`; sin embargo se usan como utilidades en pantalla en 20+ archivos (p. ej. `NewInvoiceViewLayout.tsx:214`, `InvoiceCart.tsx:76,118,161`, `PaymentModal.tsx:311`, `CashClosingPanel.tsx:69`, `ReportsAudit.tsx:268,337`, `ExecutiveSummary.tsx:201-230`, `BackupSupportStatusPanel.tsx:209,296`, `AppErrorBoundary.tsx:50`). En Tailwind v4 una utilidad de color sin variable `--color-*` registrada no se genera; el efecto esperado en pantalla es pérdida del borde/superficie operativa. **Pendiente de confirmar con build** (no ejecutado: sin `node_modules`).

## 3. Propuesta de tokens (reutilizando lo existente)

No se crean librerías nuevas. Se proponen reglas de uso y, si hs-frontend acepta, el registro de los tokens operativos en el bloque `@theme` existente.

### 3.1 Superficies y jerarquía

| Rol | Token existente | Uso |
|---|---|---|
| Fondo de app | `--color-background` (#f8fafc / #0f172a) | base |
| Superficie de tarjeta/panel | `--color-card` / `--color-surface` | contenido agrupado |
| Zona secundaria | `--color-muted` con borde `--color-border` | filtros, resúmenes, previews |
| Panel operativo (si se registra) | `--color-operational-surface`, `--color-operational-border`, `--color-operational-panel` | paneles de POS/caja/informes; debe ser **el mismo** en claro/oscuro salvo superficie |
| Sidebar | `--color-sidebar*` | rail |

Regla: máximo dos niveles visuales por pantalla (fondo + superficie). Sin gradientes decorativos, sin sombras flotantes (`institutional-tokens.css:128` declara su eliminación); sombra solo con `ring`/borde.

### 3.2 Tipografía y jerarquía

| Nivel | Tamaño/peso propuesto | Uso |
|---|---|---|
| h1 de pantalla | 24 px (1366) / 30 px (≥1920), 600 | título único; eyebrow 12 px mayúsculas muted |
| h2 de sección | 18-20 px, 600 | bloques y tarjetas |
| Cuerpo | 14 px, 400, línea 1.5-1.6 | operación |
| Metadatos | 12-13 px, muted | fechas, ayudas, IDs |
| Montos | `tabular-nums` + `font-mono` cuando van en tabla | totales y saldos; Lempira con `LempiraAmount` (`frontend/src/design-system/components/LempiraAmount.tsx:22-43`) |

Regla: los montos se alinean a la derecha en tablas y nunca se truncan; la jerarquía se logra con tamaño/peso antes que con color.

### 3.3 Densidad y espaciado

- Unidad base 4 px; padding de panel 16 px (compacto) / 24 px (secciones amplias); gaps 12/16/24.
- Filas de tabla: alto 44-48 px; celdas 12 px verticales; cabeceras 12 px semibold.
- Controles críticos de caja/POS: 44 px de alto mínimo (documentado en `docs/ux/2026-07-15-...:101-103`); controles secundarios nunca < 32 px.
- Tablas: `font-variant-numeric: tabular-nums` global en columnas numéricas (`styles.css:56-58`).

### 3.4 Estados (contrato no-solo-color)

| Estado | Tratamiento mínimo |
|---|---|
| Éxito | texto + icono/estructura + `--color-success` como refuerzo |
| Advertencia | texto + `--color-warning` + acción sugerida |
| Error | `role="alert"` + texto + acción de recuperación |
| Información | texto + `--color-info` |
| Cargando | `role="status"` + spinner/skeleton, nunca solo cambio de tono |
| Vacío | título + causa + una acción |
| Deshabilitado | `aria-disabled` + explicación, no solo opacidad |

Regla dura: factura emitida/pagada/anulada/parcial y "recibo pendiente" **siempre** con texto (badge textual ya existente en `InvoiceHistoryTable.tsx:303-330`).

### 3.5 Foco y teclado

- Anillo de foco único `focus-visible:ring-2 ring-ring` con offset; nunca `outline: none` sin sustituto.
- Orden de tabulación predecible por región (ver contratos 02-08); `Esc` cierra overlay y devuelve foco al disparador.
- Skip link ya existe (`InstitutionalShell.tsx:118-120`): mantener y verificar que el primer Tab lo alcance.
- `prefers-reduced-motion` ya respetado globalmente (`styles.css:60-69`).

### 3.6 Radios y bordes

- Radios ≤ 16 px (gate E2E); recomendado 8-12 px en tarjetas y 6-8 px en controles.
- Bordes 1 px `--color-border`; usar `ring-1 ring-foreground/10` para tarjetas destacadas (patrón existente en `RouteState.tsx:57`).

## 4. Shell propuesto (sin cambios de producto desde hs-ux)

- **Rail** izquierdo de 256 px colapsable a iconos; grupos Operaciones/Administración/Asistencia; `aria-current="page"`; tooltips en colapsado; preferencia persistida (`InstitutionalShell.tsx:122`, `InstitutionalRail.tsx:29-38`).
- **Barra de contexto** sticky: breadcrumb actual, badge de caja con texto, conexión local, buscar (Ctrl+K), ayuda, usuario (`ContextBar.tsx:34-88`).
- **Contenido**: ancho máximo actual `max-w-screen-2xl` (1536 px) con padding 12/20/28 px (`InstitutionalShell.tsx:136-137`). Propuesta: conservar; en 1920 px las tablas ganan ancho útil y las columnas de acción no se estiran.
- **Ayudas globales**: comandos, paleta de atajos, tour. Todas deben filtrar por permisos y devolver foco.
- **Prohibiciones**: sin landing/hero, sin tarjetas de marketing, sin gradientes gratuitos, sin collage de shadcn no relacionado, sin botones decorativos.

## 5. Criterios de aceptación visual (medibles en Tanda 2)

1. Sin scroll horizontal de documento a 320/390/768/1024/1366/1600/1920 px y zoom 125/200 equivalente.
2. Contraste AA (4.5:1 texto normal) en claro y oscuro, incluidos badges de estado y tablas.
3. Un solo `h1` por ruta; `main` único; jerarquía h1→h2→h3 sin saltos.
4. Montos en `tabular-nums`, alineados a la derecha, sin truncar; Lempira siempre explícito.
5. Objetivos táctiles ≥ 44 px en acciones operativas.
6. Ningún estado diferenciado solo por color.
7. Tareas principales de cada pantalla visibles en el primer viewport a 1366x768 (regla de `docs/superpowers/specs/2026-07-14-operational-ux-correction-design.md:237-249`).

## 6. Pendiente de validación visual (sin navegador en T1-004)

- Confirmar en build que las utilidades `border-operational-border` / `bg-operational-surface` se generan o corregirlas (HS-UX-02).
- Revisar contraste real en ambos temas con la paleta institucional y las 5 variantes de color (`accessibility.spec.ts:208-230`).
- Verificar densidad del POS a 1366x768 con carrito lleno y la cuenta sticky.
- Verificar guard sticky de configuración a 390x844.
