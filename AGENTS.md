# AGENTS.md - S_Hospital Offline

## Identidad del proyecto
Construir un sistema hospitalario local para facturación, caja, pagos, reportes, catálogo de servicios y emisión de recibos institucionales PDF/papel.
El sistema debe funcionar sin internet, pero sí en red local LAN con una computadora servidor y varias computadoras cliente por navegador.
Stack objetivo: React + TypeScript + Laravel API + MySQL/MariaDB.
No usar Supabase cloud, SQLite multiusuario, Firebase, servicios SaaS obligatorios ni dependencias que requieran internet en producción.

## Regla de trabajo obligatoria
Antes de codificar, trabajar en MODO PLAN.
El plan debe dividirse en fases pequeñas, verificables y commiteables.
Cada fase debe incluir alcance, archivos esperados, migraciones, pruebas, riesgos y criterios de aceptación.
No implementar cambios amplios sin plan aprobado.
No mezclar módulos no relacionados en el mismo commit.

## Flujo agentic obligatorio
1. Leer docs/ y prompts/ antes de tocar código.
2. Ejecutar el prompt de planificación: prompts/00_PLAN_MODE_MASTER_PROMPT.md.
3. Ejecutar revisión del plan con prompts/01_PLAN_REVIEW_ORCHESTRATOR.md.
4. Aplicar correcciones al plan hasta que no haya bloqueantes.
5. Implementar una fase a la vez.
6. Ejecutar pruebas y quality gate local.
7. Commit por fase.
8. Ejecutar prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md contra el diff.
9. Corregir hallazgos críticos o altos antes de avanzar.
10. Documentar decisiones técnicas importantes en docs/DECISIONS.md.

## Convenciones de commits
Usar Conventional Commits.
Ejemplos: feat(billing): create invoice transaction flow; fix(cashbox): prevent closing with pending invoices; test(printing): add thermal receipt snapshots.
Cada commit debe representar una fase o subfase coherente.
No hacer commits gigantes con frontend, backend, DB y estilos mezclados salvo que la fase lo justifique.

## TDD y pruebas
Preferir TDD para reglas de negocio: facturación, totales, ISV, caja, anulaciones, pagos, permisos, numeración fiscal y eritropoyetina.
Laravel: tests Feature para endpoints y tests Unit para servicios de dominio.
React: tests de componentes críticos y flujos con Testing Library.
E2E: Playwright para nueva factura, pago, reimpresión, cierre de caja y reportes.
No considerar completa una fase sin pruebas mínimas automatizadas.

## Calidad de backend Laravel
Usar Form Requests para validación.
Usar Policies/Gates para permisos.
Usar Services/Actions para lógica de negocio; controllers delgados.
Usar DB transactions para crear facturas, pagos, cierre de caja y anulaciones.
Evitar lógica de dinero en floats; usar enteros en centavos o decimal(12,2) con cuidado.
Guardar snapshots de precios y nombres en invoice_items; nunca recalcular facturas históricas desde services.

## Calidad de frontend React
Usar TypeScript estricto.
Usar componentes reutilizables para tablas, formularios, modales y receipt preview.
Usar TanStack Query para comunicación API y cache controlado.
Usar React Hook Form + Zod para formularios.
No duplicar lógica de cálculo fiscal como fuente de verdad; backend decide, frontend solo previsualiza.
Diseño sobrio, rápido y usable para caja hospitalaria.

## Base de datos
MySQL/MariaDB local en servidor LAN.
Migraciones idempotentes y seeders reproducibles.
Tablas críticas: users, roles, permissions, categories, services, invoices, invoice_items, payments, cash_register_sessions, cash_movements, settings, audit_logs, backups.
Índices para fecha, número de factura, paciente, estado, caja, usuario y categoría.
Usar constraints y claves foráneas donde no interfieran con auditoría histórica.

## Reglas de negocio no negociables
Paciente: solo nombre obligatorio en factura, no expediente clínico completo.
Eritropoyetina: medicamento de L.25; gratis si se marca paciente con receta de diálisis.
Facturas deben salir con nombre del paciente.
El recibo principal debe ser institucional PDF/papel, en formatos carta, media carta o A5. Los formatos 80mm/58mm quedan solo como compatibilidad secundaria. El recibo principal no debe exponer QR, código de barras ni códigos internos.
Toda factura pagada debe quedar asociada a caja, cajero, método de pago y fecha.
Anulación requiere permiso, motivo y auditoría; no borrar facturas.

## Offline LAN
Producción local: una PC servidor ejecuta app, MySQL/MariaDB y servidor web.
Clientes acceden por IP local, por ejemplo http://192.168.1.10.
No depender de internet para login, facturación, reportes o impresión.
Backups diarios automáticos y backup manual desde panel admin.

## Comandos esperados
Preferir Docker Compose para desarrollo reproducible.
Comandos base sugeridos:
docker compose up -d
docker compose exec backend php artisan migrate --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build

## Librerías permitidas recomendadas
Laravel Sanctum, Spatie Laravel Permission, Spatie Activitylog, Spatie Backup, Laravel DomPDF o Snappy/wkhtmltopdf según pruebas, Maatwebsite Excel si se requiere exportación.
React: TanStack Query, React Hook Form, Zod, TanStack Table, Recharts, date-fns, clsx/tailwind-merge, Playwright.
Validar impacto de cada librería; no agregar dependencias por comodidad si no resuelven un problema claro.

## Definición de terminado
Funcionalidad implementada, probada, documentada y revisada por subagentes.
Migraciones y seeders corren desde cero.
No hay secretos en frontend ni en repositorio.
Quality gate pasa.
Flujo principal probado en navegador: crear factura, cobrar, imprimir, reimprimir y reportar.
