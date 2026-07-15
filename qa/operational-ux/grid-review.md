# Revisión operativa — historial y grids

Fecha: 2026-07-14

## Criterio verificado

- Historial presenta una sola paginación visible y no muestra el control interno `Page Size` de AG Grid.
- Las etiquetas visibles de navegación están en español y la fecha/hora usa formato `es-HN`.
- Dos registros producen un grid de altura proporcional al contenido, sin un panel vacío de 420 px.
- Historial no produce overflow horizontal de página ni del contenedor a 1366 × 768.
- Paciente usa ancho flexible; Total y Saldo usan cifras tabulares alineadas a la derecha.
- Factura, Estado, Recibo y el menú de acciones permanecen visibles por defecto.
- Caja, Catálogo, Usuarios, Reportes y Respaldos heredan paginación desactivada y altura por contenido desde el adaptador común.
- Los importes de los grids de reportes usan alineación numérica y cifras tabulares.

## Evidencia

- `qa/operational-ux/after/history-1366.png`
- Playwright: `invoice-history-flow.spec.ts`, 4/4 escenarios aprobados.
- Vitest: 98 pruebas de grids y módulos consumidores aprobadas.
