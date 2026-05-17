# Branch Strategy

## Branch principal de trabajo

`feature/final-product-ux-rebuild`

## Sub-branches opcionales

- `feature/ui-app-shell`
- `feature/billing-pos-redesign`
- `feature/catalog-barcode-qr`
- `feature/advanced-reports`
- `test/final-ux-qa`

## Commits esperados

- `feat(ui): add app shell and module navigation`
- `feat(billing-ui): redesign invoice pos workflow`
- `feat(catalog): add barcode and qr lookup`
- `feat(reports): add advanced administrative analytics`
- `test(ui): harden final product experience`

## Reglas

- No mezclar backend + UI + reportes en un commit gigante.
- Cada fase debe pasar tests.
- Cada commit debe ser revisado con `prompts/06_COMMIT_REVIEW_FINAL_PRODUCT.md`.
