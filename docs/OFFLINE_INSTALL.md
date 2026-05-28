# Hospital Billing OS - Manual de Instalación Offline en Servidor LAN

Este manual detalla cómo preparar y desplegar el sistema **Hospital Billing OS** en una computadora servidor de hospital que **no cuenta con acceso a internet**.

---

## Estructura del Despliegue

1. **PC Servidor Central**:
   * Ejecuta los contenedores Docker (Base de Datos MariaDB, Backend Laravel, Servidor Web Nginx y Worker de Backups).
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
   cd c:\Projects\S_Hospital
   ```
3. Ejecute el script generador:
   ```powershell
   .\scripts\make_offline_release.ps1
   ```

### ¿Qué hace este script?
* Compila las imágenes de producción locales utilizando Docker Compose.
* Exporta en formato `.tar` las imágenes de:
  * `s_hospital-backend` -> `backend.tar`
  * `s_hospital-queue-worker` -> `queue-worker.tar`
  * `nginx:1.25-alpine` -> `nginx.tar`
  * `mariadb:11` -> `mariadb.tar`
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
2. Abra la carpeta y asegúrese de que contenga el subdirectorio `offline-images` con los 4 archivos `.tar`.
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
