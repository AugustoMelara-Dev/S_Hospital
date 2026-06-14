# 2026-06-14 - Rediseño operativo con tipografia no generica

Decision: se aplica una direccion visual de caja hospitalaria local, con paleta institucional calida, acento teal unico, fuente sans no-Inter con fallback offline (`Geist`, `Aptos`, `Segoe UI Variable`) y numeros tabulares/mono para montos. El cambio cubre tokens, primitivas, AppShell, sidebar/topbar, POS, catalogo, caja, reportes y dashboard sin tocar contratos API, reglas fiscales, calculos, pagos, recibos backend ni permisos.

Criterio de verificacion: pasan `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test` y `npm.cmd run build`. El E2E local ejecuta 14/16 pruebas; las 2 fallan por `ECONNREFUSED` contra endpoints `/api/*` al no estar el backend local disponible para la prueba de readiness, no por errores de render React.
