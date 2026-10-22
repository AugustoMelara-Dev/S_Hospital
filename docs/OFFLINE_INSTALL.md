# Hospital Billing OS - Manual de Instalación Offline en Servidor LAN

Este manual detalla cómo preparar y desplegar el sistema **Hospital Billing OS** en una computadora servidor de hospital que **no cuenta con acceso a internet**.

---

## Runtime y licencia (leer antes de comprar o instalar)

El camino empaquetado en Windows usa **Docker Desktop**, que para una entidad
gubernamental (un hospital público) exige una **suscripción pagada**; la exención
de "pequeña empresa" no aplica. **Docker Engine** es Apache-2.0 y no requiere
suscripción, pero exige un host Linux. La decisión es institucional y está
separada del trabajo técnico: ver `docs/OFFLINE_RUNTIME_LICENSE.md`. No se debe
declarar producción hasta resolverla y registrarla.

## Integridad del paquete (checksums no son firma)

Las imágenes se verifican por SHA-256 antes de `docker load` y el paquete tiene
manifiestos. Eso detecta alteración accidental, pero **no demuestra procedencia**:
un hash en la misma USB no es una firma. Ver `docs/OFFLINE_RELEASE_INTEGRITY.md`.

## Dirección LAN sin recompilar

El frontend se compila una sola vez y usa rutas same-origin (`/api`,
`/sanctum`); la IP o el nombre del servidor se resuelven en tiempo de ejecución
desde `.env` (`SERVER_IP`, `APP_PORT`, `SANCTUM_STATEFUL_DOMAINS`,
`CORS_ALLOWED_ORIGINS`, `PUSHER_CLIENT_*`). Cambiar la IP del servidor no exige
recompilar el frontend: se actualiza `.env` y se recrean los contenedores
(opción 4 del instalador o `scripts/refresh_lan_ip.ps1`).

---

## Ruta recomendada: una sola computadora

Para la instalacion habitual en una sola PC, copie el paquete completo al disco local y haga doble clic en `setup.bat`. Windows solicitara permiso de administrador y el resto del flujo sera automatico.

1. Selecciona automaticamente **Esta computadora** y Docker.
2. Genera sin preguntas las contrasenas de MariaDB, aplicacion, respaldos y tiempo real.
3. Ejecuta migraciones, conserva cualquier base existente y crea `admin.local` solamente cuando no existe un administrador.
4. Guarda en el Escritorio `CREDENCIALES INICIALES S_HOSPITAL.txt`; la contrasena es temporal y debe cambiarse al primer ingreso.
5. Crea y valida un respaldo local cifrado con checksum SHA-256.
6. Crea los accesos `S_Hospital` y `Mantenimiento S_Hospital`.
7. Registra el inicio automatico: al iniciar sesion en Windows espera Docker, levanta el sistema y verifica `/up`.

El nombre legal del hospital, RTN y CAI no se inventan durante la instalacion. El administrador los registra una sola vez dentro de Configuracion con los documentos reales de la institucion.

El modo LAN es opcional. Seleccionelo solamente cuando otras computadoras deban entrar al mismo servidor; no instale bases de datos independientes por estacion.

Si cualquier comprobacion obligatoria falla, el asistente muestra **Instalacion requiere atencion** y `setup.bat` devuelve error. No use el sistema hasta corregir los puntos indicados.

## Estructura del Despliegue

1. **PC Servidor Central**:
   * Ejecuta los contenedores Docker del stack de produccion: backend, nginx, mysql, queue-worker, realtime-worker, scheduler y soketi.
   * Requiere Docker Desktop preinstalado.
   * Debe configurarse con una **IP Estática** y perfil de red **Privado**.
2. **Estaciones Cliente (Cajeros, Admisión)**:
   * Acceden al sistema a través de su navegador Chrome/Edge ingresando a `http://<IP_DEL_SERVIDOR>:8000`.
   * **No requieren instalación alguna**.

---

## Fase 1: Generación del Paquete Offline (En máquina con Internet)

Para preparar el paquete de instalación, realice los siguientes pasos en una máquina de desarrollo con conexión a internet y Docker Desktop en ejecución:

1. Abra una terminal de PowerShell como Administrador.
2. Navegue al directorio raíz del proyecto:
   ```powershell
   cd RUTA_DEL_REPOSITORIO
   ```
3. Ejecute el script generador:
   ```powershell
   .\scripts\make_offline_release.ps1
   ```

### ¿Qué hace este script?
* Compila las imágenes de producción locales utilizando Docker Compose.
* Exporta en formato `.tar` las 6 imágenes de producción:
  * `s_hospital-prod-backend:latest` -> `backend.tar`
  * `s_hospital-prod-queue-worker:latest` -> `queue-worker.tar`
  * `s_hospital-prod-scheduler:latest` -> `scheduler.tar`
  * `nginx:1.25.4-alpine` -> `nginx.tar`
  * `mariadb:11.4.3` -> `mariadb.tar`
  * `quay.io/soketi/soketi:1.6-16-alpine` -> `soketi.tar`
* Copia únicamente los archivos de configuración y scripts indispensables para correr en producción en la carpeta `offline-release/`.
* Calcula los hashes SHA256 de verificación.
* Genera un reporte `MANIFEST.txt` con la información del build.

4. Copie la carpeta generada `offline-release/` completa a una memoria USB.

---

## Fase 2: Instalación en el Servidor del Hospital (Sin Internet)

Una vez en el hospital, realice los siguientes pasos en la computadora que actuará como **servidor**:

### Requisitos Previos en el Servidor:
1. **Docker Desktop** debe estar instalado y en ejecución. (Si el servidor no tiene Docker, descargue el instalador ejecutable de Docker Desktop previamente en la máquina con internet y ejecútelo en el servidor).
2. La red local del servidor debe estar configurada como **Privada**.
3. Configure la **IP Estática** (ej. `192.168.1.100`) en la configuración del adaptador de Windows del servidor.

### Pasos de Despliegue:

1. Conecte la memoria USB y copie la carpeta `offline-release` en el disco local del servidor (ej. en `C:\S_Hospital`).
2. Abra la carpeta y asegúrese de que contenga el subdirectorio `offline-images` con los 6 archivos `.tar` (backend, queue-worker, scheduler, nginx, mariadb y soketi).
3. Haga clic derecho sobre `setup.bat` y seleccione **Ejecutar como Administrador**.
4. En el menú, elija la opción **[1] Despliegue en Contenedores Docker**.
5. Confirme la dirección IP estática del servidor (el script intentará autodetectarla).
6. El instalador detectará automáticamente el modo offline y procederá a:
   * Ejecutar `docker load` para importar cada una de las imágenes `.tar`.
   * Generar los secretos seguros para el archivo `.env`.
   * Levantar los contenedores sin buscar descargar nada de internet.
   * Ejecutar las migraciones y seeders de la base de datos MariaDB.
   * Solicitarle crear las credenciales del Administrador Inicial.
   * Habilitar la regla de entrada en el Firewall para el puerto 8000.
7. Al finalizar, el script mostrará las URLs de acceso.

---

## Verificación

* Desde el servidor, abra su navegador e ingrese a: `http://localhost:8000`.
* Desde cualquier estación cliente conectada al mismo router, abra el navegador e ingrese a: `http://<IP_DEL_SERVIDOR>:8000`.
* Verifique que puede iniciar sesión con el usuario administrador creado durante el asistente.
