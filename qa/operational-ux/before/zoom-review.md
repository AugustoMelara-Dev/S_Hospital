# Revisión de zoom del baseline

Fecha: 2026-07-14 (America/Tegucigalpa)

## Entorno

- Google Chrome: `150.0.7871.115`
- Pantalla objetivo automatizada: `1366x768`
- Escala del sistema observada en Chrome sin override: `devicePixelRatio = 1.25`
- Evidencia de reflow automatizado:
  - `billing/1366x768-effective-125.{json,png}` (`1093x614` CSS px)
  - `billing/1366x768-effective-200.{json,png}` (`683x384` CSS px)

## Resultado

El control de viewport sí aplicó `1366x768`, pero los atajos de zoom enviados al
contenido de Chrome (`Ctrl+0`, `Ctrl++` y `Ctrl+rueda`) no modificaron el zoom de
la interfaz del navegador. Antes y después se observaron los mismos valores:
`innerWidth = 1366`, `innerHeight = 768`, `devicePixelRatio = 1.0` bajo override.

Por integridad de la evidencia, las capturas de ancho efectivo no se presentan
como zoom real. La revisión manual de Chrome a 125 % y 200 % sigue siendo un
criterio pendiente antes de declarar corregida la interfaz.

