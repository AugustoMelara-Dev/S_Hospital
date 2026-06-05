# Production readiness preflight - 2026-06-02

Estado: NOT PRODUCTION READY.

Comando ejecutado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/production_readiness_preflight.ps1 -BaseUrl http://127.0.0.1:8000 -AllowMissingPhysicalProof
```

Resultado:

- `PRODUCTION_READY: NO`.
- 7 bloqueantes reportados por el preflight.
- El flag `-AllowMissingPhysicalProof` se uso solo para obtener diagnostico local; no permite declarar produccion lista.

Bloqueantes detectados:

- `APP_ENV` esta en `local`; produccion requiere `production`.
- `APP_DEBUG` esta en `true`; produccion requiere `false`.
- `APP_URL` no coincide con la URL probada.
- `BaseUrl` uso `127.0.0.1`; la validacion final debe usar IP LAN o dominio local del servidor.
- No existe la tarea programada `SistemaCajaHospitalaria-BackupWorker`.
- No existe la tarea programada `SistemaCajaHospitalaria-DailyBackup`.
- La prueba fisica LAN/impresora fue omitida y debe repetirse sin `-AllowMissingPhysicalProof`.

Checks que si pasaron:

- `DB_CONNECTION=mysql`.
- `SANCTUM_STATEFUL_DOMAINS` incluye host LAN.
- CORS esta restringido para produccion same-origin.
- `QUEUE_CONNECTION=database`.
- `frontend/dist/index.html` existe.
- `frontend/dist/assets` contiene assets.
- `php`, cliente MySQL y herramienta de dump estan disponibles.
- Directorio de backups escribible.
- `/up`, `/login` y `/verify-email` responden 200.

Acciones siguientes:

- Preparar `.env` final con `APP_ENV=production`, `APP_DEBUG=false` y `APP_URL=http://IP-LAN:8000`.
- Instalar tareas programadas de worker y backup diario en la PC servidor.
- Ejecutar preflight usando la IP LAN real y sin `-AllowMissingPhysicalProof`.
- Completar evidencia fisica LAN y recibo institucional en media carta, carta y A5.
