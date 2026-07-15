# Decisiones de investigación para UX operativa

Fecha de revisión: 15 de julio de 2026.

Esta nota registra cómo las referencias externas se convierten en decisiones
del producto. Ninguna referencia es una dependencia de producción y no se
copió una interfaz completa.

## Punto de venta

- [Shopify POS: procesar una venta](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/process-sales-transaction)
  confirma una secuencia corta: buscar, agregar al carrito, ajustar y cobrar.
  S_Hospital mantiene paciente, búsqueda y cuenta en un único espacio; la fila
  completa agrega y la cuenta conserva cantidad, importe y acción.
- [Square: aceptar efectivo y otros medios](https://squareup.com/help/us/en/article/5177-accept-cash-checks-and-other-tender)
  separa la preparación del carrito de la elección del medio y del registro del
  pago. S_Hospital muestra recibido/cambio sólo en efectivo, oculta campos que
  no aplican y termina en un estado de resultado con recibo.
- [Square: personalizar medios de pago](https://squareup.com/help/us/en/article/6389-manage-payment-types-with-the-square-app)
  respalda priorizar los métodos pertinentes. La interfaz no muestra entradas
  de efectivo para tarjeta o transferencia.

## Formularios, errores y foco

- [NHS: mensajes de error](https://service-manual.nhs.uk/design-system/components/error-message)
  exige explicar cómo corregir, mostrar el error al intentar continuar y no
  borrar entradas. Paciente, cobro y cierre preservan valores y sitúan el error
  junto al campo.
- [GOV.UK: resumen de errores](https://design-system.service.gov.uk/components/error-summary/)
  mueve foco a un resumen enlazable cuando existen varios errores. En tareas
  breves se prefiere el error local; el resumen se reserva para errores
  múltiples y no duplica toast/alerta.

## Reflow y controles persistentes

- [WCAG 2.2 — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
  exige conservar información y funcionalidad a 320 CSS px sin scroll en dos
  dimensiones. Facturación cambia a una columna y cuenta en Drawer; tablas se
  convierten en listas móviles cuando su relación tabular no cabe.
- [WCAG 2.2 — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
  obliga a que barras sticky no cubran el foco. Las pruebas geométricas miden la
  barra móvil, el Drawer y la acción primaria.
- [WCAG 2.2 — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
  informa objetivos de al menos 24×24 CSS px; los controles operativos críticos
  se mantienen en 44 px cuando el viewport lo permite.
- [WCAG 2.2 — Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)
  respalda conservar paciente, carrito y pago cuando el servidor rechaza una
  operación.

## Identidad institucional

La búsqueda oficial se documenta en
`docs/branding/HOSPITAL_IDENTITY_SOURCE.md`. Los expedientes públicos de ONCAE
confirman “Hospital General San Isidro”, Tocoa, Colón, y la dependencia de la
Secretaría de Salud, pero no proporcionan un logotipo hospitalario separable y
autorizado. Se mantiene un wordmark local explícitamente provisional; no se
extraen sellos ni imágenes de documentos escaneados.
