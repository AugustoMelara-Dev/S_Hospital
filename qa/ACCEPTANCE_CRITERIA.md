# Acceptance Criteria - S_Hospital Offline

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
- Recibo institucional media carta por defecto.
- Opciones carta, A5, 80mm y 58mm configurables.
- Se imprime una factura por vez con fondo blanco.
- No imprime QR, codigo de barras, codigos internos ni datos tecnicos.

## Production readiness
- `/up`, `/login` y `/verify-email` responden desde servidor LAN.
- Playwright E2E local pasa con `npm.cmd run e2e`.
- Restore real MySQL/MariaDB validado en base descartable antes de `PRODUCTION_READY`.
- Concurrencia real MySQL/MariaDB validada contra servidor de prueba antes de `PRODUCTION_READY`.
- Validacion fisica media carta/carta/A5/80mm/58mm documentada en `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`.
- Ninguna validacion pendiente se marca como completada sin evidencia.
