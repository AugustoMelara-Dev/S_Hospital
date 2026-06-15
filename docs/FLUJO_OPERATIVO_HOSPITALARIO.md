# Flujo Operativo Hospitalario

## Estado de este documento

Este documento queda actualizado para el cierre billing-only/offline. Cualquier referencia anterior a usuarios de area, consulta por area, reportes por area o flujos donde un area solicita y caja cobra queda como historica/no incluida en el producto final visible, salvo datos internos de catalogo ya existentes.

## Flujo final autorizado

El sistema opera como caja unica hospitalaria:

1. El cajero inicia sesion en el servidor local por navegador.
2. El cajero abre su caja.
3. En Nueva factura ingresa el nombre del paciente.
4. Busca servicios facturables por nombre, categoria o codigo interno si esta habilitado.
5. Agrega servicios al carrito.
6. El backend emite la factura, reserva correlativo y guarda snapshots.
7. El cajero registra pago con metodo y referencia cuando aplica.
8. El sistema asocia factura, pago, caja, cajero y fecha.
9. El recibo institucional se genera desde snapshots historicos.
10. Historial y reportes consultan datos persistidos, no precios actuales.

## Lo que no se implementa como producto final

- Expediente clinico.
- Diagnosticos.
- Resultados de laboratorio.
- Inventario medico.
- Citas.
- Triage.
- Admisiones.
- Hospitalizacion.
- Laboratorio clinico.
- Farmacia clinica.
- Roles clinicos de medicos o enfermeria.

## Catalogo

El catalogo maneja servicios facturables, categorias, precios, estado activo/inactivo, codigos opcionales y regla especial de eritropoyetina. Si una categoria o servicio tiene nombre clinico, se conserva solo como concepto facturable heredado del listado del hospital.

## Reportes

Los reportes finales son administrativos y financieros: diario, rango, caja, cajero, categoria, servicio, pagos, anulaciones/reversos y auditoria. Los reportes por area quedan fuera del menu final y no deben venderse como modulo activo.

## Criterios de aceptacion

- Caja unica funciona sin pasos extra.
- Paciente es solo texto obligatorio en factura.
- Recibo institucional usa snapshots historicos.
- No se muestran modulos clinicos en menu.
- La operacion sigue siendo offline LAN.
