# POS Screen Spec

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Nueva factura | Paciente [________________] | Scanner [___________]            |
+----------------------+--------------------------------------+------------------+
| Categorias           | Buscar servicio [________________]   | Carrito          |
| - Todas              |                                      |                  |
| - Laboratorio A      | [Servicio compacto] [Agregar]        | Item 1     L.xx  |
| - Laboratorio B      | [Servicio compacto] [Agregar]        | Item 2     L.xx  |
| - Radiologia         | [Servicio compacto] [Agregar]        |                  |
| - Emergencia         |                                      | Subtotal   L.xx  |
| - Odontologia        |                                      | ISV        L.xx  |
| - Medicamentos       |                                      | Total      L.xx  |
|                      |                                      | Metodo [____]    |
|                      |                                      | [Cobrar] [Limpiar]|
+----------------------+--------------------------------------+------------------+
```

## Requisitos

- Busqueda rapida.
- Seleccion por categoria.
- Campo scanner/codigo.
- Servicios en tarjetas o tabla compacta.
- Carrito lateral siempre visible en escritorio.
- Resumen de factura claro.
- Pago claro.
- Recibo termico.

## Errores

- Codigo no encontrado.
- Servicio inactivo.
- Caja no abierta.
- Paciente requerido.
- Pago invalido.

## Bloqueo

Si el cajero debe recorrer 122 servicios para facturar, la pantalla queda bloqueada.
