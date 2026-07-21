# Revisión de seguridad

Fecha: 2026-07-21.

## Controles presentes

Sanctum stateful, CSRF, cookies/sesiones de Laravel, rate limiting por usuario, bloqueo de login, cambio obligatorio de contraseña, cabeceras de seguridad, saneamiento de excepciones productivas, Policies/Gates, auditoría de permisos, idempotencia y validación de archivos/entradas mediante Form Requests.

Los backups registran checksum y cifrado. Los reportes Excel tienen sanitización de fórmulas; los documentos oficiales se generan desde snapshots y no exponen tokens ni secretos. La búsqueda de URLs externas en código productivo sólo encontró ejemplos LAN de OpenAPI y namespaces SVG, no dependencias CDN.

## Cadena de suministro

Hallazgo inicial: `npm audit --omit=dev --json` devolvió 1 vulnerabilidad alta (`js-yaml 4.2.0`) y 3 moderadas transitivas del CLI shadcn. Corrección:

- override mínimo de `js-yaml` a `4.3.0` en ambos lockfiles;
- `shadcn` se clasificó como herramienta de desarrollo/construcción, no dependencia de runtime;
- no se utilizó `npm audit fix --force` ni se degradó shadcn;
- el bundle productivo continúa compilando componentes locales sin red.

Verificación posterior: `npm audit --omit=dev --json` = 0 vulnerabilidades, `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts` = código 0 y `scripts/security/supply-chain-check.ps1` = código 0, 0 findings/0 warnings.

## Riesgos residuales

El audit completo conserva tres advisories moderados en el CLI shadcn/MCP usado sólo durante desarrollo; la corrección publicada exige una combinación incompatible/downgrade según npm. No se ejecuta en la imagen final. Se mantiene documentado y se revisará cuando el SDK actualice su adaptador Hono sin override mayor inseguro.

La revisión no equivale a un pentest externo. La instalación limpia sobre el compose de producción y el ejercicio completo de backup cifrado/restauración se certificaron el 2026-07-21 en infraestructura aislada. Siguen pendientes únicamente la aceptación desde un segundo cliente de la LAN hospitalaria y la revisión física de impresoras y formatos de papel.
