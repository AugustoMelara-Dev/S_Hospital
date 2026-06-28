# V1.2 Before Screenshots

Fecha: 2026-06-26T13:25:58Z

Base URL: `http://192.168.1.10:8081`

Usuario QA intentado: `admin.validacion`

Mutaciones permitidas: NO

## Resultado

Captura publica realizada:

- `login.png`

Capturas autenticadas bloqueadas:

- dashboard
- billing empty
- billing cart
- payment modal
- invoice confirmation
- cashbox
- invoice history
- reports executive
- reports cash
- reports services
- receipt settings
- receipt preview
- catalog
- backups
- fiscal settings
- users
- help/about
- 404
- access denied
- mobile dashboard
- mobile billing
- mobile reports

## Motivo del bloqueo

El runtime `http://192.168.1.10:8081` respondio correctamente en `/login`, pero rechazo las credenciales demo documentadas:

- Usuario: `admin.validacion`
- Respuesta: HTTP 422
- Mensaje: `Las credenciales no son validas.`

No se modificaron usuarios, contrasenas, base de datos ni estado operativo.

## Reintento

Con credenciales QA autorizadas:

```powershell
$env:V1_2_BEFORE_BASE_URL='http://192.168.1.10:8081'
$env:V1_2_BEFORE_USER='usuario.qa'
$env:V1_2_BEFORE_PASSWORD='password-qa'
node qa\visual-smoke\v1-2-before-screenshots.mjs
```

Para capturas que creen/cobren factura solo usar entorno descartable y agregar:

```powershell
$env:V1_2_ALLOW_MUTATIONS='1'
```
