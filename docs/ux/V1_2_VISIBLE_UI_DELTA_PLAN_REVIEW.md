# V1.2 Visible UI Delta Plan Review

Fecha: 2026-06-26

Plan revisado: `docs/ux/V1_2_VISIBLE_UI_DELTA_IMPLEMENTATION_PLAN.md`

## 1. Decision

APROBADO CON CAMBIOS YA INCORPORADOS.

No hay hallazgos BLOQUEANTES pendientes. El plan puede pasar a captura before, creacion de worktrees y ejecucion por fases siempre que se mantenga la prohibicion de cambios de negocio.

## 2. Tabla de hallazgos

| Subagente | Severidad | Hallazgo | Evidencia del plan | Recomendacion concreta | Estado |
| --- | --- | --- | --- | --- | --- |
| Arquitectura y mantenibilidad | MEDIA | La fase de design system puede crecer demasiado si intenta migrar pantallas completas al mismo tiempo. | Fase 5 lista tokens y muchos componentes compartidos. | Mantener Fase 5 en primitives/patrones; migrar pantallas desde Fase 6 en adelante. | Incorporado en orden de fases. |
| Base de datos e integridad transaccional | BAJA | El plan debe decir explicitamente que no hay migraciones esperadas. | Seccion 5. | Mantener migraciones en "ninguna"; cualquier necesidad backend crea plan separado. | Incorporado. |
| Seguridad, privacidad y permisos | ALTA | Redisenar shell/users puede exponer rutas o permisos si el frontend muestra acciones indebidamente. | Fases 6 y 12 tocan navegacion y RBAC UI. | Probar PermissionGate, UsersView y RBAC E2E; no confiar en ocultar botones como seguridad. | Incorporado. |
| UI/UX de caja hospitalaria | ALTA | POS visual fuerte puede romper rapidez o foco si se prioriza decoracion. | Fase 8. | Mantener buscador, paciente, total y cobrar como anclas; incluir keyboard hints y mobile real. | Incorporado. |
| Rendimiento y escalabilidad local | MEDIA | TanStack Table puede inducir filtrado cliente sobre datasets incompletos. | Fase 3 y Fase 9. | Si se adopta, usar manual/server-side para tablas grandes y migrar piloto. | Incorporado. |
| Offline LAN, instalacion y respaldos | MEDIA | Nuevos assets/fuentes/CDN romperian offline. | Fases visuales. | No introducir fuentes remotas, CDN ni APIs externas; validar build local. | Incorporado. |
| Pruebas, TDD y QA | ALTA | Capturas before/after y a11y deben estar en gates, no como evidencia opcional. | Fases 13 y 14. | Crear spec `v1-2-visible-ui-a11y`, screenshots antes/despues y performance review. | Incorporado. |
| Dominio hospitalario y facturacion fiscal | ALTA | Recibos/settings podrian inventar textos legales o datos institucionales. | Fase 11. | Preservar null/vacio en campos opcionales; no agregar QR, barcode, codigos internos, sello/firma falsos. | Incorporado. |

## 3. Cambios obligatorios antes de codificar

- Capturar o documentar intento de capturas before contra el runtime correcto `http://192.168.1.10:8081`.
- Crear worktrees o delegaciones con archivos permitidos/prohibidos claros.
- Revisar dirty state antes de cada merge o commit.
- No instalar librerias nuevas sin actualizar el decision record.
- No empezar pantallas de dominio antes de integrar o acordar la capa de design system.

## 4. Cambios recomendados

- Crear una tabla piloto con la DataTable local antes de decidir TanStack Table.
- Hacer primero screenshots de dashboard/POS/reportes para calibrar el delta visual.
- Usar estados vacios elegantes donde los endpoints no provean el dato esperado.
- Documentar cada desviacion en `docs/DECISIONS.md`.

## 5. Plan corregido resumido

1. Proteger base con checkpoint y rama principal.
2. Registrar investigacion oficial y decision de librerias.
3. Coordinar subagentes/worktrees con ownership estricto.
4. Centralizar tokens/componentes compartidos.
5. Migrar shell y pantallas por area, con pruebas focales.
6. Capturar before/after y ejecutar matriz a11y/responsive/performance.
7. Integrar ramas en orden normal, sin rebase.
8. Ejecutar gates finales, generar informe y push.

## 6. Checklist de entrada a implementacion

- [x] `main` limpio y sincronizado con `origin/main`.
- [x] SHA base real registrado.
- [x] Checkpoint remoto creado.
- [x] Rama principal creada.
- [x] Investigacion oficial documentada.
- [x] Decision inicial de librerias documentada.
- [x] Tablero de subagentes creado.
- [x] Plan por fases creado.
- [x] Revision del plan completada sin bloqueantes.
- [ ] Before screenshots capturados o bloqueo tecnico documentado.
- [ ] Worktrees/subagentes creados.
- [ ] Design system phase lista para comenzar.

## 7. Dictamen

El plan es apto para comenzar ejecucion faseada. La aprobacion se limita a UX/UI. Cualquier cambio en backend, DB, reglas fiscales, pagos, caja, permisos, endpoints o payloads queda fuera de este plan y debe bloquearse hasta tener plan propio.
