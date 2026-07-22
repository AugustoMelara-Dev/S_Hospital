# Auditoría Manual UI/UX - 00 Baseline

- **Fecha**: 2026-07-22
- **Repositorio**: `C:\Projects\S_Hospital`
- **Rama**: `main`
- **Commit Inicial**: `8db5d4c4e725300f93c902cec613dbf9bf588b13`
- **Parche de Seguridad**: `working_tree_safety.patch`
- **URL Desplegada**: `http://127.0.0.1:8282`
- **Servicio Backend**: Laravel 11 en Docker
- **Servicio Frontend**: React 19 + TypeScript + Vite en Docker
- **Base de Datos**: MariaDB 11 en Docker (`127.0.0.1:3307`)

## Estado del Entorno Inicial

| Componente | Comando | Estado | Notas |
| --- | --- | --- | --- |
| Docker Compose | `docker compose ps` | OK | Contenedores activos |
| HTTP Web | `curl.exe -s -I http://127.0.0.1:8282` | 200 OK | Nginx + PHP-FPM / Vite |
| Frontend Typecheck | `pnpm run typecheck` | PASS | `tsc --noEmit` sin errores |
| Backend Unit Tests | `php artisan test` | PASS | Pruebas unitarias de dominio pasando |
