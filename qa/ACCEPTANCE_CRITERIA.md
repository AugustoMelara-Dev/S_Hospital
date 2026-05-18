# Acceptance Criteria - Hospital Billing OS Offline

## Facturación
- Crear factura con nombre del paciente obligatorio.
- Buscar y seleccionar servicios por categoría.
- Totales calculados por backend.
- Factura guarda snapshots de nombre/precio/categoría.
- Reimpresión conserva valores históricos.

## Eritropoyetina
- Normal: L.25.
- Con receta de diálisis marcada: L.0 y nota/regla aplicada.
- Se registra en factura como medicamento.

## Caja y pagos
- No se puede cobrar sin caja abierta.
- Pago crea movimiento de caja.
- Cierre calcula esperado vs contado.
- Reporte diario por caja.

## Seguridad
- Cajero no edita precios.
- Cajero no anula sin permiso.
- Admin gestiona usuarios/configuración.

## Offline LAN
- Funciona con internet desconectado.
- Cliente accede por IP local al servidor.
- Backup manual y diario disponible.
- Backups son locales, descargables solo por admin y no exponen rutas internas.
- Restore manual esta documentado y validado primero en entorno de prueba, sin endpoint destructivo.

## Impresión
- Recibo 80mm por defecto.
- Opción 58mm.
- PDF/impresión no sale como hoja carta principal.

## Production readiness
- `/up`, `/login` y `/verify-email` responden desde servidor LAN.
- Playwright E2E local pasa con `npm.cmd run e2e`.
- Restore real MySQL/MariaDB validado en base descartable antes de `PRODUCTION_READY`.
- Concurrencia real MySQL/MariaDB validada contra servidor de prueba antes de `PRODUCTION_READY`.
- Validacion fisica 80mm/58mm documentada en `docs/THERMAL_PRINTER_VALIDATION.md`.
- Ninguna validacion pendiente se marca como completada sin evidencia.
