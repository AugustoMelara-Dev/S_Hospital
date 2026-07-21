# Certificación integral de release — 2026-07-21

## Entorno certificado

- Rama: `codex/refactor-migration-integral-20260721`.
- Runtime: `docker-compose.prod.yml`, Nginx, PHP-FPM con OPcache, workers, Soketi y MariaDB aislada.
- Instalación: base vacía, 81 migraciones y seeders reproducibles.
- Frontend: bundle Vite servido por Nginx; todos los recursos de operación son locales.

El entorno de certificación utilizó volúmenes y credenciales desechables fuera del repositorio. No se reutilizó la base de desarrollo ni se modificaron sus sesiones de caja existentes.

## Flujos de producción con MariaDB real

`npm run test:e2e:release` finalizó 2/2 escenarios con código 0:

1. Cajero: login, apertura de caja, creación de factura, cobro, emisión y visualización de recibo institucional, consulta de reportes y cierre de caja (41,6 s).
2. Administrador: creación de cajero, cambio obligatorio de contraseña, navegación por rol y rechazo HTTP 403 del endpoint administrativo (18,0 s).

El navegador no registró errores de consola. La persistencia fue comprobada directamente en MariaDB: factura `999-001-99-00000001`, total 1.725 centavos, estado pagado, pago en efectivo posteado con usuario y fecha, sesión de caja cerrada, recibo emitido y un evento explícito de impresión.

Evidencia estructurada: `frontend/test-results/mariadb-release-prod-audit-20260721.json`.

## Hallazgos corregidos durante la certificación

- La respuesta tardía de `/auth/session` podía borrar un login ya completado. El bootstrap de sesión ahora ignora resultados obsoletos y tiene prueba de regresión.
- Los endpoints públicos compartían un bucket de rate limit por IP y podían bloquear un login válido después de los probes operativos. Se separaron `public-read`, `csp-report` y `auth-login`; el bloqueo por intentos fallidos conserva sus límites. Las pruebas focalizadas de autenticación, lockout, throttling, salud, CSP y broadcasting pasaron 46 casos / 302 aserciones.
- El archivo de respaldo se cifraba correctamente, pero su registro no reflejaba cifrado ni compresión. El flujo ahora persiste formato SQL, compresión gzip, indicador de cifrado y una huella SHA-256 no reversible de la clave. Las pruebas focalizadas de backups pasaron 30 casos / 156 aserciones.
- El acceso denegado renderizaba su título como `h2` aunque reemplaza una ruta completa. `PermissionGate` ahora entrega un único `h1` y cuenta con prueba de regresión.
- La evidencia de Soporte reutilizaba por error la respuesta avanzada de `/api/system/status` para `/api/system/status-summary`, lo que provocaba una recuperación fugaz de React. Se separaron ambos contratos en el mock, `/support` se incorporó a la matriz y el flujo de capturas ahora falla ante cualquier error real de consola, página o red.

## Respaldo y restauración

Se generó un respaldo manual real `*.sql.gz.enc` de 114.488 bytes con checksum SHA-256 y huella de clave de 64 caracteres. Se descifró y restauró en la base separada `hospital_restore_audit`.

| Tabla crítica | Origen | Restaurada |
|---|---:|---:|
| users | 4 | 4 |
| invoices | 1 | 1 |
| payments | 1 | 1 |
| institutional_receipts | 1 | 1 |

La factura pagada restaurada conserva 1.725 centavos. Los logs de auditoría son 208 en origen y 205 en el snapshot porque tres eventos ocurrieron después del dump; es la diferencia temporal esperada. El respaldo pendiente capturado por el dump quedó reconciliado como fallido al restaurar, evitando mostrar una operación eternamente en curso.

## Contratos de instalación y operación offline

Los siguientes gates pasaron con código 0:

- `scripts/production_readiness_preflight.test.ps1`;
- `scripts/offline_release_contract.test.ps1`;
- `scripts/docker_compose_dev_contract.test.ps1`;
- `scripts/test_installer_diagnostics.ps1` (16/16);
- `scripts/test_pre_commit_guard.ps1`;
- `scripts/lan_asset_discovery.test.ps1`.

El preflight exige evidencia de recibo y comprueba los workers de Docker. El contrato offline valida que el paquete contiene imágenes, manifiesto, checksums, configuración y scripts necesarios sin descargar dependencias durante la instalación destino.

## Gates finales de código y rendimiento

- Backend: `php artisan test` — código 0, 949 aprobadas, 7.165 aserciones y 12 omisiones justificadas, 728,73 s.
- Frontend: `npm run test:segmented` — código 0, 144 archivos, 1.093 aprobadas, 0 fallidas y 0 omitidas, 988,7 s.
- Pint: código 0, 452 archivos.
- Frontend build: código 0, Vite 8, 3.735 módulos, 23,48 s.
- Guards UI: 378 archivos sin librerías heredadas y 382 archivos conformes con las reglas shadcn.
- Bundle: código 0; inicio 213,8 KiB gzip frente a límite 488,3 KiB; total 525,9 KiB gzip frente a límite 1.123 KiB.
- Dependencias runtime: `npm audit --omit=dev --json` — código 0, 0 vulnerabilidades.
- Accesibilidad visible: 6/6 viewports, 84 auditorías de ruta/estado y 24 capturas funcionales; todos los JSON finales registran cero overflow horizontal, errores de consola, `pageerror` y solicitudes fallidas reales.

Después de reiniciar todos los contenedores del stack aislado, Nginx/API respondió HTTP 200, backend, MariaDB, Nginx y workers recuperaron estado saludable, Soketi completó su healthcheck y la factura `999-001-99-00000001` siguió presente en MariaDB.

## Alcance pendiente fuera del software

La certificación automatizada no sustituye la prueba física en carta, media carta, A5, 80 mm y 58 mm ni la aceptación desde una segunda computadora de la LAN hospitalaria. Esas dos actividades requieren el hardware y la red de destino; no representan un fallo conocido del código.
