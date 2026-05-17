# Final Product UX Acceptance

## Bloqueantes

- Parece prototipo.
- Todo vive en una sola pagina.
- No hay sidebar/topbar/rutas internas.
- Servicios se muestran como lista interminable.
- Facturar no parece POS/caja.
- Reportes siguen basicos.
- Scanner/codigo confia en precio frontend.

## Smoke de navegacion

- Entrar a app shell.
- Navegar a Nueva factura.
- Navegar a Caja.
- Navegar a Catalogo.
- Navegar a Historial.
- Navegar a Reportes.
- Navegar a Backups.
- Navegar a Configuracion fiscal.
- Navegar a Usuarios/roles si existe.

## Smoke POS

- Crear factura con nombre de paciente.
- Buscar servicio por texto.
- Filtrar por categoria.
- Agregar servicio al carrito.
- Escanear o escribir codigo.
- Confirmar pago.
- Ver recibo termico.

## Smoke reportes

- Filtrar por rango de fecha.
- Ver ventas por dia/rango.
- Ver ingresos por metodo.
- Ver servicios mas vendidos.
- Ver ingresos por categoria.
- Ver caja por cajero.
- Ver anuladas/reimpresiones/backups.

## Gates sugeridos

- `php artisan test --colors=never`.
- `npm run build`.
- Validar `/up`, `/login` y `/verify-email` antes de deploy.
