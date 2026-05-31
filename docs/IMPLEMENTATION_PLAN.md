# Sistema de Caja Hospitalaria - Implementation Plan

## 1. Resumen ejecutivo

Sistema de Caja Hospitalaria se construira desde cero en este repositorio como una app LAN local para facturacion hospitalaria, caja, pagos, catalogo de servicios, recibos institucionales, reportes, usuarios, permisos, auditoria y respaldos.

La implementacion usara:

- Backend: Laravel API en `backend/`.
- Frontend: React + TypeScript en `frontend/`.
- Base de datos: MySQL/MariaDB local.
- Desarrollo: Docker Compose reproducible.
- Produccion: instalacion offline LAN en una computadora servidor, documentada tambien para Windows servidor.

La prioridad de producto es una validacion operativa temprana: login, abrir caja, crear factura con nombre de paciente, buscar servicios, aplicar regla de eritropoyetina, cobrar, imprimir recibo institucional media carta/carta/A5, reimprimir y ver reporte diario. El diseno debe permitir completar el sistema sin rehacer la arquitectura.

## 2. Principios obligatorios

- No usar Supabase cloud, Firebase, SQLite multiusuario ni SaaS obligatorio.
- No crear expediente clinico: paciente solo requiere nombre en factura.
- Backend es fuente de verdad para totales, impuestos, reglas especiales, estado de factura y permisos.
- Usar `DECIMAL(12,2)` para dinero en MySQL/MariaDB.
- Guardar snapshots en `invoice_items`: nombre del servicio, categoria, precio, impuesto, total y regla aplicada.
- No recalcular facturas historicas desde precios actuales.
- No borrar facturas ni pagos; anular con permiso, motivo y auditoria.
- Numeracion fiscal debe ser atomica y protegida contra concurrencia.
- No emitir factura si la configuracion fiscal obligatoria esta incompleta, vencida, inactiva o fuera de rango.
- Credenciales temporales solo se permiten en desarrollo/testing; produccion requiere admin inicial con password temporal, `must_change_password=true` o procedimiento local documentado antes de uso real.
- Docker es herramienta de desarrollo, no requisito para operar en produccion offline si la instalacion local esta documentada.

## 3. Arquitectura propuesta

### Backend Laravel API

- Laravel API en `backend/`.
- Laravel Sanctum para autenticacion local.
- Spatie Laravel Permission para roles y permisos.
- Form Requests para validacion.
- Policies/Gates para acciones sensibles.
- Services/Actions para reglas de negocio:
  - `CreateInvoiceAction`
  - `GenerateFiscalNumberAction`
  - `RegisterPaymentAction`
  - `OpenCashSessionAction`
  - `CloseCashSessionAction`
  - `VoidInvoiceAction`
  - `CreateBackupAction`
- DB transactions en factura, correlativo fiscal, pagos, caja, anulacion y backups auditables.
- API Resources para respuestas consistentes.

### Frontend React + TypeScript

- React + TypeScript estricto en `frontend/`.
- TanStack Query para server state.
- React Hook Form + Zod para formularios.
- TanStack Table para listados.
- Componentes reutilizables para tablas, formularios, modales, estados vacios, errores y receipt preview.
- UI sobria, rapida y usable para caja hospitalaria.
- Frontend puede previsualizar, pero el backend decide el resultado persistido.

### Base de datos

- MySQL/MariaDB local.
- Migraciones Laravel idempotentes.
- Seeders reproducibles.
- `catalogo_servicios_inicial.csv` es la fuente inicial autorizada de servicios.
- Indices para fecha, numero de factura, paciente, estado, caja, usuario, categoria y auditoria.

### Offline LAN

- Una computadora servidor ejecuta backend, frontend compilado, MySQL/MariaDB y backups.
- Clientes acceden desde navegador por IP local.
- Login, facturacion, pagos, reportes e impresion deben funcionar sin internet.
- Produccion debe documentar firewall, IP fija, backup, restore y operacion en Windows servidor.

## 4. Estructura final esperada

```text
backend/
  app/
  database/
  routes/
  tests/
frontend/
  src/
  tests/
  playwright/
database/
  database_schema_critico.sql
  seed_servicios_iniciales.sql
docs/
  IMPLEMENTATION_PLAN.md
  API_CONTRACTS.md
  PERMISSIONS_MATRIX.md
  OPERATIVE_VALIDATION_FLOW.md
  LOCAL_VALIDATION_SCRIPT.md
  FISCAL_RULES.md
  DECISIONS.md
devex/
scripts/
qa/
references/
prompts/
subagents/
workflows/
```

## 5. Modelo de datos inicial

Tablas base:

- `users`
- `roles`, `permissions`, tablas pivot de Spatie Permission
- `settings`
- `categories`
- `services`
- `fiscal_sequences`
- `cash_register_sessions`
- `invoices`
- `invoice_items`
- `payments`
- `cash_movements`
- `audit_logs` o tablas de Spatie Activitylog
- `backup_logs`

Campos y reglas clave:

- `fiscal_sequences`: `document_type`, `prefix`, `current_number`, `min_number`, `max_number`, `cai`, `valid_until`, `active`.
- `invoices`: `invoice_number`, `patient_name`, `subtotal`, `tax_amount`, `discount_amount`, `total`, `paid_amount`, `balance_due`, `status`, `issued_by`, `cash_session_id`, `issued_at`, `voided_by`, `voided_at`, `void_reason`.
- `invoice_items`: snapshots obligatorios de categoria, servicio, precio, impuesto, total y regla especial.
- `payments`: factura, caja, cajero, metodo, monto, referencia, fecha y estado.
- `cash_movements`: apertura, pago, retiro, ajuste, cierre.

Estados de factura:

- `issued`: emitida sin pago completo.
- `partial`: pago parcial registrado.
- `paid`: saldo en cero.
- `void`: anulada con motivo y auditoria.

Regla de saldo:

- `paid_amount` y `balance_due` se actualizan dentro de la misma transaccion que registra pagos o anulaciones.
- El estado de factura se deriva del saldo y del estado de anulacion.

## 6. Fases de implementacion

### Fase 0 - Plan y contratos tecnicos

Alcance:

- Crear documentacion base en `docs/`.
- Definir contratos API, permisos, flujo de validacion operativa, reglas fiscales y decisiones.
- No crear `backend/` ni `frontend/`.

Quality gate:

- Confirmar que los seis documentos existen.
- Confirmar que no se crearon `backend/` ni `frontend/`.
- Confirmar que los hallazgos altos de la revision estan cubiertos.

Commit sugerido:

- `docs(plan): define phase zero implementation contracts`

### Fase 1A - Bootstrap backend

Alcance:

- Crear Laravel API en `backend/`.
- Configurar `.env.example`, health endpoint `/up`, conexion DB y estructura base.
- Instalar paquetes backend necesarios con justificacion.

Archivos probables:

- `backend/composer.json`
- `backend/routes/api.php`
- `backend/routes/web.php`
- `backend/app/Http/Controllers/HealthController.php`
- `backend/.env.example`
- `backend/tests/Feature/HealthTest.php`

Quality gate:

- `composer validate`
- `php artisan test --colors=never`
- `php artisan config:cache`

Commit sugerido:

- `chore(backend): bootstrap laravel api`

### Fase 1B - Bootstrap frontend

Alcance:

- Crear React + TypeScript en `frontend/`.
- Configurar routing base, cliente HTTP, layout minimo y pantalla placeholder conectable.

Archivos probables:

- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/routes/*`
- `frontend/src/test/*`

Quality gate:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Commit sugerido:

- `chore(frontend): bootstrap react typescript app`

### Fase 1C - Docker y devex

Alcance:

- Crear Docker Compose para desarrollo reproducible.
- Separar claramente desarrollo Docker de produccion offline.
- Agregar docs iniciales de instalacion local/Windows servidor.

Archivos probables:

- `docker-compose.yml`
- `.env.example`
- `devex/windows-server-install.md`
- `docs/OFFLINE_LAN_INSTALL.md`
- `scripts/quality_gate.sh`

Quality gate:

- `docker compose config`
- `docker compose up -d`
- Health check `/up`.

Commit sugerido:

- `chore(devex): add docker development environment`

### Fase 2 - Auth, permisos y configuracion fiscal

Alcance:

- Login local con Sanctum.
- Roles `admin`, `supervisor`, `cajero`.
- Permisos base segun `docs/PERMISSIONS_MATRIX.md`.
- CRUD/API de settings fiscales: hospital, RTN, CAI, rango, fecha limite, correlativo, impuesto y formato de recibo.
- Flujo de password temporal/cambio obligatorio para admin inicial y usuarios creados por admin.
- Usuarios temporales solo para desarrollo/testing; no se entrega produccion con usuarios de prueba activos.

Archivos probables:

- Migraciones de users/settings/permissions/fiscal_sequences.
- Seeders de roles/permisos y admin temporal para desarrollo/testing.
- Controllers/Auth, Controllers/Settings.
- Frontend auth y settings fiscal.

Quality gate:

- `php artisan migrate:fresh --seed`
- Tests auth.
- Tests permisos.
- Tests fiscal settings.
- Test `must_change_password` para usuario con password temporal.
- Frontend typecheck/build.

Commit sugerido:

- `feat(auth): add local login roles and fiscal settings`

### Fase 3 - Catalogo desde CSV

Alcance:

- Migrar `categories` y `services`.
- Seeder idempotente desde `catalogo_servicios_inicial.csv`.
- CRUD protegido para categorias y servicios.
- Identificacion estable de eritropoyetina con `special_rule_code`.

Archivos probables:

- `backend/database/seeders/ServiceCatalogSeeder.php`
- `backend/app/Actions/Catalog/*`
- `backend/app/Http/Controllers/CategoryController.php`
- `backend/app/Http/Controllers/ServiceController.php`
- `frontend/src/features/catalog/*`

Quality gate:

- `php artisan migrate:fresh --seed`
- Test de carga de 122 servicios.
- Test de regla especial eritropoyetina.
- Tests de permisos de catalogo.

Commit sugerido:

- `feat(catalog): seed and manage hospital services`

### Fase 4 - Facturacion transaccional

Alcance:

- Crear factura con nombre de paciente.
- Seleccionar servicios activos.
- Calcular totales en backend.
- Generar numero fiscal dentro de transaccion.
- Validar CAI activo, no vencido y dentro de rango.
- Guardar snapshots en `invoice_items`.
- Soportar saldo y estados `issued`, `partial`, `paid`, `void`.

Archivos probables:

- Migraciones `invoices`, `invoice_items`.
- `CreateInvoiceAction`
- `GenerateFiscalNumberAction`
- `InvoiceController`
- UI de nueva factura.

Quality gate:

- `php artisan migrate:fresh --seed`
- Unit tests de totales e impuestos.
- Feature tests de creacion de factura.
- Test de concurrencia de correlativo.
- Test de bloqueo por CAI vencido/fuera de rango.

Commit sugerido:

- `feat(billing): create transactional invoice workflow`

### Fase 5 - Caja, pagos y recibo institucional MVP

Alcance:

- Abrir caja.
- Registrar pago total o parcial.
- Crear movimiento de caja.
- Actualizar `paid_amount`, `balance_due` y estado de factura dentro de transaccion.
- Cerrar caja con esperado vs contado.
- Agregar preview/print MVP de recibo media carta/carta/A5.

Archivos probables:

- Migraciones `cash_register_sessions`, `payments`, `cash_movements`.
- `OpenCashSessionAction`, `RegisterPaymentAction`, `CloseCashSessionAction`.
- UI caja/pagos.
- UI recibo MVP y CSS print.

Quality gate:

- `php artisan migrate:fresh --seed`
- Test no cobrar sin caja abierta.
- Test pago crea movimiento.
- Test pago parcial y pago completo.
- Test cierre de caja.
- Test receipt render con RTN/CAI/rango si existen.
- Smoke E2E de validacion parcial.

Commit sugerido:

- `feat(cashbox): add payments cash sessions and receipt mvp`

### Fase 6 - Historial, reimpresion y anulacion

Alcance:

- Historial paginado de facturas.
- Reimpresion desde snapshots.
- Anulacion de factura con permiso, motivo y auditoria.
- Confirmaciones visibles para acciones criticas.

Archivos probables:

- `VoidInvoiceAction`
- `ReceiptController`
- Audit service.
- UI historial/anulacion/reimpresion.

Quality gate:

- Tests de permisos de anulacion.
- Test audit log.
- Test reimpresion historica.
- Frontend tests de confirmacion.

Commit sugerido:

- `feat(invoices): add history reprint and voiding`

### Fase 7 - Reportes basicos

Alcance:

- Reporte diario.
- Reporte por rango.
- Reporte por caja/cajero/categoria.
- Paginacion y rangos por defecto.
- Agregaciones en backend.

Archivos probables:

- Report services/query objects.
- `ReportController`
- UI reportes.

Quality gate:

- Feature tests de reportes.
- Test que exige rango de fecha.
- Test que totales coinciden con pagos/caja.

Commit sugerido:

- `feat(reports): add basic income and cash reports`

### Fase 8 - Backups y offline LAN

Alcance:

- Backup manual.
- Backup diario documentado.
- Registro en `backup_logs`.
- Guia de restore.
- Validacion manual reproducible de restore en entorno de prueba, con pasos y evidencia minima.
- Guia de instalacion offline LAN y Windows servidor.

Archivos probables:

- `BackupDatabaseCommand`
- `backup_logs` migration.
- UI/admin backup.
- `docs/BACKUP_RESTORE.md`
- `docs/OFFLINE_LAN_INSTALL.md`

Quality gate:

- Command tests.
- Test backup log.
- Validacion manual documentada de restore en entorno de prueba: crear backup, restaurar en base limpia de prueba, correr migraciones/seed si aplica, validar login admin y conteos minimos de tablas criticas.
- Evidencia minima en `qa/RELEASE_READINESS.md` o documento de fase: fecha, entorno, backup usado, resultado y comando/pasos ejecutados.

Commit sugerido:

- `feat(backups): add local backup workflow`

### Fase 9 - QA release y validacion operativa

Alcance:

- Playwright E2E completo del flujo operativo.
- Release readiness.
- Guion de validacion final.
- Evidencia de quality gate.

Archivos probables:

- `frontend/tests/e2e/billing-flow.spec.ts`
- `qa/RELEASE_READINESS.md`
- `docs/LOCAL_VALIDATION_SCRIPT.md`
- `docs/FINAL_DELIVERY_REPORT.md`

Quality gate:

- Backend tests.
- Frontend typecheck/lint/test/build.
- Playwright E2E.
- Validar `/up`, `/login`, `/verify-email`.

Commit sugerido:

- `test(e2e): cover hospital billing validation flow`

### Fase 10 - Production readiness y validaciones reales

Alcance:

- Gate E2E Playwright separado.
- Rutas LAN finales para `/login`, `/verify-email`, `/up` y assets del frontend compilado.
- Script verificable de restore real MySQL/MariaDB.
- Script verificable de concurrencia real MySQL/MariaDB.
- Checklist fisico de impresora institucional media carta/carta/A5.
- Documentacion de estados `PRODUCTION_CANDIDATE` y `PRODUCTION_READY`, sin presentar evidencia fisica pendiente como completada.

Archivos probables:

- `frontend/playwright.config.ts`
- `frontend/e2e/production-readiness.spec.ts`
- `scripts/e2e_gate.sh`
- `scripts/e2e_gate.ps1`
- `scripts/validate_restore_mysql.sh`
- `scripts/validate_mysql_concurrency.sh`
- `scripts/validate_mysql_concurrency.mjs`
- `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`
- `qa/RELEASE_READINESS.md`

Quality gate:

- Backend tests y Pint.
- Frontend typecheck/lint/test/build.
- Playwright E2E local.
- Scripts de restore/concurrencia ejecutados solo en entorno MySQL/MariaDB correcto.

Commit sugerido:

- `test(release): add production readiness validation gates`

### Fase 11 - Field deployment validation

Alcance:

- Detectar entorno real/casi real: MySQL/MariaDB, herramientas `mysql`/`mysqldump`, Docker, IP LAN y build frontend.
- Ejecutar restore MySQL/MariaDB solo con guardas explicitas contra base descartable.
- Ejecutar concurrencia real solo contra target local/descartable confirmado.
- Validar rutas LAN por IP y documentar si falta computadora cliente fisica.
- Validar worker de backups y documentar como dejarlo corriendo en Windows.
- Documentar pendientes reales de impresora institucional y configuracion final de produccion.

Archivos probables:

- `qa/FIELD_DEPLOYMENT_VALIDATION.md`
- `qa/PRODUCTION_READINESS_GAP_REPORT.md`
- `qa/RELEASE_READINESS.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/OFFLINE_LAN_INSTALL.md`
- `docs/BACKUP_RESTORE.md`

Quality gate:

- Backend tests y Pint.
- Frontend typecheck/lint/test/build/E2E.
- `scripts/quality_gate.sh`.
- `scripts/e2e_gate.sh`.
- Scripts destructivos/mutantes solo con variables seguras.

Commit sugerido:

- `test(release): document field deployment validation`

## 7. Orden de commits

1. `docs(plan): define phase zero implementation contracts`
2. `chore(backend): bootstrap laravel api`
3. `chore(frontend): bootstrap react typescript app`
4. `chore(devex): add docker development environment`
5. `feat(auth): add local login roles and fiscal settings`
6. `feat(catalog): seed and manage hospital services`
7. `feat(billing): create transactional invoice workflow`
8. `feat(cashbox): add payments cash sessions and receipt mvp`
9. `feat(invoices): add history reprint and voiding`
10. `feat(reports): add basic income and cash reports`
11. `feat(backups): add local backup workflow`
12. `test(e2e): cover hospital billing validation flow`

## 8. Comandos de verificacion previstos

Backend:

```bash
cd backend
composer validate
php artisan migrate:fresh --seed
php artisan test --colors=never
vendor/bin/pint --test
vendor/bin/phpstan analyse
php artisan config:cache
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright test
```

Docker desarrollo:

```bash
docker compose config
docker compose up -d
```

Smoke deploy/local:

```bash
curl http://localhost/up
curl http://localhost/login
curl http://localhost/verify-email
```
