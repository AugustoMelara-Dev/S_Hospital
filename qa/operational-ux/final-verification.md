# Verificación integral — UX operativa

Fecha: 2026-07-16

## Alcance validado

- Acceso, identidad institucional, permisos y cambio obligatorio de contraseña.
- Shell, navegación, dashboard y páginas de apoyo.
- Nueva factura, búsqueda bajo carga inicial, eritropoyetina, cobro, recuperación
  idempotente y recibo institucional.
- Historial, reimpresión, anulaciones, conciliación y grids institucionales.
- Caja, movimientos, conteo por denominaciones, bloqueos y cierre auditado.
- Catálogo, reportes, respaldos y configuración administrativa.
- Perfiles de recibo carta, media carta, A5, 80 mm, 58 mm y personalizado.

## Resultados finales

- Frontend Vitest: **147 archivos y 1,127/1,127 pruebas aprobadas**.
- Laravel PHPUnit: **879 pruebas, 6,711 aserciones y 13 omisiones
  condicionales**.
- Playwright mock planificado: **49/49**; caja responsive adicional: **3/3**.
- Playwright release con Chrome del sistema: **2/2**, incluyendo factura,
  cobro, recibo/PDF, evento de impresión, reporte, cierre MariaDB y RBAC.
- Gate visual canónico: **12/12**; los 12 originales y 12 equivalentes conservan
  sus hashes. La captura real adicional muestra el arqueo por denominaciones.
- TypeScript, ESLint, cuatro pruebas Node, reglas UI, build Vite, presupuesto de
  bundle, Pint (436 archivos), PHPStan y `docker compose config --quiet`:
  aprobados.
- MariaDB 11: `migrate:fresh --seed --force` aprobado desde cero con la
  migración de `closing_breakdown` incluida.

## Evidencia operativa real

El gate release usó la API Laravel en `127.0.0.1:8010` y MariaDB del stack
`hospital-product-closure`. Verificó que el backend persistiera factura pagada,
recibo institucional, evento de impresión y cierre de caja con el mismo
`closing_breakdown` contado en pantalla y diferencia L 0.00. No registró errores
de consola ni respuestas HTTP bloqueantes. El reporte estructurado de la corrida
está en [`after/mariadb-release-e2e-report.json`](after/mariadb-release-e2e-report.json).

## Observaciones no bloqueantes

- Vite conserva la advertencia de chunks asíncronos mayores de 500 kB para
  ECharts y AG Grid. El presupuesto pasó: inicio 326.7 KiB gzip y total 1,061.8
  KiB gzip, por debajo de sus límites configurados.
- Falta validar una impresora física —incluidos márgenes no imprimibles— y la
  concurrencia desde varias computadoras reales de la LAN hospitalaria, además
  de repetir el recorrido con desconexión física de internet.
