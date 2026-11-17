---
name: S_Hospital
description: Caja y facturación hospitalaria de ventanilla, teclado primero, en un piso de ladrillo hidráulico.
colors:
  rail: "#24493f"
  rail-ink: "#e9e4da"
  rail-muted: "#bfc9c1"
  rail-hover: "#2e574b"
  rail-line: "#3b6157"
  ground: "#e4dfd5"
  surface: "#f4f1eb"
  surface-2: "#ebe7df"
  field: "#ffffff"
  ink: "#2a2724"
  ink-2: "#5e5850"
  ink-3: "#665f56"
  junta: "#cfc8ba"
  junta-strong: "#b3ab9c"
  oxide: "#9c3b2a"
  oxide-hover: "#86311f"
  oxide-deep: "#7e2e20"
  oxide-ink: "#f7f2ea"
  ochre: "#c8902f"
  ochre-line: "#b07c24"
  ochre-ink: "#2a2724"
  slate: "#3e5c76"
  slate-hover: "#344e65"
  slate-soft: "#dde5ec"
  slate-text: "#2c4559"
  ok: "#2f5b44"
  ok-soft: "#dde8df"
  warn: "#8a5a0e"
  warn-soft: "#f1e3c6"
  danger: "#a12937"
  danger-hover: "#8a2230"
  danger-soft: "#f3dcdc"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "58px"
    fontWeight: 700
    lineHeight: "64px"
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 88"
  headline:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 92"
  title:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
  body:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "tnum"
  label:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
  total-label:
    fontFamily: "'Archivo Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0.06em"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
spacing:
  page-x: "24px"
  page-top: "20px"
  panel: "16px"
  dialog-x: "20px"
  gap: "16px"
  column-gap: "24px"
  rail: "216px"
  rail-collapsed: "64px"
  topbar: "56px"
  total-column: "420px"
components:
  button-primary:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.oxide-ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.oxide-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
  button-pay:
    backgroundColor: "{colors.oxide}"
    textColor: "{colors.oxide-ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  kbd:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 5px"
    height: "18px"
  badge:
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  total-field:
    backgroundColor: "{colors.ochre}"
    textColor: "{colors.ochre-ink}"
    typography: "{typography.display}"
    padding: "16px 24px 20px"
  rail:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    width: "216px"
  rail-item-active:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
  topbar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    height: "56px"
  shift-chip:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.md}"
    height: "40px"
---

# Design System: S_Hospital

## Overview

**Creative North Star: "El piso de ladrillo hidráulico"**

La caja del hospital es un pasillo hondureño de cemento pigmentado: módulos cuadrados, una sola junta fina de 1px entre pieza y pieza, y pigmentos mate que trabajan en lugar de decorar. El suelo es piedra cálida-gris; sobre él se asientan paneles hueso planos; a la izquierda corre un riel verde botella con texto hueso. Tres pigmentos tienen trabajo asignado y ningún otro: el óxido es la acción principal, el ocre es el campo del total, la pizarra es información, selección y foco.

La densidad es de oficina: texto base de 14/20px, tablas de 44px por fila, todo navegable con teclado y con su atajo visible al lado. Las cifras son la tipografía protagonista: Archivo con figuras tabulares y un ancho ligeramente condensado, alineadas duro a la derecha. El total de Cobrar es la cifra más grande de la pantalla, siempre. Los estados se distinguen por forma y etiqueta (cuadro lleno, hueco, medio, tachado, rombo); el color solo acompaña.

El sistema rechaza el dashboard genérico de tarjetas blancas iguales flotando sobre gris con un único acento, y rechaza las sombras decorativas: la profundidad la da el tono del suelo contra la superficie y la junta, no el relieve.

**Key Characteristics:**
- Una sola regla de 1px (la junta) para separar todo: celdas, paneles, cabeceras, pies.
- Tres pigmentos con un trabajo cada uno (óxido, ocre, pizarra) sobre neutros cálidos.
- Archivo para todo; cifras tabulares, condensadas y alineadas a la derecha.
- Radios pequeños (2–4px); nada más redondo salvo el avatar de iniciales.
- El ladrillo de cuatro cuartos como única firma: marca, estado del turno y arqueo.
- Teclado primero: cada acción principal lleva su tecla en un Kbd.

## Colors

Neutros cálidos de piedra y hueso, un riel verde botella, y tres pigmentos mate con roles exclusivos. El modo claro es la escena principal (oficina con fluorescente, de día); el oscuro se aplica por `prefers-color-scheme` o `[data-theme]` y redefine los mismos nombres.

### Primary
- **Óxido de ladrillo** (oxide): la acción principal de la vista y nada más: "Cobrar · L x" en Cobrar, el botón primario de un diálogo. Hover baja a óxido hondo (oxide-hover); el Kbd sobre óxido usa oxide-deep. Aparece además como trazo del icono del ítem activo del riel y en el núcleo de la roseta de marca; esos son los únicos usos fuera del botón.

### Secondary
- **Ocre de campo** (ochre): el campo del total. Fondo del panel de totales de Cobrar y de la franja "Saldo / Total a cobrar" del diálogo de pago, con reglas internas en ocre-línea (ochre-line) y tinta oscura (ochre-ink). No se usa como acento, botón ni estado.

### Tertiary
- **Pizarra** (slate): información, selección y foco. Anillo de foco, caret, `::selection`, fila seleccionada (slate-soft con slate-text), enlaces de acción ("Abrir caja"), badges de información y pago parcial.

### Neutral
- **Verde botella de riel** (rail): fondo de la navegación lateral y juntas de la roseta de marca; rail-ink para texto, rail-muted para secundarios, rail-hover para hover, rail-line para sus divisiones. En el ladrillo del turno, los cuartos completados se rellenan en este verde (en oscuro, con ok).
- **Piedra cálida** (ground): el suelo de la app, cabeceras de tabla, el chip del turno, el ítem activo del riel.
- **Hueso** (surface): paneles, tablas, diálogos, barra superior. surface-2 para hover de filas y pies de diálogo.
- **Blanco de campo** (field): solo controles de texto (inputs, selects, textareas, buscador). Nada más es blanco.
- **Tinta** (ink / ink-2 / ink-3): texto principal, secundario (≥5.2:1) y terciario (≥4.7:1 sobre ground y surface).
- **Junta** (junta / junta-strong): la regla de 1px; junta-strong para hover de bordes, scrollbar y el borde del ladrillo del turno.
- **Estados** (ok, warn, danger con sus -soft): siempre emparejados con glifo y etiqueta.

### Named Rules
**The Three Pigments Rule.** Óxido = presionar lo principal; ocre = el total; pizarra = información, selección y foco. Ningún pigmento cambia de trabajo, y una vista tiene a lo sumo un botón óxido.

**The White Field Rule.** El blanco puro es exclusivo de los campos donde se escribe. Paneles y tarjetas son hueso sobre piedra, nunca blanco sobre gris.

**The Disabled Is Not Faded Rule.** El primario deshabilitado no es óxido translúcido: cae a una pieza de superficie con junta y tinta terciaria, y su Kbd vuelve al tono neutro.

## Typography

**Display Font:** Archivo Variable (con Segoe UI, system-ui)
**Body Font:** Archivo Variable (con Segoe UI, system-ui)
**Label/Mono Font:** Archivo Variable con la utilidad de cifras (`num`): figuras tabulares y ancho 92%. No hay monoespaciada; `--font-mono` apunta a Archivo.

**Character:** Una sola familia grotesca, empaquetada offline, que se condensa para las cifras. La jerarquía sale del tamaño y del peso, no de cambiar de fuente.

### Hierarchy
- **Display** (700, 58/64px, ancho 88%, −0.02em): el total de Cobrar. Baja a 44/52px cuando la cifra supera 12 caracteres para no desbordar.
- **Headline** (700, 22/28px, −0.015em): título de la página, portado a la barra superior como el único h1 (19px bajo 640px; 24/32px cuando la página va sin shell).
- **Figure** (600, 24/28px, cifras tabulares al 92%): la cifra de cada celda KPI y del arqueo.
- **Title** (700, 15/20px): h2 de panel y de sección; 17/24px en la cabecera de diálogos y drawers; 13/16px en secciones de libro (LedgerSection).
- **Body** (400, 14/20px, figuras tabulares por defecto en `html`): texto, celdas de tabla, controles. Descripciones a máximo 75ch.
- **Label** (600, 12/16px, ink-2): rótulos de campo, cabeceras de columna, rótulos de KPI. Badges a 11.5px semibold; Kbd a 11px semibold.
- **Total label** (700, 15px o 13px, +0.06em, mayúsculas): solo la palabra que acompaña a la cifra final de un campo de totales (TOTAL, CAMBIO, SALDO) y el sello de estado en vistas de documento.

### Named Rules
**The Hard Right Rule.** Todo monto va con la utilidad de cifras (tabular, condensado) y alineado a la derecha en su columna, para que los decimales caigan uno sobre otro.

**The Title In The Bar Rule.** El título de página vive en la barra superior de 56px. No hay antetítulo, kicker ni eyebrow sobre ningún encabezado; el contexto va en la descripción.

## Layout

Shell fijo: riel de 216px a la izquierda (se colapsa a 64px de iconos con tooltip bajo 1100px) y barra superior pegajosa de 56px en surface con título, chip del turno, buscador Ctrl K (400px; se reduce a un botón de 36px bajo 900px), selector de tema y reloj (oculto bajo 1280px). El contenido se centra a 1600px máx. con 24px laterales (16px bajo 1100px) y 20px arriba.

Cobrar a escritorio es dos columnas: trabajo a la izquierda (paciente → conceptos → tabla de cuenta) y una columna fija de 420px a la derecha con el campo ocre del total y el botón de cobrar arriba, pegajosa bajo la barra y sin estirarse a toda la altura. Bajo `lg` se apila y deja 96px abajo para el cobro.

Ritmo: 4px de base; 16px entre bloques y dentro de paneles, 24px entre columnas, 20px de padding en diálogos y drawers. Las grillas de KPI usan `auto-fit` con mínimo de 200px por celda. Las tablas desbordan con scroll horizontal propio, nunca la página.

## Elevation & Depth

Plano. La profundidad es tonal: piedra (ground) debajo, hueso (surface) encima, blanco solo en los campos, y la junta marcando cada borde. Los botones no tienen sombra; los paneles tampoco. La única sombra es la de lo que flota sobre la página (diálogos, menús, tooltips del riel, toasts), y es corta y difusa. Los overlays oscurecen con un velo verdoso (rgb 31 35 32 / 0.42).

### Shadow Vocabulary
- **Pop** (`box-shadow: 0 6px 16px -6px rgb(42 39 36 / 0.28), 0 1px 2px rgb(42 39 36 / 0.08)`): diálogos, drawers, menús, tooltips del riel colapsado, toasts. En oscuro: `0 8px 20px -6px rgb(0 0 0 / 0.6), 0 1px 2px rgb(0 0 0 / 0.4)`.

### Named Rules
**The Junta Not Shadow Rule.** Si algo necesita separarse de lo que tiene al lado, lleva una junta de 1px; solo lo que flota sobre la página lleva sombra.

## Shapes

Esquinas apenas suavizadas: 4px para botones, controles, paneles, diálogos y chips del turno; 3px para Kbd, badges, sellos y accesos rápidos; 2px para skeletons y botones de orden; 1px para los ladrillos. El único círculo es el avatar de iniciales del riel.

La forma recurrente es el cuadrado dividido en cuartos por juntas. Las grillas comparten una sola junta: celdas de tabla y de KPI se separan por 1px interno con un único borde exterior, no por huecos entre tarjetas. Los glifos de estado son cuadrados (lleno, hueco, medio, tachado) o un rombo, dibujados en SVG de 10px.

## Components

### Buttons
Piezas firmes y de un solo pigmento; se hunden al presionar.
- **Shape:** esquinas de 4px; alturas sm 32 · md 36 · lg 40 · xl 56px.
- **Primary:** óxido con tinta hueso, 600, padding lateral 14px (md). La variante xl (18px, 700, padding 20px) es el botón de cobrar, con el Kbd separado al borde derecho.
- **Hover / Focus / Active:** hover a oxide-hover; foco con contorno pizarra de 2px desplazado 2px; al presionar escala a 0.96 en 120ms (desactivado con reduced-motion).
- **Secondary:** hueso con junta, tinta; hover a surface-2 y junta-strong. Es la variante por defecto.
- **Ghost:** sin fondo, ink-2; hover a surface-2.
- **Danger:** relleno danger con texto blanco, solo para confirmar acciones destructivas.
- **Loading:** spinner centrado, conserva el ancho, anuncia "Procesando…".

### Keyboard hints (Kbd)
- **Style:** 18px de alto, 3px de radio, borde de 1px, 11px semibold tabular. Tonos: neutro (surface + junta), sobre óxido (oxide-deep), sobre riel (transparente + rail-line), sobre fila pizarra.
- **Uso:** junto al rótulo de un campo (F2, F3), dentro de botones (F4, F6, Esc), en el buscador (Ctrl K), en el riel (F1) y en la tira de atajos al pie de Cobrar.

### Chips / Badges
- **Badge:** 20px de alto, 3px de radio, 11.5px semibold, fondo -soft del estado y glifo de 8px; el neutro es transparente con junta.
- **Estado de factura:** glifo + etiqueta en tablas (Pendiente ☐ warn, Pago parcial ◧ pizarra, Pagada ■ ok, Emitida sin cobro ◆ neutro, Anulada ⊠ danger). En vistas de documento, sello de 28px con borde en el color del estado, 12px bold en mayúsculas.
- **Accesos rápidos:** 28px, 3px de radio, hueso con junta, nombre más precio tabular.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** surface sobre ground.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** una junta de 1px; la cabecera (min. 44px, h2 de 15px) se cierra con otra junta.
- **Internal Padding:** 16px; los paneles con tabla van al ras (`flush`).
- **KPI grid:** celdas tipo libro mayor (rótulo 12px, cifra de 24px, pista 12px) compartiendo una sola grilla de juntas; un cuadrito de color marca el estado si no es neutro.

### Data tables
- **Grilla de juntas:** cada celda lleva junta abajo y a la izquierda; los bordes exteriores los pone el contenedor.
- **Cabecera:** fila de 32px en ground, 12px semibold ink-2.
- **Filas:** 44px (36px compacto); números alineados a la derecha con cifras tabulares; hover surface-2 si son clicables (Enter las activa); seleccionada en slate-soft.
- **Paginación:** barra de 44px con junta arriba, "1–20 de N" tabular.

### Inputs / Fields
- **Style:** blanco de campo, junta de 1px, 4px de radio, 36px de alto (40px para el paciente en Cobrar), padding 10px.
- **Focus:** borde pizarra más halo de 3px (slate al 22%).
- **Error / Disabled:** borde danger con halo danger y mensaje de 12.5px con icono; deshabilitado en surface-2 con ink-3.
- **Rótulo:** 12px semibold ink-2 encima, con el Kbd del atajo alineado a la derecha; asterisco danger si es obligatorio.

### Navigation
- **Riel:** verde botella, 216px; cabecera de 56px con la roseta de marca (32px), "S_Hospital" a 16px bold y el nombre del hospital en rail-muted.
- **Ítems:** 36px, 4px de radio, icono de trazo 1.6 a 16px, 14px; hover rail-hover. El ítem activo se convierte en una pieza de piedra (ground) con tinta y su icono en óxido.
- **Grupos:** el grupo de administración se rotula en 11px semibold mayúsculas en rail-dim; ayuda y usuario al pie, separados por rail-line.
- **Colapsado (<1100px):** solo iconos, tooltip en tinta con sombra pop.
- **Tabs:** subrayado de 2px en tinta para la pestaña activa, todas 600; contador en caja de 3px (tinta invertida si está activa).

### Total field (signature)
El campo ocre de Cobrar: filas de 32px a 15px separadas por ochre-line (Subtotal, Ajuste por receta, Exento, ISV) que suman exactamente al total, y debajo TOTAL con la cifra display. Mientras calcula baja a 70% de opacidad; si no hay cifra del servidor muestra "—" con "No disponible" para lectores. El diálogo de pago repite el campo como franja ocre con el saldo como la cifra más grande del diálogo.

### Shift brick (signature)
El ladrillo del turno: un cuadrado de cuatro cuartos separados por juntas (arriba-izquierda Apertura, arriba-derecha Cobros, abajo-derecha Arqueo, abajo-izquierda Cierre, en sentido horario). Los cuartos se llenan en verde riel estrictamente en orden; uno nunca está lleno si el anterior está pendiente. Vive en el chip de 40px de la barra superior (24px, con "Caja · abierta hh:mm" y "Sigue: …"; bajo 640px solo el ladrillo), a 56–64px en Resumen y en la banda de Caja. La roseta de marca es su pariente: cuartos de círculo óxido y ocre que forman una flor, con juntas en verde riel, solo como marca.

## Do's and Don'ts

### Do:
- **Do** separar con una junta de 1px (#CFC8BA en claro) y compartirla entre celdas vecinas.
- **Do** poner un solo botón óxido por vista, con su tecla en un Kbd.
- **Do** escribir todo monto con la utilidad de cifras (tabular, ancho 92%) y alinearlo a la derecha.
- **Do** hacer del total la cifra más grande de la pantalla en cualquier vista de cobro, sobre ocre.
- **Do** distinguir estados por glifo y etiqueta; el color de estado solo acompaña.
- **Do** mostrar "No disponible" (nunca L 0.00) cuando falta un monto.
- **Do** mantener los radios en 2–4px y el blanco solo para campos de texto.

### Don't:
- **Don't** construir dashboards de tarjetas blancas iguales flotando sobre gris con un acento.
- **Don't** usar sombras en botones, paneles o tarjetas; la sombra pop es solo para lo que flota.
- **Don't** usar el ladrillo de cuatro cuartos ni la roseta como decoración, viñeta o ilustración: solo marca, turno y arqueo.
- **Don't** usar óxido para estados, enlaces o acentos, ni ocre fuera de un campo de total.
- **Don't** poner antetítulos, kickers o eyebrows sobre los encabezados.
- **Don't** introducir otra familia tipográfica ni una monoespaciada para cifras.
- **Don't** usar los alias heredados (`--brand`, `--line`, `--bg`) en código nuevo; usar los nombres del mundo (slate, junta, ground).
