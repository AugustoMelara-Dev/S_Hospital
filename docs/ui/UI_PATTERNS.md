# UI Patterns - S_Hospital

## Proposito

Esta fase consolida patrones compartidos para pantallas, formularios, filtros y tablas. Los componentes no hacen fetching, no cambian permisos, no mutan query params y no contienen reglas de facturacion, caja, pagos, recibos o reportes.

## PageHeader

`PageHeader` define el encabezado de una pantalla interna.

- `title`: titulo visible.
- `description`: descripcion opcional.
- `actions`: acciones de la pantalla.
- `topContent`: contenido previo opcional.
- `secondary`: contenido secundario opcional.
- `headingLevel`: `1`, `2` o `3`; por defecto `1`.
- `className`: combinable.

No incluye breadcrumbs. Los breadcrumbs pertenecen al shell.

## ActionBar

`ActionBar` agrupa acciones primarias y secundarias sin ejecutarlas.

- Puede recibir `children` como antes.
- Puede recibir `primary` y `secondary`.
- `align`: `start`, `end` o `between`.
- `fullWidthOnMobile`: solo afecta botones en pantallas pequenas.

El consumidor decide permisos, loading, disabled y handlers.

## FilterBar

`FilterBar` envuelve controles arbitrarios dentro de un formulario controlado por el consumidor.

- `children`: controles principales.
- `onSearch`: submit del consumidor.
- `onClear`: limpieza definida por la pantalla.
- `advanced`: contenido avanzado opcional.
- `collapsibleAdvanced`: colapso opt-in con `aria-expanded` y `aria-controls`.
- `actions`: acciones extra opcionales.

No actualiza URL, no dispara fetching y no inventa filtros.

## FormField

`FormField` mantiene label, hint, error y control unidos.

- Usa render prop para pasar `id`, `describedBy`, `invalid`, `hintId` y `errorId`.
- `error` se anuncia con `role="alert"`.
- `hint` y `error` se conectan por `aria-describedby`.
- `orientation` puede ser `vertical` u `horizontal`.
- Compatible con React Hook Form y campos controlados o no controlados.

## FormSection y FieldGroup

`FormSection` agrupa secciones de formularios largos.

- `title`, `description`, `actions`, `footer`, `children`.
- No aplica sticky footer por defecto.
- No define schemas ni payloads.

`FieldGroup` organiza campos en columnas responsive mediante `columns`.

## DataTable

`DataTable` renderiza tablas simples sin libreria adicional.

- `columns`: `key`, `header`, `render`, `numeric`, clases opcionales.
- `rows` y `getRowKey` son controlados por el consumidor.
- `loading`, `empty` y `error` usan `LoadingState`, `EmptyState` y `ErrorState`.
- `caption` permite descripcion accesible.

No controla filtros, permisos, paginacion ni fetching.

## Table

`Table` conserva estructura semantica real: `table`, `thead`, `tbody`, `tr`, `th`, `td`.

- El wrapper tiene `role="region"` y `tabIndex={0}` para scroll horizontal accesible.
- `containerLabel` nombra la region.
- `data-numeric="true"` alinea y aplica `tabular-nums`.
- Las columnas de acciones las define el consumidor.

## Pagination

`PaginationControls` recibe `meta` y `onPageChange`.

- Usa `nav aria-label="Paginacion"`.
- Marca la pagina actual con `aria-current="page"`.
- Deshabilita anterior/siguiente en limites.
- Muestra elipsis cuando hay muchas paginas.

No asume query params ni hace fetching. La indexacion visible es base 1.

## DateRangePicker

`DateRangePicker` preserva valores string `yyyy-mm-dd`.

- `startDate`, `endDate`, `onStartDateChange`, `onEndDateChange`.
- Labels configurables.
- `disabled`, `error`, `onClear` opcionales.
- Shortcuts usan fecha local del navegador como antes.

No convierte fechas a UTC ni agrega librerias.

## MetricCard

`MetricCard` muestra titulo, valor, helper, icono y badge operativo.

- Valores usan `tabular-nums`.
- `trend` incluye texto e icono; no depende solo del color.
- No asume que el valor es dinero.
- No anima numeros.

## MoneyText

`MoneyText` usa `formatLempirasUIFromCents`.

- No recalcula importes.
- No cambia moneda.
- `emphasis` solo cambia peso visual.
- `ariaLabel` permite una lectura mas explicita.
- `translate="no"` protege montos.

## StatusBadge

`StatusBadge` conserva estados y labels existentes:

- `active`, `closed`, `failed`, `info`, `open`, `paid`, `partial`, `pending`, `success`, `void`.
- Usa variantes semanticas de `Badge`.
- Incluye icono opcional o indicador decorativo.
- Estado desconocido cae en `secondary` con "Estado desconocido".

No introduce severidades clinicas.

## Loading, Empty y Error

- `LoadingState`: `role="status"`, `aria-live="polite"`, `aria-busy`.
- `EmptyState`: mensaje y accion opcional.
- `ErrorState`: `role="alert"`, accion y retry opcional.
- `Skeleton`: oculto por defecto para lectores, configurable.

Los mensajes los suministra el consumidor.

## Responsabilidades del consumidor

- Fetching y cache.
- Permisos.
- Query params.
- Validacion Zod.
- React Hook Form.
- Fechas de negocio.
- Formato de reportes.
- Acciones de dominio.

## Reglas responsive

- Acciones envuelven antes de desbordar.
- Tablas mantienen scroll horizontal seguro.
- Listas tipo tarjeta son futuras y opt-in.
- No se ocultan columnas criticas desde el componente base.

## Accesibilidad

- Labels asociados.
- `aria-invalid` y `aria-describedby` en formularios.
- `aria-current` en paginacion.
- Foco visible heredado de componentes base.
- Iconos decorativos con `aria-hidden`.
- Estados no dependen solo del color.

## Compatibilidad hacia atras

Los imports existentes se preservan. Las nuevas props son opcionales. Ninguna pantalla de dominio se migra en esta fase.

## Ejemplos breves

```tsx
<PageHeader title="Catalogo" actions={<Button>Nuevo servicio</Button>} />
```

```tsx
<FormField id="name" label="Nombre" error={error}>
  {({ id, describedBy, invalid }) => (
    <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
  )}
</FormField>
```

```tsx
<DataTable
  rows={rows}
  getRowKey={(row) => row.id}
  columns={[{ key: "total", header: "Total", numeric: true, render: (row) => row.total }]}
/>
```

## Pendiente para migrar modulos

- Dashboard: sustituir cards custom por patrones compartidos.
- Catalogo: normalizar filtros y tablas.
- Usuarios: normalizar formulario y tabla.
- Backups: usar estados y paginacion reforzada.
- Reportes: unificar filtros y tablas por tab.
- Historial de facturas: migrar filtros y tabla con pruebas de permisos.

