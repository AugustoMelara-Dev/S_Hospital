# Regresión E2E del frontend

Fecha de corte: 2026-07-13

## Suite mockeada

```bash
cd frontend
npm run test:e2e:mock
```

No usa credenciales ni datos secretos. Ejecuta en Chromium los recorridos del
shell institucional, Facturación, Catálogo y Administración con las APIs
interceptadas explícitamente por cada spec. `npm run test:e2e` ejecuta como
mínimo esta suite y, por tanto, también funciona en CI sin secretos.

## Suite release

```powershell
cd frontend
$env:E2E_RELEASE_PASSWORD = '<secreto provisto fuera del repositorio>'
npm run test:e2e:release
```

También se admite `E2E_SEED_PASSWORD`. El runner nunca proporciona un valor por
defecto y falla antes de sembrar datos si ninguna de las dos variables existe.
La suite release levanta Laravel y Vite contra una base desechable preparada por
las migraciones y seeders reales. No se debe guardar el secreto en archivos
versionados, comandos de CI visibles ni capturas de evidencia.
