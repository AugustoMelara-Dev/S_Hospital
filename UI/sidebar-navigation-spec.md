# Sidebar Navigation Spec

## Items

1. Inicio
2. Nueva factura
3. Caja
4. Historial
5. Catalogo
6. Reportes avanzados
7. Backups
8. Configuracion fiscal
9. Usuarios/roles si existe

## Comportamiento

- Item activo visible.
- Iconos con `lucide-react`.
- Labels en espanol claro.
- Colapsable solo si no sacrifica claridad.
- Acceso rapido a Nueva factura.

## Topbar relacionada

La topbar debe mostrar:

- Titulo de pantalla.
- Usuario actual.
- Caja activa o aviso si no hay caja abierta.
- Fecha/hora local.
- Estado LAN/servidor si existe endpoint.

## Bloqueos

- Navegacion por scroll vertical sin rutas.
- Links ambiguos.
- Acciones criticas escondidas.
