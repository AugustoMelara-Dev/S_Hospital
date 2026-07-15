# Revisión visual del núcleo operativo

Fecha: 2026-07-14  
Alcance: shell institucional, nueva factura, cuenta responsive y cobro.  
Evidencia: `qa/operational-ux/after/core`.

## Resultado

El núcleo operativo pasa la revisión visual en los siete viewports requeridos. Todas las capturas fueron abiertas e inspeccionadas a resolución original después de ejecutar la interacción real de teclado: completar paciente, buscar `glucosa` y agregar el primer resultado con Enter.

| Viewport | Cuenta | Overflow horizontal | Scroll interno | Acción primaria | Revisión visual |
| --- | --- | ---: | ---: | --- | --- |
| 1440×900 | Panel de 420 px | 0 px | 0 | Visible, libre | Primera fila completa, total y CTA visibles |
| 1366×768 | Panel de 420 px | 0 px | 0 | Visible, libre | Primer resultado y acción Agregar visibles en el viewport |
| 1024×768 | Drawer de 480 px | 0 px | 0 | Visible, libre | Cantidad enfocada sin quedar bajo la barra inferior |
| 768×1024 | Drawer de 480 px | 0 px | 0 | Visible, libre | Fondo atenuado, cuenta y CTA legibles |
| 390×844 | Drawer a ancho completo | 0 px | 0 | Visible, libre | Tabla apilada, cantidad, importe, total y CTA completos |
| 360×800 | Drawer a ancho completo | 0 px | 0 | Visible, libre | Sin truncación ni solapamientos |
| 320×568 | Drawer a ancho completo | 0 px | 0 | Visible, libre | CTA y total dentro del viewport; foco de cantidad libre |

## Cobro

- Efectivo: muestra total, recibido, cambio, monto editable y presets Exacto/L 100/L 200/L 500. El CTA `Cobrar L 17.25 e imprimir` queda visible a 1366×768.
- Transferencia: oculta monto recibido y cambio, muestra `A cobrar`, solicita referencia real y conserva el mismo CTA visible.
- Ambos estados mantienen la factura y el paciente como contexto, sin códigos internos ni controles de impresión duplicados.

## Lista de inspección manual

- Sin overflow horizontal ni barras de desplazamiento anidadas.
- Sin controles cubiertos por navegación móvil, barra inferior o drawer.
- Jerarquía clara: paciente, selección, resultado, cuenta, total y acción.
- Primer resultado visible sin desplazamiento excesivo en laptop.
- Cuenta persistente en escritorio y drawer explícito bajo 1280 px.
- Sin truncación destructiva, texto operativo en inglés ni paginación duplicada.
- Borde cuadrado y densidad consistente con el shell institucional.
- Capturas de pago regeneradas como screenshot del diálogo después del repintado para descartar artefactos de rasterización del runner.

## Incidencias encontradas y corregidas durante el gate

1. Enter se perdía entre el debounce y `useDeferredValue`; ahora la intención queda asociada a la consulta hasta recibir su primer resultado o cambiar filtros.
2. El primer resultado quedaba bajo el pliegue en 1366×768; se compactaron confirmación, paciente y filtros sin reducir los controles críticos por debajo de 44 px.
3. El CTA del modal de cobro quedaba bajo el pliegue; se compactó la composición sin introducir scroll interno.
