# Manual de Operador - Sistema de Caja Hospitalaria v1.0.0

Bienvenido al manual maestro del operador del Sistema de Caja
Hospitalaria. Este documento es el índice que el supervisor de
turno consulta cuando necesita derivar al personal correcto o
al procedimiento correcto.

## Cómo usar este manual

1. Identifica tu rol: Cajero, Supervisor, Administrador o
   Soporte Local de Primer Nivel.
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

### Soporte Local de Primer Nivel

- Manual: `GUIA_SOPORTE_PRIMER_NIVEL.md`
- Casos cubiertos: diagnosis de red, reinicio de servicios,
  recoleccion de paquete de soporte, escalamiento a administrador.

## Procedimientos operacionales

- Instalacion inicial: `GUIA_INSTALACION_OPERATIVA.md`
- Respaldos y restauracion: `GUIA_RESPALDOS_Y_RESTAURACION.md`
- Capacitacion segura: `GUIA_CAPACITACION_SEGURA.md`
- HTTPS local obligatorio: `../HTTPS_OPTIONAL.md`
- Secretos y rotacion: `../SECRETS.md`
- Recuperacion de desastres: `../DISASTER_RECOVERY.md`

## Diagrama de escalamiento

```
Cajero
  -> cierra caja / reimprime / anula con motivo
  -> duda del sistema
       -> Supervisor (revisa la consola del cajero, valida la
                       transaccion en Historial)
            -> falla de sistema (caja no abre o aparece mensaje de error)
                -> Soporte Local
                     -> necesita intervencion administrativa
                         -> Administrador
```

## Acciones Rapidas Del Operador

Estas acciones se hacen desde el navegador o se escalan al rol indicado. Los
comandos de mantenimiento quedan en las guias de soporte local y no deben ser
parte del trabajo diario de caja.

| Necesidad | Accion segura |
|---|---|
| Entrar al sistema | Abrir la direccion LAN entregada por administracion. |
| Revisar si el sistema responde | Intentar abrir la pantalla de inicio y avisar a soporte local si no carga. |
| Hacer respaldo manual | Administrador: **Respaldos > Crear respaldo local**. |
| Ver ultimos respaldos | Administrador: **Respaldos** y confirmar **Protegido**, **Pendiente** o **Error**. |
| Reparar tras reinicio | Avisar a soporte local; no repetir facturas ni cobros mientras el sistema no abra. |
| Diagnosticar problema | Usar **Ayuda > Preparar resumen para soporte**. |
| Validar antes de entrega | Completar evidencia LAN, impresora, restore, concurrencia y preflight final con soporte local. |

## Errores comunes del cajero (mensaje -> accion)

| Mensaje en pantalla | Accion |
|---|---|
| "Sesion vencida" | Volver a iniciar sesion. |
| "Cuenta bloqueada" | Esperar 15 minutos o pedir a supervisor. |
| "Caja esta cerrada o cambio de estado" | Verificar caja; pedir a supervisor si esta cerrada por otro cajero. |
| "La factura o el pago ya cambio de estado" | Verificar en Historial; no repetir la operacion. |
| "Sistema en mantenimiento" | Esperar el tiempo indicado. |
| "No se pudo conectar con el servidor LAN" | Avisar a soporte local. |
| "Permiso denegado" | Pedir al supervisor que asigne el permiso. |

## Contactos

- Supervisor de turno: pegar en la pared del cuarto de caja.
- Administrador del sistema: pegar en la pared.
- Soporte local: telefono del proveedor o del equipo interno.

## Cambios respecto a la version anterior

- v1.0.0 consolida 8 manuales sueltos + 3 documentos operativos en
  este indice unico.
- v1.0.0 separa acciones normales de caja de tareas de mantenimiento y soporte.
- Ver `../KNOWN_LIMITATIONS.md` para lo que queda fuera de v1.0.0.
