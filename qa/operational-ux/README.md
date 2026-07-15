# Evidencia de UX operativa

Esta carpeta conserva evidencia reproducible del rediseño operativo iniciado el
14 de julio de 2026. Las pruebas automatizadas generan medidas y artefactos; la
aceptación final exige además inspección visual documentada.

## Directorios

- `before/`: baseline inmutable capturado antes de modificar cada ruta.
- `after/`: capturas equivalentes después de la corrección.
- `documents/`: PDFs y renders PNG de Carta, Media Carta, A5, 80 mm y 58 mm.

Una ejecución final nunca sobrescribe `before/`. El informe debe conservar el
nombre del escenario, viewport, zoom, commit y fecha de cada artefacto.

## Doce comparaciones canónicas

1. Login.
2. Dashboard.
3. Facturación vacía.
4. Facturación con cuenta.
5. Cobro en efectivo.
6. Recibo Carta.
7. Historial de facturas.
8. Caja abierta.
9. Cierre de caja.
10. Catálogo.
11. Configuración institucional.
12. Configuración de recibos.

## Contrato JSON

Cada auditoría de página incluye:

- viewport efectivo;
- `scrollWidth`, `clientWidth` y overflow horizontal del documento;
- rectángulos de paneles marcados con `data-audit-panel`;
- contenedores con scroll vertical real;
- elementos sticky;
- visibilidad y cobertura de la acción principal;
- `console.error`, `pageerror` y `requestfailed` observados desde antes de la
  navegación.

Las duraciones de red se registran por método y ruta en el informe de
rendimiento LAN, separado de la geometría visual.

## Criterio de revisión

Cada comparación registra overflow, scrolls internos, controles cubiertos,
acción principal, truncado, idioma, paginadores y jerarquía visual. Un test verde
no convierte automáticamente la revisión visual en aprobada.
