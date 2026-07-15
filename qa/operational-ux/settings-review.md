# Revisión visual — Configuración

Fecha: 2026-07-14

## Criterios verificados

- La barra contextual del sistema aporta el único encabezado principal visible y accesible `Configuración`.
- Resumen, Hospital, Numeración, Operativa y Marca permanecen como dominios separados; Recibos conserva su ruta dedicada.
- El estado fiscal y sus bloqueos forman una fila compacta, sin tarjeta anidada.
- El resumen fiscal presenta seis datos en una sola región, sin seis cajas decorativas.
- Hospital y Numeración muestran la acción de guardado únicamente después de un cambio.
- En móvil la acción pendiente queda por encima de la navegación inferior y no produce desbordamiento horizontal a 390 px.
- La captura móvil usa el viewport para evitar el artefacto de Chromium al capturar páginas completas con elementos `sticky`.

## Evidencia

- `after/settings-summary-1366.png`
- `after/settings-hospital-dirty-390.png`

## Pruebas automatizadas

- Vitest: vistas de Configuración, Hospital, Numeración, Operativa y Marca.
- Playwright: encabezado único, resumen compacto, vínculo a Recibos, guardado condicionado por cambios y separación de la navegación móvil.
