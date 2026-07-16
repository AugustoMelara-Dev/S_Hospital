# Frontend CI Security And Bundle Budget Design

## Contexto

El workflow principal instala el frontend con pnpm, ejecuta typecheck, lint,
Vitest y build, pero no consulta advisories del registro ni aplica el presupuesto
de bundle ya mantenido por el proyecto. Composer sí se audita en ambos jobs
backend. El build local actual aprueba por solo 12.4 KiB gzip de margen total,
por lo que una regresión de peso podría llegar a `main` sin ser detectada.

`docs/CI.md` además describe npm para el job frontend, aunque el workflow usa
pnpm 11 y `pnpm-lock.yaml`.

## Objetivo

Hacer obligatorias en CI la detección de vulnerabilidades frontend de severidad
alta o crítica y la defensa del presupuesto del artefacto desplegable, manteniendo
una documentación fiel al workflow ejecutado.

## Diseño aprobado

- Añadir `pnpm audit --audit-level high` inmediatamente después de la instalación
  congelada y antes de typecheck.
- No usar `--ignore-registry-errors`: una auditoría que no pudo consultar el
  registro no debe presentarse como aprobada.
- Ejecutar `pnpm run budget:bundle` inmediatamente después del build, reutilizando
  el analizador y los límites ya versionados.
- Proteger ambos gates y su orden con un test que extraiga únicamente el job
  `frontend` del workflow.
- Actualizar `docs/CI.md` para reflejar pnpm, auditoría y presupuesto sin cambiar
  los comandos npm del entorno Docker local.

## Alternativas descartadas

- Auditar solo dependencias de producción: omitiría vulnerabilidades de Vite,
  Vitest, Playwright y otras herramientas que ejecutan código durante CI/build.
- Usar `--ignore-registry-errors`: reduce flakiness a costa de convertir una
  ausencia de evidencia en éxito de seguridad.
- Duplicar límites de bytes en YAML: crearía dos fuentes de verdad; el script de
  presupuesto ya contiene clasificación de chunks y mensajes útiles.
- Añadir una dependencia de análisis: el repositorio ya dispone de todos los
  comandos necesarios.

## Riesgos y mitigaciones

- **Disponibilidad del registro:** la auditoría agrega una consulta de red. El job
  ya depende del mismo ecosistema para la instalación; un fallo será explícito y
  reintentable, no un falso PASS.
- **Incremento de tiempo:** la medición local de auditoría tarda segundos y el
  presupuesto lee el build existente sin recompilar.
- **Falsos positivos por otros jobs:** la prueba limita búsquedas al bloque
  `frontend`.
- **Deriva de lockfiles:** la fase no modifica `package.json`, `package-lock.json`
  ni `pnpm-lock.yaml`.

## Pruebas y aceptación

1. El test contractual falla antes de añadir los pasos.
2. La auditoría aparece después de instalar y antes de typecheck, con severidad
   mínima `high` y sin tolerar errores del registro.
3. El presupuesto aparece después del build.
4. `pnpm audit --audit-level high` informa cero vulnerabilidades conocidas.
5. Build y presupuesto aprueban con los límites vigentes.
6. El workflow continúa siendo YAML válido y los tests de contratos CI pasan.
7. El commit excluye el lockfile modificado por el usuario.
