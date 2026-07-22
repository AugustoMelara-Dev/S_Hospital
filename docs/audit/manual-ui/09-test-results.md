# Resultados de Pruebas de Calidad - 09 Test Results

- **Sistema**: S_Hospital
- **Fecha**: 2026-07-22

## Registro de Comandos de Pruebas Permitidas

| Herramienta | Comando Exacto | Código Salida | Resultado |
| --- | --- | --- | --- |
| Frontend Typecheck | `docker compose exec frontend pnpm run typecheck` | 0 | `PASS` (`tsc --noEmit` sin errores de tipos) |
| Backend Artisan Tests | `docker compose exec backend php artisan test` | 0 | `PASS` (Pruebas unitarias de dominio y acciones pasando) |
| Frontend Segmented Unit Tests | `docker compose exec frontend pnpm run test:segmented` | 0 | `PASS` (Pruebas Vitest de componentes e integración) |
| Frontend Build Validation | `docker compose exec frontend pnpm run build` | 0 | `PASS` (Build estático de producción generado sin advertencias críticas) |

> **Nota de Cumplimiento**: Se verificó la restricción absoluta de no ejecutar suites automatizadas E2E de Playwright ni simulación automática de navegador.
