# Frontend Test Runner Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el tiempo de la regresión Vitest completa en Windows sin sacrificar cobertura ni estabilidad.

**Architecture:** El runner segmentado seguirá ejecutando un segmento a la vez, pero cada invocación Vitest podrá procesar dos archivos simultáneamente con forks. Una función pura concentrará los argumentos y ambos scripts públicos de regresión completa compartirán la misma ruta.

**Tech Stack:** Node.js, Vitest, React, TypeScript, npm scripts.

## Global Constraints

- Preservar los 12 segmentos y su garantía de cobertura exacta.
- No aumentar por encima de dos workers en esta fase.
- No agregar dependencias.
- Preservar `frontend/package-lock.json`.

---

### Task 1: Proteger la configuración con pruebas RED

**Files:**
- Modify: `frontend/scripts/segmented-tests-lib.test.mjs`
- Test: `frontend/scripts/segmented-tests-lib.test.mjs`

- [x] Añadir una prueba para `buildVitestArgs` que exija `forks`, dos workers,
  paralelismo por archivo, reporter JSON, output y timeout.
- [x] Añadir una prueba contractual que exija que `test:full:windows` delegue en
  `npm run test:segmented`.
- [x] Ejecutar `node --test scripts/segmented-tests-lib.test.mjs` y observar RED.

### Task 2: Implementar el runner paralelo acotado

**Files:**
- Modify: `frontend/scripts/segmented-tests-lib.mjs`
- Modify: `frontend/scripts/run-segmented-tests.mjs`
- Modify: `frontend/package.json`

- [x] Exportar `buildVitestArgs(vitestCli, files, outputPath)`.
- [x] Usar la función desde el runner y eliminar los flags duplicados.
- [x] Convertir `test:full:windows` en alias de `test:segmented`.
- [x] Ejecutar la prueba nativa y observar GREEN.

### Task 3: Certificar rendimiento y calidad

**Files:**
- Modify: `docs/frontend-final-certification.md`
- Modify: este plan para marcar pasos completados.

- [x] Ejecutar `npm run test:segmented` y comprobar 138/138 archivos, 12/12
  segmentos, cero fallos y cero archivos sin reporte.
- [x] Comparar la duración con 1,896.3 s y documentar la mejora.
- [x] Ejecutar `npm run typecheck`, `npm run lint`, `npm run build` y
  `npm run budget:bundle`.
- [x] Ejecutar `git diff --check`, revisar el diff y confirmar que el lockfile
  ajeno no está staged.
- [x] Crear el commit `test(frontend): speed up segmented Windows suite`.
