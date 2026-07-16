# Decisiones de investigación para UX operativa

Fecha de revisión: 16 de julio de 2026.

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

## Recibos institucionales y comprobantes históricos

- El recibo institucional autorizado conserva como fuente de verdad el HTML
  generado por Laravel. Cuando una factura tiene más de un pago, la cabecera
  dice `Pagos mixtos (n)` y una tabla desglosa fecha, método, monto, referencia
  (`Sin referencia` cuando no existe) y cajero de cada pago. El total de la
  factura no se presenta como si perteneciera al último método registrado.
- `fiscal_cai`, `fiscal_range_from`, `fiscal_range_to` y
  `fiscal_valid_until` quedan congelados en el snapshot del recibo. CAI, rango
  y fecha límite de emisión sólo aparecen cuando el snapshot contiene el dato;
  los snapshots históricos incompletos no fabrican valores.
- Si una factura histórica no tiene recibo institucional, la vista compatible
  puede imprimirse, pero se titula `COMPROBANTE HISTÓRICO DE FACTURA`, muestra
  `No institucional` y declara que no asigna correlativo de recibo. El número
  se etiqueta `Factura No.` y nunca se simula una serie institucional.
- Carta, media carta, A5, personalizado, 80 mm y 58 mm se mantienen bajo una
  matriz PDF de 30 combinaciones (1, 5, 15, 30 y 60 servicios por perfil). La
  información fiscal se compactó en una fila para conservar media carta con
  cinco servicios en una página. Esta verificación de render no sustituye una
  prueba con impresora física.

## Conteo físico de caja

- El [Boletín de prensa No. 66/2019 del Banco Central de Honduras](https://www.bch.hn/administrativas/RI/Enlaces%20Comunicados%20FMI%20%20ES/Bolet%C3%ADn%20de%20prensa%20no%2066%20Directorio%20del%20Banco%20Central%20de%20Honduras%20aprueba%20emisi%C3%B3n%20de%20billete%20de%20doscientos%20lempiras%20%28L200.00%29.pdf)
  identifica la familia de billetes de actual circulación como L1, L2, L5,
  L10, L20, L50, L100, L200 y L500. El contador usa exactamente esas nueve
  denominaciones, ordenadas de L500 a L1 para el arqueo.
- El boletín citado habla de billetes, no de monedas. Por eso monedas y
  fracciones se registran aparte en `Monedas y otros`; no se inventa una tabla
  de monedas a partir de esa fuente.
- El total por denominaciones alimenta el monto contado y el desglose se
  persiste con el cierre para auditoría. El backend rechaza un desglose cuya
  suma no coincide con el monto contado y conserva tanto el desglose válido
  como su copia en el log de auditoría.
- La persistencia usa
  `2026_07_15_000001_add_closing_breakdown_to_cash_register_sessions_table.php`.
  Una instalación limpia con seed se ejecutó en MariaDB 11 y el gate de
  navegador cerró una sesión real con el mismo desglose persistido y diferencia
  L 0.00. Esto no sustituye una prueba multiusuario en la LAN del hospital.
- La validación frontend ya incluye el gate global de 147 archivos y 1,127
  pruebas Vitest, tres E2E específicos de caja y el recorrido real de arqueo y
  cierre contra MariaDB. La evidencia visual complementaria está en
  `qa/operational-ux/after/cashbox-denominations-1366.png`.

## Ejecución offline local

- El Compose base inicia el router HTTP de Laravel directamente con `php -S`.
  Esto conserva `DB_DATABASE`, usuario y contraseña inyectados por el
  contenedor durante todo el proceso HTTP; evita que `php artisan serve`
  vuelva a cargar un `.env` montado con otra base.
- `ProductionEnvTemplateTest` protege esa decisión y `docker compose config
  --quiet` valida la plantilla. El health check real confirmó conexión a
  MariaDB antes del gate release.
- Login, facturación, cobro, recibo, reporte y cierre funcionaron sin depender
  de servicios SaaS. Esta corrida no aisló el egreso de red; siguen pendientes
  la validación con desconexión física de internet y la concurrencia desde
  varias computadoras físicas de la LAN.

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
