# Certificacion integrada 2026-07-19

Estado: `LOCAL_RELEASE_CANDIDATE`. La aplicacion no debe declararse
`PRODUCTION_READY` hasta completar la evidencia fisica de impresoras y la
aceptacion desde una computadora cliente de la LAN hospitalaria.

HEAD de codigo certificado: `a5d1dc90`. El commit documental que contiene este
registro no se usa como identificador autorreferencial.

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
| Suite Laravel completa posterior a integracion | PASS; 0 fallos; 952 aprobadas y 12 omitidas en la corrida integral vigente |
| Suite Laravel sobre MariaDB aislada | 957 casos; 0 fallos, 0 errores, 12 omitidos |
| Laravel Pint | PASS |
| PHPStan | PASS, 0 errores |
| Frontend unitario segmentado | 141 archivos; 1,083 pruebas; 12 segmentos |
| TypeScript / ESLint | PASS / PASS |
| Build y presupuesto de bundle | PASS |
| E2E mock | 49/49 |
| E2E real Laravel + MariaDB | 2/2; 0 errores de consola |
| PDFs automatizados | 18/18: Carta, Media Carta, A5, 80 mm, 58 mm y 190x140 mm; original y copias |
| Backup y restore MariaDB | checksum y descifrado verificados; 122 servicios, 5 roles y 81 migraciones preservados; 0 logs `pending` restaurados |
| Preflight del paquete Docker | Todos los gates locales aprobados; frontend servido, seis servicios requeridos y WebSocket 101 |
| Paquete offline | 6/6 imagenes cargadas desde TAR; checksums validos; manifiesto regenerado desde el commit de cierre vigente |

El E2E real se ejecuto en el proyecto Docker aislado
`s_hospital_final_e2e_20260719`, despues de `migrate:fresh --seed`. El reporte generado
es `frontend/test-results/mariadb-release-e2e-report.json`; el resultado valido
tiene `run_id=e1b0e76aab18435382f2295a12c83fbf`,
`database_driver=mysql`, ambos specs en `passed`, caja final `closed`, cero
problemas de consola y acceso protegido con estado 403.

El preflight se ejecuto sobre la distribucion offline en una pila de produccion
descartable con MariaDB nueva. `APP_ENV=production`, `APP_DEBUG=false`, Nginx,
backend, MariaDB, workers, scheduler, assets, rutas y Soketi aprobaron. Al usar
`-AllowMissingPhysicalProof`, el unico bloqueo restante fue precisamente la
evidencia fisica omitida; no aparecieron bloqueantes locales adicionales.

## Preflight de sitio 2026-07-21

- El smoke Chromium real contra `http://192.168.1.4:5174` aprobo login y todas
  las superficies operativas sin errores de consola. Las rutas `/up`, `/login`,
  `/verify-email` y `/api/system/echo-config` respondieron HTTP 200 usando la
  direccion LAN en lugar de loopback.
- Windows detecta la impresora fisica `L15150 Series(Network)`, con driver
  `EPSON L15150 Series` y estado `Normal`.
- La configuracion activa de la impresora es A4. El driver anuncia Carta,
  Statement/Media Carta y papel personalizado, pero no un perfil A5 explicito.
- La impresora responde a ICMP en `192.168.1.6`, pero durante el preflight no
  acepto conexiones en 515, 631 ni 9100. No se enviaron trabajos: imprimir con
  A4 activo o sin canal de datos verificable no produciria evidencia valida.
- Una prueba desde la red aislada de Docker hacia la IP Wi-Fi del host agoto el
  tiempo de conexion. Es una limitacion de hairpin del host y no sustituye ni
  contradice la prueba requerida desde una segunda computadora fisica.

Este preflight demuestra que la aplicacion funciona usando su direccion LAN y
que el hardware/driver existe. No se promueve el estado a `PRODUCTION_READY`
hasta inspeccionar el papel impreso y ejecutar el flujo desde el cliente fisico.

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
- Los dumps restaurados convierten operaciones de backup en vuelo a `failed`,
  evitando alertas permanentes por un `pending` que no puede reanudarse.
- El restaurador de Windows elimina y recrea exclusivamente bases con nombre
  descartable antes de importar; produccion y bases del sistema siguen
  bloqueadas.
- El preflight Docker valida el frontend dentro de la imagen en vez de exigir
  `frontend/dist` en el disco del paquete.
- Preflight y validador LAN conectan al host, puerto y esquema publicados por
  Soketi, y cierran el canal WebSocket sin ocultar los gates posteriores.
- El contrato offline ya falla si un archivo requerido falta en fuente o en la
  entrega; se restauro `scripts/lib/operational_url_safety.ps1`.

## Validaciones externas pendientes

1. Imprimir fisicamente Carta, Media Carta, A5, 80 mm y 58 mm con los drivers y
   equipos que usara el hospital. Completar
   `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` desde su plantilla.
2. Ejecutar desde otra computadora de la LAN `scripts/validate_lan_client.ps1`
   y completar `qa/LAN_CLIENT_VALIDATION_PROOF.md`.
3. Repetir en el servidor hospitalario el preflight ya aprobado localmente,
   usando IP fija, HTTPS o la aceptacion formal del riesgo HTTP y las evidencias
   firmadas.

Estas validaciones requieren hardware/red externos y no pueden sustituirse por
capturas o mocks locales.
