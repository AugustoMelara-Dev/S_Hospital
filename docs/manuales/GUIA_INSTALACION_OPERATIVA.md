# Guia De Instalacion Operativa

Esta guia ayuda a dejar el sistema listo en una computadora servidor Windows.

## Antes De Instalar

Confirme:

- La computadora sera el servidor local.
- Hay energia estable.
- Docker esta instalado si se usara Docker Compose.
- La red local funciona.
- La impresora esta instalada.
- Hay respaldo si se esta actualizando una instalacion existente.

No borre carpetas de datos ni volumenes de base de datos.

## Instalar

1. Abra PowerShell o Explorador en la carpeta del sistema.
2. Ejecute `setup.bat`.
3. Espere a que los servicios levanten.
4. Revise que el acceso directo **Abrir Sistema de Caja Hospitalaria** exista en el escritorio.

El instalador no debe cargar datos temporales en produccion.

## Abrir El Sistema

Servidor:

```text
http://127.0.0.1:8000
```

Clientes de red:

```text
http://IP-DEL-SERVIDOR:8000
```

## Arranque Automatico

El script `scripts/install_hospital_startup_shortcut.ps1` crea el acceso directo. Si el tecnico lo autoriza, puede registrar una tarea al iniciar sesion:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_hospital_startup_shortcut.ps1 -InstallStartupTask
```

## Validacion Inicial

Despues de instalar:

1. Inicie sesion.
2. Configure hospital y recibo.
3. Abra caja.
4. Cree una factura de prueba autorizada.
5. Cobre.
6. Imprima.
7. Reimprima.
8. Cree respaldo.
9. Cierre caja.

## Soporte

Si el sistema no abre:

1. Espere dos minutos.
2. Use el acceso directo nuevamente.
3. Ejecute la reparacion segura:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\repair_hospital_system.ps1 -BaseUrl http://127.0.0.1:8000
```

4. Si sigue fallando, envie `qa\LOCAL_REPAIR_DIAGNOSTIC.md` al responsable tecnico.
5. No borre carpetas, volumenes Docker, archivos `.env` ni archivos de base de datos.

La reparacion segura solo revisa servicios, levanta contenedores, espera el backend,
abre el navegador si responde y genera diagnostico. No reinicia datos, no ejecuta
seeders y no restaura backups automaticamente.
