# Protocolo de commits por fase

## Commit ideal
- Cambia una fase o subfase.
- Incluye tests.
- Pasa quality gate.
- Tiene mensaje Conventional Commit.
- Puede revertirse sin romper módulos no relacionados.

## Ejemplo de fases/commits
1. chore(devex): add docker compose and project bootstrap
2. feat(auth): implement local login and roles
3. feat(catalog): add categories services and seed hospital prices
4. feat(billing): create invoice transaction and item snapshots
5. feat(cashbox): implement open close cash session
6. feat(payments): register payment and cash movements
7. feat(printing): add thermal receipt preview and print css
8. feat(reports): add daily income reports
9. feat(backups): add backup and restore commands
10. test(e2e): cover billing cashbox receipt flow
