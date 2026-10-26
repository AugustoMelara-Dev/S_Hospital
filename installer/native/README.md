# Entrega nativa de S_Hospital para un PC Windows

Este paquete instala S_Hospital para operar sin Internet en una sola computadora
Windows x64. El equipo de destino no necesita Docker, Node.js, Composer, PHP,
MariaDB, Caddy ni WinSW instalados previamente: esos runtimes viajan dentro del
instalador y sus hashes se validan antes de construir el payload.

## Arquitectura instalada

- `%ProgramFiles%\S_Hospital\releases\<version>-<hash>` contiene código y runtimes
  inmutables. `%ProgramFiles%\S_Hospital\current` es un junction NTFS hacia la
  revisión activa. El hash proviene del contenido del manifiesto, por lo que una
  reconstrucción corregida de la misma versión no se confunde con la ya instalada.
- `%ProgramData%\S_Hospital` contiene configuración, base de datos, cachés,
  respaldos, logs, estado y staging. No se guarda información mutable dentro de
  una release.
- Caddy escucha sólo en `127.0.0.1:8000`; PHP FastCGI en `127.0.0.1:9070`; y
  MariaDB en `127.0.0.1:3307`. La instalación de un PC no expone puertos a la LAN.
- MariaDB, PHP, Caddy, las dos colas y el scheduler arrancan como servicios
  automáticos. Los procesos de aplicación usan `NT AUTHORITY\LocalService`, no
  una cuenta administrativa.
- El acceso al iniciar sesión abre la aplicación y conserva el login normal de
  S_Hospital. No existe login automático ni excepción de autenticación.

Los secretos de aplicación se escriben atómicamente en ProgramData antes de
iniciar procesos y la ACL permite acceso sólo a administradores, SYSTEM y al
servicio local donde corresponde. La credencial administrativa de MariaDB se
protege con DPAPI de máquina en `config\database-admin.dpapi` y su archivo queda
limitado a SYSTEM y Administradores. No se pasa por argumentos, variables de
entorno ni logs.

## Construcción reproducible

La primera preparación de la máquina de construcción necesita Internet para
obtener runtimes y dependencias. Con las cachés verificadas y las dependencias
de producción disponibles, la reconstrucción puede hacerse sin descargar nada.
Nunca se ejecutan estas tareas en el equipo hospitalario de destino.

1. Produzca `frontend/dist` una sola vez después del gate final del frontend.
2. Cree un staging separado del backend y ejecute Composer con
   `install --no-dev --classmap-authoritative`; no modifique `backend/vendor` del
   árbol de trabajo.
3. Descargue runtimes fijados y compruebe sus hashes:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native/fetch_native_runtimes.ps1 `
     -CacheRoot artifacts/native-cache
   ```

4. Arme el payload con el backend de producción y el `dist` final:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native/build_native_payload.ps1 `
     -ProjectRoot . `
     -ProductionBackendRoot artifacts/native-staging/backend-2026.10.24.8 `
     -FrontendDistRoot frontend/dist `
     -RuntimeCache artifacts/native-cache `
     -OutputRoot artifacts/native-payload-2026.10.24.8 `
     -Version 2026.10.24.8 `
     -DatabaseUpdatePolicy backward_compatible_additive
   ```

5. Prepare Inno Setup 6.5.4 en modo portátil dentro de la caché. El script fija
   URL, SHA-256 y editor de la firma, y no registra el compilador en Windows:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native/prepare_inno_compiler.ps1 `
     -CacheRoot artifacts/tool-cache
   ```

6. Compile el instalador desde esa copia aislada:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/native/build_native_installer.ps1 `
     -PayloadRoot artifacts/native-payload-2026.10.24.8 `
     -Version 2026.10.24.8 `
     -IsccPath artifacts/tool-cache/inno-6.5.4-portable/ISCC.exe
   ```

`installer/native/runtime-sources.json` fija versión, URL HTTPS, algoritmo,
hash y procedencia de checksum. Las fuentes primarias son los metadatos de
[PHP para Windows](https://windows.php.net/downloads/releases/releases.json),
el archivo oficial de [MariaDB 11.4.13](https://archive.mariadb.org/mariadb-11.4.13/winx64-packages/sha256sums.txt),
los [checksums de Caddy 2.11.4](https://github.com/caddyserver/caddy/releases/download/v2.11.4/caddy_2.11.4_checksums.txt)
y el release oficial de [WinSW 2.12.0](https://github.com/winsw/winsw/releases/tag/v2.12.0).
WinSW no publica checksum en ese release; el manifiesto registra el SHA-256 del
asset oficial y el fetcher lo exige byte por byte.
El quinto artefacto es el [Microsoft Visual C++ Redistributable x64 v14](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170),
fijado en la versión 14.51.36247.0 mediante la URL versionada de Microsoft. El
instalador comprueba además su firma Authenticode y lo instala con las
[opciones silenciosas oficiales](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170)
antes de iniciar PHP o MariaDB. Un código 3010 queda registrado para que Windows
solicite reinicio al cerrar el instalador.

El candidato `.8` incorpora dos migraciones de impuestos: crea `tax_rates`,
añade `services.tax_rate_id` nullable y enlaza servicios gravados con la tasa
preexistente. Conserva todas las migraciones anteriores y los snapshots de
facturas. Por eso declara `backward_compatible_additive`; el valor predeterminado
`no_schema_change` rechazaría correctamente esa actualización. Esta declaración
requiere revisar las migraciones de cada release y no debe copiarse sin revisión.

El payload incluye `LEEME.txt`, con los pasos de configuración de cada hospital.
Al preparar el kit copie también la guía vigente y la entrega actual con los
nombres `GUIA_UNA_COMPUTADORA.md` y `ENTREGA_ACTUAL.md`, junto al EXE y
`SHA256SUMS.txt`. No incluya binarios del kit en Git.

## Instalación y primer acceso

El instalador pide elevación una vez, valida el payload completo, inicializa
MariaDB sin colocar contraseñas en la línea de comandos, ejecuta migraciones y
únicamente `ProductionInstallationSeeder`: roles/permisos, caja, perfiles y
serie de recibo institucional, y catálogo inicial autorizado. No usa
`DatabaseSeeder`, factories ni datos de validación. Después muestra el formulario protegido
para crear el primer administrador; la contraseña viaja por stdin y el usuario
debe cambiarla al iniciar sesión.

La primera apertura lleva a Administración > Ajustes después del login. La
institución debe ingresar sus datos reales: nombre legal, RTN, tasa fiscal
vigente y secuencia autorizada con CAI, rango y vencimiento. El instalador no
inventa esos valores y declara `BillingReady=false` hasta completar esa tarea.
El papel inicial es carta con dos zonas; no se pide elegirlo al instalar.

La instalación queda incompleta si se cierra ese formulario. Un diario en
`ProgramData\S_Hospital\state\native-install-state.json` permite reanudar la
misma versión sin convertirla erróneamente en actualización. Al terminar se
comprueban los seis servicios, `GET /up`, un respaldo cifrado y su descifrado de
verificación. El resultado declara honestamente que la copia es sólo local hasta
que la institución exporte el kit y una copia a una unidad removible o UNC.

El menú Inicio incluye:

- **Abrir S_Hospital**.
- **Recuperar acceso a S_Hospital**, elevado y con consola visible para la
  recuperación interactiva.
- **Respaldos y recuperación de S_Hospital**, elevado, para exportar el kit a un
  destino externo real, validar un respaldo y ejecutar una restauración
  confirmada.

## Actualizaciones y recuperación

El mismo EXE sirve para instalar y actualizar. Un mutex del instalador y otro
del motor impiden dos mutaciones simultáneas. Detecta la base persistente en
ProgramData, muestra el modo **Actualizar S_Hospital** y no vuelve a abrir el
asistente de datos institucionales. Una actualización offline valida otro payload completo, crea y verifica un
payload y su identidad exacta, lo prepara con la aplicación todavía activa,
detiene todos los writers y espera estado `Stopped`, crea y verifica por ID el
respaldo cifrado definitivo, ejecuta
las migraciones con el runtime candidato, cambia el junction `current`, espera
los cinco servicios de aplicación en `Running`, comprueba `/up` usando el
`APP_URL` persistido y crea otro respaldo verificado. No vuelve a sembrar el
catálogo. Una actualización estándar rechaza cambios de versión de MariaDB.
También rechaza downgrades y cualquier paquete que elimine o modifique una
migración ya instalada. El paquete declara `database_update_policy`: el valor
predeterminado `no_schema_change` rechaza migraciones nuevas; sólo una release
revisada como `backward_compatible_additive` puede agregarlas, de forma que el
código anterior siga funcionando durante un rollback. La base de datos,
configuración, respaldos y archivos persistentes permanecen en ProgramData.
Con los writers detenidos también elimina los caches Laravel persistentes
conocidos (configuración, rutas, eventos, paquetes, servicios y vistas) después
del respaldo y antes de migrar. Ambos releases arrancan sin reutilizar código
compilado por la versión contraria; cualquier ruta inesperada o reparse point
aborta el update y reactiva la versión seleccionada.

La release previa se conserva. Si el código nuevo no arranca, el actualizador
restaura el junction anterior y confirma servicios y salud. Una migración
aditiva compatible permanece aplicada y no se vuelve a sembrar ni se ejecuta
un `down`; el respaldo previo es la vía separada de recuperación de datos. Un
corte entre los dos renombres de `current` se detecta
en el siguiente intento mediante `current.previous-*`.

El wizard de recuperación primero restaura hacia una base desechable nueva y
verifica estructura, relaciones, dinero, triggers y lectura/escritura. El modo
Replace exige confirmación local, motivo, backup preventivo y health posterior;
mantiene la base anterior para rollback. Kit, frase y confirmación se envían por
stdin y no aparecen en argumentos ni logs.

Los comandos PHP elevados usan un `php.ini`, caché Laravel y directorio de scan
creados dentro de `config\administrator-only`. Ignoran `PHPRC`, rutas de caché
y binarios auxiliares heredados del servicio. Esto evita que un proceso de
servicio con permisos sobre datos mutables inyecte código en una operación de
mantenimiento administrativa.

## Licencias de terceros

Los archivos de licencia de PHP, MariaDB y Caddy se conservan al extraer sus
distribuciones oficiales. El constructor añade `runtime/winsw/LICENSE.txt`
desde `installer/native/licenses/WinSW-2.12.0-LICENSE.txt`, copia del aviso MIT
del [tag oficial 2.12.0](https://github.com/winsw/winsw/blob/v2.12.0/LICENSE.txt).
Las dependencias PHP mantienen sus avisos dentro de `vendor`. Visual C++
Redistributable y Windows/Edge conservan sus propias condiciones; incluirlos o
usarlos no convierte sus licencias en licencias libres. No se requiere un SaaS
ni una suscripción Docker para operar el sistema instalado.

## Evidencia que aún debe producirse

Los contratos PowerShell y el modo sandbox no sustituyen la certificación del
instalador. Antes de certificar Windows limpio se requiere ejecutar el EXE en una VM
Windows limpia sin PHP/MariaDB/Docker/Node, reiniciar, probar inicio de servicios
y apertura al login, completar el flujo UI con backend real, validar backup y
restore desechable, y repetir update/rollback. Impresora, política institucional,
unidad externa siguen siendo comprobaciones del entorno de entrega; no se
consideran certificadas por el código. La entrega actual se prepara sin firma
Authenticode por decisión del propietario; la guía explica el aviso de
SmartScreen y la verificación de procedencia y hash.

Los SHA-256 del manifiesto detectan archivos incompletos o modificados dentro
del payload, pero por sí solos acreditan integridad, no la identidad del editor.
Este candidato no tiene firma Authenticode y su hash debe recibirse por un
canal de confianza junto con el instalador.
