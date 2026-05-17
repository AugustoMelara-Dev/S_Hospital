# Final Product Wireframe

## App shell

```text
+--------------------------------------------------------------------------------+
| Topbar: Pantalla actual | Caja activa | Usuario | Estado servidor | Acciones   |
+-------------------------+------------------------------------------------------+
| Sidebar                 | Contenido de ruta                                    |
|                         |                                                      |
| Inicio                  | PageHeader                                           |
| Nueva factura           | Filtros / acciones                                   |
| Caja                    |                                                      |
| Historial               | Modulo activo                                        |
| Catalogo                |                                                      |
| Reportes                |                                                      |
| Backups                 |                                                      |
| Configuracion fiscal    |                                                      |
| Usuarios/roles          |                                                      |
+-------------------------+------------------------------------------------------+
```

## Principios

- Sidebar persistente, no menu escondido como unica navegacion.
- Topbar persistente con contexto operacional.
- Cada modulo tiene ruta y pantalla propia.
- No se permite una sola pagina interminable.

## Pantallas clave

- Nueva factura/POS debe ser la pantalla mas rapida.
- Caja debe mostrar estado actual antes de acciones.
- Catalogo debe separar categorias y servicios.
- Reportes debe abrir con dashboard gerencial.
