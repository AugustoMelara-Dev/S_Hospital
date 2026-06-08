# Branch Strategy

## Branches principales de trabajo

Usar ramas `codex/*` y PR por fase. No empujar directo a `main` salvo hotfix explicito.

## Ramas sugeridas

- `codex/phase-12a-app-shell-design-system`
- `codex/phase-12b-pos-billing-ux`
- `codex/phase-12c-catalog-service-identifiers`
- `codex/phase-12d-advanced-reports`
- `codex/phase-12e-final-ux-qa`

## Commits esperados

- `feat(ui): add app shell and module navigation`
- `feat(billing-ui): redesign invoice pos workflow`
- `feat(catalog): polish service identifiers`
- `feat(reports): add advanced administrative analytics`
- `test(ui): harden final product experience`

## Reglas

- No mezclar backend + UI + reportes en un commit gigante.
- Cada fase debe pasar tests.
- Cada commit debe ser revisado con `prompts/06_COMMIT_REVIEW_FINAL_PRODUCT.md`.
