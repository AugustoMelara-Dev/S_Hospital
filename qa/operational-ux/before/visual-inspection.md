# Inspección visual del baseline

Fecha: 2026-07-14 (America/Tegucigalpa)

Se inspeccionaron directamente las capturas PNG, además de sus métricas JSON.

## Hallazgos reproducidos

- `billing/1366x768.png`: la composición es legible, pero contiene varios
  paneles anidados y la cuenta fija compite con la selección de servicios por
  altura útil.
- `billing/320x568.png`: la navegación inferior cubre contenido operativo; el
  campo principal de paciente queda fuera del primer bloque visible; la cuenta
  se desplaza muy abajo y el resumen/estado se solapan visualmente. La acción
  primaria no aparece en el viewport.
- `canonical/cashbox-open.png`: el encabezado, estado de caja, alerta y pestañas
  consumen gran parte de la altura antes de mostrar la conciliación; el contenido
  de métodos de pago queda bajo el corte de 768 px.
- `canonical/receipt-settings-a5.png`: la vista previa A5 queda demasiado pequeña
  para validar cómodamente tipografía y datos; el formulario y la previsualización
  compiten en una cuadrícula rígida.

## Hallazgos cuantificados por la matriz

- `1366x768`: dos contenedores con scroll vertical interno.
- `1024x768`: un scroll interno y acción primaria no encontrada.
- `768x1024`, `390x844` y `320x568`: acción primaria no encontrada.
- Reflow equivalente a 125 %: un scroll interno y acción primaria no encontrada.
- Reflow equivalente a 200 %: acción primaria no encontrada.

Estos defectos permanecen deliberadamente en rojo para guiar la corrección de
shell y facturación; no son criterios aceptados por el baseline.

