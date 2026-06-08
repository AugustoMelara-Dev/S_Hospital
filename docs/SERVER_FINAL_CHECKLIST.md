# Checklist del servidor final - S_Hospital v1.0.0-FINAL

> Lista de pasos ordenados para el operador del servidor final del
> hospital. Cada paso tiene un comando PowerShell ejecutable, un
> tiempo estimado y un criterio de exito. No saltar pasos.

## Pre-requisitos del operador

Antes de empezar, confirmar:

- [ ] El servidor final tiene Windows 10/11 o Windows Server 2019+
- [ ] El operador tiene cuenta de Administrador local
- [ ] El operador abrio PowerShell como Administrador
- [ ] El USB con `offline-release/` esta copiado a `C:\S_Hospital\`
- [ ] La IP fija LAN del servidor esta reservada en el router
  (DHCP reservation) o configurada como estatica
- [ ] Hay al menos 5 GB libres en disco
- [ ] Hay conexion de red estable al switch LAN (no requerida a internet)

---

## Paso 1: Regenerar imagenes Docker (15-30 min)

**Por que**: las imagenes `*.tar` en `offline-release/offline-images/`
vienen del commit `e287d249` (v1.0.0 production candidate). El
codigo de v1.0.0-FINAL (HTTPS obligatorio, soketi detras de nginx,
cambios PHP) **no esta bakeado** en esas imagenes. Sin rebuild,
el backend PHP corriendo sera el viejo.

**Comando**:
```powershell
cd C:\S_Hospital
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\make_offline_release.ps1 -Force
```

**Criterio de exito**:
- `make_offline_release.ps1` termina con `OFFLINE_RELEASE_CLEAN: YES`
- 4 imagenes `.tar` nuevas en `offline-release\offline-images\`
  (backend.tar, mariadb.tar, nginx.tar, queue-worker.tar)
- `MANIFEST.txt` apunta al commit actual
- `checksums.sha256` regenerado

**Verificacion**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit
# Debe terminar con: OFFLINE_RELEASE_CLEAN: YES
```

**Tiempo estimado**: 15-30 min en hardware modesto.

---

## Paso 2: Generar CA local (1 min)

**Por que**: HTTPS es obligatorio. La CA se instala en cada PC
cliente para que confien en el certificado del servidor.

**Comando**:
```powershell
cd C:\S_Hospital
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\generate_local_ca.ps1 -ServerIp <IP-FIJA-LAN>
```

Reemplazar `<IP-FIJA-LAN>` con la IP del servidor, por ejemplo
`192.168.1.10`.

**Criterio de exito**:
- 5 archivos en `nginx\ssl\`:
  - `hospital-ca.crt.pem` (certificado CA, para distribuir a clientes)
  - `hospital-ca.key.pem` (clave privada CA, queda en servidor)
  - `hospital-server.crt.pem` (certificado servidor)
  - `hospital-server.key.pem` (clave privada servidor)
  - `hospital-ca.srl` (numero de serie)

**Documentacion**: `docs\HTTPS_MIGRATION.md` explica como
renovar la CA anualmente.

**Tiempo estimado**: 1 min.

---

## Paso 3: Instalar CA en PCs cliente (5-10 min por PC)

**Por que**: sin la CA en el almacen de confianza, los navegadores
muestran `NET::ERR_CERT_AUTHORITY_INVALID`.

**Para cada PC cliente** (5 PCs tipicamente):

### Windows (Chrome/Edge)
```powershell
# Ejecutar como Administrador
Import-Certificate `
  -FilePath "\\SERVIDOR\share\hospital-ca.crt.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

Reiniciar Chrome / Edge / Firefox.

### Verificacion por PC
1. Abrir `https://IP-DEL-SERVIDOR:8443/up`
2. Verificar candado cerrado en la barra de direcciones
3. Click en candado > "Conexion segura" > "El certificado es valido"

**Documentacion**: `docs\HTTPS_MIGRATION.md` cubre macOS y
Linux tambien.

**Tiempo estimado**: 5-10 min por PC.

---

## Paso 4: Levantar el stack (3-5 min)

**Comando**:
```powershell
cd C:\S_Hospital
.\setup.bat
```

`setup.bat` ejecuta `scripts\deploy_hospital_lan.ps1` que:

1. Detecta la IP LAN
2. Genera `.env` con secretos aleatorios si no existe
3. Levanta `docker compose -f docker-compose.prod.yml up -d`
4. Carga las imagenes `offline-images\*.tar` si existen
5. Ejecuta `php artisan migrate --force` y `db:seed --class=RolesAndPermissionsSeeder`
6. Crea el usuario administrador inicial
7. Crea una regla de firewall para el puerto 443/8443

**Criterio de exito**:
- Browser en el servidor: `https://127.0.0.1:8443/up` responde 200
- Browser en PC cliente: `https://IP-SERVIDOR:8443/up` responde 200 con candado
- Login con admin funciona

**Tiempo estimado**: 3-5 min.

---

## Paso 5: Instalar tareas Windows (2 min)

**Comando**:
```powershell
cd C:\S_Hospital
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting

powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\install_stack_autostart_windows.ps1 -UpdateExisting
```

**Criterio de exito**:
- Tareas `SistemaCajaHospitalaria-BackupWorker` y
  `SistemaCajaHospitalaria-DailyBackup` visibles en
  `Get-ScheduledTask`
- Backup worker responde en `/api/system/health` con
  `data.backups.worker_recently_active: true`

**Verificacion**:
```powershell
Get-ScheduledTask -TaskName "SistemaCajaHospitalaria-*"
```

**Tiempo estimado**: 2 min.

---

## Paso 6: Rotar APP_KEY (1 min, ventana de mantenimiento)

**Por que**: la `APP_KEY` del `.env` actual es del desarrollo.
En produccion se rota con criptografia fuerte y se invalidan
todas las sesiones existentes.

**Comando**:
```powershell
cd C:\S_Hospital

# 1. Preview (no aplica)
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\rotate-app-key.ps1 -WhatIf

# 2. Aplicar (invalidara sesiones activas)
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\rotate-app-key.ps1
```

**Criterio de exito**:
- Backup `.env.bak.<timestamp>` creado
- `APP_KEY` en `.env` con `base64:` de 32 bytes random
- `/up` responde 200 despues del restart
- Cajeros deben volver a loguearse (esperado)

**Documentacion**: `docs\SECRETS.md` explica por que y como.

**Tiempo estimado**: 1 min + ventana de mantenimiento.

---

## Paso 7: Completar 7 evidencias fisicas finales (30-60 min cada una)

**Por que**: el guard `production_readiness_preflight.ps1` falla
el handoff si cualquiera de las 7 evidencias finales esta PENDING.

### 7.1. LAN_CLIENT_VALIDATION_PROOF (desde 2da PC)
- [ ] Abrir `https://IP-SERVIDOR:8443` desde una segunda PC cliente
- [ ] Login con cajero
- [ ] Validar `/up`, `/login`, `/invoices`, `/cashbox`, `/reports`,
      `/backups` desde el navegador
- [ ] Llenar `qa\LAN_CLIENT_VALIDATION_PROOF.md`

**Comando auxiliar**:
```powershell
# En la PC cliente (no servidor)
powershell -NoProfile -ExecutionPolicy Bypass `
  -File \\SERVIDOR\S_Hospital\scripts\validate_lan_client.ps1 `
  -BaseUrl https://IP-SERVIDOR:8443 `
  -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

### 7.2. INSTITUTIONAL_RECEIPT_PRINT_PROOF (impresora)
- [ ] Imprimir una factura de prueba en los tamanos institucionales:
      media carta, carta y A5
- [ ] Validar margenes, fondo blanco, firma, ausencia de QR
- [ ] Validar reimpresion desde historial
- [ ] Llenar `qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`

### 7.3. FINAL_STARTUP_TASK_PROOF (autoarranque real)
- [ ] Reiniciar el servidor final
- [ ] Confirmar que el stack levanta sin intervencion manual
- [ ] Validar `/up` y login despues del reinicio
- [ ] Llenar `qa\FINAL_STARTUP_TASK_PROOF.md`

**Comando auxiliar**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\validate_final_startup_task_proof.ps1 `
  -EvidencePath qa\FINAL_STARTUP_TASK_PROOF.md
```

### 7.4. FINAL_BACKUP_TASK_PROOF (respaldo automatico real)
- [ ] Confirmar que `SistemaCajaHospitalaria-BackupWorker` esta activo
- [ ] Esperar o disparar un ciclo de respaldo automatico
- [ ] Validar estado "Protegido" en la pantalla de respaldos
- [ ] Llenar `qa\FINAL_BACKUP_TASK_PROOF.md`

**Comando auxiliar**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\validate_final_backup_task_proof.ps1 `
  -EvidencePath qa\FINAL_BACKUP_TASK_PROOF.md
```

### 7.5. FINAL_RESTORE_PROOF (restore real)
- [ ] Crear backup desde UI (Respaldos > Crear respaldo local)
- [ ] Restaurar en base descartable `hospital_restore_test`
- [ ] Validar SHA256, conteos, fechas
- [ ] Llenar `qa\FINAL_RESTORE_PROOF.md`

**Comando auxiliar**:
```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 \
  RESTORE_TEST_DATABASE=hospital_restore_test \
  HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_test \
  bash scripts/validate_restore_mysql.sh
```

### 7.6. FINAL_CONCURRENCY_PROOF (concurrencia real)
- [ ] Doble apertura de caja (rechazado)
- [ ] Doble facturacion (correlativos unicos)
- [ ] Doble pago (rechazado con 409)
- [ ] Llenar `qa\FINAL_CONCURRENCY_PROOF.md`

**Comando auxiliar**:
```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 \
  HOSPITAL_CONCURRENCY_BASE_URL=https://IP-SERVIDOR:8443 \
  HOSPITAL_CONCURRENCY_LOGIN=concurrencia.validacion \
  HOSPITAL_CONCURRENCY_PASSWORD=... \
  bash scripts/validate_mysql_concurrency.sh
```

### 7.7. TRAINING_ACCEPTANCE_PROOF (capacitacion supervisada)
- [ ] Cajero practica apertura de caja, factura, cobro, reimpresion y cierre
- [ ] Supervisor practica anulacion autorizada y revision de reportes
- [ ] Administrador practica usuarios, respaldos y configuracion
- [ ] Usuario de area practica consulta de servicios pagados
- [ ] Confirmar que no se usaron pacientes reales ni base de produccion
- [ ] Llenar `qa\TRAINING_ACCEPTANCE_PROOF.md`

**Comando auxiliar**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\validate_training_acceptance_proof.ps1 `
  -EvidencePath qa\TRAINING_ACCEPTANCE_PROOF.md
```

**Tiempo estimado del paso 7 completo**: 3-5 horas.

---

## Paso 8: Ejecutar handoff final (5-10 min)

**Comando**:
```powershell
cd C:\S_Hospital
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\final_production_handoff.ps1 `
  -BaseUrl https://IP-DEL-SERVIDOR:8443
```

**Criterio de exito**:
- `final_production_handoff.ps1` retorna exit code 0
- `qa\FINAL_PRODUCTION_HANDOFF_RESULT.md` contiene
  `PRODUCTION_READY=YES`
- `production_readiness_preflight.ps1` (parte del handoff)
  pasa todas las checks

**Verificacion final**:
```powershell
Get-Content qa\FINAL_PRODUCTION_HANDOFF_RESULT.md | Select-String "PRODUCTION_READY"
# Debe retornar: PRODUCTION_READY=YES
```

**Tiempo estimado**: 5-10 min.

---

## Resumen de tiempo total

| Paso | Tiempo |
|---|---|
| 1. Regenerar Docker | 15-30 min |
| 2. Generar CA | 1 min |
| 3. Instalar CA en PCs (5 PCs) | 25-50 min |
| 4. Levantar stack | 3-5 min |
| 5. Tareas Windows | 2 min |
| 6. Rotar APP_KEY | 1 min + ventana |
| 7. 7 evidencias fisicas finales | 3-5 horas |
| 8. Handoff final | 5-10 min |
| **TOTAL** | **3-5 horas** |

---

## Si algo falla

### Rollback del stack
```powershell
cd C:\S_Hospital
docker compose -f docker-compose.prod.yml down
```

Esto detiene todos los contenedores. Los volumenes de MariaDB
**no se borran** (los datos persisten). Para volver a iniciar:
```powershell
docker compose -f docker-compose.prod.yml up -d
```

### Restaurar `.env` despues de rotacion
```powershell
# Encontrar el backup
Get-ChildItem .env.bak.* | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# Restaurar
Copy-Item .env.bak.20260608T120000 .env -Force
docker compose -f docker-compose.prod.yml restart backend
```

### Soporte
- `docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md`
- `docs\manuales\RUNBOOK_INCIDENTES_COMUNES.md` (14 incidentes)
- `scripts\collect_support_packet.ps1` para paquete de soporte
