# Verificación final de impresión del frontend

## Evidencia automatizada

- Pruebas unitarias focales: 25/25.
- Playwright impresión: 21/21.
- PDFs generados: 18, más `printing-evidence.json`, bajo `frontend/test-results/frontend-final/printing/`.
- Cada PDF tiene una página; `pypdf` confirmó MediaBox y texto obligatorio en 18/18.
- Recursos externos de fuentes durante la generación: 0.

| Formato | MediaBox verificado | Copias |
|---|---|---|
| Carta | 792 × 612 pt | Original, primera, segunda |
| Media Carta | 612 × 396 pt | Original, primera, segunda |
| A5 | 594.96 × 420 pt | Original, primera, segunda |
| 80 mm | 227.04 × 841.92 pt | Original, primera, segunda |
| 58 mm | 165.12 × 841.92 pt | Original, primera, segunda |
| Personalizado 190 × 140 mm | 539.04 × 396.96 pt | Original, primera, segunda |

Los recorridos comprobaron tamaño, orientación, una página, márgenes del perfil, ausencia de overflow, shell y acciones ocultos, sombra desactivada, encabezado, pie, RTN, correlativo, monto, monto en letras, firma, sello y leyenda de copia.

## VALIDACIÓN FÍSICA EXTERNA PENDIENTE

No existe una impresora física accesible en este entorno. Una persona debe:

1. Registrar modelo de impresora, versión de driver, sistema operativo, fecha y operador.
2. Configurar en el driver el tamaño exacto de cada uno de los seis perfiles.
3. Seleccionar la orientación indicada por el PDF y escala 100 %, sin “ajustar a página”.
4. Imprimir original, primera copia y segunda copia de cada perfil: 18 salidas.
5. Medir ancho, alto y cuatro márgenes con regla; comparar con el perfil seleccionado.
6. Verificar que no existan cortes, páginas en blanco, desbordes ni escalado inesperado.
7. Confirmar legibilidad de encabezado, RTN, correlativo, monto en número y letras, firma, sello, pie y leyenda de copia.
8. Adjuntar fotografías/escaneos y anotar cualquier ajuste exclusivo del driver.

Este pendiente es validación de hardware externo, no deuda de implementación.
