# Añadir otro especialista manualmente

Crea `.opencode/agents/hs-consulta.md` con este contenido, reinicia/recarga según tu versión y verifica que aparezca en `opencode agent list`:

```markdown
---
description: Consulta puntual de solo lectura sobre el proyecto, sin cambiar archivos.
mode: subagent
permission:
  edit: deny
  bash: deny
  task: deny
---
Responde la tarea recibida con evidencia de archivos. No cambies código, no expongas secretos ni inventes pruebas ejecutadas.
```

Se invoca desde el coordinador mediante Task o manualmente con `@hs-consulta`. El nombre proviene del archivo. No hay un modelo escrito para que herede el del padre. Este ejemplo no se instala como un decimocuarto agente; es una referencia para ampliar el equipo.

Fuentes: documentación oficial OpenCode, agentes y permisos, enlazada en FUENTES.md. Un contexto separado no crea automáticamente un worktree ni aísla bases de datos.
