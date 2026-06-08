# HTTPS migration guide - S_Hospital v1.0.0

> HTTPS is **mandatory** in v1.0.0 PRODUCTION_READY. HTTP requests on
> port 80 are permanently redirected to HTTPS on port 443. The
> hospital LAN is offline, but cashier credentials, patient names
> and receipts still cross the local network, so the connection
> must be encrypted end-to-end.

## Why HTTPS on a closed LAN

The cashier PC browser already trusts the server's hostname via DNS
or static IP, but credentials, fiscal numbers, and patient names
are still observable to any other device on the same LAN segment.
A second-hand cashier laptop, a vendor doing maintenance, or a
misconfigured IoT device can passively read HTTP traffic. The
mitigation is a self-signed local Certificate Authority that every
cashier PC trusts.

## What the installer does

`setup.bat` (offline-release) and `scripts/deploy_hospital_lan.ps1`
both call `scripts/generate_local_ca.ps1` automatically on the
server. The flow is:

1. Detect the server's LAN IP from the network adapters.
2. Generate a 4096-bit RSA private key for the local CA
   (`nginx/ssl/hospital-ca.key.pem`).
3. Self-sign the CA certificate for 825 days
   (`nginx/ssl/hospital-ca.crt.pem`).
4. Generate a 2048-bit RSA private key for the server
   (`nginx/ssl/hospital-server.key.pem`).
5. Build a CSR with the LAN IP and a friendly CN in the SAN list
   (`nginx/ssl/hospital-server.csr.pem`).
6. Sign the server certificate with the local CA
   (`nginx/ssl/hospital-server.crt.pem`).
7. Mount `nginx/ssl/` into the nginx container and start it on
   port 443.

The `nginx/ssl/` directory is git-ignored. The certs are private to
the hospital and never leave the server.

## Installing the CA on cashier PCs

After the install, the operator (or the support person) copies
`nginx/ssl/hospital-ca.crt.pem` to each cashier PC. There it is
installed into the **Trusted Root Certification Authorities** store.

### Windows

```powershell
# Run elevated on each cashier PC
Import-Certificate `
  -FilePath "C:\path\to\hospital-ca.crt.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

After this, restart Chrome / Edge / Firefox so the browser picks up
the new trust store. Navigate to `https://IP-DEL-SERVIDOR:8443/up`
and confirm the lock icon is closed.

### macOS

Double-click the `.pem` file, open **Keychain Access**, find the
new certificate under "System", double-click it, expand
**Trust**, and set "When using this certificate" to
**Always Trust**.

### Linux

```
sudo cp hospital-ca.crt.pem /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

Restart the browser.

## Verifying the deployment

After the CA is installed on a cashier PC:

1. Open `https://IP-DEL-SERVIDOR:8443/up` from the cashier PC
   browser. The browser should show a closed lock and the response
   `ok`.
2. Open `https://IP-DEL-SERVIDOR:8443/login`. The React SPA should
   load and the browser should report the WebSocket as connected
   within 1-2 seconds.
3. Sign in with the cashier credentials. The browser sends the
   session cookie over the same TLS connection; an HTTP sniffer on
   the LAN only sees encrypted bytes.

## Renewal and rotation

The CA cert is valid for 825 days (Chrome's current maximum for
self-signed roots). 30 days before expiry the operator should
regenerate the materials:

```powershell
cd C:\Projects\S_Hospital
powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10
docker compose -f docker-compose.prod.yml restart nginx
```

Then re-distribute the new `hospital-ca.crt.pem` to each cashier PC
following the steps above. The server cert itself is rotated at the
same time.

If the server's IP changes (DHCP rotation, hardware replacement),
re-run the script with the new IP and re-distribute the new CA
cert. The new server cert is signed with a different SAN list
containing only the new IP.

## What if a cashier PC refuses the cert

A "Your connection is not private" or "NET::ERR_CERT_AUTHORITY_INVALID"
error means the cashier PC does not trust the local CA. Re-run the
import command above and restart the browser. If the lock icon
appears on the server itself but not on the cashier PC, the issue
is the cashier PC's trust store, not the server config.

## Production checklist

- [ ] `nginx/ssl/hospital-ca.crt.pem` exists on the server
- [ ] `nginx/ssl/hospital-server.crt.pem` exists on the server
- [ ] nginx container reports `listen 443 ssl http2` is bound
- [ ] HTTP request to port 80 returns `301` redirect to HTTPS
- [ ] `https://IP/up` returns `ok` with a closed lock
- [ ] Each cashier PC has the CA in its Trusted Root store
- [ ] LAN client validation evidence is in
      `qa/LAN_CLIENT_VALIDATION_PROOF.md`

## Disabling HTTPS is not supported

There is no supported downgrade path. Removing the HTTPS server
block from `nginx/default.conf`, undoing the `app.url=https://`
in `backend/.env`, or un-trusting the CA on the cashier PCs will
all cause silent failures: the cashier PC will either get a
warning page on every visit or fail to authenticate because the
session cookie cannot be set over plain HTTP with
`SESSION_SECURE_COOKIE=true`. The system is designed for HTTPS and
the production installer always provisions it.
