# AGENTS.md - S_Hospital Offline

## Identidad Del Proyecto

S_Hospital es un sistema hospitalario local para caja, facturacion, pagos,
reportes, catalogo de servicios, backups y recibos institucionales PDF/papel.

El sistema debe operar sin internet en produccion, dentro de una red local LAN:
una computadora servidor ejecuta la app, MySQL/MariaDB y el servidor web; las
computadoras cliente acceden por navegador.

Stack objetivo: React + TypeScript + Laravel API + MySQL/MariaDB.

No usar Supabase cloud, SQLite multiusuario, Firebase, servicios SaaS
obligatorios ni dependencias que requieran internet para operar en produccion.

## Forma De Trabajo

- Trabajar en fases pequenas, verificables y commiteables.
- No mezclar modulos no relacionados en el mismo commit.
- Antes de cambios amplios, explicar alcance, riesgos, pruebas y criterio de aceptacion.
- No depender de prompts, subagentes, skills o documentos generados como fuente de verdad.
- La fuente de verdad es el codigo, las pruebas, las migraciones, los contratos API y las reglas de negocio de este archivo.
- Documentar decisiones importantes en el commit, PR o changelog vivo del cambio.

## Commits

Usar Conventional Commits.

Ejemplos:

- `feat(billing): create invoice transaction flow`
- `fix(cashbox): prevent closing with pending invoices`
- `test(printing): add institutional receipt snapshots`
- `chore(repo): remove obsolete agent artifacts`

Cada commit debe representar una fase o subfase coherente.

## TDD Y Pruebas

Preferir TDD para reglas de negocio:

- facturacion,
- totales,
- ISV,
- caja,
- anulaciones,
- pagos,
- permisos,
- numeracion fiscal,
- eritropoyetina.

Laravel:

- Feature tests para endpoints.
- Unit tests para servicios de dominio.

React:

- Tests de componentes criticos.
- Tests de flujos con Testing Library.

E2E:

- Playwright para nueva factura, pago, reimpresion, cierre de caja y reportes.

No considerar completa una fase sin pruebas automatizadas razonables para el riesgo tocado.

## Backend Laravel

- Usar Form Requests para validacion.
- Usar Policies/Gates para permisos.
- Usar Services/Actions para logica de negocio.
- Mantener controllers delgados.
- Usar DB transactions para facturas, pagos, cierre de caja y anulaciones.
- Evitar floats para dinero.
- Guardar snapshots de precios y nombres en `invoice_items`.
- Nunca recalcular facturas historicas desde el catalogo actual.

## Frontend React

- Usar TypeScript estricto.
- Usar componentes reutilizables para tablas, formularios, modales y recibos.
- Usar TanStack Query para API y cache controlado.
- Usar React Hook Form + Zod para formularios.
- No duplicar la logica fiscal como fuente de verdad.
- El backend decide totales; el frontend solo previsualiza.
- Diseno sobrio, rapido y usable para caja hospitalaria.

## Base De Datos

- MySQL/MariaDB local en servidor LAN.
- Migraciones idempotentes y seeders reproducibles.
- Indices para fecha, numero de factura, paciente, estado, caja, usuario y categoria.
- Usar constraints y claves foraneas donde no rompan auditoria historica.

Tablas criticas:

- `users`
- `roles`
- `permissions`
- `categories`
- `services`
- `invoices`
- `invoice_items`
- `payments`
- `cash_register_sessions`
- `cash_movements`
- `settings`
- `audit_logs`
- `backups`

## Reglas De Negocio No Negociables

- Paciente: solo nombre obligatorio en factura; no expediente clinico completo.
- Eritropoyetina: medicamento de L.25; gratis si se marca paciente con receta de dialisis.
- Facturas deben salir con nombre del paciente.
- El recibo principal debe ser institucional PDF/papel en carta, media carta o A5.
- 80mm/58mm son compatibilidad secundaria.
- El recibo principal no debe exponer QR, codigo de barras ni codigos internos.
- Toda factura pagada debe quedar asociada a caja, cajero, metodo de pago y fecha.
- Anulacion requiere permiso, motivo y auditoria.
- No borrar facturas.

## Offline LAN

- No depender de internet para login, facturacion, reportes o impresion.
- Clientes acceden por IP local del servidor, por ejemplo `http://192.168.1.10`.
- Backups diarios automaticos y backup manual desde panel admin.

## Comandos Base

```bash
docker compose up -d
docker compose exec backend php artisan migrate --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
```

## Dependencias

Permitidas si resuelven un problema real:

- Laravel Sanctum
- Spatie Laravel Permission
- Spatie Activitylog
- Spatie Backup
- Laravel DomPDF o Snappy/wkhtmltopdf segun pruebas
- Maatwebsite Excel si se requiere exportacion
- TanStack Query
- React Hook Form
- Zod
- TanStack Table
- Recharts
- date-fns
- clsx/tailwind-merge
- Playwright

No agregar dependencias por comodidad si no reducen riesgo o complejidad real.

## Definicion De Terminado

- Funcionalidad implementada.
- Migraciones y seeders corren desde cero.
- Pruebas relevantes pasan.
- No hay secretos en frontend ni repositorio.
- Quality gate local razonable pasa.
- El flujo principal funciona en navegador: crear factura, cobrar, imprimir, reimprimir y reportar.
