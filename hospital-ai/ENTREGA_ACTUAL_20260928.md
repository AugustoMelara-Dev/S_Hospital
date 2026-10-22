# S_Hospital — entrega y comprobaciones actuales

Actualizado el 22 de octubre de 2026. Rama de trabajo: `release/entrega-20261021`, en `C:\Projects\S_Hospital_AI`. El árbol original `C:\Projects\S_Hospital` permanece intacto.

**La entrega está en validación.** El candidato objetivo es `.8`; este documento no publica todavía un ejecutable ni un hash nuevo. No use los candidatos `.2`–`.7` como entrega de la identidad dark y los impuestos actuales.

## Producto y destino

Dos hospitales, cada uno con instalación, datos, identidad, catálogo, impuestos y usuarios propios. El producto se identifica como **S_Hospital** hasta configurar la institución. La operación habitual es local en una computadora Windows, sin internet, mediante Edge en modo app. MariaDB, PHP y Caddy van en el instalador.

El catálogo semilla parte exento y se debe revisar antes de cobrar. Cada concepto tiene su tasa; sin tasa es exento. La importación/exportación CSV/XLSX permite preparar un catálogo por hospital. El backend calcula los totales y conserva snapshots de las facturas históricas.

La gratuidad por receta/diálisis es exclusiva de la línea elegible de eritropoyetina. El recibo institucional conserva nombre del paciente y desglose de impuestos; 80 y 58 mm son formatos térmicos secundarios.

## Evidencia y estado de cierre

La [auditoría de entrega](evidencia/ENTREGA-20261021/AUDITORIA_CLAUDE.md) y la evidencia de cada fase registran resultados y commits. Los gates heredados del relevo no se atribuyen a la validación final del código en curso.

| Bloque | Estado de este corte |
| --- | --- |
| Consolidación e impuestos configurables | Implementados en la rama según la auditoría; requieren gates finales tras integración |
| Backend MariaDB 11.4 del payload | A-11 y omitidos A-09 en validación; no se declara aprobado |
| Recibos | Carta, media carta y 80 mm aprobados en la revisión previa; residual 58 mm A-10 en corrección y regeneración |
| Frontend y recorrido por rol | Gate final, mock y recorrido del build de producción en el stack real pendientes de evidencia final |
| Exportación Excel H-07 | Pendiente medición de 100 facturas en el servidor real |
| Instalador `.8` | Pendientes build, suites PowerShell 5.1, SHA-256 y manifiesto finales |
| Actualización instalada `.6` → `.8` | Pendiente F5, con UAC del propietario |
| Guía | [Procedimiento actualizado](GUIA_UNA_COMPUTADORA.md); su contenido no certifica la instalación |

La instalación `.6` existente en esta PC es ajena al laboratorio: falló al preparar el administrador inicial y sirve la interfaz anterior. Solo se intervendrá mediante el instalador nuevo en F5. No constituye evidencia de que el candidato actual funcione instalado.

## No verificado para la entrega actual

1. Gates completos después de integrar todos los cambios: frontend, SQLite, MariaDB 11.4, omitidos con motivo y concurrencia real de dinero/numeración.
2. Recorrido completo admin/supervisor/cajero sobre build de producción con Caddy + PHP-FCGI 8.3 + MariaDB 11.4: cobros, gratuidades, anulación, reimpresión, arqueo/cierre, reportes y respaldos.
3. Rendimiento Excel con 100 facturas y conciliación de PDF/Excel con el mismo filtro API.
4. Render final de los cuatro formatos y revisión del residual de totales de seis cifras en 58 mm.
5. Construcción y hash del instalador `.8`, contenido final del payload y suites nativas/certificación en PowerShell 5.1.
6. F5 en esta PC: actualización/reparación desde `.6`, administrador y respaldo inicial, servicios con cuentas correctas, acceso directo, reinicio de Windows y arranque posterior; actualización adicional `.8.1` con datos conservados.
7. Instalación desde cero en Windows limpio. Esta PC de desarrollo no equivale a Windows limpio. VirtualBox está instalado, pero no hay VM Windows registrada ni imagen disponible para F6; falta preparar ese entorno o registrar la prueba en una PC del hospital.
8. Impresión física en impresoras del hospital: carta/media carta y térmicas 80/58 mm, tamaño real 100 %, sin encabezados/pies y sin cortes.
9. Configuración y aprobación por cada hospital de identidad/logo, CAI/rango, catálogo, tasas y usuarios; copia externa y restauración de prueba con su responsable.
10. Firma Authenticode: **no incluida en esta entrega**, por decisión del propietario. El aviso de SmartScreen se explica en la guía; no se considera una validación de firma pendiente que el equipo de desarrollo vaya a ejecutar.

La evidencia de laboratorio usa datos sintéticos. La prueba de una copia concreta no certifica cualquier respaldo posterior. Un PDF inspeccionado tampoco certifica una impresión física.

## Referencias

- [Guía de instalación, configuración, impresión y recuperación](GUIA_UNA_COMPUTADORA.md).
- [Plan de cierre y orden de integración](PLAN_CODEX_GPT61_20261022.md).
- [Fases y decisiones del propietario](PLAN_DEEPSEEK_ENTREGA_20261021.md).
- [Auditoría y resolución por commit](evidencia/ENTREGA-20261021/AUDITORIA_CLAUDE.md).

Los informes de septiembre conservan valor histórico para sus propios assets y candidatos. Sus capturas azul/blanco, hashes y recorridos no certifican la versión dark actual.
