# Current Release Truth

## Verdad de producto

S_Hospital queda cerrado como sistema hospitalario offline LAN para caja, facturacion, pagos, recibos institucionales, catalogo, historial, reportes, usuarios, configuracion, respaldos, ayuda/soporte y auditoria.

No incluye expediente clinico, citas, consulta medica, triage, admisiones, laboratorio clinico, farmacia clinica, enfermeria, hospitalizacion ni HIS/EMR.

## Menu final autorizado

1. Inicio
2. Nueva factura
3. Caja
4. Catalogo
5. Historial
6. Reportes
7. Respaldos
8. Configuracion
9. Usuarios
10. Ayuda

## Estado tecnico actual

- Rama diagnosticada: `v1.1-critical-hardening-after-offline`.
- HEAD observado al cierre F21: `0dab48f53077c039b084b41f8584d21684348892`.
- Stack: Laravel API, React + TypeScript, MySQL/MariaDB local, Docker Compose.
- Estado permitido de este cierre: `READY_FOR_REAL_LAN_INSTALLATION_TEST`.
- Validacion de gates: registrada en `reports/BILLING_OFFLINE_READINESS_REPORT.md` y `reports/F21_FIX_AUDIT_FINDINGS_REPORT.md`.
- No se declara `PRODUCTION_READY`.

## Regla de release

No se permite declarar `PRODUCTION_READY` sin evidencia de servidor final, segunda PC LAN, impresora fisica, backup worker/tarea programada, restore final, concurrencia final y configuracion production.

## Bloqueos para estados superiores

- `PRODUCTION_READY`: bloqueado hasta evidencia fisica final de servidor, segunda PC LAN, impresora, backup worker/scheduler, restore, concurrencia y production config.
- `CLINICALLY_VALIDATED`, HIS o EMR: no aplican al alcance final.

## Gates frescos del cierre F21

- Backend completo: `php artisan test --colors=never` PASS, 567 passed, 11 skipped, 3667 assertions.
- Backend formato/analisis: `vendor/bin/pint --test` PASS; `php -d memory_limit=512M vendor/bin/phpstan analyse` PASS.
- Frontend seguridad/calidad: `npm audit --audit-level=high` PASS; `npm run typecheck` PASS; `npm run lint` PASS.
- Frontend pruebas/build: `npm run test:full:windows` PASS, 67 files, 297 tests; `npm run build` PASS.
- E2E release controlado: `npm run e2e` PASS con `E2E_SEED_PASSWORD=Password123!` y SQLite descartable.
- Composer CLI: no disponible en este host; ejecutar `composer validate` y `composer audit --no-interaction` desde Docker/host con Composer antes de firma final.
