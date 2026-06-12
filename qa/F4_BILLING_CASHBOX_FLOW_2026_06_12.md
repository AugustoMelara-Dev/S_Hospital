# F4.1 Billing/Cashbox Fiscal Unblock Evidence

Fecha: 2026-06-12
Rama: `codex/f4-billing-cashbox-flow`

## Resultado

`F4.1 fiscal unblock`: PASS

El smoke F4 completo pudo ejecutar el flujo operativo:

1. Sesion autenticada.
2. Caja abierta.
3. Nueva factura.
4. Busqueda y seleccion de servicio facturable.
5. Emision de factura.
6. Registro de pago.
7. Vista previa de recibo.
8. Historial de facturas.
9. Reimpresion basica desde historial.

## Bloqueo Encontrado

El smoke `node qa\visual-smoke\f4-billing-cashbox-flow.mjs` llegaba a `Nueva factura`, pero la emision era bloqueada por el backend:

```txt
fiscal sequence: Existe mas de una secuencia fiscal activa para facturas.
```

La base local tenia esta configuracion:

```txt
id=1 active=true active_document_type=invoice
id=2 active=true active_document_type=null
```

## Causa Raiz

`GenerateFiscalNumberAction` contaba todas las filas con:

```txt
document_type=invoice
active=true
```

Eso hacia que una secuencia legacy con `active_document_type=NULL` bloqueara una secuencia canonica valida con `active_document_type=invoice`.

Segun el contrato fiscal vigente, `active_document_type` es la marca portable para asegurar una unica secuencia activa por tipo de documento en MySQL/MariaDB. Por tanto:

- `active_document_type=invoice` es la secuencia activa canonica para facturas.
- `active_document_type=NULL` puede existir por datos legacy o por filas inactivas.
- Una fila legacy activa `NULL` no debe bloquear si ya existe una secuencia canonica `invoice`.
- Dos filas legacy activas sin secuencia canonica siguen siendo ambiguas y deben bloquear.
- Una configuracion inconsistente no debe emitir factura de forma ambigua.

## Correccion Aplicada

El selector fiscal ahora:

1. Bloquea las filas activas de `document_type=invoice`.
2. Prefiere exactamente una fila canonica `active_document_type=invoice`.
3. Tolera filas legacy `active_document_type=NULL` cuando existe la canonica.
4. Usa una unica fila legacy `NULL` solo como fallback si no hay canonica.
5. Bloquea multiples filas legacy activas sin canonica.
6. Bloquea marcas inconsistentes no nulas diferentes de `invoice`.

No se limpio manualmente la base como solucion principal.

## Pruebas Ejecutadas

```txt
php artisan test --filter=GenerateFiscalNumberActionTest
php artisan test --filter=InvoiceCreationTest
php artisan test --filter=FiscalSequenceTest
php artisan test --filter=CashPaymentsReceiptTest
node qa\visual-smoke\f4-billing-cashbox-flow.mjs
```

Resultado focal:

```txt
GenerateFiscalNumberActionTest: 10 passed
InvoiceCreationTest: 20 passed
FiscalSequenceTest: 11 passed
CashPaymentsReceiptTest: 23 passed
F4 visual smoke: passed
```

Nota de ejecucion: durante la repeticion intensiva del smoke en desarrollo, corridas intermedias recibieron `429 Too Many Requests` en `/api/system/echo-config` por el throttle `30,1`. El endpoint devuelve solo configuracion publica no secreta de realtime, asi que se alineo con `/api/system/health` a `throttle:120,1` y se agrego prueba de ruta para evitar que bloquee smokes operativos por recargas normales. La corrida final de `node qa\visual-smoke\f4-billing-cashbox-flow.mjs` paso sin entradas de consola.

## Capturas

Evidencia final exitosa:

- `qa/screenshots/after/f4-cashbox-open.png`
- `qa/screenshots/after/f4-new-invoice-service-selected.png`
- `qa/screenshots/after/f4-new-invoice-paid-receipt.png`
- `qa/screenshots/after/f4-invoice-history.png`
- `qa/screenshots/after/f4-history-reprint-receipt.png`
- `qa/screenshots/after/f4-billing-cashbox-flow-report.json`

Evidencia conservada del bloqueo previo:

- `qa/screenshots/after/f4-cashbox-after-open.png`
- `qa/screenshots/after/f4-new-invoice-payment-missing.png`

## Pendientes

- Revisar la base local de validacion y normalizar la fila legacy `active_document_type=NULL` mediante procedimiento explicito si soporte quiere dejar el entorno sin deuda historica.
- No se requiere cambio de contrato API.
- No se inicio F5.
