# Instalador único de Windows y entrega en memoria USB

## Resultado

El proceso genera un asistente gráfico en español:

```text
installer-output/
└── ENTREGA-USB/
    ├── S_Hospital-Instalador.exe
    ├── S_Hospital-Instalador.exe.sha256
    ├── LEEME-INSTALACION.txt
    └── Docker Desktop Installer.exe  (solo si se proporcionó al construir)
```

`S_Hospital-Instalador.exe` contiene el paquete offline completo: aplicación,
API, imágenes de MariaDB, Nginx y Soketi, automatización de arranque, accesos
directos, respaldos y restauración. Inno Setup solo se necesita en la PC de
desarrollo; no se instala en el hospital.

## Generar el instalador

Requisitos en la PC de desarrollo:

- Windows 10/11 de 64 bits.
- Docker Desktop funcionando.
- Inno Setup 6 instalado desde <https://jrsoftware.org/isdl.php>.
- Repositorio ubicado en la revisión que se entregará.

Desde PowerShell, en la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build_windows_installer.ps1
```

Si la PC del hospital todavía no tiene Docker Desktop, descargar previamente
su instalador oficial y agregarlo a la entrega:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts\build_windows_installer.ps1 `
  -DockerDesktopInstallerPath "C:\Descargas\Docker Desktop Installer.exe"
```

El segundo comando vuelve a validar el paquete offline antes de compilar. Si
falta una imagen, cambió un archivo o existe una inconsistencia, se detiene y
no genera una entrega aparentemente válida.

## Qué copiar a la memoria USB

1. Formatear o usar una memoria USB confiable, preferiblemente exFAT.
2. Copiar completa la carpeta
   `installer-output\ENTREGA-USB`.
3. No copiar el repositorio, `node_modules`, `vendor` ni archivos `.env`.
4. Expulsar la memoria de forma segura.
5. Conservar una segunda copia de la misma entrega fuera de la memoria USB.

Si el equipo destino no tiene Docker Desktop, la carpeta debe incluir también
`Docker Desktop Installer.exe`. Docker Desktop tiene términos de licencia
propios; la institución debe comprobar que su uso está permitido.

## Instalación en el hospital

1. Iniciar sesión con un usuario que pueda aceptar permisos de administrador.
2. Si Docker Desktop no está instalado, ejecutar primero
   `Docker Desktop Installer.exe` y reiniciar Windows cuando se solicite.
3. Copiar `S_Hospital-Instalador.exe` de la USB al Escritorio.
4. Hacer doble clic, aceptar el aviso de Windows y seguir
   **Siguiente → Instalar**.
5. Esperar a que termine la configuración automática. No cerrar la ventana.
6. Abrir S_Hospital mediante el icono creado en el Escritorio.
7. Cambiar la contraseña inicial, guardar la nueva de forma segura y eliminar
   el archivo temporal de credenciales del Escritorio.
8. Registrar una sola vez los datos legales reales del hospital en
   **Configuración**: nombre, RTN, dirección, CAI y numeración fiscal cuando
   correspondan.
9. Crear una factura de prueba, cobrarla, imprimirla y ejecutar un respaldo
   manual antes de entregar el equipo.
10. Reiniciar Windows y confirmar que Docker Desktop y S_Hospital inician
    automáticamente.

La aplicación queda en `C:\S_Hospital`. No se ofrece desinstalación automática
porque borrar esa carpeta sin un procedimiento controlado podría perder las
claves necesarias para restaurar los respaldos. Los datos institucionales no
se inventan ni se incluyen en el instalador.

## Verificar integridad

En PowerShell, dentro de `ENTREGA-USB`:

```powershell
Get-FileHash .\S_Hospital-Instalador.exe -Algorithm SHA256
Get-Content .\S_Hospital-Instalador.exe.sha256
```

Los dos valores deben coincidir. Si no coinciden, no instalar.

## Firma de Windows

El ejecutable funciona sin firma de código, pero Windows puede mostrar
“Editor desconocido”. Para una distribución institucional definitiva se
recomienda firmarlo con un certificado de firma de código emitido a nombre de
la institución. No se debe crear ni simular ese certificado dentro del
repositorio.
