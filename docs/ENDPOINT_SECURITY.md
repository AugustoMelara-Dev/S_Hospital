# Seguridad de Endpoints - S_Hospital (subagente 21)

## Proposito

Reducir riesgos por virus, malware, ransomware, USBs y equipos contaminados en las PCs donde corre el sistema o se accede a el.

## Antivirus y antimalware

- Activar Windows Defender o el antivirus corporativo en todas las PCs del hospital.
- Programar escaneo completo al menos 1 vez por semana fuera del horario de caja.
- Mantener las firmas actualizadas; si el hospital no tiene internet, descargar firmas en una PC de soporte y transferirlas por USB siguiendo politica del hospital.
- Cualquier alerta de malware en PC de caja, servidor o administrador debe aislar la PC de la red hasta limpieza verificada.

## Politica de USB

- El servidor del hospital NO debe tener habilitada la ejecucion automatica de USBs.
- Desactivar auto-run en Windows por GPO local o clave de registro:
  - `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer\NoDriveTypeAutoRun = 0xFF`
  - `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer\NoAutorun = 1`
- Solo personal autorizado (responsable tecnico) puede conectar USBs al servidor.
- USBs personales de cajeros, medicos o pacientes no deben conectarse a ninguna PC del hospital.

## Permisos de carpetas

- Carpeta de aplicacion (`C:\HospitalBilling` o `/opt/hospital`): acceso lectura para usuarios del sistema, lectura/escritura solo para el usuario que corre el backend.
- Carpeta de base de datos (Docker volume `mysql_prod_data` o `/var/lib/mysql`): solo root y servicio `mysql`.
- Carpeta de backups (`backups/` o `/var/backups/hospital`): solo usuario del backend, lectura temporal para admin.
- Archivos `.env` reales: lectura solo para el usuario que corre el backend. NUNCA lectura para cajeros.

## Ejecucion de archivos externos

- Prohibido descargar y ejecutar instaladores de internet en las PCs del hospital.
- El navegador de caja debe bloquear descargas automaticas; permitir solo PDFs de recibos institucionales.
- El navegador de caja debe usar perfil limpio sin extensiones adicionales.

## Actualizaciones offline

- Windows Update en servidor y estaciones: aplicar solo parches criticos de seguridad.
- Validar cada parche en una PC de prueba antes de aplicarlo en produccion.
- No aplicar actualizaciones de Windows que reinicien la PC fuera del horario autorizado.

## Instalacion en PCs no confiables

- Si una PC de caja es de uso compartido (biblioteca, sala de espera), NO instalar el sistema alli.
- Si soporte necesita instalar el sistema en una PC nueva, primero:
  1. Formatear el disco.
  2. Instalar Windows/Linux limpio.
  3. Activar antivirus.
  4. Aplicar actualizaciones criticas offline.
  5. Instalar el sistema con `setup.bat`.
  6. Documentar fecha, PC y operador.

## Proteccion contra borrado accidental

- Backup automatico diario (ver `docs/BACKUP_RESTORE.md`).
- Permisos de Windows: usuarios normales no deben poder borrar `C:\HospitalBilling` ni `backups\`.
- Papelera de reciclaje: revisar antes de vaciar; el sistema no toca la papelera.
- Procedimiento de restore documentado y probado antes de cualquier borrado de archivos de la aplicacion o base.

## Procedimiento de revision de equipo antes de instalar

Antes de instalar el sistema en una PC:

1. Confirmar sistema operativo soportado (Windows 10 Pro 22H2+, Windows Server 2019+, Ubuntu 22.04 LTS, Rocky Linux 9).
2. Confirmar que la PC cumple requisitos minimos de hardware (ver `SYSTEM_REQUIREMENTS.md`).
3. Verificar que el antivirus esta activo y actualizado.
4. Escanear la PC con antivirus completo.
5. Verificar que no hay software no autorizado instalado.
6. Confirmar que la PC no es de uso publico o compartido.
7. Documentar en `qa/INSTALL-YYYY-MM-DD.md`: PC, operador, escaneo, fecha, resultado.

## Criterio de listo

El sistema NO depende de que todos los usuarios tengan acceso administrativo a la PC. Si un cajero o usuario normal tiene permisos de administrador del sistema operativo, hay brecha de seguridad que debe corregirse.

## Checklist rapido

- [ ] Antivirus activo y actualizado.
- [ ] Usuario del sistema (backend) sin permisos de admin del SO innecesarios.
- [ ] Auto-run desactivado en servidor.
- [ ] Carpeta de aplicacion protegida contra escritura de usuarios normales.
- [ ] Carpeta de base de datos protegida.
- [ ] Backups protegidos.
- [ ] Prohibicion explicita de instalar software desconocido.
- [ ] Politica de USB documentada y respetada.
- [ ] Procedimiento de revision de equipo antes de instalar activo.
