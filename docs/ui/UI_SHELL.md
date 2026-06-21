# UI Shell - S_Hospital

## Proposito

El shell de S_Hospital organiza la navegacion institucional de la aplicacion offline LAN sin cambiar rutas, permisos ni flujos de facturacion. Debe sentirse sobrio, hospitalario y usable durante turnos largos de caja y administracion.

## Arquitectura visual

- `AppShell` es el contenedor autenticado.
- `Sidebar` es la navegacion persistente de escritorio.
- `Topbar` muestra contexto de pagina, estado operativo y acciones globales.
- `MobileNavigation` replica la navegacion permitida dentro de un dialog lateral con foco controlado.
- `AppBreadcrumbs` deriva la ruta actual desde `appNavigation`.

La composicion evita sombras pesadas, gradientes y superficies decorativas. La diferenciacion se hace con tokens de superficie, borde, foco y acento.

## Responsabilidades de AppShell

- Calcular navegacion visible con `getVisibleNavigation(user.permissions)`.
- Calcular ruta activa con `getActiveNavigationItem(location.pathname)`.
- Calcular breadcrumbs con `getBreadcrumbs(location.pathname)`.
- Mantener skip link hacia `#main-content`.
- Mantener `main` enfocable y sin overflow horizontal accidental.
- Montar `useBroadcastSync` para invalidaciones LAN.
- Montar `GuidedTour`.
- Cerrar navegacion movil al cambiar de ruta.
- Exponer `aria-live` con el estado operativo recibido.

## Responsabilidades de Sidebar

- Consumir solo `visibleNavigation`.
- No consultar permisos por su cuenta.
- Renderizar grupos visuales sin alterar el orden plano de `primaryNavigation`.
- Marcar la ruta activa con `aria-current="page"`.
- Usar tokens `sidebar-*`.
- Conservar branding institucional, logo si existe, caja activa y usuario.
- Mantener scroll interno con `ScrollArea`.

## Responsabilidades de Topbar

- Mostrar titulo actual y breadcrumbs accesibles.
- Exponer boton de navegacion movil.
- Mantener estado LAN esencial visible en movil.
- Mantener caja y hora en anchos donde hay espacio.
- Mantener ayuda, cambio de tema y menu de usuario.
- Mantener logout dentro de menu accesible por teclado.
- Usar botones de solo icono con `aria-label`.

## Navegacion movil

`MobileNavigation` usa Radix Dialog. Debe:

- Abrirse desde el boton "Abrir menu".
- Atrapar foco mientras esta abierta.
- Cerrar con Escape.
- Devolver foco al trigger.
- Cerrar al seleccionar una ruta.
- Usar las mismas entradas filtradas que el Sidebar.
- Respetar `motion-reduce`.

## Breadcrumbs

Los breadcrumbs se derivan de `appNavigation`. El elemento actual usa `aria-current="page"`. Los enlaces intermedios solo se renderizan si `canAccessPath` confirma acceso con los permisos actuales.

## Accesibilidad

- Landmarks: `banner`, `navigation`, `main`, `contentinfo`.
- Skip link visible al foco.
- Foco visible mediante token `ring`.
- Iconos decorativos con `aria-hidden`.
- Estado operativo en `aria-live`.
- Menus y dialogos basados en Radix.
- No depender solo del color para seleccion: el item activo tiene fondo, borde y barra lateral.

## Permisos

La fuente de verdad visual es `frontend/src/navigation/appNavigation.ts`.

No cambiar:

- `path`
- `navigationPermissions`
- `navigationPermissionMode`
- `requiredPermissions`
- `permissionMode`
- roles o nombres de permisos

Para agregar una entrada futura:

1. Agregar una definicion en `appRoutes`.
2. Definir breadcrumbs.
3. Definir permisos de navegacion y ruta.
4. Agregarla a `primaryNavigation` en el orden operativo acordado.
5. Cubrir paths, permisos y visibilidad por perfil en tests.

## Tokens usados

- Base: `background`, `foreground`, `card`, `muted`, `border`, `ring`.
- Navegacion: `sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-primary`, `sidebar-border`, `sidebar-ring`.
- Estado: `secondary`, `destructive`.

## Componentes UI usados

- `Button`
- `DropdownMenu`
- `Breadcrumb`
- `Separator`
- `ScrollArea`
- `Tooltip`
- Radix Dialog para navegacion movil

## Comportamientos que no deben romperse

- Rutas actuales.
- Permisos visibles por perfil.
- Logout.
- Cambio de tema.
- Estado de caja.
- Estado LAN/sistema.
- Guided tour.
- Skip link.
- `aria-live`.
- Dark mode.
- Cierre de menu movil por ruta y Escape.
- Foco devuelto al boton de menu movil.

## Responsive

- `lg` activa el sidebar persistente.
- Debajo de `lg`, la navegacion vive en `MobileNavigation`.
- A 320 px se prioriza menu, titulo, estado LAN y usuario.
- Breadcrumbs se muestran desde `sm` para no empujar acciones esenciales.
- Tablas y pantallas internas gestionan su propio scroll.

## Pendiente para Fase 3

- Consolidar patrones compartidos de page header, filtros, tablas y dialogos de dominio.
- Revisar formularios largos en catalogo, configuracion fiscal, recibos y usuarios.
- Mantener facturacion, pagos, caja y recibos para fases dedicadas con pruebas de negocio.

