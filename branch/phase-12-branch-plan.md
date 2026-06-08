# Phase 12 Branch Plan

## Regla

No empujar directo a main salvo hotfix explicito. Fase 12 debe trabajarse en ramas `codex/*` y PR.

## Ramas sugeridas

- `codex/phase-12a-app-shell-design-system`
- `codex/phase-12b-pos-billing-ux`
- `codex/phase-12c-catalog-service-identifiers`
- `codex/phase-12d-advanced-reports`
- `codex/phase-12e-final-ux-qa`

## Commits sugeridos

- `feat(ui): add app shell and sidebar navigation`
- `feat(billing): rebuild invoice screen as pos workflow`
- `feat(catalog): add scan code workflow for services`
- `feat(reports): add advanced management dashboard`
- `test(ux): add final product acceptance smoke coverage`

## Gates antes de push a main

- `php artisan test --colors=never`
- `npm run build`
- `php artisan config:cache`
- Validar `/up`, `/login` y `/verify-email`.

## Politica de alcance

Cada rama debe implementar una fase. No mezclar app shell, POS, catalogo y reportes en un solo commit gigante.
