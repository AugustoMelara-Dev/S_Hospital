# S_Hospital — entrega y comprobaciones actuales

Actualizado el 25 de octubre de 2026. Rama de trabajo: `release/entrega-20261021`, en `C:\Projects\S_Hospital_AI`. El árbol original `C:\Projects\S_Hospital` permanece intacto.

**Candidato `.8` verificado en laboratorio y listo para la fase de instalación.** El kit está en `artifacts/ENTREGA-2026.10.24.8`. La instalación elevada, el reinicio y las comprobaciones físicas siguen pendientes. No use los candidatos `.2`–`.7` ni el primer `.8` sustituido como entrega final. La interfaz vigente es clara, blanca y azul; las referencias anteriores a una identidad exclusivamente dark son históricas.

Ejecutable: `S_Hospital-2026.10.24.8-Windows-x64.exe` (102,328,024 bytes).
SHA-256: `b91e2dddc1d9152466762228c5c333a70d205ee8fa0b44382726bb17d1a07a67`.
ReleaseId del payload: `2026.10.24.8-239966d4d5f0`.
Compilado desde el árbol con cambios sin commit; el hash de HEAD por sí solo
no reproduce esta entrega. `BUILD_RECEIPT.json` y el manifiesto identifican el
contenido exacto. El EXE no se ha ejecutado y no tiene firma Authenticode.

## Producto y destino

Dos hospitales, cada uno con instalación, datos, identidad, catálogo, impuestos y usuarios propios. El producto se identifica como **S_Hospital** hasta configurar la institución. La operación habitual es local en una computadora Windows, sin internet, mediante Edge en modo app. MariaDB, PHP y Caddy van en el instalador.

El catálogo semilla parte exento y se debe revisar antes de cobrar. Cada concepto tiene su tasa; sin tasa es exento. La importación/exportación CSV/XLSX permite preparar un catálogo por hospital. El backend calcula los totales y conserva snapshots de las facturas históricas.

La gratuidad por receta/diálisis es exclusiva de la línea elegible de eritropoyetina. El recibo institucional conserva nombre del paciente y desglose de impuestos; 80 y 58 mm son formatos térmicos secundarios.

## Evidencia y estado de cierre

El [informe de esta sesión](../docs/qa/2026-10-24-completion.md) registra resultados, repeticiones y límites del candidato actual. La [auditoría anterior](evidencia/ENTREGA-20261021/AUDITORIA_CLAUDE.md) conserva el historial. Los gates heredados del relevo no se atribuyen a la validación final del código en curso.

| Bloque | Estado de este corte |
| --- | --- |
| Consolidación e impuestos configurables | Flujo real de cobro, impuestos, EPO, reimpresión, anulación y cierre aprobado en laboratorio |
| Backend MariaDB 11.4 del payload | 1,496 aprobadas en global; nueve errores corregidos y repetición focal de 32 pruebas/526 aserciones aprobada en ambos motores; ocho pruebas de concurrencia real aprobadas |
| Recuperación | Respaldo cifrado restaurado en otra base: 16 tablas con conteos/hashes idénticos, recibo y serie poblados, lectura/escritura comprobada |
| Análisis estático | PHPStan y Pint globales finales aprobados; regresión focal del último guard de recibos aprobada |
| Recibos | 53 pruebas aprobadas y diez PDF renderizados en carta, media carta, A5, 80 y 58 mm; casos cortos de una página |
| Frontend y recorrido por rol | TypeScript, lint, build, 24 escenarios mock y regresión 409 aprobados; 13 escenarios reales únicos mediante corridas documentadas; 15 rutas en escritorio/móvil |
| Exportación Excel H-07 | 106 facturas: 2,565 / 1,399 / 1,511 ms, tres respuestas válidas; valores y estilos preservados |
| Instalador `.8` | Compilación final aprobada en 246.813 s; 34 suites PowerShell 5.1 aprobadas; manifiesto estricto de 8,806 archivos e higiene aprobados; SHA-256 final arriba |
| Instalación elevada y actualización desde versiones anteriores | Pendiente F5, con UAC del propietario; no hay instalación estándar activa detectada |
| Guía | [Procedimiento actualizado](GUIA_UNA_COMPUTADORA.md); su contenido no certifica la instalación |

Los informes iniciales con errores y omisiones se conservan junto a sus
repeticiones focales. No se afirma una segunda corrida global íntegra verde;
el informe de verificación detalla cada comprobación y sus límites.

El informe del 21 de octubre describía una instalación `.6` defectuosa. En la
comprobación de solo lectura del 25 de octubre **no existen** las rutas estándar
`C:\Program Files\S_Hospital` ni `C:\ProgramData\S_Hospital`, y no aparecen
servicios `SHospital*`. Los artefactos `.6` del repositorio son antecedentes,
no una instalación activa verificada. La instalación elevada del candidato
y el reinicio de Windows siguen pendientes.

## No verificado para la entrega actual

1. F5 en esta PC: instalación elevada, administrador y respaldo inicial, servicios con cuentas correctas, acceso directo, reinicio de Windows y arranque posterior. La actualización desde `.6` y una actualización adicional deben verificarse por separado con datos conservados. Las pruebas de ACL elevada y del instalador ejecutado tampoco se han corrido.
2. Instalación desde cero en Windows limpio. Esta PC de desarrollo no equivale a Windows limpio. Falta preparar ese entorno o registrar la prueba en una PC del hospital.
3. Impresión física en impresoras del hospital: carta/media carta/A5 y térmicas 80/58 mm, tamaño real 100 %, sin encabezados/pies y sin cortes.
4. Configuración y aprobación por cada hospital de identidad/logo, CAI/rango, catálogo, tasas y usuarios; copia externa y restauración de prueba con su responsable. La operación desde otro puesto LAN requiere validación separada.
5. Firma Authenticode: **no incluida en esta entrega**, por decisión del propietario. El aviso de SmartScreen se explica en la guía; no se considera una validación de firma pendiente que el equipo de desarrollo vaya a ejecutar.

La evidencia de laboratorio usa datos sintéticos. La prueba de una copia concreta no certifica cualquier respaldo posterior. Un PDF inspeccionado tampoco certifica una impresión física.

El runtime nativo no necesita Docker Desktop, servicios cloud ni suscripciones
obligatorias nuevas para operar. La licencia del proyecto permanece sin cambios.
El kit incluye el código fuente oficial de MariaDB 11.4.13 y su procedencia;
consérvelo con el instalador al distribuirlo. No se requiere compilarlo.

## Referencias

- [Guía de instalación, configuración, impresión y recuperación](GUIA_UNA_COMPUTADORA.md).
- [Plan de cierre y orden de integración](PLAN_CODEX_GPT61_20261022.md).
- [Fases y decisiones del propietario](PLAN_DEEPSEEK_ENTREGA_20261021.md).
- [Auditoría y resolución por commit](evidencia/ENTREGA-20261021/AUDITORIA_CLAUDE.md).

Los informes anteriores conservan valor histórico para sus propios assets y candidatos. Sus capturas, hashes y recorridos no certifican el código actual; consulte la evidencia de cada verificación.
