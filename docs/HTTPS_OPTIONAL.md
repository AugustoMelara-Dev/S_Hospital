# =============================================================================
# Local HTTPS with self-signed CA
# =============================================================================

The hospital LAN does not require HTTPS, but enabling it protects
cashier credentials and patient names from passive sniffing on the
cable. This document describes the optional HTTPS path.

## When to use

- The LAN cable run passes through areas where unauthorized people
  could plug in a sniffer (rare in a hospital, but possible).
- Compliance asks for transport encryption.
- You want to test the client UI with a real HTTPS context.

If none of these apply, HTTP on port 80 is fine. The Laravel middleware
hardens both transports the same way.

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

1. Edit `nginx/default.conf` and uncomment the `server { listen 443 ... }`
   block.
2. Move the common `location` blocks into a snippet and `include` it
   from both servers.
3. Update `docker-compose.prod.yml` so the nginx service mounts
   `./nginx/ssl:/etc/nginx/ssl:ro`.
4. Restart nginx: `docker compose restart nginx`.

## Update application config

- Set `APP_URL=https://192.168.1.10:443` in `.env` and `backend/.env`.
- In the LAN_CLIENT_VALIDATION_PROOF, validate `/login` and `/up` over
  HTTPS from a second PC.

## Renewal

The default validity is 825 days (Chrome/Firefox maximum for
self-signed). Re-run the generator before expiry. Cashier PCs do not
need a re-install because the CA certificate has the same fingerprint
(if the same CA key is reused).

## Rollback

To disable HTTPS:

1. Comment out the `server { listen 443 ... }` block in
   `nginx/default.conf`.
2. Revert `APP_URL` to `http://...`.
3. Restart nginx.

The CA and server certs stay on disk in case you re-enable HTTPS.
