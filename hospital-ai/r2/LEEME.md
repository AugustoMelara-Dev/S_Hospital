# Qué contiene esta entrega

No es el sistema reparado ni un instalador. Contiene una revisión de los archivos entregados, una causa monetaria reproducida, un diagnóstico ejecutable y un contrato de refactor para la copia local actual.

- `REVISION_DE_19_PANTALLAS_Y_EXPORTACIONES.md`: inventario de las 19 capturas, recibos y diez hojas del Excel; distingue hechos, hipótesis y propuestas.
- `REFACTOR_R2_PARA_OPENCODE.md`: instrucciones de intervención sobre C1, con cambios estructurales y criterios de aceptación. No sobrescribe fuentes por sí mismo.
- `pruebas/reproduccion_aislada.mjs`: fragmentos relevantes del commit remoto, transcritos sin modificar su lógica; reproduce el cero al cruzar mil lempiras. Incluye una demostración de serialización canónica, no un cambio aplicado a C1.
- `pruebas/verificar_contrato_monetario.cjs`: lee y ejecuta los módulos monetarios del checkout que se indique; no edita archivos ni accede a la base de datos. Requiere TypeScript ya instalado en `frontend`. Devuelve 1 si reproduce discrepancias y 2 si las firmas/dependencias cambiaron. Su prueba aquí fue sobre un fixture sintético, no sobre tu Windows.
- `evidencia/`: resultados de la reproducción y del diagnóstico sintético; dimensiones de PDF y estilos de celdas medidos.
- `MANIFIESTO.json`: tamaños y hashes completos de esta entrega. No identifica el código C1 del hospital.

## Uso en el checkout local actual

El coordinador debe leer primero el checkpoint C1 y su evidencia guardada. Después puede ejecutar, desde la carpeta extraída:

```powershell
node .\pruebas\verificar_contrato_monetario.cjs --repo "C:\Projects\S_Hospital_AI"
```

Una salida 0 solo acredita los casos concretos del contrato heredado. Si el refactor ya cambió las firmas, no se debe revertir para que pase este diagnóstico: se necesitan las pruebas equivalentes del contrato nuevo.

Para reproducir la investigación aislada, sin ninguna carpeta del hospital:

```powershell
node .\pruebas\reproduccion_aislada.mjs
```

Para encargar la intervención a OpenCode, copia el contenido completo de `REFACTOR_R2_PARA_OPENCODE.md` en la sesión del coordinador y proporciona también `REVISION_DE_19_PANTALLAS_Y_EXPORTACIONES.md`. Mantén el worktree y el modelo actual. No reinstales los agentes ni repitas la auditoría original.

## Alcance técnico de lo comprobado aquí

Inspección de los adjuntos, consulta del commit remoto `baa41f97310a578f8fd417a1e9b4b5d06c380670`, ejecución de la reproducción monetaria en Node y pruebas del diagnóstico en un fixture. No se inició el laboratorio del usuario, no se modificó C1, no se ejecutaron sus suites ni se verificó una impresora física.

La reparación integrada necesita las fuentes actuales reconstruibles. No sustituirlas por el `main` de agosto ni incluir `.env`, claves, datos hospitalarios o dependencias instaladas en una exportación de fuentes.
