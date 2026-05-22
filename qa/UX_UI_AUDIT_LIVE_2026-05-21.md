# Auditoria visual UX/UI - evidencia viva 2026-05-21

## Alcance capturado

Sesion autenticada en `http://127.0.0.1:8000` con capturas en:

- `qa/screenshots/ux-live-auth-2026-05-21-browser/dashboard.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/billing-new-settled.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/cashbox.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/catalog.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/invoices.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/reports-settled.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/backups-settled.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/settings-fiscal-settled.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/users-settled.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/help.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/dashboard-user-menu.png`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/login-clean-name.png`

Reportes tecnicos de captura:

- `qa/screenshots/ux-live-auth-2026-05-21-browser/ux-live-auth-report.json`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/settled-recapture-report.json`
- `qa/screenshots/ux-live-auth-2026-05-21-browser/patch-verification-authenticated.json`

## Hallazgos principales

| Severidad | Modulo | Hallazgo | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| Alta | Respaldos | El boton de crear respaldo dejaba registros pendientes si no estaba activo el proceso de cola. Para un usuario administrativo eso se ve como respaldo que no termina. | `backups-settled.png` muestra respaldos pendientes. | El respaldo manual debe completarse en la misma accion o mostrar resultado final inmediato. Corregido en esta fase. |
| Alta | Global | El titulo de pestana y el login mostraban nombres internos del proyecto en instalaciones heredadas. | `ux-live-auth-report.json` marco `/Hospital Billing OS/i`; recaptura `login-clean-name.png` confirma limpieza visual. | Usar una etiqueta operativa visible al usuario. Corregido a `Caja hospitalaria` sin bloquear nombres configurados reales. |
| Media | Global | Modo oscuro y acentos violetas aumentan carga visual para caja. Hay muchos bordes, tarjetas y paneles simultaneos. | Capturas autenticadas muestran alto contraste oscuro, sidebar pesado y muchos contenedores. | Definir tema claro como experiencia recomendada de caja y reservar modo oscuro como opcion secundaria. Reducir tarjetas anidadas y superficie de bordes. |
| Media | Nueva factura | La fila de categorias puede quedar con scroll horizontal angosto y texto cortado; el cajero pierde contexto. | `billing-new-settled.png` muestra categorias partidas y barra horizontal visible. | Convertir categorias en tabs/chips envolventes o lista lateral compacta, sin scroll horizontal visible. |
| Media | Catalogo | La tabla mostraba el identificador interno del servicio debajo del nombre, lo que agregaba ruido sin valor operativo. | `catalog.png` y `CatalogView.tsx`. | Ocultar identificadores internos y dejar nombre, categoria, precio, codigo util y estado. Corregido en esta fase. |
| Media | Historial | El estado de carga usaba una tabla de esqueletos larga que podia parecer una tabla rota o sin resultados. | `invoices.png` y `InvoiceHistoryView.tsx`. | Separar carga y resultados con un mensaje claro. Corregido en esta fase. |
| Media | Reportes | La informacion mejora al cargar, pero queda mucha jerarquia compitiendo: etiqueta superior, tabs, filtros, cards, tabla en un solo primer viewport. | `reports-settled.png`. | Priorizar resumen de rango, filtros compactos persistentes y una lectura gerencial clara. |
| Media | Usuarios | Habia texto en ingles `Username / Email`. | `UsersView.tsx`. | Cambiar a `Usuario / Correo`. Corregido en esta fase. |
| Baja | Global | El menu de usuario tiene una sola accion de cerrar sesion; no se detecto duplicado visible. | `dashboard-user-menu.png` y conteo de `visibleLogoutMatches: 1`. | Mantener cierre de sesion solo en menu de usuario. |
| Baja | Configuracion | El nombre del hospital se refleja en login, sidebar, topbar y resumen fiscal. | `settings-fiscal-settled.png`, `help.png`. | Mantener como fuente de verdad para recibos/reportes/exportaciones. |

## Cambios aplicados en esta pasada

- Respaldo manual: `POST /api/backups` ahora ejecuta el respaldo inmediatamente y devuelve `201` si queda completado.
- Prueba actualizada: `BackupWorkflowTest` valida que el respaldo manual cree archivo, checksum, fecha de completado y auditoria.
- Titulo HTML: cambiado de `Hospital Billing OS` a `Caja hospitalaria`.
- Login, sidebar, topbar y exportaciones: se agrego saneamiento de nombres heredados internos (`Hospital Billing OS`, `S_Hospital Billing OS`) para mostrar `Caja hospitalaria` mientras el hospital configura su nombre real.
- Usuarios: cabecera `Username / Email` cambiada a `Usuario / Correo`.
- Nueva factura: se reemplazo el texto `POS hospitalario` por `Factura y cobro en caja`.
- Nueva factura: las categorias ya no usan un carril horizontal que corta nombres; ahora se muestran como botones en una cuadricula compacta con seleccion clara.
- Nueva factura: el estado inicial de servicios ahora indica que el usuario puede buscar, escanear o elegir categoria, en vez de mostrar `Sin filtro activo`.
- Encabezados: se quito el rotulo repetido `Panel hospitalario` del encabezado base para reducir ruido visual en los modulos.
- Reportes: el encabezado ahora explica el alcance real: ventas, cobros, caja y auditoria.
- Reportes: se simplificaron etiquetas visibles (`Facturado`, `Cobrado`, `No. de caja`, `No. de cajero`) para evitar lenguaje interno como `ID` y jerarquia innecesaria.
- Historial: el estado de carga ahora muestra `Cargando facturas...` en vez de una tabla larga de esqueletos.
- Catalogo: se oculto el identificador interno del servicio y se simplificaron etiquetas de acciones visibles.
- Usuarios: titulos y acciones se redujeron a lenguaje operativo (`Usuarios`, `Crear usuario`, `Rol`, `Restablecer clave`).
- Respaldos: se redujo lenguaje tecnico visible en checklist, estado operativo y confirmaciones.
- Tipografia: la app mantiene dos familias como maximo: `Inter` para interfaz y `Courier New` solo para recibos termicos; se quitaron usos visuales de monoespaciada en catalogo, historial, usuarios, respaldos y setup.
- Reportes de auditoria: el tipo de respaldo ya muestra etiquetas operativas (`Manual`, `Automatico`) en vez del valor interno.
- Configuracion: se redujo de cinco a cuatro secciones (`Resumen`, `Hospital`, `Numeracion`, `Apariencia`) para bajar carga visual.
- Configuracion: se unieron datos del hospital y ancho de recibo en una sola seccion operativa, con una sola accion `Guardar hospital y recibo`.
- Configuracion: se elimino la accion duplicada de guardado del recibo y se quitaron textos visibles orientados a implementacion como cambios en tiempo real o reinicio de sesion.
- Navegacion principal: se corrigieron textos rotos por codificacion y se normalizaron etiquetas visibles sin acentos problematicos (`Catalogo`, `Configuracion`, `Nueva factura`).
- Encabezado superior: se quitaron elementos persistentes de bajo valor visual como la hora visible y el estado inferior; el estado queda como region accesible para lectores de pantalla.
- Encabezado superior: el cierre de sesion sigue existiendo solo dentro del menu de usuario, no como segunda accion duplicada en pantalla.
- Dashboard: se reemplazo `Modulos disponibles` por `Facturas`, se redujo la tarjeta de accion rapida a una sola `Siguiente accion` y se simplificaron titulos de graficas (`Ventas y cobros`, `Cajeros hoy`, `Cobros de hoy`, `Servicios principales`).
- Dashboard: el asistente inicial ahora usa lenguaje operativo (`Preparar caja`, `Hospital`, `Numeracion`, `Catalogo`) y evita textos pesados como `software`, `incrustar`, `obligatoria` o conceptos orientados a implementacion.

## Verificacion ejecutada

- `npm.cmd run typecheck` paso.
- `npm.cmd test -- App.test.tsx` paso: 11 pruebas.
- `npm.cmd test -- hospital-name.test.ts NewInvoiceView.test.tsx ReportsView.test.tsx` paso: 19 pruebas.
- `docker compose exec backend php artisan test --colors=never --filter=HospitalNameTest` paso: 2 pruebas, 5 aserciones.
- `docker compose exec backend php artisan test --colors=never --filter=BackupWorkflowTest` paso: 14 pruebas, 60 aserciones.
- `npm.cmd run build` paso. Queda advertencia no bloqueante de chunk apenas mayor a 500 kB.
- Browser integrado en `http://127.0.0.1:5173`: titulo `Caja hospitalaria`, DOM sin `S_Hospital Billing OS` ni `Hospital Billing OS`, consola sin errores, captura `login-clean-name.png`.
- Busqueda textual focalizada en layout/dashboard/settings/reportes: no quedan textos visibles de `API`, `Laravel`, `React`, `Vite`, `software`, `Modulos disponibles` ni textos rotos `Ã`/`Â`; los matches restantes son tipos internos de codigo.

## Riesgos restantes

- La sesion del navegador compilado rechazo luego las credenciales demo disponibles; no se modificaron contrasenas ni datos de acceso para evitar tocar estado sensible.
- La recaptura autenticada post-dashboard no pudo completarse en esta pasada: Browser integrado fallo al escribir en login por portapapeles virtual y la validacion Playwright local requirio permisos que el entorno rechazo por limite de uso. Queda pendiente recapturar `dashboard-clean-shell.png` y menu de usuario cuando el entorno permita automatizacion autenticada.
- Existen respaldos pendientes anteriores en la base de datos de desarrollo. El cambio evita que nuevos respaldos manuales queden pendientes, pero los registros viejos siguen como evidencia historica.
- La auditoria visual aun no esta cerrada como objetivo final: falta fase de rediseño sistematico por modulos, QA responsive, accesibilidad con teclado y limpieza de textos tecnicos en reportes/exportaciones backend.

## Siguiente fase recomendada

1. Consolidar tema claro operativo como predeterminado visual de caja.
2. Simplificar AppShell: menos ruido en topbar, menos badges simultaneos, breadcrumb mas discreto.
3. Rediseñar Nueva factura: categorias sin scroll horizontal, buscador mas dominante, carrito con acciones claras.
4. Rediseñar estados vacios de Catalogo, Usuarios y Respaldos con pruebas de teclado.
5. Revisar reportes por tarea gerencial: ventas, caja, auditoria, respaldos.
6. Ejecutar smoke en `/up`, `/login`, `/verify-email`, mas capturas desktop y tablet.
