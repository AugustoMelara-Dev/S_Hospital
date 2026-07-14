# Verificación final de impresión del frontend

Fecha: 2026-07-14.

## Evidencia automatizada

- Playwright mock del bloque recibos/reportes: 27/27.
- PDFs generados y versionados: 18, más `printing-evidence.json`.
- Cada PDF tiene una página, MediaBox correcto, fuentes locales, contenido institucional obligatorio y cero overflow.
- La plantilla administrativa compacta fue revalidada con 16/16 tests backend (197 aserciones) y 19/19 tests frontend de preview/CSS. Las facturas cortas conservan totales, monto en letras, firmas y sello en una página cuando el contenido cabe.

| Formato | MediaBox verificado | Copias |
|---|---|---|
| Carta | 792 × 612 pt | Original, primera, segunda |
| Media Carta | 612 × 396 pt | Original, primera, segunda |
| A5 | 594.96 × 420 pt | Original, primera, segunda |
| 80 mm | 227.04 × 841.92 pt | Original, primera, segunda |
| 58 mm | 165.12 × 841.92 pt | Original, primera, segunda |
| Personalizado 190 × 140 mm | 539.04 × 396.96 pt | Original, primera, segunda |

Los recorridos verifican orientación, márgenes, una página, salto, escalado, shell/acciones ocultos, encabezado, pie, correlativo, RTN, monto, monto en letras, firma, sello y leyenda de copia.

## VALIDACIÓN FÍSICA EN IMPRESORA PENDIENTE POR HARDWARE EXTERNO

1. Registrar modelo, driver, sistema operativo, fecha y operador.
2. Configurar el tamaño exacto de cada perfil y escala 100 %, sin “ajustar a página”.
3. Imprimir original, primera y segunda copia de los seis perfiles: 18 salidas.
4. Medir ancho, alto y cuatro márgenes; comparar con el perfil.
5. Verificar cortes, páginas en blanco, overflow y escalado.
6. Confirmar legibilidad de identidad, RTN, correlativo, montos, firma, sello, pie y copia.
7. Adjuntar fotografías o escaneos y anotar ajustes exclusivos del driver.

Este punto es validación de hardware externo, no deuda de implementación.
