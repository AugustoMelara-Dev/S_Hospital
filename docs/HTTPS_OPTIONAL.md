# =============================================================================
# Local HTTPS with self-signed CA
# =============================================================================

HTTPS is required for the v1.0.0 release candidate. The hospital LAN is
offline, but cashier credentials, patient names and receipts still cross
the local network. Port 80 stays open only to redirect browsers to
HTTPS; normal operation uses `https://IP_DEL_SERVIDOR`.

## Generate the materials

The hospital has its own self-signed Certificate Authority (CA). The
CA cert is installed in the Trusted Root Certification Authorities
store on every cashier PC. The server certificate is signed by this
CA.

```powershell
cd C:\Projects\S_Hospital
powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10
```

Output:

```
nginx/ssl/hospital-ca.crt.pem
nginx/ssl/hospital-server.crt.pem
nginx/ssl/hospital-server.key.pem
nginx/ssl/hospital-server.csr.pem
nginx/ssl/hospital-ca.srl
nginx/ssl/openssl.cnf
```

The materials in `nginx/ssl/` are git-ignored. Do not commit them.

## Install the CA on cashier PCs

For each cashier PC:

1. Copy `hospital-ca.crt.pem` to the desktop.
2. Double-click, "Install Certificate".
3. "Local Machine" (requires admin) or "Current User" if no admin
   access.
4. "Place all certificates in the following store" -> "Trusted Root
   Certification Authorities".
5. Finish.

The cashier browser will then trust the hospital server certificate
without warnings.

## Activate HTTPS in nginx

The production compose file already mounts `nginx/ssl/`, publishes 443
and redirects port 80 to HTTPS. After generating or rotating certs,
restart nginx:

```powershell
docker compose -f docker-compose.prod.yml restart nginx
```

## Update application config

- Set `APP_URL=https://192.168.1.10` in `.env` and `backend/.env`.
- Set `APP_HTTP_PORT=80` and `APP_HTTPS_PORT=443` in the root `.env`.
- In the LAN_CLIENT_VALIDATION_PROOF, validate `/login` and `/up` over
  HTTPS from a second PC.

## Renewal

The default validity is 825 days (Chrome/Firefox maximum for
self-signed). Re-run the generator before expiry. Cashier PCs do not
need a re-install because the CA certificate has the same fingerprint
(if the same CA key is reused).

## Rollback

Do not disable HTTPS for `PRODUCTION_READY`. If certificate trust fails
on a cashier PC, reinstall the CA certificate on that PC or use another
authorized workstation while support corrects the trust store.
