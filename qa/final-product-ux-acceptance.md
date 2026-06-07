# Final Product UX Acceptance

## Bloqueantes

- Parece prototipo.
- Todo vive en una sola pagina.
- No hay sidebar/topbar/rutas internas.
- Servicios se muestran como lista interminable.
- Facturar no parece POS/caja.
- Reportes siguen basicos.
- El escaneo de servicios confia en precio frontend.

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

## Evidencia visual requerida

- Captura desktop de app shell con sidebar/topbar visibles.
- Captura de POS donde se vea categoria, busqueda, escaneo de servicios, servicios compactos y carrito.
- Captura de reportes con filtros, metricas y tabla/grafica.
- Evidencia de que no existe una sola pagina interminable como experiencia principal.
- Revision minima de tablet o viewport mediano para confirmar que la UI no se rompe.

## Smoke POS

- Crear factura con nombre de paciente.
- Buscar servicio por texto.
- Filtrar por categoria.
- Agregar servicio al carrito.
- Escanear o escribir codigo.
- Confirmar pago.
- Ver recibo institucional media carta/carta/A5.

## Smoke reportes

- Filtrar por rango de fecha.
- Ver ventas por dia/rango.
- Ver ingresos por metodo.
- Ver servicios mas vendidos.
- Ver ingresos por categoria.
- Ver caja por cajero.
- Ver anuladas/reimpresiones/backups.
- Exportar CSV minimo si hay datos en el rango.

## Gates sugeridos

- `php artisan test --colors=never`.
- `npm run build`.
- Validar `/up`, `/login` y `/verify-email` antes de deploy.
