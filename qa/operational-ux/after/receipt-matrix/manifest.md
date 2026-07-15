# Matriz de recibos institucionales

Generada el 15 de julio de 2026 mediante:

```text
RECEIPT_QA_MATRIX_OUTPUT_DIR=... php vendor/bin/phpunit \
  --filter test_receipt_pdf_page_matrix_is_bounded_and_monotonic_for_supported_profiles \
  tests/Feature/InstitutionalReceiptPdfTest.php
```

Resultado: **1 test, 914 aserciones, 30 PDF**. Cada perfil cubre 1, 5, 15,
30 y 60 ítems. El test comprueba que cada servicio aparece exactamente una
vez, que las filas no se cortan, que el encabezado puede repetirse, que resumen
y firmas mantienen su orden y que la cantidad de páginas es monótona y acotada.

| Perfil | 1 | 5 | 15 | 30 | 60 |
|---|---:|---:|---:|---:|---:|
| Carta horizontal | 1 | 1 | 1 | 2 | 3 |
| Media carta horizontal | 1 | 1 | 2 | 3 | 5 |
| A5 horizontal | 1 | 1 | 2 | 3 | 4 |
| Personalizado 180×95 mm | 1 | 2 | 2 | 3 | 5 |
| Térmica 80 mm | 1 | 2 | 2 | 3 | 4 |
| Térmica 58 mm | 1 | 1 | 2 | 2 | 4 |

## Revisión visual

Se renderizaron los PDF a PNG con Poppler y se inspeccionaron primeras páginas,
últimas páginas y los extremos de 60 ítems. No se observaron texto cortado,
superposiciones, columnas fuera del papel ni pérdida de totales. El perfil
personalizado de un ítem se corrigió y se volvió a renderizar: encabezado,
detalle, totales, monto en letras, firmas y leyenda caben en una sola hoja.

En 58 mm con 60 ítems, las firmas pasan a la cuarta hoja porque la tercera está
ocupada hasta el monto en letras; no existe espacio físico suficiente en esa
hoja. La impresión física, márgenes no imprimibles y calibración de cada equipo
siguen pendientes de validación en el hospital.
