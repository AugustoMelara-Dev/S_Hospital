# Frontend Test Runner Performance Design

## Contexto

La regresión frontend completa se divide en 12 segmentos para evitar picos de
memoria en Windows y comprobar que cada archivo Vitest se ejecuta exactamente
una vez. Sin embargo, cada segmento fuerza un único proceso y desactiva el
paralelismo por archivo. La última certificación documentada tardó 1,896.3 s y
una medición actual no terminó dentro de 1,204 s.

Dos segmentos representativos muestran que el cuello de botella es el
paralelismo conservador:

- `billing`: 294.7 s con un fork frente a 140.0 s con dos forks (52.5 % menos).
- `reports-and-receipts`: 397.4 s con un fork frente a 111.6 s con dos forks
  (71.9 % menos).

Ambas ejecuciones paralelas conservaron exactamente 18 archivos, cero fallos y
245/142 tests, respectivamente.

## Objetivo

Reducir de forma material el tiempo de la suite frontend completa en Windows
sin perder cobertura, aislamiento por procesos, reportes por segmento ni la
validación exacta del manifiesto.

## Diseño aprobado

- Mantener los 12 segmentos y el pool `forks`.
- Ejecutar hasta dos archivos en paralelo mediante `--maxWorkers=2` y
  `--fileParallelism`.
- Centralizar la construcción de argumentos Vitest en una función pura y
  exportada para poder proteger la configuración con pruebas rápidas.
- Hacer que `test:full:windows` delegue en `test:segmented`, evitando dos
  definiciones divergentes de la regresión completa.
- Conservar el reporter JSON, el timeout de 30 s, la detección de archivos no
  cubiertos/duplicados/sin reporte y la ejecución secuencial entre segmentos.

## Alternativas descartadas

- `threads` con un worker: `billing` tardó 363.4 s, un 23.3 % más que el fork
  único de referencia, por lo que empeora el cuello de botella.
- Cuatro workers: podría reducir más el tiempo, pero duplica de nuevo la presión
  de memoria y aumenta el riesgo de inestabilidad en los equipos Windows que
  motivaron la segmentación. Se descarta hasta contar con evidencia de recursos
  y estabilidad suficiente.
- Volver a una sola invocación monolítica: elimina las garantías del manifiesto,
  dificulta localizar fallos y recupera el riesgo de agotamiento de memoria.

## Riesgos y mitigaciones

- **Mayor uso de memoria:** se limita a dos workers y solo un segmento se
  ejecuta a la vez.
- **Interferencia entre tests:** Vitest mantiene procesos separados; la suite
  completa debe aprobar los 138 archivos sin archivos omitidos ni fallidos.
- **Deriva de scripts:** `test:full:windows` será un alias del runner mantenido y
  una prueba contractual protegerá esa relación.
- **Cambio silencioso de flags:** la función pura tendrá pruebas sobre pool,
  workers, paralelismo, reporter, salida y timeout.

## Pruebas y aceptación

1. Las pruebas unitarias del manifiesto fallan antes de implementar la nueva
   función y el alias.
2. El runner usa dos forks, paralelismo por archivo y no incluye
   `--no-file-parallelism`.
3. `test:full:windows` delega en `test:segmented`.
4. La regresión completa aprueba 12 segmentos y los 138 archivos descubiertos,
   sin duplicados, archivos no cubiertos ni archivos sin reporte.
5. La duración total mejora al menos 30 % frente a los 1,896.3 s documentados.
6. TypeScript, ESLint, build y presupuesto de bundle continúan aprobando.
7. El cambio no modifica ni incluye `frontend/package-lock.json`.
