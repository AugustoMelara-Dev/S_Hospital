# HTTPS/WSS opcional con CA local

Este runbook describe el modo TLS **opt-in** de S_Hospital: el stack base sigue
siendo HTTP y TLS se activa con un overlay de Compose, una CA local y un
certificado de servidor con SAN. No declara certificacion: la prueba en PCs
cliente, firewall e impresion pertenece a la validacion de entorno real.

Archivos involucrados:

- `docker-compose.tls.yml` (overlay opt-in, no modifica el compose base).
- `nginx/tls.conf` (server 443, WSS y API).
- `scripts/generate_local_ca.ps1` (CA + certificado de servidor).
- `docker-compose.prod.yml` (sigue HTTP-only por defecto).
- `.env.example` (seccion "HTTPS/WSS opcional").

## Que cambia y que no

- `docker-compose.prod.yml` no cambia: mantiene el puerto HTTP (`APP_PORT`) y
  `SESSION_SECURE_COOKIE=${SESSION_SECURE_COOKIE:-false}`.
- El overlay publica `${TLS_BIND_IP:-0.0.0.0}:${TLS_PORT:-443}` y monta
  `nginx/tls.conf` y `nginx/ssl/` en el contenedor nginx.
- `nginx/tls.conf` sirve 443 (TLS 1.2/1.3), proxya WSS en `/app` hacia
  `soketi:6001` y conserva el flujo de API y CSRF. **No** hay redireccion
  forzada ni HSTS en el puerto 80.
- HSTS lo emite Laravel (`AddSecurityHeaders`) solo con `APP_ENV=production` y
  request segura; `nginx/tls.conf` no lo duplica. Subir `max-age` o
  `includeSubDomains` es decision de despliegue.

## 1. Generar la CA local y el certificado del servidor

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10
```

Con nombre DNS adicional (queda en el SAN y debe ser el host del navegador):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10 -ServerNames hospital.local
```

- Salida en `nginx/ssl/` (ignorada por git): `hospital-ca.crt.pem`,
  `hospital-ca.key.pem`, `hospital-server.crt.pem`, `hospital-server.key.pem`,
  `hospital-server.csr.pem` y `openssl.cnf`.
- El script verifica que el certificado del servidor contenga el SAN IP/DNS y
  que este firmado por la CA. Nunca imprime claves: solo rutas, SAN, fechas y
  huella SHA-256.
- Con openssl disponible, `-Force` renueva el certificado **reutilizando la
  CA** (los clientes no reinstalan nada). Sin openssl usa
  `New-SelfSignedCertificate`; en ese camino la CA se regenera y cada PC debe
  reinstalar la CA.
- Custodia: `hospital-ca.key.pem` y `hospital-server.key.pem` no se copian a
  capturas, informes ni al repositorio.

## 2. Instalar la CA en cada PC cliente (una vez por CA)

1. Copiar `nginx\ssl\hospital-ca.crt.pem` a la PC.
2. Doble clic > Instalar certificado > Equipo local (o Usuario actual).
3. Ubicacion: "Entidades de certificacion raiz de confianza".
4. Verificar la huella SHA-256 que imprime el generador antes de aceptar.

## 3. Definir el origen TLS

En `.env` del servidor:

```env
HOSPITAL_TLS_ORIGIN=https://192.168.1.10
TLS_PORT=443
TLS_BIND_IP=0.0.0.0
HOSPITAL_ALLOW_INSECURE_HTTP=0
```

- `HOSPITAL_TLS_ORIGIN` debe ser el **origen exacto del navegador**, sin `:443`:
  la IP del servidor o el nombre DNS pasado a `-ServerNames`. El overlay falla
  al arrancar si falta.
- El overlay fija con ese valor `APP_URL`, `CORS_ALLOWED_ORIGINS`,
  `APP_SCHEME=https`, `SESSION_SECURE_COOKIE=true`, `PUSHER_CLIENT_SCHEME=wss` y
  `PUSHER_CLIENT_PORT=443`.
- `backend/config/sanctum.php` deriva `host[:port]` desde `APP_URL` y
  `CORS_ALLOWED_ORIGINS`, de modo que el origen declarado (IP o DNS) queda
  stateful y login/CSRF funcionan sin duplicar el hostname a mano. En
  produccion, `SANCTUM_STATEFUL_DOMAINS` explicito sigue siendo obligatorio.
- `HOSPITAL_ALLOW_INSECURE_HTTP=0` evita la excepcion HTTP: el preflight falla
  si el modo HTTPS declara `1`.

## 4. Activar el overlay

```powershell
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml up -d
```

- Abrir 443/TCP en el firewall del servidor: el instalador solo abre
  `APP_PORT`; el puerto TLS se configura aparte.
- Conservar el puerto HTTP durante la transicion y el rollback.

## 5. Transicion HTTP: que deja de funcionar

Con el overlay activo, `SESSION_SECURE_COOKIE=true` hace que el navegador no
almacene cookies Secure desde respuestas `http://`. Por eso:

- `http://<servidor>:8000` queda como ruta de liveness, estaticos y bootstrap
  de certificados: `/up`, `/api/health`, branding publico.
- Login y CSRF por HTTP **no completan** (419/401) y las rutas autenticadas
  responden 401/419. Todos los flujos con sesion deben usar
  `https://HOSPITAL_TLS_ORIGIN`.
- No hay redireccion automatica de 80 a 443.

## 6. Tiempo real por WSS

- El overlay define `PUSHER_CLIENT_SCHEME=wss` y
  `PUSHER_CLIENT_PORT=${TLS_PORT:-443}`.
- `GET /api/system/echo-config` (autenticado) normaliza `ws→http` y `wss→https`
  y devuelve `scheme: https` con `useTLS: true`; el navegador no necesita el
  puerto 6001.
- nginx proxya `wss://<host>/app/<key>` hacia `soketi:6001`; el CSP
  (`connect-src`) incluye `wss://<host>` y `wss://<host>:443`.

## 7. Renovacion

Re-ejecutar con `-Force` antes del vencimiento (default de 825 dias para el
certificado de servidor; la CA dura 3650). Con openssl la CA se reutiliza y los
clientes no reinstalan; sin openssl se regenera la CA y hay que reinstalarla en
cada PC.

## 8. Rollback a HTTP

1. Reiniciar sin el overlay:

   ```powershell
   docker compose -f docker-compose.prod.yml up -d
   ```

2. El compose base restaura `SESSION_SECURE_COOKIE=${SESSION_SECURE_COOKIE:-false}`
   y toma `APP_URL` y CORS de `.env` (`APP_SCHEME=http`).
3. Dejar `HOSPITAL_ALLOW_INSECURE_HTTP=1` de forma explicita (modo LAN sin
   cifrado) y documentarlo en el preflight.
4. Los certificados quedan en `nginx/ssl/` para reactivar TLS despues.

## 9. Pendiente de entorno real (no ejecutado)

- `nginx -t` y `docker compose up` con el overlay no se ejecutaron en la
  campana (sin Docker). La coherencia se cubrio con tests de backend,
  PowerShell del generador y parseo YAML.
- El instalador (`scripts/deploy_hospital_lan.ps1`) todavia fija
  `APP_SCHEME=http` y `SESSION_SECURE_COOKIE=false`; activar TLS sigue siendo
  manual (deuda de hs-install).
- Abrir 443/TCP en el firewall del servidor.
- Retirar el mapeo del puerto 6001 cuando todos los clientes usen WSS y
  actualizar `scripts/validate_lan_client.ps1` (hoy prueba 6001). Mientras
  siga el modo HTTP, Soketi se publica a proposito en
  `${SOKETI_BIND_IP:-0.0.0.0}:6001`; el instalador ya escribe
  `SOKETI_BIND_IP=0.0.0.0` en modo LAN y `127.0.0.1` en modo una PC. Al adoptar
  TLS/WSS basta fijar `SOKETI_BIND_IP=127.0.0.1` en `.env` y recrear el
  servicio `soketi`; no requiere recompilar el frontend.
- Prueba real desde una segunda PC con la CA instalada y flujos autenticados;
  la impresion fisica no depende de TLS pero sigue pendiente.
- La CA local da confianza interna; no sustituye un certificado institucional
  publico ni una firma de codigo.

## 10. Verificacion M-W1-SEC-01 (revalidacion, no certificacion)

- `docker compose config` (base y overlay) valida sintaxis: `EXIT=0` con
  placeholders sinteticos, sin levantar servicios y sin tocar secretos.
- Coherencia renderizada confirmada: base = `APP_URL http`, `SESSION_SECURE_COOKIE
  false`, `PUSHER_CLIENT_SCHEME http`, `PUSHER_CLIENT_PORT 6001`; overlay =
  `APP_URL https`, `SESSION_SECURE_COOKIE true`, `PUSHER_CLIENT_SCHEME wss`,
  `PUSHER_CLIENT_PORT 443`, `SANCTUM_STATEFUL_DOMAINS` con host `:443` y nginx
  publicando 443.
- `mysql` y `backend` no publican puertos en `docker-compose.prod.yml`.
- HSTS sigue condicionado a `APP_ENV=production` + request segura
  (`AddSecurityHeaders`); el puerto 80 no emite HSTS ni redirige.
- Evidencia: `hospital-ai/evidencia/M-W1-SEC-01/`.

