# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones [SemVer](https://semver.org/lang/es/).

## [2.0.0] — 2026-11-18

Reescritura completa del sistema.

### Cambiado
- Backend migrado de PHP/Laravel a **Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic**.
- Frontend reconstruido desde cero (React 19 + TypeScript + Tailwind 4) con nueva identidad visual "Mostrador clínico": modo claro y oscuro, fuentes empaquetadas para operar sin internet y paleta de comandos (Ctrl+K).
- Despliegue simplificado: una imagen única (API + SPA) y MariaDB 11.4 vía Docker Compose.
- Dinero almacenado exclusivamente en centavos enteros; tasas en puntos básicos.

### Conservado (reglas de negocio de v1)
- Numeración fiscal CAI con rango, vigencia y una sola secuencia activa.
- ISV por grupo de tasa con reparto por mayor residuo.
- Gratuidad de eritropoyetina por línea con receta de diálisis.
- Recibo institucional con serie propia, copias, reimpresión con motivo y monto en letras.
- Caja con apertura, arqueo por denominaciones, bloqueos de cierre y diferencia justificada.
- Auditoría de acciones sensibles, bloqueo de login por intentos y escrituras idempotentes.
- Catálogo inicial de 151 servicios.

### Eliminado
- Dependencias de Laravel (Sanctum, Spatie, DomPDF), workers de colas y servidor de websockets: la actualización de pantallas se hace por consulta periódica.
- Instalador nativo de Windows basado en PHP/WinSW. El despliegue soportado es Docker.
