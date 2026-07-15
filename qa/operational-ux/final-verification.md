# Verificación integral — UX operativa

Fecha: 2026-07-14

## Alcance validado

- Acceso e identidad institucional.
- Shell, navegación, dashboard y páginas de apoyo.
- Nueva factura, cuenta, cobro y recuperación ante fallo de recibo.
- Historial, reimpresión, anulación y grids institucionales.
- Caja, movimientos, conciliación, bloqueos y cierre.
- Catálogo, servicios homónimos, filtros y mantenimiento de categorías.
- Configuración fiscal, hospital, numeración, operativa, marca y recibos.
- Recibo institucional y perfiles carta, media carta, A5, 80 mm, 58 mm y personalizado.

## Resultados

- Frontend Vitest: 137 archivos y 1,028 pruebas aprobadas mediante segmentos aislados.
- Playwright integral: 45 pruebas aprobadas en una sola corrida con 8 workers.
- Laravel: 863 pruebas aprobadas, 5,668 aserciones y 12 omitidas por condiciones documentadas de MySQL o driver de cobertura.
- TypeScript, ESLint, reglas UI y build de producción: aprobados.
- Gate visual final: 339 archivos auditados, 0 violaciones.
- Revisión visual final: factura, pago, caja, catálogo y configuración inspeccionados a resolución original.

## Observaciones no bloqueantes

- Vite conserva la advertencia conocida de chunks mayores de 500 kB para ECharts y AG Grid; la compilación termina correctamente y ambos módulos ya se cargan por ruta.
- El runner Vitest segmentado oficial excedió 15 minutos por ejecutar todos los segmentos en serie. Se conservaron sus seis reportes completos y los seis segmentos restantes se ejecutaron en lotes aislados con un worker; toda la asignación de 137 archivos quedó cubierta.
