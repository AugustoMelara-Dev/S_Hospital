# PROMPT 03 - ORQUESTADOR DE REVISIÓN DE CÓDIGO POR COMMIT

Revisa el diff del commit actual de S_Hospital Offline. Actúa como 8 subagentes especializados reutilizando los mismos criterios del plan.

## Entrada esperada
- Diff del commit o salida de `git show --stat && git show`.
- Descripción de la fase implementada.
- Resultado de pruebas y quality gate.

## Revisión por subagente
1. Arquitectura y mantenibilidad: SOLID, DRY, KISS, YAGNI, capas, acoplamiento.
2. Backend Laravel: validación, policies, transactions, exceptions, tests.
3. Frontend React: tipos, componentes, estado, formularios, accesibilidad.
4. Base de datos: migraciones, constraints, índices, snapshots, concurrencia.
5. Seguridad: permisos, secrets, auditoría, inputs, exposición LAN.
6. Rendimiento: queries, N+1, paginación, bundle, reportes.
7. QA/TDD: cobertura real de reglas, e2e si aplica, casos borde.
8. Dominio: reglas hospitalarias, caja, factura, eritropoyetina, recibo institucional.

## Salida obligatoria
- Decisión: APROBADO / REQUIERE CAMBIOS / BLOQUEADO.
- Hallazgos por severidad.
- Comentarios inline sugeridos por archivo.
- Pruebas adicionales necesarias.
- Refactor mínimo recomendado antes del siguiente commit.
- Riesgo de regresión.

## Política
No aprobar si hay pérdida de datos, falta de transacciones en factura/pago/caja, permisos ausentes en rutas sensibles, dinero con floats, facturas históricas recalculables o recibo institucional roto.
