# Entrega Tecnica Offline

## Producto entregado

S_Hospital es un sistema de caja/facturacion hospitalaria offline LAN. La entrega tecnica cubre codigo fuente, backend Laravel, frontend React compilable, base MySQL/MariaDB, documentacion operativa, guias de caja, reportes, respaldos, recibos institucionales y usuarios/permisos.

## Componentes tecnicos

- Backend Laravel API con autenticacion local y rutas protegidas.
- Frontend React + TypeScript para navegador LAN.
- Base de datos MySQL/MariaDB local.
- Catalogo de servicios facturables.
- Facturacion, pagos, caja, recibos, historial y reportes.
- Usuarios, roles, permisos, auditoria y respaldos.
- Documentacion para instalacion y operacion offline.

## Condiciones de instalacion local

- Servidor Windows o Linux con PHP, Composer, Node para build, servidor web y MySQL/MariaDB.
- APP_URL configurado con IP local o hostname LAN.
- Firewall permitiendo acceso HTTP/HTTPS desde clientes autorizados.
- Backups en ruta local protegida, no accesible a cajeros.

## Exclusiones

No se entrega expediente clinico, citas, triage, admisiones, laboratorio clinico, farmacia clinica, hospitalizacion ni HIS/EMR.

## Evidencia pendiente de campo

La entrega tecnica no sustituye la validacion fisica final. Deben validarse servidor real, segunda PC LAN, impresora final, backup worker/tarea y restore final antes de declarar PRODUCTION_READY.
