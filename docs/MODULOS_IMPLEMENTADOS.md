# Modulos Implementados

## Alcance oficial

S_Hospital se entrega como sistema hospitalario offline LAN para caja, facturacion, pagos, recibos institucionales, catalogo, historial, reportes, usuarios, configuracion, respaldos, auditoria y ayuda.

No incluye expediente clinico, citas, consulta medica, triage, admisiones, hospitalizacion, laboratorio clinico, farmacia clinica, recetas clinicas ni portal de pacientes.

## Modulos del producto

1. Inicio/dashboard operativo.
2. Nueva factura con paciente por nombre y servicios facturables.
3. Caja: apertura, cobro, cierre, movimientos y conciliacion.
4. Pagos asociados a factura, caja, cajero, metodo y fecha.
5. Recibos institucionales y reimpresion controlada.
6. Catalogo de servicios facturables.
7. Historial de facturas, pagos, anulaciones y recibos.
8. Reportes administrativos y financieros.
9. Respaldos locales con worker/scheduler y descarga autorizada.
10. Configuracion fiscal, hospitalaria y de recibos.
11. Usuarios, roles y permisos.
12. Ayuda/soporte operativo.
13. Auditoria local de acciones sensibles.
14. Instalacion local/offline y operacion en red LAN.

## Notas de alcance

- Los nombres clinicos que aparezcan dentro del catalogo son conceptos de cobro heredados, no modulos clinicos.
- La eritropoyetina y la marca de receta de dialisis son reglas de facturacion, no expediente clinico.
- Cualquier extension clinica futura requiere plan, autorizacion y fase separada.
