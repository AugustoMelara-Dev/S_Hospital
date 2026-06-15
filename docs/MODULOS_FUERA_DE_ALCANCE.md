# Modulos Fuera De Alcance

## Definicion obligatoria

S_Hospital se entrega como sistema hospitalario offline LAN para caja, facturacion, pagos, recibos institucionales, catalogo, historial, reportes, usuarios, configuracion, respaldos, auditoria y ayuda. No incluye expediente clinico, citas, consulta medica, triage, admisiones, hospitalizacion, laboratorio clinico, farmacia clinica, recetas clinicas ni portal de pacientes.

## No implementar ni prometer

- Expediente clinico.
- EMR o HIS clinico integral.
- Citas o agenda medica.
- Consulta medica.
- Triage.
- Admisiones clinicas.
- Hospitalizacion.
- Camas.
- Enfermeria.
- Diagnosticos medicos.
- Recetas clinicas.
- Laboratorio clinico.
- Farmacia clinica o inventario clinico.
- Portal de pacientes.

## Tratamiento de referencias historicas

Los documentos, prompts, reportes o subagentes que mencionen esos modulos deben tratarse como historicos o DEROGADO / NO APLICA AL ALCANCE FINAL, salvo que hablen explicitamente de facturacion, cobro o reporte administrativo.

## Regla para futuras fases

Si el hospital solicita algun modulo fuera de alcance, debe abrirse un plan nuevo, con riesgos, permisos, modelo de datos, pruebas y autorizacion explicita. No debe mezclarse con fases de caja/facturacion.
