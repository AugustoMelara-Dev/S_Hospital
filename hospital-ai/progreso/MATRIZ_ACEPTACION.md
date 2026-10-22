# MATRIZ DE ACEPTACIÓN (§20) — S_Hospital, 2026-09-17

Coordinador: `hs-orchestrator`. Método: cada fila cita evidencia **realmente ejecutada**
en esta campaña, con el dueño y el archivo. Lo no ejecutado se marca NOT VERIFIED con
la razón y el comando/paso que lo habilitaría. No hay PASS heredados de campañas previas.

Estados: PASS · FAIL · PARTIAL · NOT VERIFIED.

| Área | Evidencia exigida | Estado | Sustento real |
|---|---|---|---|
| **Acceso y roles** | Login, expiración, cambio de contraseña y denegaciones por API con roles reales | **PASS (alcance verificado)** | `AuthTest|LoginLockoutTest` OK 29/220; `LanEndpointAccessTest` 11/77 → 401 anónimo 12/12, 403 por rol con permisos reales del seeder; `PasswordChangeView` con tests |
| **Facturación y caja** | Flujo completo, arqueo, cierre, anulaciones y conciliación reproducible | **PARTIAL** | `CashPaymentsReceiptTest` 37/400 (incluye `recovery_required`); `CloseCashSessionTest`; arqueo con esperado/contado/diferencia donde el servidor calcula y audita. **Consolidado por caja: backend ENTREGADO y probado** (`consolidatedByRegister()` + `GET /api/cash-sessions/consolidated`, 30.00 = 10.00 + 20.00, grupo `unassigned` probado); **falta la superficie UI** (`M-W2-FE-04`, en curso) |
| **Dinero y concurrencia** | Casos límite y operaciones concurrentes sin duplicaciones | **PASS (alcance verificado)** | MariaDB real `--group=concurrent` → 6 tests/32 aserciones: 2 aperturas misma caja (1 gana), cajas distintas (ambas ganan, tras corregir deadlock InnoDB 1213), mismo usuario bloqueado, cierre vs cobro ×3 sin pago en caja cerrada, retry con misma `Idempotency-Key` → replay 1 sesión/1 movimiento. EPO (L 25.00/receta, flag raíz) y dialisis OK |
| **Impresión** | PDFs reales, tamaños, paginación, copias, permisos, reimpresión y cancelación | **PARTIAL** | PDFs reales del motor: carta vertical **612×792 pt** y A4 **595.28×841.89 pt** (`dimensions.txt`); **ORIGINAL / PRIMERA COPIA / SEGUNDA COPIA** y **"REIMPRESIÓN #2"** extraídos del texto del PDF; preview no consume correlativo (`next_receipt_number=8` con `current_number=7`). **Impresora física, cancelación y popup bloqueado: NOT VERIFIED** (sin hardware) |
| **Offline** | WAN bloqueada, login nuevo, refresh, cobro, PDF, reportes y backup funcionales | **NOT VERIFIED** | `offline_no_build_runtime` PASS 18 checks; `audit_offline_dependencies` 0 CRITICAL; sin CDN. **No ejecutable sin daemon Docker y sin navegador real**; comando: levantar el stack y bloquear salida WAN |
| **LAN** | Segundo cliente, usuarios simultáneos y separación correcta de cajas | **PARTIAL** | Separación de cajas probada con **procesos/conexiones independientes en MariaDB**. **Segunda máquina física: NOT VERIFIED** |
| **Recuperación** | Restore limpio, actualización fallida/rollback y claves verificadas | **PARTIAL** | `BackupExternalRecoveryTest`: respaldo sintético → copia externa verificada por SHA-256 → pérdida local → reposición → descifrado → importación validando factura/pago/caja/paciente; frontera copia-degradada→correlativos con `confirm()` real. **Drill con contenedor: BLOQUEADO_EXTERNO** (daemon apagado); 10 suites PowerShell exit 0 |
| **Instalador** | VM soportada limpia, instalación offline, reanudación y reinicio | **NOT VERIFIED** | 27/29 suites PowerShell PASS (2 FAIL ambientales por `installer-output/` ausente). **Sin VM limpia, sin `.exe`**, licencia Docker Desktop = decisión institucional abierta |
| **UI y accesibilidad** | Todas las rutas, estados, teclado, zoom, responsive y pruebas diferenciadas | **PARTIAL** | 13 rutas montadas + cambio de contraseña; tokens v2; contrastes medidos (claro y oscuro, todos ≥4.5 texto / ≥3 UI); E2E mock `accessibility` 4/4 con **0 violaciones axe**; fix real de §10 (Enter suelto cobraba) con regresión sensible. **Lector de pantalla real, zoom 150–200 % y aprobación visual: NOT VERIFIED** |
| **Seguridad** | Acceso indebido, manipulación de IDs/importes y exposición bloqueados | **PASS (alcance verificado)** | `--filter=Security` OK 37/203; horizontales/verticales con roles reales; `/api/health` y `/api/system/health` públicos mínimos; branding 6 campos sin RTN/address/phone/footer/tax; `pnpm audit` canónico = **0 vulnerabilidades** (el hallazgo F3 previo era falso positivo por lockfile secundario) |

## Lo que NO se declara

- No se declara `PRODUCTION_READY`, ni certificación, ni aprobación para entrega.
- No se marca como PASS ninguna prueba física (impresora, escáner, monitor, segunda PC, VM).
- No se reutilizan los conteos históricos (981/1162, 556/11) como resultados actuales.
- El job CI `backend-mariadb` **estaba rojo** al medir (7 fallos por contaminación de orden
  + 2 fallos reales); su reparación es M-W1-QA-02 y su resultado se registrará aparte.

## Pendientes externos que requieren acto humano

1. VM Windows limpia e instalación offline con WAN bloqueada desde antes de iniciar.
2. Impresora institucional real (carta vertical / A4 / media carta / A5) y prueba de copias.
3. Segunda PC LAN con usuario distinto y caja distinta.
4. Firma de código institucional (certificado real).
5. Destino externo de respaldo (USB/NAS) y custodia de claves en el hospital.
6. Decisión institucional sobre licencia de Docker Desktop vs Docker Engine.
7. Daemon Docker disponible para drill de restore, `nginx -t`, LAN y empaquetado real.
