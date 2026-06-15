# Hospital San Isidro RC - Plan Review

Fecha: 2026-05-29

Plan revisado:

- `docs/superpowers/plans/2026-05-29-hospital-san-isidro-release-candidate.md`

Prompt aplicado:

- `prompts/01_PLAN_REVIEW_ORCHESTRATOR.md`

## Decisión

**APROBADO CON CAMBIOS**

No hay bloqueantes para iniciar implementación por fases después de aprobación del usuario. Sí hay cambios obligatorios que deben incorporarse antes de cerrar las fases afectadas.

## Tabla de Hallazgos

| Subagente | Severidad | Hallazgo | Evidencia del plan | Recomendación concreta |
| --- | --- | --- | --- | --- |
| Arquitectura y mantenibilidad | Alta | El plan toca casi todos los módulos y puede volverse gigante si Fase 1 intenta limpiar branding, textos, diagnósticos y docs visibles a la vez. | Fase 1 modifica login, shell, backups, ayuda, about y branding check. | Mantener Fase 1 estrictamente en texto/identidad visible y tests de branding; no rediseñar layout ni flujos en esa fase. |
| Base de datos e integridad transaccional | Alta | La migración propuesta para campos institucionales podría duplicar conceptos ya existentes (`government_line`, `receipt_paper_size`, snapshots en invoices). | Sección 6 propone campos nuevos "si faltan". | Antes de crear migración, auditar columnas actuales y preferir reutilizar `2026_05_29_000001_add_institutional_receipt_settings.php`. Solo migrar si un test falla por falta real de snapshot. |
| Seguridad, privacidad y permisos | Media | Fase 1 propone ocultar diagnósticos técnicos, pero no especifica verificación por rol. | Criterios hablan de admin/cajero, sin matriz de pruebas por rol. | Agregar pruebas o smoke por rol admin/supervisor/cajero para asegurar que cajero no ve respaldos, estado técnico ni configuración fiscal. |
| UI/UX caja hospitalaria | Alta | "Todos debe mostrar servicios activos" puede reintroducir la lista de 122 servicios en Nueva factura. | Fase 4 acepta mostrar todos con riesgo de lista inmanejable. | Mostrar "Todos" con resultados activos paginados/limitados y búsqueda dominante; no renderizar los 122 como bloque largo sin control. |
| Rendimiento y escalabilidad local | Media | Búsqueda tolerante a errores simples puede degradar rendimiento si se implementa con filtros pesados en PHP sobre todo el catálogo. | Fase 4 pide tolerancia a errores simples. | Implementar normalización de acentos/mayúsculas primero; limitar fuzzy simple al frontend sobre catálogo cacheado o a consultas index-friendly en backend. Medir antes de algoritmos costosos. |
| Offline LAN, instalación y respaldos | Alta | El plan menciona backup antes de migraciones, pero no lo convierte en paso obligatorio de ejecución. | Riesgos y checklist hablan de respaldo, pero fases con migración no tienen paso explícito. | En cada fase con migración, primer paso obligatorio: crear backup o validar que el entorno es descartable. |
| QA, TDD y quality gates | Media | Plan final incluye muchos gates, pero no define gates mínimos por fase pequeños. | Sección 11 lista gate final amplio. | Cada fase debe cerrar con gate mínimo focalizado y registrar pruebas en QA; gate total queda para Fase 9. |
| Dominio hospitalario y facturación fiscal | Alta | El plan evita inventar cumplimiento fiscal, pero no declara qué pasa si CAI/rango faltan al intentar imprimir una factura ya emitida. | Fase 2 dice "Configuración pendiente" si faltan datos. | Para nuevas facturas, backend debe bloquear emisión si fiscal obligatorio falta; para históricas existentes incompletas, recibo debe mostrar "Configuración pendiente" sin alterar datos. |

## Cambios Obligatorios Antes de Codificar

- Confirmar con el usuario que se implementará fase por fase y que la primera fase de código será Fase 1, no todo el plan.
- Antes de cualquier migración, auditar columnas existentes y preferir reutilizar campos actuales.
- Añadir al plan operativo de cada fase con migración: backup previo o entorno descartable confirmado.
- Mantener "Todos" en Nueva factura sin convertirlo en lista interminable.
- No tocar release zip/rar ni `.env` en fases tempranas.

## Cambios Recomendados

- Crear `qa/HOSPITAL_SAN_ISIDRO_AUDIT_2026-05-29.md` al iniciar Fase 0 con hallazgos de pantalla y referencias a capturas.
- Añadir pruebas por rol para textos técnicos visibles.
- Añadir captura específica de recibo institucional porque la captura actual `10-receipt-preview.png` no evidencia el recibo.
- Separar documentos técnicos de manuales no técnicos usando una búsqueda de términos prohibidos por audiencia.

## Plan Corregido Resumido

1. Fase 0 deja auditoría y capturas honestas, sin tocar producto.
2. Fase 1 limpia identidad/copy visible sin rediseñar flujos.
3. Fase 2 corrige recibo institucional y pruebas/capturas.
4. Fase 3 endurece pago, parcial y conciliación.
5. Fase 4 mejora búsqueda y "Todos" sin lista infinita.
6. Fase 5 aclara reportes financieros.
7. Fase 6 endurece respaldos, restore e instalación Windows.
8. Fase 7 cierra accesibilidad/teclado/responsive.
9. Fase 8 actualiza manuales no técnicos.
10. Fase 9 ejecuta gates completos y evidencia final.

## Checklist de Entrada a Implementación

- [ ] Usuario aprueba el plan.
- [ ] `git status --short --branch` revisado.
- [ ] No hay cambios de código sin plan.
- [ ] Capturas base guardadas.
- [ ] Si la fase toca DB, backup previo o entorno descartable documentado.
- [ ] Tests focalizados definidos antes de editar.
- [ ] Commit por fase con Conventional Commits.
- [ ] Revisión por `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md` después de cada commit.

