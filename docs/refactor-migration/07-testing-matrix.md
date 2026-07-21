# Matriz de pruebas

Fecha: 2026-07-21.

| Área | Gate | Resultado |
|---|---|---|
| Dominio Laravel | suite completa `php artisan test` | 949 PASS, 7.165 aserciones, 12 omisiones justificadas |
| Frontend React | `npm run test:segmented` | 144 archivos, 1.093 PASS, 0 fallos, 0 omitidas |
| Tipos y lint | `npm run typecheck`, `npm run lint` | PASS |
| Arquitectura UI | `check:ui-legacy:final`, `check:ui-rules` | 0 imports heredados / PASS |
| Accesibilidad visible | Playwright + axe en 320, 375, 768, 1024, 1366 y 1920 px | 6/6 PASS; 84 auditorías de ruta/estado |
| Evidencia visual | 24 pantallas y estados operativos con auditoría JSON | PASS; 0 overflow, consola, `pageerror` o solicitudes fallidas reales |
| Producción real | `npm run test:e2e:release` contra Nginx+PHP-FPM+MariaDB | 2/2 PASS, sin errores de consola |
| Dinero | unitarias y ciclo factura→pago→recibo | PASS; 1.725 centavos reconciliados |
| Caja/RBAC | E2E real y Feature tests | PASS; cierre persistido y endpoint protegido 403 |
| Recibos/PDF | matriz de perfiles y paginación | PASS automatizado |
| Reportes/Excel | endpoints, PDF, filtros, sanitización de fórmulas | PASS automatizado |
| Backup/restore | dump cifrado real + import separado | PASS |
| Instalador | preflight, contratos y autodiagnóstico | PASS; autodiagnóstico 16/16 |
| Reinicio | restart completo + health + consulta SQL | PASS; factura E2E persistida |
| Offline | paquete de seis imágenes + manifest/checksums | PASS estructural |

Los escenarios unitarios con API simulada se usan para estados visuales y regresiones rápidas; no son la evidencia de cierre del flujo productivo. Esa evidencia proviene del E2E sobre el compose de producción y MariaDB real.

La auditoría visible detectó y corrigió dos regresiones de certificación: el estado de acceso denegado recuperó un `h1` semántico y el mock de `/api/system/status-summary` se separó del contrato avanzado de `/api/system/status`, evitando el error fugaz que aparecía al abrir Soporte. El flujo de capturas ahora falla ante errores de consola, `pageerror` o solicitudes fallidas no justificadas.

Las pruebas de concurrencia dependientes de `pcntl` se omiten en Windows; los guards de correlativo, locks y unicidad están cubiertos por pruebas de integración y constraints. La aceptación física de impresoras y el acceso desde un segundo equipo LAN siguen fuera del alcance automatizable de esta máquina.
