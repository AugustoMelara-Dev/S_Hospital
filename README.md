# Hospital Billing OS - Codex Agentic Pack v3

Este paquete define un flujo agentic para que Codex implemente el sistema hospitalario con alta exigencia técnica.

## Cómo usarlo
1. Copiar `AGENTS.md` a la raíz del repo.
2. Copiar `prompts/`, `codex-skills/`, `subagents/`, `references/`, `workflows/`, `database/`, `qa/` y `devex/` al repo o adjuntarlos a Codex.
3. Pedir a Codex que empiece con `prompts/00_PLAN_MODE_MASTER_PROMPT.md`.
4. Revisar el plan con `prompts/01_PLAN_REVIEW_ORCHESTRATOR.md`.
5. Implementar fase por fase.
6. Revisar cada commit con `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md`.

## Filosofía
Plan primero, código después. Commit pequeño, revisión crítica, pruebas y avance controlado.
