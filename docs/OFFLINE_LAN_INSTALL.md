# Offline LAN Install - Hospital Billing OS

## Proposito

Este documento separa el entorno Docker de desarrollo de una instalacion de produccion offline LAN. Docker Compose facilita desarrollo reproducible, pero produccion no debe depender de descargar paquetes desde internet al arrancar.

## Topologia de produccion

- Una PC servidor ejecuta Laravel API, frontend compilado, MySQL/MariaDB y backups.
- Clientes usan navegador en la red local.
- Los clientes no deben usar `localhost` para entrar al sistema, porque `localhost` apunta a la computadora cliente.
- Usar IP fija o nombre local del servidor, por ejemplo `http://192.168.1.10`.
- El despliegue recomendado para produccion es same-origin: frontend compilado y API publicados bajo el mismo host/puerto o dominio LAN.

## Desarrollo con Docker

Docker Compose en este repositorio es solo para desarrollo:

```bash
docker compose config
docker compose up -d
```

Servicios:

- `backend`: Laravel en `http://localhost:8000`.
- `frontend`: Vite React en `http://localhost:5173`.
- `mysql`: MariaDB local para desarrollo.

El servicio frontend puede ejecutar `npm install` y el backend puede ejecutar `composer install` al iniciar en desarrollo. Esa estrategia no es aceptable como requisito de produccion offline.

### Variables de entorno Docker

- `backend/.env.example` es para instalacion local normal.
- `backend/.env.docker.example` es solo para Docker de desarrollo y usa `DB_HOST=mysql`.
- Docker Compose carga `backend/.env.docker.example` y, si falta `backend/.env`, crea una copia inicial para desarrollo.
- No copiar `backend/.env.example` dentro del contenedor Docker, porque sus valores locales como `DB_HOST=127.0.0.1` no sirven dentro de Compose.
- `php artisan key:generate --force` se ejecuta solo al crear el `.env` Docker inicial de desarrollo.
- Produccion offline LAN debe usar un `.env` real creado manualmente en el servidor, con secretos locales fuera de Git.

## Produccion offline LAN

Antes de instalar en el hospital:

1. Preparar artefactos con internet en una maquina de build controlada.
2. Ejecutar `composer install --no-dev --optimize-autoloader` para backend.
3. Ejecutar `npm ci` y `npm run build` para frontend.
4. Copiar backend, `vendor/`, frontend compilado y configuracion al servidor.
5. Instalar MySQL/MariaDB local en el servidor.
6. Configurar `.env` real fuera del repositorio con secretos locales, `APP_ENV=production` y `APP_DEBUG=false`.
7. Configurar `APP_URL`, `SANCTUM_STATEFUL_DOMAINS` y CORS con la IP fija o dominio LAN final, por ejemplo `192.168.1.10`.
8. Generar `APP_KEY` en el servidor.
9. Ejecutar migraciones aprobadas sin `migrate:fresh`.
10. Crear admin real con `php artisan auth:create-initial-admin`; no ejecutar seeders demo.
11. Ejecutar `php artisan config:cache`.
12. Publicar por IP fija LAN o nombre local.
13. Levantar worker local de backups como servicio/tarea continua con `php artisan queue:work --queue=backups --tries=1 --timeout=600`.
14. Validar `/up`, `/login` y `/verify-email`.

En publicacion same-origin con Laravel, `/`, `/login` y `/verify-email` sirven el build React desde `frontend/dist/index.html`, y `/assets/*` sirve los assets compilados. Si `frontend/dist` no existe, el servidor responde error operativo y no debe entregarse como listo.

No entregar un servidor LAN real con `APP_ENV=local`. Los usuarios `admin.demo`, `supervisor.demo` y `cajero.demo` pertenecen solo a desarrollo/testing.

## Red local y Arquitectura Multi-Estación (3+ concurrentes)

El sistema está diseñado de forma nativa para soportar múltiples estaciones de trabajo (ej. Admisión, Caja Principal, Caja de Diálisis) conectadas de forma concurrente a un solo Servidor Central:

1. **PC Servidor Central**:
   - Es la computadora donde se ejecuta el backend Laravel, la base de datos MariaDB y el frontend compilado (servido por Nginx).
   - Es la única PC que requiere instalación y configuración de bases de datos.
   - Debe permanecer encendida durante todo el horario operativo.

2. **Estaciones Clientes (Cajas / Admisión)**:
   - Son las computadoras desde las cuales facturarán los cajeros.
   - **No requieren instalación de ningún tipo**. No necesitan Docker, PHP, Composer ni Node.
   - Solo necesitan abrir un navegador web moderno (Google Chrome o Microsoft Edge recomendado) e ingresar a la URL del servidor local: `http://<IP_DEL_SERVIDOR>:8000`.

### Configuración del Servidor: IP Fija (Estática) en Windows

Para evitar que las estaciones clientes pierdan la conexión al reiniciar el router del hospital (lo cual cambia la IP del servidor si está en automático/DHCP), es MANDATORIO configurar una IP Estática en el Servidor:

1. Abra el **Panel de Control** en Windows.
2. Vaya a **Centro de redes y recursos compartidos** > **Cambiar configuración del adaptador**.
3. Haga clic derecho sobre su conexión de red activa (Ethernet o Wi-Fi) y seleccione **Propiedades**.
4. Seleccione **Protocolo de Internet versión 4 (TCP/IPv4)** y haga clic en **Propiedades**.
5. Seleccione **Usar la siguiente dirección IP** e ingrese:
   - **Dirección IP**: Una IP libre en el rango de su red (ej. `192.168.1.150`).
   - **Máscara de subred**: Normalmente `255.255.255.0`.
   - **Puerta de enlace predeterminada**: La IP de su router (ej. `192.168.1.1`).
6. En DNS use los de su red o DNS locales. Guarde y acepte los cambios.
7. Escriba esta IP en el script de instalación (`scripts/deploy_hospital_lan.ps1`).

### Firewall y Perfil de Red: Pública vs Privada

Por defecto, Windows Defender Firewall bloquea todo tráfico entrante en redes marcadas como **Públicas** (para proteger su PC en cafeterías o aeropuertos). En el hospital, para que los clientes accedan al servidor, el perfil de red del servidor debe configurarse como **Privado**:

1. En la barra de tareas de Windows, haga clic en el ícono de red (Wi-Fi o Ethernet).
2. Haga clic en **Propiedades** de la red a la que está conectado.
3. En **Perfil de red**, seleccione **Privada** (esto permite que otras computadoras en la LAN vean su servidor).
4. El instalador `scripts/deploy_hospital_lan.ps1` creará automáticamente la regla de excepción de firewall para permitir conexiones entrantes en el puerto 8000 dentro del perfil privado.

---

## Impresora térmica en Multi-Estación

Cada estación de caja puede tener su propia impresora térmica conectada localmente por USB, o compartir una sola impresora en la red local:

1. **Conexión Local (USB por Estación)**:
   - Conecte la impresora térmica (80mm o 58mm) a la estación cliente mediante USB.
   - Instale el driver oficial del fabricante en esa estación cliente.
   - Cuando el cajero imprima desde Chrome/Edge, el navegador detectará la impresora conectada directamente por USB.

2. **Compartir Impresora en Red**:
   - Si la impresora está físicamente conectada al Servidor, vaya a **Impresoras y Escáneres** en Windows Server.
   - Propiedades de la Impresora > pestaña **Compartir** > activar **Compartir esta impresora**.
   - En las estaciones clientes, agregue la impresora de red navegando por la ruta de red del servidor (ej. `\\<IP_DEL_SERVIDOR>\NombreImpresora`).

3. **Parámetros del Navegador (Esencial para evitar descuadres)**:
   - Margen: Seleccionar **Ninguno** o **Mínimo**.
   - Escala: **100%** (no usar "Ajustar al área de impresión").
   - Opciones: Desmarcar **Encabezados y pies de página** para evitar que se imprima la URL y la fecha del navegador arriba y abajo del recibo térmico.

---

## Backups y Resiliencia


## Variables de entorno y artefactos

- El `.env` real debe vivir solo en el servidor y fuera de Git.
- Produccion debe usar `APP_ENV=production` y `APP_DEBUG=false`.
- No commitear credenciales, passwords de DB, `APP_KEY` ni rutas privadas.
- Produccion debe arrancar con `vendor/` y `frontend/dist` ya preparados.
- No ejecutar `composer install` ni `npm install` como parte del arranque de produccion offline.
- No ejecutar `php artisan migrate:fresh` en servidor real. Ese comando borra datos
  historicos y solo pertenece a bases descartables de desarrollo/testing.

## Actualizacion controlada

1. Avisar ventana de mantenimiento.
2. Crear backup local y copiarlo a USB antes de actualizar.
3. Copiar artefactos nuevos ya construidos: backend, `vendor/`, frontend compilado.
4. Revisar `.env` real sin reemplazar secretos.
5. Ejecutar migraciones aprobadas sin `php artisan migrate:fresh`.
6. Ejecutar `php artisan config:cache`.
7. Reiniciar o validar el worker local de backups.
8. Validar `/up`, `/login`, `/verify-email`.
9. Entrar como admin y revisar facturas, caja, reportes y backups.

## Validacion manual post-instalacion

- Desde servidor: `/up` responde OK.
- Desde cliente LAN: `/login` carga usando IP fija del servidor.
- Desde cliente LAN: `/verify-email` responde con la SPA o la ruta esperada documentada.
- Desde cliente LAN: un asset `/assets/*.js` responde como `text/javascript` y un asset `/assets/*.css` responde como `text/css`.
- Desde cliente LAN: login local completa sin 419 CSRF usando el host/IP final configurado en `SANCTUM_STATEFUL_DOMAINS`.
- Admin inicia sesion y ve configuracion/backups.
- Cajero inicia sesion, abre caja, crea factura de prueba y puede imprimir recibo.
- Supervisor/admin ve reporte diario.
- Backup manual queda `pending` y luego `success` cuando el worker corre; si falta herramienta de dump en servidor, queda `failed` con causa operativa sin credenciales.
- Restore de prueba documentado antes de operar datos reales.

## Evidencia Fase 11 local

- Restore real MySQL/MariaDB fue validado en MariaDB XAMPP local contra `hospital_restore_validation_test`.
- Concurrencia real fue validada contra `http://192.168.1.7:8000` con `RUN_ID=concurrency-validation-20260517T20435`.
- Rutas por IP desde servidor respondieron para `/up`, `/login`, `/verify-email` y assets.
- No se declara LAN fisica completa hasta repetir el checklist desde otra computadora cliente.
- No se declara impresora fisica validada hasta imprimir 80mm/58mm en hardware real.

## Scripts de validacion real

Restore:

```bash
HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_test bash scripts/validate_restore_mysql.sh
```

Concurrencia:

```bash
HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONCURRENCY_BASE_URL=http://IP_DEL_SERVIDOR bash scripts/validate_mysql_concurrency.sh
```

No ejecutar `php artisan migrate:fresh --seed` en el servidor real. Ese comando borra la base activa y solo pertenece a entornos descartables de desarrollo/testing.

## Riesgos

- Si el servidor se apaga, ningun cliente puede facturar.
- IP dinamica rompe acceso de clientes.
- Cortes de energia pueden afectar datos; se recomienda UPS.
- Sin restore probado, los backups no deben considerarse completos.
