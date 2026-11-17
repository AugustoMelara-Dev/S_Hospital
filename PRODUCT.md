# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Cajeros de ventanilla** de un hospital público en Honduras: atienden filas de pacientes durante turnos largos, en PC de escritorio (monitor estándar, teclado y mouse). Su trabajo: registrar el nombre del paciente, agregar servicios o medicamentos, cobrar, entregar recibo y cuadrar la caja al final del turno.
- **Supervisión y administración** usan el sistema a diario con el mismo peso: reportes del periodo, cierres de caja ajenos, anulaciones y reversiones, catálogo y precios, usuarios, numeración fiscal y respaldos.
- **Auditoría** consulta en modo lectura.

## Product Purpose

Caja hospitalaria local que factura con numeración fiscal CAI, cobra, emite el recibo institucional en PDF/papel y deja cada operación auditada, sin depender de internet. Éxito = un cajero cobra una cuenta en segundos solo con teclado, y la caja cuadra al cierre sin sorpresas.

## Positioning

Sistema hecho para la ventanilla de un hospital público hondureño: reglas fiscales del SAR (CAI, rango, vigencia, ISV), la gratuidad de eritropoyetina por receta de diálisis aplicada por línea, recibo institucional con serie propia y monto en letras, y operación 100 % offline en LAN.

## Operating Context

- Un servidor en la LAN; clientes por navegador (`http://<IP>:8080`). Sin internet en producción.
- Flujo diario: abrir caja → cobrar muchas cuentas cortas → reimprimir/anular excepcionalmente → arqueo por billetes (L 500…L 1) → cierre.
- Documentos físicos: recibo institucional en carta, media carta, A5 o A4, con copias (original / primera / segunda copia), firma del enterante y sello.
- Idioma español (es-HN), moneda Lempira ("L 1,234.00"), zona horaria America/Tegucigalpa.

## Capabilities and Constraints

- Módulos: Resumen, Cobrar, Recibos, Caja, Reportes, Catálogo y precios, Usuarios y permisos, Ajustes institucionales, Respaldos, Auditoría, Ayuda.
- El servidor calcula todos los totales; el frontend solo los muestra. Dinero en centavos.
- Facturas nunca se borran; acciones sensibles exigen motivo y quedan auditadas.
- Recibo principal sin QR, códigos de barras ni códigos internos.
- Todo recurso (fuentes, iconos) empaquetado: nada desde CDN.
- Terminología fijada en `docs/TERMINOLOGIA.md`; contrato en `docs/SPEC.md`.

## Brand Commitments

Ninguno obligatorio: el usuario dio libertad total de identidad. El nombre del sistema es "S_Hospital"; el nombre y logo del hospital se configuran en Ajustes y deben poder mostrarse.

## Evidence on Hand

- Catálogo real de 151 servicios: `api/app/seed/catalogo_servicios.csv`.
- Datos demo (institución "Hospital General San Isidro", CAI de prueba) son sintéticos.
- No hay logo institucional real en el repositorio.

## Product Principles

1. La ventanilla manda: cobrar rápido con teclado pesa más que cualquier adorno.
2. El número correcto, siempre visible: totales, saldo y estado de caja nunca quedan en duda.
3. Toda excepción deja rastro: anular, revertir, reimprimir o cambiar precios pide motivo.
4. Funciona sin internet, siempre.

## Accessibility & Inclusion

Contraste AA, navegación completa por teclado, foco visible y textos legibles durante turnos largos.
