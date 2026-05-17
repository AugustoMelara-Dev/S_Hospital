# Wireframes ASCII

Referencia auxiliar. El wireframe canonico de Fase 12 es `UI/final-product-wireframe.md`.

## App Shell

```
┌────────────────────────────────────────────────────────────────┐
│ Topbar: caja abierta | usuario | conexión | logout             │
├───────────────┬────────────────────────────────────────────────┤
│ Sidebar       │ Module Header                                  │
│ Inicio        ├────────────────────────────────────────────────┤
│ Nueva factura │ Content                                        │
│ Caja          │                                                │
│ Historial     │                                                │
│ Catálogo      │                                                │
│ Reportes      │                                                │
│ Backups       │                                                │
│ Configuración │                                                │
└───────────────┴────────────────────────────────────────────────┘
```

## POS

```
┌──────────────┬─────────────────────────────┬───────────────────┐
│ Categorías   │ Servicios                    │ Factura actual    │
│ [Todos]      │ [Buscar o escanear...]       │ Paciente          │
│ Laboratorio  │ [Hemograma] [Glucosa]        │ Items             │
│ Radiología   │ [Eritropoyetina]             │ Total             │
│ Emergencia   │                              │ [Emitir] [Cobrar] │
└──────────────┴─────────────────────────────┴───────────────────┘
```

## Reportes

```
┌──────────────────────────────────────────────────────────────┐
│ Filtros: fecha desde | fecha hasta | cajero | caja | método   │
├────────────┬────────────┬────────────┬────────────┬──────────┤
│ Ingresos   │ Facturas    │ Pagos      │ Ticket Prom│ Anuladas │
├──────────────────────────────────────────────────────────────┤
│ Gráfico / Tabla                                             │
├──────────────────────────────────────────────────────────────┤
│ Tabla exportable                                            │
└──────────────────────────────────────────────────────────────┘
```
