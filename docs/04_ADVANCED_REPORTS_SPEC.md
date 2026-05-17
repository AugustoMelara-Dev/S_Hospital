# 04 Advanced Reports Spec

## Objetivo

Los reportes deben dejar de ser basicos. Fase 12D debe entregar una vista gerencial clara para administracion hospitalaria, caja y auditoria.

## Dashboard gerencial

Metricas principales:

- Ventas del dia.
- Ventas del rango seleccionado.
- Facturas pagadas, pendientes y anuladas.
- Ingresos por metodo de pago.
- Top servicios vendidos.
- Ingresos por categoria.
- Caja por cajero.
- Reimpresiones.
- Backups recientes.

## Filtros obligatorios

- Fecha desde/hasta.
- Cajero.
- Categoria.
- Metodo de pago.
- Estado de factura.
- Caja/sesion si existe.

## Reportes minimos

- Ventas por dia y rango.
- Ingresos por metodo de pago.
- Servicios mas vendidos.
- Ingresos por categoria.
- Caja por cajero.
- Facturas anuladas con motivo, usuario y fecha.
- Reimpresiones con usuario, factura y fecha.
- Backups ejecutados, fallidos y ultima verificacion.

## UI requerida

- Cards de metricas compactas.
- Graficas con `Recharts`.
- Tablas con `TanStack Table`.
- Filtros persistentes por pantalla.
- Estados vacios que expliquen falta de datos.
- Exportacion CSV/Excel si ya existe soporte o queda planificada por subfase.

## Fuente de verdad

Los totales deben venir calculados o validados por backend. El frontend no debe recalcular hechos financieros como autoridad.

## Bloqueos

- Reporte que solo muestra una tabla basica sin metricas: bloqueado.
- Reporte sin filtros por fecha: bloqueado.
- Reporte con totales calculados solo en frontend: bloqueado.
- Reporte sin relacion con caja/cajero/metodo cuando aplica: bloqueado.
