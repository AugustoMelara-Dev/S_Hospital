# Backup y Restore Local - Hospital Billing OS

## Alcance de Fase 8

El sistema permite crear y descargar backups locales desde admin y con `php artisan hospital:backup`. No existe restore por UI ni endpoint destructivo de restore en esta fase.

## Crear backup manual

Desde el panel:

1. Entrar como usuario admin.
2. Abrir Backups locales.
3. Presionar Crear backup.
4. Confirmar que el registro quede en `success`.
5. Descargar el archivo y copiarlo a una carpeta local protegida o USB.

Desde consola del servidor:

```powershell
cd C:\HospitalBilling\backend
php artisan hospital:backup --type=scheduled
```

Los archivos quedan bajo `storage/app/private/backups`. El API solo descarga archivos registrados en `backup_logs`, existentes y dentro de esa carpeta.

## Programar backup diario en Windows

Crear una tarea del Programador de tareas:

- Programa: `php`
- Argumentos: `artisan hospital:backup --type=scheduled`
- Iniciar en: `C:\HospitalBilling\backend`
- Frecuencia: diario, fuera del horario de caja.
- Usuario: cuenta local con permisos sobre la carpeta del sistema y destino USB si aplica.

Después de cada backup diario, copiar el archivo más reciente a una unidad USB o disco externo del hospital. No usar servicios cloud como requisito operativo.

## Restore manual en entorno de prueba

Restore debe probarse en una base limpia de prueba, nunca directo en producción sin parada controlada.

Pasos para MySQL/MariaDB:

1. Confirmar que el archivo de backup viene de `backup_logs` con estado `success`.
2. Verificar checksum:

```powershell
Get-FileHash C:\backups\hospital-backup.sql -Algorithm SHA256
```

3. Crear base de prueba limpia:

```powershell
mysql -u root -p -e "CREATE DATABASE hospital_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

4. Restaurar en la base de prueba:

```powershell
mysql -u hospital -p hospital_restore_test < C:\backups\hospital-backup.sql
```

5. Apuntar un `.env` temporal de prueba a `hospital_restore_test`.
6. Ejecutar validaciones:

```powershell
php artisan migrate:status
php artisan config:cache
php artisan test --colors=never
```

7. Validar en navegador local de prueba:
   - `/up` responde OK.
   - `/login` carga.
   - Admin puede iniciar sesión.
   - Existen usuarios, permisos, servicios, facturas, pagos y cajas esperadas.
   - Último backup aparece en `backup_logs`.

## Restore en producción

Restore en producción requiere:

1. Avisar parada operativa y detener acceso de clientes LAN.
2. Crear un backup nuevo antes del restore.
3. Copiar la base actual a un destino externo.
4. Validar checksum del archivo que se restaurará.
5. Restaurar primero en prueba si no se hizo antes.
6. Restaurar en producción con el servicio web detenido o en modo mantenimiento.
7. Ejecutar `php artisan config:cache`.
8. Validar `/up`, `/login`, `/verify-email`, login admin, listado de facturas, caja y reporte diario.
9. Documentar fecha, operador, archivo usado, checksum y resultado.

## Checklist de evidencia mínima

- Fecha y hora del restore de prueba.
- Equipo donde se probó.
- Archivo restaurado.
- Checksum esperado y checksum calculado.
- Resultado de `php artisan migrate:status`.
- Resultado de `/up`, `/login`, `/verify-email`.
- Conteos mínimos revisados: users, roles, permissions, services, invoices, payments, cash_register_sessions, backup_logs.
- Firma o nombre del responsable local.
