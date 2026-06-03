# Manual de Operador - Sistema de Caja Hospitalaria v1.0.0

Bienvenido al manual maestro del operador del Sistema de Caja
Hospitalaria. Este documento es el índice que el supervisor de
turno consulta cuando necesita derivar al personal correcto o
al procedimiento correcto.

## Cómo usar este manual

1. Identifica tu rol: Cajero, Supervisor, Administrador o
   Soporte Tecnico de Primer Nivel.
2. Salta a la seccion de tu rol.
3. Sigue el procedimiento paso a paso.
4. Si el problema escapa al procedimiento, escala al siguiente
   nivel.

## Roles

### Cajero

- Manual: `MANUAL_CAJERO.md`
- Checklist de capacitacion: `CHECKLIST_CAPACITACION.md`
- Casos cubiertos: abrir caja, crear factura, cobrar, reimprimir
  recibo, anular factura, cerrar caja.

### Supervisor

- Manual: `MANUAL_SUPERVISOR.md`
- Casos cubiertos: cierre diario, anulacion supervisada,
  conciliacion de caja, escalamiento a administrador, gestion de
  permisos del cajero.

### Administrador

- Manual: `MANUAL_ADMINISTRADOR.md`
- Casos cubiertos: alta/baja de usuarios, gestion de catalogo y
  areas, configuracion fiscal, mantenimiento programado,
  supervision de respaldos.

### Soporte Tecnico de Primer Nivel

- Manual: `GUIA_SOPORTE_PRIMER_NIVEL.md`
- Casos cubiertos: diagnosis de red, reinicio de servicios,
  recoleccion de paquete de soporte, escalamiento a administrador.

## Procedimientos operacionales

- Instalacion inicial: `GUIA_INSTALACION_OPERATIVA.md`
- Respaldos y restauracion: `GUIA_RESPALDOS_Y_RESTAURACION.md`
- Capacitacion segura: `GUIA_CAPACITACION_SEGURA.md`
- HTTPS opcional: `../HTTPS_OPTIONAL.md`
- Secretos y rotacion: `../SECRETS.md`
- Recuperacion de desastres: `../DISASTER_RECOVERY.md`

## Diagrama de escalamiento

```
Cajero
  -> cierra caja / reimprime / anula con motivo
  -> duda tecnica
       -> Supervisor (revisa la consola del cajero, valida la
                       transaccion en Historial)
            -> falla de sistema (caja no abre, error 5xx)
                -> Soporte Tecnico
                     -> necesita intervencion administrativa
                         -> Administrador
```

## Comandos del operador

Los siguientes comandos se ejecutan desde `C:\Projects\S_Hospital`
en PowerShell como Administrador.

| Accion | Comando |
|---|---|
| Ver salud del sistema | `curl http://IP-SERVIDOR/api/system/health` |
| Iniciar sesion interactiva | Abrir `http://IP-SERVIDOR` en el navegador |
| Reiniciar el sistema | `scripts\start_hospital_services.ps1` |
| Hacer backup manual | UI > Respaldos > Crear respaldo local |
| Ver ultimos respaldos | UI > Respaldos |
| Activar mantenimiento | `php artisan hospital:maintenance on --message="..."` |
| Desactivar mantenimiento | `php artisan hospital:maintenance off` |
| Generar CA local (HTTPS) | `scripts\generate_local_ca.ps1 -ServerIp <ip>` |
| Validar LAN cliente | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP-SERVIDOR -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md` |
| Reparar tras reboot | `scripts\open_hospital_system.ps1` |
| Diagnosticar problema | `scripts\repair_hospital_system.ps1` |
| Recolectar soporte | `scripts\collect_support_packet.ps1` |
| Validar todo antes de produccion | `scripts\production_readiness_preflight.ps1 -BaseUrl http://IP-SERVIDOR` |

## Errores comunes del cajero (mensaje -> accion)

| Mensaje en pantalla | Accion |
|---|---|
| "Sesion vencida" | Volver a iniciar sesion. |
| "Cuenta bloqueada" | Esperar 15 minutos o pedir a supervisor. |
| "Caja esta cerrada o cambio de estado" | Verificar caja; pedir a supervisor si esta cerrada por otro cajero. |
| "La factura o el pago ya cambio de estado" | Verificar en Historial; no repetir la operacion. |
| "Sistema en mantenimiento" | Esperar el tiempo indicado. |
| "No se pudo conectar con el servidor LAN" | Avisar a soporte tecnico. |
| "Permiso denegado" | Pedir al supervisor que asigne el permiso. |

## Contactos

- Supervisor de turno: pegar en la pared del cuarto de caja.
- Administrador del sistema: pegar en la pared.
- Soporte tecnico: telefono del proveedor o del equipo interno.

## Cambios respecto a la version anterior

- v1.0.0 consolida 8 manuales sueltos + 3 documentos tecnicos en
  este indice unico.
- v1.0.0 anade HTTPS opcional, secrets playbook, comando
  `hospital:maintenance`, throttle por usuario.
- Ver `../KNOWN_LIMITATIONS.md` para lo que queda fuera de v1.0.0.
