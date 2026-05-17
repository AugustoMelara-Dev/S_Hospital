# Flujo agentic compartido adaptado a Codex

## Ciclo completo
1. Modo Plan: Codex lee AGENTS.md, docs, referencias y genera plan.
2. Revisión del Plan: ejecutar orquestador de 8 subagentes.
3. Corrección del Plan: Codex modifica el plan según hallazgos.
4. Implementación por Fase: una fase pequeña a la vez.
5. Pruebas locales: ejecutar quality gate.
6. Commit: commit separado por fase.
7. Revisión de Commit: ejecutar orquestador de revisión de código.
8. Revisión Manual: el desarrollador decide qué comentarios aplicar.
9. Corrección: aplicar cambios aceptados.
10. Siguiente fase.

## Regla de avance
No avanzar a la siguiente fase si hay hallazgos BLOQUEANTES o ALTOS sin resolver en facturación, base de datos, seguridad, caja, permisos, backups o offline LAN.
