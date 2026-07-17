# Aislamiento de artefactos del E2E ordinario

Fecha: 2026-07-17
Estado: diseño aprobado

## Contexto

El comando mantenido `npm run test:e2e:mock` ejecuta los flujos de facturación,
catálogo e historial. Esos flujos escriben capturas y métricas directamente
sobre archivos rastreados bajo `qa/operational-ux/after`.

La revalidación del 2026-07-17 reprodujo dos fallos intermitentes de Playwright:
primero al abrir `payment-cash-1366x768.png` y después al abrir
`payment-transfer-1366x768.png`. Los archivos no eran de solo lectura, admitían
apertura exclusiva después del fallo y soportaron 200 sobrescrituras seguidas
desde Node. El punto inestable es, por tanto, la escritura rutinaria de
Playwright sobre evidencia rastreada que puede estar observada por Git, el IDE
u otras herramientas del escritorio.

Además del fallo, el comportamiento mezcla dos responsabilidades: comprobar el
producto y regenerar evidencia visual curada. Un gate ordinario debe ser
repetible y no modificar el checkout.

## Objetivo

Hacer que `npm run test:e2e:mock` conserve sus capturas y métricas en el
directorio aislado de cada test, sin escribir en `qa/`, y mantener un mecanismo
explícito para regenerar la evidencia curada cuando esa sea la intención.

## Alcance

El cambio cubre únicamente los specs incluidos en el plan E2E ordinario que hoy
escriben evidencia rastreada:

- `new-invoice-flow.spec.ts`;
- `invoice-history-flow.spec.ts`;
- `catalog-flow.spec.ts`.

Las suites visuales especiales, históricas o de release que se invocan para
capturar evidencia quedan fuera de esta fase. Sus escrituras son parte de su
propósito explícito y no participan en `npm run test:e2e:mock`.

## Diseño

### Destino ordinario

Cada spec usará `testInfo.outputPath(...)` como destino predeterminado. Los
JSON de auditoría y las capturas quedarán bajo `frontend/test-results`, que ya
es el espacio efímero administrado por Playwright e ignorado por Git.

Los nombres actuales se conservarán para facilitar la comparación:

- `billing-<viewport>.json` y `billing-<viewport>.png`;
- `payment-cash-1366x768.png`;
- `payment-transfer-1366x768.png`;
- `history-1366.png`;
- `catalog-1366.png` y `catalog-390.png`.

### Regeneración explícita

Una variable de entorno única, `E2E_UPDATE_OPERATIONAL_UX_EVIDENCE=1`, activará
el destino histórico bajo `qa/operational-ux/after`. Sin ese valor exacto no
se tocará evidencia rastreada.

La resolución del destino vivirá en un helper pequeño compartido por los tres
specs. El helper recibirá `testInfo`, el subdirectorio opcional y el nombre del
archivo; creará directorios únicamente en modo de actualización explícita. No
añadirá reintentos ni ocultará errores de escritura.

### Contrato del runner

El test de `mock-e2e-plan` protegerá que los specs mantenidos continúan en el
plan. Un nuevo test unitario del helper probará ambos modos con un directorio
temporal:

- por defecto, el resultado procede de `testInfo.outputPath`;
- con la variable exacta, el resultado apunta al árbol QA esperado;
- valores distintos de `1` no activan la escritura rastreada.

Una búsqueda de contrato verificará que los tres specs ya no construyen rutas
directas hacia `qa/operational-ux/after`.

## Flujo de datos

1. El spec solicita una ruta para un artefacto.
2. El helper comprueba exclusivamente
   `E2E_UPDATE_OPERATIONAL_UX_EVIDENCE === '1'`.
3. En ejecución ordinaria delega en `testInfo.outputPath`.
4. En actualización explícita resuelve el destino QA conocido y crea su
   directorio.
5. Playwright o `writeFileSync` escribe el artefacto en la ruta resultante.

No se transfieren datos de producción, secretos ni información clínica. Los
flujos mock usan únicamente pacientes y referencias sintéticas.

## Riesgos y mitigaciones

- **Pérdida accidental de evidencia curada:** el modo explícito conserva los
  nombres y rutas existentes.
- **Activación accidental:** solo el valor exacto `1` habilita escrituras QA.
- **Divergencia entre specs:** un helper compartido define el contrato.
- **Artefactos difíciles de localizar:** Playwright adjunta su directorio de
  salida al resultado de cada test y conserva los nombres existentes.
- **Cambios locales preexistentes:** la implementación no restaurará ni
  incluirá `frontend/package-lock.json` o capturas QA modificadas por el
  usuario.

## Pruebas y aceptación

1. El test del helper falla antes de implementarlo y pasa después.
2. El test de contrato detecta cualquier ruta QA directa restante en los tres
   specs mantenidos.
3. El caso focalizado de facturación a 1366x768 pasa sin tocar las capturas QA.
4. `npm run test:e2e:mock` pasa completo.
5. El estado Git posterior conserva exactamente los cambios locales que ya
   existían, sin nuevas modificaciones rastreadas por la suite.
6. TypeScript, ESLint y los tests unitarios relevantes pasan.
7. La auditoría viva registra el fallo, la causa, la corrección, las métricas y
   las suites visuales especiales descartadas de esta fase con su motivo.

## Alternativas descartadas

- **Reintentar sobrescrituras en `qa/`:** reduce el síntoma, pero mantiene la
  carrera y ensucia el checkout.
- **Eliminar capturas:** pierde evidencia útil para diagnosticar regresiones.
- **Modificar todas las suites visuales históricas:** amplía el riesgo sin
  relación con el gate ordinario que falló; esas suites tienen una finalidad de
  captura explícita.
