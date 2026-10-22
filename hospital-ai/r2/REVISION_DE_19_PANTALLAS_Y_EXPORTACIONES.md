# S_Hospital — revisión de los archivos realmente entregados

**Fecha:** 17 de septiembre de 2026. **Estado de esta entrega:** revisión, reproducción focalizada y contratos de reparación; NO es un refactor integrado ni una certificación del sistema.

## 1. Alcance comprobado y límites

Se revisaron las 19 capturas de `Shospital.pptx` y su representación en `Shospital.pdf`, las tres páginas de cada uno de los dos recibos, las tres páginas del reporte ejecutivo PDF y las diez hojas del XLSX. Para la UI se prefirieron las imágenes originales del PPTX: la representación del PDF comprime/deforma su proporción. No se infirió el tamaño real de fuentes de la aplicación a partir de esa representación.

Se midieron dimensiones y tamaños de texto de los PDF con PyMuPDF; se inspeccionó el XLSX con `artifact_tool` y se contrastaron valores, tipos y estilos contra su OOXML. No se utilizó OCR. Se consultó el repositorio conectado `AugustoMelara-Dev/S_Hospital`: `main` permanece en `baa41f97310a578f8fd417a1e9b4b5d06c380670`, del 2 de agosto. Ese código NO contiene el árbol local de C1 descrito por el usuario.

El checkpoint C1 más reciente se conoce por el mensaje del usuario, no por una copia de sus fuentes. Las afirmaciones sobre 204 capturas, reconstrucción 1994/1994 y MariaDB 11.4.3 nativo no se revalidaron aquí. La presente inspección abarca las 19 capturas adjuntas, no las otras capturas del laboratorio.

## 2. R2-MONEY-01 — total monetario convertido a cero

**Prioridad propuesta: P0, bloquea el uso del flujo de cobro mostrado.**

Las capturas 3–5 presentan subtotal L 910.00, impuesto L 136.50 y total L 0.00; la acción principal también anuncia cero. La captura 6 confirma servicios por L 850.00 y L 45.00, subtotal L 895.00 y total estimado L 0.00. No es una diferencia subjetiva de diseño.

En la revisión de código disponible se encontró esta cadena:

1. `frontend/src/features/invoices/state/posMath.ts`, `computeSimpleEstimate()`: calcula y devuelve `total: formatCentsFromMoneyCents(subtotal + tax)`.
2. `frontend/src/lib/moneyCents.ts`, `formatCents()`: llama al formateador visible y retira el prefijo `L`, pero deja el separador de miles. 102925 centavos se transforman en **`1,029.25`**.
3. `frontend/src/features/invoices/components/InvoiceCart.tsx`, `moneyLabel()`: pasa esa cadena de nuevo a `parseCents()`.
4. El parser de `moneyCents.ts` admite dígitos y punto decimal, no coma de miles. Devuelve `null`.
5. `formatLempirasUIFromCents(null)` lo presenta como **`L 0.00`**.

La reproducción de los cuerpos pertinentes, transcritos sin modificar su lógica de TypeScript a JavaScript, se ejecutó con Node. No es una ejecución de React ni del laboratorio del usuario.

| Centavos originales | Intermedio producido | Resultado al volver a parsear | Texto resultante |
|---:|---|---:|---|
| 99999 | `999.99` | 99999 | `L 999.99` |
| 100000 | `1,000.00` | null | `L 0.00` |
| 102925 | `1,029.25` | null | `L 0.00` |
| 104650 | `1,046.50` | null | `L 0.00` |
| 109825 | `1,098.25` | null | `L 0.00` |
| 249000 | `2,490.00` | null | `L 0.00` |

**Conclusión acotada:** el defecto está demostrado en la cadena del commit remoto y explica el patrón observado. Se debe comparar con los archivos locales C1 para atribuir la causa exacta a esa versión, antes de aplicar cambios. No se propone sobrescribir el worktree con archivos de agosto.

**Contrato de sustitución:** importes internos tipados en centavos o decimales canónicos, presentación localizada únicamente en la última capa, y estados inválidos/ausentes separados del cero legítimo. No resolver mediante `replace(',', '')` global, `Number(x) || 0`, `as any` ni fórmulas copiadas en cada componente. La autoridad de cálculo financiero permanece en el servidor.

## 3. Inventario visual, captura por captura

“Después” significa objetivo propuesto, NO cambio ya implementado. Los mismos defectos se agrupan bajo IDs comunes para no contarlos tres veces.

| Captura | Superficie | Antes observado | Después requerido / comprobación | Naturaleza |
|---:|---|---|---|---|
| 1 | Acceso | Tarjeta alta con separadores, aviso permanente de disponibilidad y pie reiterativo. | Acceso compacto: identidad, credenciales, acción y error contextual; comprobar teclado, recuperación y estados reales. | Rediseño. La imagen no demuestra un fallo de autenticación. |
| 2 | Inicio | Resumen y “próxima acción” ocupan grandes superficies; jerarquía repetida antes de la actividad. | Una franja operativa útil, acciones prioritarias y actividad legible; evitar contenedores vacíos dentro de otros. | Rediseño. Las cuatro facturas de L 17.25 suman los L 69.00 mostrados en ese momento. |
| 3 | POS, tres líneas | Subtotal 910.00 + impuesto 136.50, total y acción en cero; servicios por debajo del primer viewport. | Resolver R2-MONEY-01; paciente compacto, búsqueda/catálogo disponibles de inmediato y resumen estable. | Defecto funcional + estructura. |
| 4 | POS, búsqueda enfocada | Mismo total falso y elevada ocupación de espacio por filtros; carrito con scroll anidado. | Misma reparación monetaria; foco visible sin sacrificar área de trabajo; filtros compactos. | Misma causa, no otro bug monetario independiente. |
| 5 | POS, carrito desplazado | El scroll permite ver muy pocas líneas completas; total sigue en cero. | Filas compactas con cantidad, precio unitario e importe inequívocos, total y acción estables. | Operabilidad y R2-MONEY-01. |
| 6 | Confirmación breve | Servicios 850+45; subtotal895; total0; mensaje aplaza el valor definitivo hasta emitir. | Confirmar un importe verificado antes de la emisión/cobro; si no está disponible, mostrar estado no disponible y bloquear esa acción. | P0 del flujo mostrado. No ocultarlo con una advertencia. |
| 7 | Confirmación extensa | Encabezado y acciones fuera de la región visible; subtotal/total0; “2.00 x Anti D” junto a850 no distingue precio unitario de importe. | Diálogo acotado al viewport con contenido desplazable y acciones accesibles; separar cantidad/precio/importe y probar cantidades. | Clipping visible; semántica de850 debe verificarse, no asumir cobro incorrecto. |
| 8 | Caja | Fecha se rompe entre “p.” y “m.”; resumen compacto frente a superficies muy grandes. | Fecha local legible, conciliación por caja/turno y navegación de operaciones coherente. | Rediseño. 100+1098.25=1198.25 es consistente en esta muestra. |
| 9 | Catálogo | Cuatro etiquetas repetitivas de estado por servicio, cabecera y filtros muy altos. | Tabla de trabajo: estado resumido y excepciones relevantes; detalles secundarios al abrir el servicio. | Densidad/jerarquía, no fallo probado del CRUD. |
| 10 | Historial | Títulos/contenedores repetidos, filtro con ejemplo de numeración ajeno al formato mostrado, menú de acciones poco explícito. | Búsqueda acorde a los identificadores, tabla canónica, detalle y acciones por estado/permisos. | UX. Los cinco totales visibles reconcilian con los reportes. |
| 11 | Respaldos | Tres indicadores “No disponible” repiten explicación; simultáneamente aparece “Sin pendientes de preparación detectados”; historial vacío. | Estado fiable: desconocido, sin respaldo, operativo, fallido y recuperable deben distinguirse. Cargar resumen autorizado real, no inferir salud del vacío. | Comunicación de estado; no se ejecutó una restauración desde la imagen. |
| 12 | Reportes | Tarjetas de navegación, filtros, período y otra cabecera preceden la información principal. La pestaña Consolidado ya existe. | Barra de navegación/filtros compacta, métricas pertinentes primero; mismo contrato en pantalla/PDF/XLSX. | Rediseño. No volver a registrar Consolidado como ruta inexistente. |
| 13 | Usuarios | “Roles editables” convive con “Roles en modo consulta”; contadores consumen altura antes del directorio. | Copy basado en capacidades efectivas y controles autorizados claros; tabla primaria. | Contradicción de comunicación posible; comprobar permisos antes de declararlo bypass/denegación errónea. |
| 14 | Papel y copias | Selector “Copias” vacío, preview de media carta y opciones térmicas muy prominentes. | Enum y formulario sincronizados, valor legible, perfil efectivo explícito; formatos habituales arriba, compatibilidad avanzada aparte. | Defecto de formulario visible; causa requiere rastrear DTO/estado. |
| 15 | Preview | Se apilan copias pequeñas dentro de otro scroll; muestra el perfil guardado mientras hay cambios sin guardar. | Preview de documento real por página, ajuste a ancho/zoom, borrador separado del perfil guardado; sin consumir numeración. | Flujo confuso y legibilidad. No asumir que el backend consumió correlativo. |
| 16 | Serie | Exposición directa de formato técnico y correlativo; texto administrativo prolijo. | Vista normal legible y avanzada controlada; ejemplo del número resultante, permisos, motivo y validación. | Simplificación. `{series}` usa REC-A: el prefijo RA no prueba aquí un número incorrecto. |
| 17 | Ayuda, inicio | Icono de búsqueda desalineado; bloques extensos y texto que habla del “rail” de navegación. | Búsqueda alineada, tareas concretas, ayuda local contextual; retirar jerga de implementación. | Defecto visual/copy. |
| 18 | Ayuda, tareas | Acordeones muy grandes para instrucciones cortas; menciona estados de respaldo distintos de los de la captura11. | Ayuda organizada por tarea y vinculada a los estados reales. | Desincronización de documentación visible + densidad. |
| 19 | Ayuda, roles | Repetición de tarjetas y contenido amplio; instrucciones de recuperación genéricas. | Ayuda de problemas y responsabilidades compacta, rutas verificadas y contexto del usuario. | Rediseño. No retirar salvaguardas por abreviar texto. |

Las imágenes no demuestran duración de animaciones, existencia de handlers, persistencia de cambios, lector de pantalla o contraste CSS medido. Esas pruebas requieren la aplicación actual; no se declararon ejecutadas aquí.

## 4. Los dos recibos efectivamente descargados

Los seis MediaBox medidos son **612 × 396 puntos**, rotación0; equivalen a **215.9 × 139.7 mm**, media carta horizontal. No son carta vertical612×792. Las páginas tienen texto entre **5.2 y8.5 puntos**; numerosos campos principales están en6.7.

| Archivo | Páginas | SHA-256 |
|---|---:|---|
| `recibo-institucional-REC-A-00000005.pdf` | 3 | `98a04257f846a4a85cde2a47d05ab9421dcd37ac5883d7e2e5e34b980b9574a8` |
| `recibo-institucional-REC-A-00000005 (1).pdf` | 3 | `e61cb4ec7e962d4be63f35de24da2ac0f113d3ae42541590bd479c0467961d96` |

Los archivos binarios son distintos; sus renders a2x resultaron píxel a píxel iguales en las tres páginas correspondientes. El sufijo `(1)` no permite inferir que se usó la acción de reimpresión: puede ser otra descarga del mismo documento. Ambos muestran ORIGINAL/PRIMERA/SEGUNDA COPIA, sin marca visible de REIMPRESIÓN.

El contenido incluye `VALIDACION-CAI` y un cajero de validación, pero carece del aviso de prueba grande que sí muestra el preview. La configuración de laboratorio debe ser inequívoca y no producir documentos que aparenten haber sido emitidos con una autorización fiscal real. Los valores institucionales no se verificaron ante ninguna autoridad.

La aritmética del recibo adjunto sí reconcilia bajo el 15 % que figura en él: 850+45=895; impuesto134.25; total1029.25. Eso no confirma que15% sea el tratamiento fiscal correcto para el hospital. El problema observado es que el paso de confirmación mostraba cero antes de ese resultado.

**Reparación de producto, no del archivo exportado:** rastrear formulario → API → perfil guardado → asignación por puesto/usuario/global → snapshot del nuevo documento → renderer. Probar carta vertical desde el flujo normal de una factura nueva, no solo llamando a `PaperSize` con un perfil de prueba. Conservar los snapshots históricos; cambiar el default no debe reescribir recibos ya emitidos.

## 5. Reporte PDF y XLSX

### PDF ejecutivo

Tres páginas A4, MediaBox595.28×841.89. Los importes de esta muestra reconcilian: 1029.25 + 4×17.25 =1098.25; promedio1098.25/5=219.65; apertura100 + cobrado1098.25=1198.25.

Problemas visibles: días sin actividad ocupan gran parte del documento; la sección “POR ÁREA” y sus encabezados quedan al final de la página2 y las filas en la3; la sesión exporta `open` y una fecha ISO en lugar de presentación local; “RECIBOS” se define como “Pagos contabilizados”, distinción que debe probarse con pagos parciales y no resolverse asumiendo que siempre son equivalentes.

Reorganizar resumen y anexos sin ocultar información: los días en cero pueden conservarse en un detalle explícito; cada bloque debe tener título, encabezado y al menos una fila en la misma página. Repetir encabezados en continuaciones. Usar componentes de impresión compatibles con el motor real.

### XLSX: verificación de diez hojas

| Hoja | Resultado de inspección de datos/formato |
|---|---|
| Resumen | Montos de muestra correctos. La zona de datos usa estilo de encabezado oscuro; B13 guarda5 pero formato`#,##0.00` lo presenta5.00. Separar conteos, moneda y variaciones. |
| Cobros por metodo | D4 guarda1 con formato General: Efectivo muestra1, no100%. D8 también guarda1 pero tiene`0.00%` y muestra100.00%. La primera fila de datos hereda estilo de encabezado. |
| Facturado diario | Serie incluye días sin movimiento; agregado de la muestra coherente. Mantener datos completos y mejorar filtros/encabezados; no llenar un reporte ejecutivo impreso con todos los ceros por defecto. |
| Servicios | Montos por servicio/categoría de la muestra consistentes. Uniformar tablas y formatos de cantidad/importes, sin duplicaciones confusas del layout. |
| Cajeros | Muestra un cajero y valores coherentes. Añadir/confirmar ámbito y período cuando se prueben múltiples responsables; no validar multicaja con esta única fila. |
| Caja | La fecha de apertura es una cadena ISO y el estado`open`; faltan identificadores explícitos de caja física y sesión en las columnas exportadas. Necesita identificación inequívoca en modo multi-caja. |
| Pendientes | Sin saldos abiertos en la muestra. No demuestra antigüedad correcta; necesita fixture con saldos y bordes de período. |
| Anulaciones y reversas | Sin filas en esta muestra. No demuestra cálculos ni exclusiones en presencia de anulaciones. |
| Auditoria | Conteos cero de la muestra; no demuestra que todos los eventos estén registrados. Revisar con acciones reales de laboratorio. |
| Glosario | Llama “nueva emisión” a la reimpresión. Aclarar solicitud adicional del mismo comprobante, sin nueva factura/correlativo. |

La inspección no encontró fórmulas: es una exportación estática, no necesariamente un defecto. La representación XML del promedio puede contener precisión binaria adicional; el valor mostrado219.65 no demuestra corrupción financiera. No se modificó el XLSX original: la corrección necesaria es su generador para que todas las exportaciones futuras salgan bien.

## 6. Qué exigen las skills y qué no prueban

Se leyeron los SKILL.md originales de `better-ui` y `emil-design-eng`. Better UI prescribe acabado e inspección de estados y deriva explícitamente tipografía, layout y accesibilidad a otras guías. Su preferencia normal por preservar el sistema visual existente no invalida la petición explícita del usuario de reemplazar el diseño global. Emil enfatiza comportamiento previsible, buenos valores iniciales y movimiento proporcional a la frecuencia de uso.

La comparación de0.96 contra0.97 no es una medida de calidad del producto. Esta revisión exige cambios estructurales, consistencia monetaria y comportamiento observable; ningún radio, sombra o animación compensa un cobro con total falso. No se infiere desde capturas que una transición específica esté implementada o ausente.

## 7. Evidencia entregada y acciones sobre código

`pruebas/reproduccion_aislada.mjs`: reproduce la cadena histórica y contrasta una serialización no localizada. Sus12 casos válidos y7 rechazos describen solo esa demostración.

`pruebas/verificar_contrato_monetario.cjs`: diagnóstico para leer los tres módulos actuales desde un checkout local con TypeScript ya instalado. No escribe archivos ni accede a bases. Devuelve1 ante discrepancias;2 si el contrato cambió o no puede ejecutarse;0 solo significa que esos casos pasan. Se probó el diagnóstico en un fixture sintético:4 discrepancias detectadas;0 después de cambiar la serialización del fixture; rechazo de contrato incompatible. No fue ejecutado contra C1.

**No se modificaron fuentes del hospital, GitHub, Windows, servicios, bases, perfiles ni artefactos de entrega.** Para integración real hace falta la copia reconstruible actual de C1 con su manifiesto, no el `main` antiguo ni otro resumen de pruebas. Mientras se obtiene, OpenCode puede ejecutar el contrato de refactor incluido sobre su worktree actual.

## Fuentes técnicas consultadas

- Better UI: https://raw.githubusercontent.com/jakubkrehel/skills/main/skills/better-ui/SKILL.md
- Emil Design Engineering: https://raw.githubusercontent.com/emilkowalski/skills/main/skills/emil-design-eng/SKILL.md
- React, estructura del estado: https://react.dev/learn/choosing-the-state-structure
- W3C, prevención de errores financieros: https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html
- Dompdf, capacidades y limitaciones: https://github.com/dompdf/dompdf
- PhpSpreadsheet, formatos numéricos: https://phpspreadsheet.readthedocs.io/en/latest/topics/Behind%20the%20Mask/
- Playwright, assertions: https://playwright.dev/docs/test-assertions
- Microsoft, comandos WSL: https://learn.microsoft.com/en-us/windows/wsl/basic-commands

Código revisado mediante el conector GitHub, fijado a la revisión indicada: `frontend/src/lib/money.ts`, `frontend/src/lib/moneyCents.ts`, `frontend/src/features/invoices/state/posMath.ts`, `frontend/src/features/invoices/components/InvoiceCart.tsx` y `NewInvoiceView.tsx`. Los paths son evidencia de ese commit y puntos de búsqueda para C1, no líneas actuales presumidas.
