# Fuentes y separación de evidencia

Consulta de documentación pública: **13 de septiembre de 2026**. Usar las guías actuales de la versión instalada si cambian. No se garantiza que una beta/fork implemente todas las funciones documentadas.

## A. Fuente del proyecto

`AUDITORIA_ORIGINAL.txt`: copia íntegra del informe suministrado por el usuario. Referencias destacadas a sus líneas originales:

- 5–11: fortalezas y bloqueadores generales.
- 19–33: HEAD, estado local y evidencia histórica.
- 143 y 540–549: contradicción de permiso EPO, no política hospitalaria confirmada.
- 199–224 y 482–492: copias, ruta inaccesible y reimpresión.
- 214: riesgo de números ya impresos después de restaurar un backup anterior.
- 471–530: recuperación, preflight, shortcut y CI MariaDB.
- 550–558: certificación Windows pendiente.
- 843–852 y 952: límites: no se ejecutaron tests, E2E ni contenedores en la auditoría.

Los hallazgos deben revalidarse en el repo actual. Reparto de especialistas, prioridades propuestas, contratos visuales y números de concurrencia son decisiones de diseño de este paquete, no resultados observados en el hospital.

## B. OpenCode — documentación primaria

1. Agentes: `https://opencode.ai/docs/agents/`
   Define primary/subagent, perfiles personalizados Markdown en `.opencode/agents/`, nombre por archivo, invocación, herencia del modelo al omitir `model`, `permission.task` y `steps`. No confundir los subagentes incorporados con un límite de perfiles.

2. CLI: `https://opencode.ai/docs/cli/`
   Referencia de `agent list`, `models`, selección de agente y variables experimentales. La referencia consultada distingue `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` de `OPENCODE_EXPERIMENTAL_PARALLEL`, asociado a búsqueda web. Disponibilidad real a comprobar por versión.

3. Comandos: `https://opencode.ai/docs/commands/`
   Comandos Markdown bajo `.opencode/commands/`, frontmatter `agent` e inclusión de archivos con `@ruta`.

4. Permisos: `https://opencode.ai/docs/permissions/`
   Acciones allow/ask/deny, reglas por patrón y prioridad del último patrón coincidente. Estos controles no se presentan aquí como aislamiento de procesos o datos.

5. Configuración y esquema: `https://opencode.ai/docs/config/` y `https://opencode.ai/config.json`
   Configuración por capas y campos del producto. No se encontró una opción documentada `maxAgents`/`maxParallel` para imponer los números propuestos. `subagent_depth`, donde existe, es profundidad, no cantidad de tareas simultáneas. El paquete evita reemplazar el archivo de configuración del usuario.

## C. DeepSeek — documentación primaria

6. Integración con agentes de programación: `https://api-docs.deepseek.com/guides/coding_agents/`
   La guía consultada incluye DeepSeek-V4.1-Flash en OpenCode y recomienda versión 1.14.24 o superior. Esa es una recomendación de compatibilidad, no la identificación del último release. El ID exacto se obtiene de la instalación del usuario; el paquete no lo presupone.

## D. Anthropic — principios de coordinación

7. Sistema de investigación multiagente: `https://www.anthropic.com/engineering/multi-agent-research-system`
   Fundamenta separar encargos independientes, dar objetivos/resultados explícitos y controlar coordinación y recursos. La composición de doce especialistas y el límite operativo 6/8 son propuestas propias, no cifras recomendadas por Anthropic para este repositorio.

8. Harness para aplicaciones de largo recorrido: `https://www.anthropic.com/engineering/harness-design-long-running-apps`
   Se tomó la separación entre planificación, generación y evaluación, y el uso de contratos de aceptación. No se importan herramientas de navegador ni permisos de ejecución por el hecho de que aparezcan en ese artículo.

9. Tareas largas: `https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents`
   Base para progreso persistente y continuidad entre contextos. No equivale a garantizar que un modelo termine autónomamente cualquier proyecto.

## E. OpenAI — principios de ejecución prolongada

10. Tareas de horizonte largo: `https://developers.openai.com/blog/run-long-horizon-tasks-with-codex`
    Se toma el ciclo planificar, modificar, verificar, observar, reparar y mantener estado durable. Las opciones de configuración de Codex no se aplican por analogía a OpenCode.

11. Worktrees: `https://developers.openai.com/codex/environments/git-worktrees`
    Fundamenta aislar cambios concurrentes del trabajo original. El instalador del paquete usa Git estándar, no requiere Codex. Un worktree no proporciona aislamiento de la base de datos.

## F. Qué NO se verificó en esta conversación

No se abrió el código real de S_Hospital. No se ejecutó OpenCode ni se observó el proveedor del usuario. No se instaló Windows, no se probó el EXE ni una impresora y no se ejecutaron tests del hospital. La verificación del paquete se describe por separado, con pruebas sintéticas del preparador y de su estructura.
