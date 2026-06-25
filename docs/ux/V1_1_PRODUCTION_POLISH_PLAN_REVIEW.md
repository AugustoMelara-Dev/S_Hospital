# V1.1 Production Polish Plan Review

Fecha: 2026-06-25
Prompt aplicado: `prompts/01_PLAN_REVIEW_ORCHESTRATOR.md`
Decision: APROBADO

## Tabla de hallazgos

| Subagente | Severidad | Hallazgo | Evidencia del plan | Recomendacion concreta |
| --- | --- | --- | --- | --- |
| Arquitectura y mantenibilidad | MEDIA | El pulido toca muchas superficies y puede duplicar componentes si no se gobierna desde UI compartida. | Fases 7 a 11 cubren todos los modulos. | Implementar primero componentes compartidos y limitar cambios por modulo. |
| Base de datos e integridad | BAJA | No se esperan migraciones, pero reportes/performance podrian descubrir indices faltantes. | Fases 9 y 12. | Si se agrega indice, hacerlo con migracion aditiva y test. |
| Seguridad, privacidad y permisos | ALTA | Cambios visuales no deben convertir botones ocultos en unica defensa. | Fase 13 exige RBAC/IDOR. | Todo flujo sensible debe conservar validacion backend y pruebas de permiso. |
| UI/UX caja hospitalaria | MEDIA | El POS puede degradarse si se prioriza estetica sobre rapidez. | Fase 10. | Medir flujo cajero: paciente, busqueda, carrito, total, cobrar. |
| Rendimiento LAN | MEDIA | Reportes y charts pueden cargar demasiado en PCs modestas. | Fases 9 y 12. | Mantener agregaciones backend, rangos obligatorios y charts con dimensiones estables. |
| Offline LAN/backups | BAJA | Investigacion web es de desarrollo, no de runtime. | Fase 2. | Documentar que ninguna fuente web se vuelve dependencia productiva. |
| TDD/QA | ALTA | No se debe declarar fase visual completa sin screenshots y gates. | Fases 14 y 15. | Separar evidencia digital de aceptacion fisica. |
| Dominio fiscal/hospitalario | ALTA | Recibo puede tentarse a agregar QR/barcode/campos legales inventados. | Fase 8. | Mantener recibo institucional sobrio con datos existentes y configuracion pendiente cuando falte informacion. |

## Cambios obligatorios antes de codificar

- Mantener Fase 2 y Fase 3 como documentacion previa.
- No instalar dependencias nuevas sin `DEPENDENCY_DECISION_RECORD.md`.
- No tocar negocio, permisos, numeracion fiscal, snapshots, pagos ni caja durante auditoria visual.
- Crear coordination board antes de lanzar subagentes paralelos.
- Separar QA digital de validacion fisica.

## Cambios recomendados

- Incluir screenshots antes/despues por modulo cuando el servidor local pueda levantarse.
- Priorizar design system antes de pantallas de negocio.
- Integrar reportes y recibos despues de estabilizar componentes compartidos.
- Registrar decisiones relevantes en `docs/DECISIONS.md` cuando haya cambios tecnicos, no solo cosmeticos.

## Plan corregido resumido

El plan queda aprobado con el siguiente orden operativo:

1. Checkpoint y worktree maestro.
2. Investigacion oficial y decision de dependencias.
3. Auditoria visual completa.
4. Coordination board para subagentes.
5. Design system.
6. Operaciones, admin/auth, invoice/receipt, reports.
7. QA/a11y/responsive/performance/security.
8. Integracion y reporte final.

## Checklist de entrada a implementacion

- [x] `main` verificado.
- [x] `origin/main` verificado.
- [x] SHA esperado confirmado.
- [x] Git limpio antes de crear checkpoint.
- [x] Checkpoint remoto creado.
- [x] Worktree maestro creado.
- [x] Rama `codex/v1-1-production-polish` subida.
- [x] Plan V1.1 escrito.
- [x] Revision del plan ejecutada.
- [ ] Investigacion web oficial documentada.
- [ ] Decision de dependencias documentada.
- [ ] Auditoria modulo por modulo completada.
