# Identidad visual DEV — Panel administrativo (2026-09-20)

Dirección única y vigente para toda superficie del producto. Sustituye la
identidad "Libro de Caja" (papel cálido, acento naranja óxido, título editorial
y barra superior técnica), retirada por el encargo vigente. La copia anterior
queda preservada en el snapshot `C:\Projects\_snapshots\S_Hospital_AI_20260920_135010`.

Fuente vinculante: `01_MANDATO_MAESTRO_HOSPITAL.md` §19–20 (fase 1). El archivo
`hospital-ai/MANDATO_DEV.md` es la campaña anterior (histórico).

## Principios

1. **Panel, no portada.** Cada pantalla es una herramienta de trabajo continua:
   navegación lateral, jerarquía por tarea y dato, sin titulares editoriales.
2. **El dato manda.** Nombre del paciente, líneas, importe y estado tienen el
   mayor peso visual. La decoración no compite.
3. **Una sola acción primaria** por pantalla; el resto son secundarias discretas.
4. **Superficies por espacio y elevación sutil.** Los separadores estructuran;
   las tarjetas agrupan de verdad, no por costumbre.

## Navegación

- Barra lateral izquierda en escritorio (240 px; 256 px en `xl`) con **icono y
  texto** para las secciones de Operación: Resumen · Cobrar · Recibos · Caja ·
  Reportes, y el grupo secundario Administración.
- Cabecera compacta solo en móvil (marca + menú + usuario) y cajón lateral para
  la navegación. Sin barra horizontal duplicada ni franja técnica permanente.
- El estado de caja y el usuario viven al pie de la barra lateral, en formato
  compacto; el detalle se abre en Caja.
- El cajero aterriza en Cobrar; supervisión/administración en Resumen.

## Paleta (light-first)

Variables en `frontend/src/design-system/admin/tokens.css` (prefijo `--ui-`).

| Token | Valor | Uso |
|---|---|---|
| `--ui-ink` | `#101828` | Texto principal (neutro frío) |
| `--ui-ink-soft` | `#475467` | Texto secundario |
| `--ui-ink-faint` | `#667085` | Terciario, hints |
| `--ui-paper` | `#f7f8fa` | Fondo de aplicación (gris frío muy claro) |
| `--ui-surface` | `#ffffff` | Superficies y tablas |
| `--ui-surface-alt` | `#f2f4f7` | Filas alternas, pies de panel |
| `--ui-line` | `#eaecf0` | Bordes estructurales |
| `--ui-line-strong` | `#d0d5dd` | Bordes de control |
| `--ui-action` | `#2563eb` | Acción primaria (cobalto) |
| `--ui-action-subtle` | `#eff4ff` | Fondo de estado activo/primario |
| `--ui-success` | `#067647` | Cobro válido |
| `--ui-warn` | `#b54708` | Advertencia, diferencia de caja |
| `--ui-danger` | `#b42318` | Error/anulación |
| `--ui-free` | `#6941c6` | Regla de gratuidad (solo el medicamento) |
| `--ui-focus` | `#2563eb` | Anillo de foco (2 px + offset 2) |

Sin gradientes decorativos. Un único acento de acción (cobalto). La gratuidad
usa violeta reservado y siempre con etiqueta textual.

## Tipografía

- Sans en todo el panel (`Geist Variable`, local, OFL). Sin serif editorial.
- Escala (rem): `--ui-text-xs .75 · sm .8125 · base .875 · md 1 · lg 1.125 ·
  xl 1.25 · 2xl 1.5 · metric 1.75`. Títulos moderados.
- Dinero: `tabular-nums`, alineado a la derecha. Cantidades centradas.

## Superficies, radios y elevación

- Radios: base `6px`, control `8px`, panel `12px`, overlay `14px`
  (concéntricos: panel 12 con padding 4 → control 8).
- Estructura por borde hairline; elevación discreta solo en overlays y en la
  tarjeta de acceso (`ui-card-raised`, sombra-como-borde de better-ui).

## Controles y estado

- Alturas: cabecera 56 px, control 38 px, operativo (cobro) 44 px, fila 48 px.
- Botón primario cobalto, texto blanco, `scale(0.96)` en `:active` (better-ui),
  desactivado con foco de teclado; transición por propiedad exacta.
- Estados por control: default, hover (solo puntero fino), focus-visible, active,
  disabled, loading.
- Movimiento: `ease-out` corto (120–200 ms) sobre `transform`/`opacity`/`color`,
  con variante de movimiento reducido.

## Componentes (namespace `admin`)

`AdminPanel`, `AdminPanelHeader`, `AdminMetric`, `AdminField`, `MoneyText`,
`QuantityText`, `StatusStamp` (badge suave: borrador/valorada/listo/cobrado/
gratuito/anulado), `FreeMedicationBadge`, `AdminTabs`, `AdminSearch`, `AdminTable`
(filas 48 px, sorting, tarjeta móvil, `minTableWidth` para tabla extensa),
`AdminEmpty`, `AdminCallout`, `AdminStep`, `AdminDialog`, `AdminShell`,
`AdminSidebar`.

## Composición por sección

- **Resumen**: "Atención ahora" accionable, cuatro métricas en una franja,
  caja/turno compacta y operaciones recientes en tabla.
- **Cobrar**: dos áreas funcionales — catálogo/búsqueda a la izquierda y, a la
  derecha, la cuenta integrada con nombre del paciente compacto, líneas, y
  resumen/cobro al pie. No tres columnas altas.
- **Recibos**: filtros, tabla compacta y detalle en panel lateral.
- **Caja**: contexto de turno, resumen por método, movimientos, arqueo y cierre.
- **Reportes**: período y filtros compactos, resumen del período y una tabla por
  desglose con `minTableWidth` (desplaza en horizontal, no comprime).
- **Administración**: tabs internos, catálogo con búsqueda/filtros/paginación.

## Accesibilidad

- Controles semánticos, `label` asociado, foco visible, teclado completo.
- Contraste ≥ 4.5:1 en texto normal. Zoom 200 % sin pérdida.
- Enter en campos no dispara cobro; el botón enfocado sí responde a Enter.
- Errores junto al campo con texto útil; nunca `L 0.00` para un dato ausente.
