# Contrato de pantalla — Catálogo (`/catalog`)

Fuente: `CatalogView.tsx:37-448`, `components/ServiceCatalogTable.tsx`, `components/ServiceDrawer.tsx` (167), `components/CategoryDrawer.tsx` (110), `components/ServiceAuditedChangesSummary.tsx`, `schemas/catalog.schema.ts`, `hooks/useServices.ts`, `hooks/useCategories.ts`.
Guard: `catalog.view`; edición con `catalog.manage` (`CatalogView.tsx:52-55,271-281`).

## CAT-1 · Propósito

Consultar y administrar servicios facturables (precio, categoría, área, visibilidad, reglas especiales) y categorías. La edición administrativa no debe confundirse con la operación de caja: sin `catalog.manage` la pantalla es solo lectura total (`:279-281`).

## CAT-2 · Estado en URL

- `q`, `category`, `status`, `page`, `per_page` y los paneles `panel=new-service|new-category`, `service=<id>`, `edit_category=<id>` (`:38-47,173-204,369-390`).
- Contrato: abrir/cerrar drawer es enlazable/atrás-compatible; no duplicar estado en memoria y URL.

## CAT-3 · Estados obligatorios

| Estado | Comportamiento actual | Evidencia | Contrato Tanda 2 |
|---|---|---|---|
| Carga | `role="status"` "Cargando servicios del catálogo" con skeletons | `ServiceCatalogTable.tsx:78-85` | conservar |
| Vacío sin filtros | "No hay servicios. Comience agregando su primer servicio..." | `:68-70,93-103` | acción sugerida para `catalog.manage` |
| Vacío con filtros | "No se encontraron servicios..." + "Limpiar filtros" | `:93-102` | conservar |
| Error | alerta "No se pudo cargar el catálogo" + Reintentar | `:86-92`; `CatalogView.tsx:411-414` | conservar y no vaciar última data |
| Datos largos | paginación + selector de tamaño + scroll de tabla; lista móvil | `CatalogView.tsx:310-319`; `ServiceCatalogTable.tsx:104-120` | sin truncar precios |
| Solo lectura | alerta "Solo lectura" | `CatalogView.tsx:279-281` | explicar permiso |
| Éxito de guardado | `onStatus` "Servicio guardado exitosamente." y refetch | `:211-215` | mantener confirmación no modal |

## CAT-4 · Acciones y confirmaciones

- Crear/editar servicio: `ServiceDrawer` (categoría, área, nombre, precio, códigos, impuestos, visibilidad, regla especial) con validación Zod (`schemas/catalog.schema.ts`); no inventar reglas de negocio.
- Crear/editar categoría: `CategoryDrawer`.
- Activar/desactivar servicio: `ConfirmDialog` con **motivo obligatorio ≥5** y ayuda "El motivo quedara registrado en auditoria del catalogo" (`CatalogView.tsx:348-362,426-447`); copy explica que las facturas históricas conservan snapshots (`:359-361`).
- Nota de implementación: la prop `requireReasonTextarea` se declara (`:436`) pero no se consume; el componente siempre renderiza textarea. Refactor menor sugerido (HS-UX-06): un único diálogo de motivo compartido entre catálogo/historial/caja/usuarios.
- Doble submit: guard en `useState` (`servicePendingStatusChange`) y el botón se deshabilita hasta el motivo válido; no hay ref de vuelo específico: **añadir** guard de una sola operación en Tanda 2 (dos clics rápidos pueden llamar dos veces).

## CAT-5 · Teclado/foco

- Fila de acciones: menú por fila con `aria-label` y botón de 44 px (`ServiceCatalogTable.tsx` despliega `DropdownMenu`; `InvoiceHistoryTable.tsx:55` usa `min-h-11 min-w-11` como referencia de tamaño).
- Drawers Radix: foco atrapado y devuelto al disparador (contrato Radix ya usado por el proyecto).
- `Enter` en búsqueda no debe abrir un servicio por accidente.
- Pendiente de verificar en código: retorno de foco al botón "Editar" tras cerrar el drawer.

## CAT-6 · Diferenciación sin color

- Estado del servicio: badge textual Activo/Inactivo + fila atenuada/estilo (`ServiceCatalogTable.tsx:48` + `ServiceState`).
- Regla especial (p. ej. EPO) se muestra con texto, no solo icono (`ServiceName`/`getServiceBillingSummary`, `lib/serviceBilling.ts`).
- Precio siempre con `tabular-nums` y moneda (L).

## CAT-7 · Criterios de aceptación Tanda 2

1. Un `h1` "Catálogo institucional"; tarea principal (buscar/filtrar/ver servicios) visible en el primer viewport a 1366x768.
2. Sin overflow a 320-1920 px; la tabla cambia a lista móvil a <768 px.
3. Sin `catalog.manage`: ningún control de edición visible; la alerta explica el motivo.
4. Cambio de estado exige motivo y no se puede duplicar con doble clic.
5. Filtros y paneles sobreviven a recarga vía URL.
6. Error no borra filtros ni datos previamente cargados.

## CAT-8 · Pendiente de inspección manual

- Anchura real de la tabla a 1366 px con nombres y categorías largas.
- Comportamiento del foco al abrir drawer desde una fila fuera del viewport.
- Contraste de badges activo/inactivo en ambos temas.
