# Certificacion integrada 2026-07-19

Estado: `LOCAL_RELEASE_CANDIDATE`. La aplicacion no debe declararse
`PRODUCTION_READY` hasta completar la evidencia fisica de impresoras y la
aceptacion desde una computadora cliente de la LAN hospitalaria.

## Alcance certificado

- Frontend React 19/Tailwind 4 basado en shadcn/ui y Radix.
- Cero imports o dependencias runtime de Ant Design, AG Grid y ECharts.
- TanStack Table y Recharts encapsulados por patrones institucionales.
- Laravel y MariaDB reales, migrados desde una base vacia.
- Factura, pago, recibo institucional, reporte y cierre de caja.
- Alta de cajero, cambio obligatorio de clave y denegacion RBAC con HTTP 403.
- Cola `backups`, cola `default`, scheduler y healthcheck separados.

## Evidencia ejecutada

| Gate | Resultado |
|---|---|
| Suite Laravel completa posterior a integracion | 948 aprobadas; 0 fallos; 13 omitidas |
| Suite Laravel sobre MariaDB aislada | 957 casos; 0 fallos, 0 errores, 12 omitidos |
| Laravel Pint | PASS |
| PHPStan | PASS, 0 errores |
| Frontend unitario segmentado | 141 archivos; 1,083 pruebas; 12 segmentos |
| TypeScript / ESLint | PASS / PASS |
| Build y presupuesto de bundle | PASS |
| E2E mock | 49/49 |
| E2E real Laravel + MariaDB | 2/2; 0 errores de consola |
| PDFs automatizados | 18/18: Carta, Media Carta, A5, 80 mm, 58 mm y 190x140 mm; original y copias |
| Backup cifrado y descifrado | checksum verificado; SQL MariaDB valido |

El E2E real se ejecuto en el proyecto Docker aislado
`s_hospital_release_e2e`, despues de `migrate:fresh --seed`. El reporte generado
es `frontend/test-results/mariadb-release-e2e-report.json`; el resultado valido
tiene `database_driver=mysql`, ambos specs en `passed`, caja final `closed` y
acceso protegido con estado 403.

## Hallazgos corregidos

- El stack local instala frontend de forma reproducible con `npm ci` y conserva
  las dependencias opcionales Linux en el lockfile.
- El backup local recibe la clave de cifrado obligatoria.
- Los jobs de backup y tiempo real ya tienen workers independientes; el
  scheduler se ejecuta y deja latido.
- El preparador E2E siembra perfiles/serie de recibos, anula facturas E2E
  interrumpidas mediante el Action auditado y rota una caja completada solo
  cuando no existe otra caja heredada abierta.
- El formulario de usuarios ya no borra datos escritos cuando se refresca la
  lista de roles.
- Los selectores E2E siguen el nombre accesible real de shadcn y toleran una
  instalacion fria sin relajar las comprobaciones financieras o RBAC.

## Validaciones externas pendientes

1. Imprimir fisicamente Carta, Media Carta, A5, 80 mm y 58 mm con los drivers y
   equipos que usara el hospital. Completar
   `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` desde su plantilla.
2. Ejecutar desde otra computadora de la LAN `scripts/validate_lan_client.ps1`
   y completar `qa/LAN_CLIENT_VALIDATION_PROOF.md`.
3. Ejecutar el preflight final con `APP_ENV=production`, `APP_DEBUG=false`, IP
   fija, workers activos y evidencias firmadas.

Estas validaciones requieren hardware/red externos y no pueden sustituirse por
capturas o mocks locales.
