# Guia de instalacion operativa

Esta guia es para dejar una computadora Windows como servidor local del Hospital San Isidro.

## Antes de instalar

Confirme:

- La computadora sera el servidor local.
- Tiene energia estable.
- Tiene IP fija o reservada en la red local.
- La impresora institucional esta instalada.
- La red LAN permite que otras computadoras abran el navegador hacia el servidor.
- Existe respaldo si se esta actualizando una instalacion anterior.

No borre carpetas de datos ni base de datos existente.

## Instalacion

1. Abra la carpeta del sistema en el servidor.
2. Confirme que ya existe `frontend\dist\index.html`. Produccion offline no debe descargar dependencias al arrancar.
3. Ejecute `setup.bat` si administracion tecnica lo autorizo.
4. Si se usa el asistente PowerShell, ejecute `scripts\install_hospital_os.ps1` y seleccione migraciones seguras.
5. No use herramientas de reset ni bases de demostracion en el servidor real.
6. Espere a que los servicios levanten.
7. Verifique que exista el acceso directo **Abrir Sistema de Caja Hospitalaria** o el acceso directo definido para el hospital.
8. Abra el sistema desde el servidor.

Produccion no debe entregarse con usuarios o datos de demostracion.

Antes de entregar el servidor, administracion tecnica debe ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installer_safety.ps1
```

La revision debe terminar sin hallazgos. Si falla, no continuar la entrega hasta corregir el script indicado.

## Direccion de acceso

Servidor:

```text
http://127.0.0.1
```

Clientes de red:

```text
http://IP-DEL-SERVIDOR
```

Ejemplo:

```text
http://192.168.1.10
```

La IP final debe confirmarse con la red local del hospital.

## Arranque al iniciar Windows

El servidor debe levantar el sistema al iniciar la PC o al iniciar sesion del usuario autorizado.

Checklist:

- Acceso directo visible.
- Servicios inician despues de reiniciar Windows.
- Navegador abre el sistema.
- Respaldos automaticos quedan activos.
- Una PC cliente puede entrar por IP LAN.

## Validacion inicial

Despues de instalar:

1. Iniciar sesion como administrador real.
2. Configurar datos del hospital y recibo.
3. Crear usuarios reales.
4. Abrir caja.
5. Crear factura de prueba autorizada.
6. Cobrar.
7. Imprimir recibo institucional.
8. Reimprimir desde historial.
9. Revisar reporte diario.
10. Crear respaldo manual y verificar SHA256.
11. Cerrar caja.
12. Reiniciar Windows y repetir login desde servidor y cliente LAN.

## Si algo falla

- No abre en servidor: esperar dos minutos y usar acceso directo otra vez.
- Si sigue sin abrir: ejecute `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1`.
- El script de reparacion revisa servicios, levanta contenedores sin borrar datos, espera `/up`, abre `/login` y deja un log en `install-logs`.
- No abre desde otra PC: revisar IP, cable/red, firewall y que el servidor este encendido.
- No imprime: revisar impresora predeterminada, papel y permisos de impresion.
- Respaldos quedan pendientes: revisar que el proceso automatico de respaldos este activo.
- Nunca ejecutar reset ni borrar base de datos en el servidor real.
