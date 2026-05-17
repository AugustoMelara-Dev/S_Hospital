# Skill Codex: Revisión de código por commit

## Disparador
Usar después de cada commit o antes de confirmar una fase.

## Procedimiento
1. Obtener diff.
2. Ejecutar prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md.
3. Reusar los 8 subagentes.
4. Marcar hallazgos bloqueantes.
5. Solicitar correcciones mínimas.

## Política de rechazo
Rechazar commit si introduce pérdida de datos, dinero con float, falta de permisos, factura sin snapshots, transacción incompleta o dependencia de internet.
