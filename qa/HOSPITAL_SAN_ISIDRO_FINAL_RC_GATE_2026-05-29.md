# Gate final RC - Hospital San Isidro

Fecha: 2026-05-29
Rama: `codex/hospital-san-isidro-rc`
Estado: aprobado como release candidate local controlada, pendiente de validaciones fisicas de campo.

## Alcance verificado

- Identidad visible: Hospital San Isidro, Gobierno de Honduras y Secretaria de Salud Publica.
- Caja: apertura, cobro, saldo, parciales bloqueantes de cierre y metodos separados.
- Facturacion: paciente obligatorio, busqueda de servicios, eritropoyetina con receta de dialisis, snapshots historicos.
- Recibo: papel institucional carta/media carta/A5, blanco al imprimir, sin QR, barcode ni ticket termico.
- Reportes: facturado, cobrado, saldo pendiente, pagadas, parciales, anuladas y metodos.
- Respaldos: manual, automatico, estado, tamano, verificacion y restore fuera de UI.
- Manuales: cajero, administrador, instalacion, respaldos/restauracion y capacitacion.

## Pruebas ejecutadas

- Backend completo:
  - `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test --colors=never`
  - Resultado: 158 pruebas, 919 assertions, pass.
- Frontend unit/component:
  - `npm.cmd run test`
  - Resultado: 5 archivos, 34 pruebas, pass.
- Frontend lint:
  - `npm.cmd run lint`
  - Resultado: pass.
- Branding:
  - `npm.cmd run check:branding`
  - Resultado: pass, sin hallazgos en superficie visible configurada.
- Build:
  - `npm.cmd run build`
  - Resultado: pass. Vite mantiene advertencia no bloqueante por chunk `index` mayor a 500 kB.
- E2E:
  - `npm.cmd run e2e`
  - Resultado: 2 pruebas Playwright, pass.
- Migraciones desde cero en testing:
  - `docker compose exec -e APP_ENV=testing -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan migrate --force --no-interaction`
  - Resultado: pass.
- Formato PHP acotado a archivos tocados:
  - `docker compose exec backend ./vendor/bin/pint --test database/seeders/DevelopmentDemoSeeder.php tests/Feature/DevelopmentDemoSeederTest.php`
  - Resultado: pass.

## Evidencia visual

- Capturas base usadas durante auditoria y refactor: `qa/screenshots/field-qa-2026-05-29-fixed/`.
- Recibo institucional retenido como evidencia: `qa/screenshots/field-qa-2026-05-29-fixed/10-receipt-preview.png`.
- El smoke visual mas reciente paso sin hallazgos; la recaptura de recibo se omitio al no existir factura pagada visible en la base local sin mutar datos.

## Cambios finales del gate

- `DevelopmentDemoSeeder` ahora usa nombres visibles institucionales para admin, supervisor y cajero de desarrollo/testing.
- `DevelopmentDemoSeederTest` espera Hospital San Isidro.
- `production-readiness.spec.ts` usa Hospital San Isidro, fiscalidad pendiente y nombres visibles institucionales.
- El E2E ignora aborts benignos de `cash-sessions/current` durante navegacion, igual que otros aborts de carga ya filtrados.

## Pendientes fisicos para entrega real

- Probar impresora real en carta/media carta/A5 con una factura por impresion.
- Validar acceso desde una segunda PC por IP LAN.
- Confirmar reinicio de Windows con servicios levantados automaticamente.
- Confirmar acceso directo de escritorio para personal.
- Crear respaldo manual y validar respaldo automatico.
- Probar restauracion en base descartable antes de cualquier operacion real.

## Notas de seguridad

- No se hizo push.
- No se borro `.env`.
- No se ejecuto reset ni `migrate:fresh` sobre la base local.
- No se invento CAI ni cumplimiento fiscal; los placeholders se muestran como configuracion pendiente.
