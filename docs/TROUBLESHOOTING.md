# Troubleshooting

This document maps recurring operator-facing failure messages to
their root cause and the fix. Use it before paging the integrator.

## "El servidor LAN no pudo completar la operación"

**Symptom:** Toast or topbar message: *"El servidor LAN no pudo
completar la operación"*. Cashier is still logged in; the action
that triggered the message (open box, register invoice, etc) did
not happen.

**Cause:** The Laravel app is up but the request to the API
threw a 5xx (database unreachable, php-fpm down, mysqld dead). The
apiClient translates the raw error into the operator-safe
message so we never leak a stack trace into the UI.

**Fix:**

1. SSH to the server and `docker compose ps`. All four services
   (backend, queue-worker, mysql, soketi) should be `running` with
   a recent healthcheck. If `backend` or `queue-worker` is
   `Restarting`, look at the last 200 lines of `docker compose
   logs backend`.
2. If `mysql` is `unhealthy` or restarting, check disk space: a
   full disk on the `mysql_prod_data` volume will block the
   healthcheck. Free space and `docker compose restart mysql`.
3. If everything is up but the cashier still sees the message,
   check `backend/storage/logs/laravel.log` (or the daily-rolled
   file for today). The actual error is in there.

## "Sesión vencida"

**Symptom:** Topbar shows *"Sesión vencida. Redirigiendo al
login..."*. The cashier is sent to the login page.

**Cause:** The Sanctum session cookie has expired (default 120
minutes of inactivity per `SESSION_LIFETIME`) or the cashier
opened a new tab on a second PC and the cookie did not sync.
Cross-tab broadcast is not implemented; only one tab at a time
per cashier.

**Fix:**

1. Re-login. If `auth.login` returns 423 (locked), the cashier
   has hit 5 failed attempts in 15 minutes. Wait 15 minutes and
   retry, or have an admin reset the lockout via the
   `php artisan auth:unlock-user USERNAME` CLI.
2. If 423 keeps recurring on the same PC, check that the system
   clock is in sync. A clock skew of >2 minutes will invalidate
   the cookie.
3. If the cashier uses multiple PCs, they must log in on each
   independently. Document this in
   `manuales/MANUAL_CAJERO.md`.

## "Falta crear secuencias fiscales antes de facturar"

**Symptom:** POS screen shows the setup wizard with a yellow
warning *"Rango fiscal"*.

**Cause:** `fiscal_sequences` table is empty. New install, or
the previous operator forgot to create a sequence after
migrating.

**Fix:**

1. Go to **Ajustes → Secuencias fiscales** (admin role required).
2. Click "Nueva secuencia", fill in:
   - Tipo de documento: Factura
   - Prefijo (e.g. 000-001-01)
   - Rango: del 1 al 99999999
   - CAI: provided by SAR (Honduras tax authority)
   - Vencimiento: the CAI expiry date
3. Save. Only ONE sequence can be active per `document_type`; the
   previous active sequence will be automatically deactivated.

## "La factura ya está anulada"

**Symptom:** The void dialog refuses to void a paid invoice.

**Cause:** v1.0.0 enforces a strict two-step reversal: void each
payment, then void the invoice. The cashier tried the direct
void path.

**Fix:**

1. Open the invoice in **Historial**.
2. Click **Reversar pagos** (or use the v1.0.0 endpoint
   `POST /api/invoices/{id}/reverse` with reason >= 5 chars).
3. The system voids each payment (creating a `payment_void`
   cash_movement and recalculating the invoice) and then voids
   the invoice. Both steps are wrapped in a single DB
   transaction; if any step fails, the whole reverse is rolled
   back.

## "Permiso denegado" on a button the cashier uses daily

**Symptom:** The cashier clicks a button (e.g. **Anular factura**,
**Reimprimir**) and sees *"No tiene permisos para realizar esta
operación"*.

**Cause:** The cashier's role (`cajero` by default) was not
granted that permission. See `docs/PERMISSIONS_MATRIX.md`.

**Fix:**

1. An admin goes to **Administración → Usuarios**.
2. Find the cashier and add the missing permission
   (`invoices.void`, `receipts.reprint_any`, etc).
3. The cashier must refresh the browser for the permission
   change to take effect (the permission set is captured at
   login time).

## "Impresora no encontrada" / "Printer not selected"

**Symptom:** The receipt preview shows fine but `window.print()`
fails or prints to the wrong device.

**Cause:** The cashier's PC does not have the institutional receipt
printer installed as the system default, or the browser's print
settings override the page CSS.

**Fix:**

1. In Windows: **Settings → Printers & scanners → set the
   office printer used for institutional receipts as the default**.
   Test print from Notepad.
2. In the browser's print dialog (Ctrl+P), uncheck
   *Headers and footers* and use the margins recommended by the
   selected paper size.
3. In the receipt preview, use media carta, carta or A5. The cashier can
   change the paper size in the dialog if the wrong size is selected.

## "Respaldo pendiente" nunca termina

**Symptom:** La pantalla de Respaldos muestra una solicitud en
**Pendiente** durante horas.

**Cause:** La automatizacion local de respaldos no esta procesando
solicitudes, la cola esta atrasada o la herramienta de dump no esta
disponible para el servicio backend.

**Fix:**

1. `docker compose ps queue-worker` should show `running`. If
   not, `docker compose restart queue-worker`.
2. `docker compose logs queue-worker --tail=200` should show
   the latest `RunBackupJob` starting and finishing. Look for
   `mysqldump: command not found`; if present, the image
   `Dockerfile.prod` is missing the `mariadb-client` package.
3. `HOSPITAL_DUMP_BINARY` env must point to `/usr/bin/mariadb-dump`
   (Docker) or `C:\xampp\mysql\bin\mysqldump.exe` (bare-metal
   Windows). See `docs/BACKUP_RESTORE.md`.

## "La PC cliente no carga la app desde otra computadora"

**Symptom:** PC A (server) loads the app at `http://localhost:8000`
but PC B (LAN client) gets connection refused or 0.0.0.0:8000.

**Cause:** Firewall on the server PC blocks inbound TCP 8000 on
the LAN profile.

**Fix:**

1. `Windows Firewall with Advanced Security → Inbound Rules →
   New Rule → Port → TCP 8000 → Allow → Private profile`.
2. Confirm the server has a static IP (`ipconfig`) and that
   `SERVER_IP` in `backend/.env` matches it. Restart the docker
   compose stack after the change so the `CORS_*` and
   `SANCTUM_STATEFUL_DOMAINS` env vars are re-read.
3. The operator's `docs/OFFLINE_LAN_INSTALL.md` has the exact
   PowerShell commands.

## "Mi PC no recibe facturas de otra PC en tiempo real"

**Symptom:** A cashier in PC A creates an invoice but the
cashier in PC B does not see it for 30+ seconds (or until
manual refresh).

**Cause:** The Soketi WebSocket is not connected or the channel
authorization is denying the user.

**Fix:**

1. `docker compose ps soketi` should be `running`. If not,
   `docker compose restart soketi`.
2. Open DevTools → Network → WS on PC B. You should see a
   connection to `ws://<server>:6001/app/hospital-key`. If the
   connection 403s, the cashier's session is missing the
   `invoices.view` permission. Add it in **Administración →
   Usuarios**.
3. If the connection 200s but no events arrive, the
   `BROADCAST_CONNECTION` env is still `log` (the dev default).
   Set it to `pusher` in `backend/.env` and restart the
   backend container.

## "Scheduler no ha corrido en N minutos" (PROD_READY only)

**Symptom:** `GET /api/system/status` shows
`data.backups.queue.scheduler_heartbeat.status = "stuck"` (age
> 10 min).

**Cause:** The `scheduler` sidecar (supercronic) is down, or
the Windows scheduled task is not registered.

**Fix (Docker):** `docker compose restart scheduler`. The
healthcheck will fail within 60s if it is still stuck.

**Fix (Windows bare metal):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register_scheduler_cron.ps1
Get-ScheduledTask -TaskName SistemaCajaHospitalaria-Scheduler
```

The task should be in `Ready` state and the last run should
be <5 min old.

## "Operación no autorizada: APP_KEY inválida"

**Symptom:** Every request returns 500 with a stack trace
mentioning `Illuminate\\Encryption\\Encrypter`.

**Cause:** `APP_KEY` is missing or corrupted. The pre-commit
guard refuses to let an empty `APP_KEY=` reach the repo, so
this only happens if an operator edits the `.env` by hand
and sets `APP_KEY=` to empty.

**Fix:**

```powershell
cd backend
php artisan key:generate --force
# Restart the containers so the new key is picked up
docker compose restart backend queue-worker
```

All cashier sessions are invalidated. The pre-commit guard
documentation in `docs/SECRETS.md` explains how to avoid this.
