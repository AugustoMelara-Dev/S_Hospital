# Contratos de pantalla — Autenticación, shell y estados de ruta

Familia: acceso y marco de la aplicación. Fuente de verdad del inventario: `01-inventario-rutas.md`.

Formato por contrato: propósito · permisos · estados · teclado/foco · validación/recuperación · doble submit · estados no-solo-color · mensajes · criterios de aceptación Tanda 2 · pendiente visual.

---

## AUTH-1 · Login (`/login` lógico; render en `App.tsx:82-95`)

- **Propósito**: autenticar usuario local por usuario/correo + contraseña contra Laravel Sanctum en LAN; mostrar marca institucional real (`usePublicBranding`).
- **Permisos**: ninguno (público). No debe exponer datos operativos.
- **Estados obligatorios**
  - Inicial: formulario vacío, estado `Listo para iniciar sesión local.` (`useHospitalSession.ts:12`).
  - Envío: botón deshabilitado con spinner y texto "Validando credenciales" (`LoginView.tsx:152-158`).
  - Error recuperable: credenciales incorrectas → alerta destructiva sin borrar usuario/contraseña (`LoginView.tsx:163-169`).
  - Bloqueo: cuenta bloqueada con cuenta regresiva 15:00; demasiados intentos con 60 s (`LoginView.tsx:48-57`).
  - Sesión vencida/cerrada: `role="alert"` con mensaje "Sesión vencida..." (`useHospitalSession.ts:72,94`).
  - Sin conexión al servidor local: error seguro desde API (`userSafeErrorMessage`), sin detalles técnicos.
- **Teclado/foco**: orden natural usuario → contraseña → mostrar/ocultar contraseña → enviar. `Enter` envía el formulario. Aviso Bloq Mayús vía `aria-describedby` (`LoginView.tsx:135,146-150`). Al montar no se fuerza foco (permitir leer la identidad); aceptable, pero el primer tab debe entrar al usuario.
- **Validación**: campos requeridos por `required` HTML + backend; mensajes en alerta, no por campo (formulario de 2 campos: aceptable).
- **Doble submit**: `loginSubmitInFlightRef` + `loginSubmitting` (`useHospitalSession.ts:16,139`); controles deshabilitados mientras se valida y durante el conteo.
- **No-solo-color**: el error usa `role="alert"` + borde/icono de alerta; el bloqueo se anuncia en texto y el botón muestra "Bloqueado (Ns)".
- **Mensajes al operador**: human-readable; nunca exponer códigos HTTP ni stack.
- **Aceptación Tanda 2**: un solo `h1`; labels asociados; botón mostrar contraseña con nombre accesible; foco visible; sin overflow a 320 px; `prefers-reduced-motion` respetado; identidad institucional declarada provisional cuando no hay logo (`InstitutionalIdentity.tsx:14,40-42`).
- **Pendiente visual**: contraste real claro/oscuro y legibilidad del wordmark provisional; no comprobable sin navegador.

## AUTH-2 · Cambio obligatorio de contraseña (`App.tsx:97-105`)

- **Propósito**: forzar clave nueva antes de operar facturación/caja.
- **Permisos**: sesión con `must_change_password`.
- **Estados**: formulario; envío con spinner; error textual en alerta superior sin borrar campos (`PasswordChangeView.tsx:66-76`); éxito implica re-render del shell.
- **Mensajes visibles al reposo**: requisitos exigidos: 12+, mayúscula, minúscula, número, símbolo (`PasswordChangeView.tsx:14-20,45-51`); la sesión permanece restringida (`:63`).
- **Teclado/foco**: 3 campos etiquetados con `autoComplete` correcto; `Enter` envía; los errores de campo usan `FieldError` + `aria-invalid` (`:89-95`).
- **Validación/recuperación**: Zod; si el backend rechaza, el mensaje va a `status` y los campos se conservan; no hay reset de formulario en error.
- **Doble submit**: `passwordSubmitInFlightRef` (`useHospitalSession.ts:19,193`).
- **Aceptación**: error local junto al campo cuando aplique; el foco no se pierde hacia el final del formulario; un solo `h1` ("Cambio obligatorio de contraseña", `:43`).
- **Pendiente visual**: densidad en 1366x768 y 390x844; no comprobable sin navegador.

## SHELL-1 · Shell institucional (`InstitutionalShell.tsx:112-147`)

- **Propósito**: marco persistente: rail de navegación por grupos (Operaciones / Administración / Asistencia), barra de contexto, contenido principal, ayudas globales.
- **Estados**
  - Cargando sesión: spinner centrado con `role="status"` (`App.tsx:78-80`).
  - Sin permisos operativos: `Empty` "No tiene permisos operativos asignados." (`App.tsx:115-116`).
  - Módulo lazy: `RouteState kind="loading"` por ruta (`AppRoutes.tsx:117` y ss.).
  - Permiso denegado: `RouteState kind="denied"` con motivo y enlace a `/help` (`PermissionGate.tsx:20-28`).
  - Ruta inexistente: `RouteState kind="not-found"` con acción "Ir al inicio" (`AppRoutes.tsx:295-304`).
  - Error de render: `AppErrorBoundary` con "Recargar pantalla" y enlace a ayuda (`AppErrorBoundary.tsx:43-57`).
- **Teclado/foco**
  - Skip link "Omitir al contenido principal" primero en tabulación; visible al foco (`InstitutionalShell.tsx:118-120`).
  - `Ctrl+K` abre/cierra comandos solo fuera de campos editables (`:79-89`); al cerrar devuelve foco al botón de comandos (`:105-110`).
  - `?` abre paleta de atajos fuera de campos editables (`keyboard-shortcuts-palette.tsx:36-48`); `Esc` cierra y devuelve foco.
  - Rail colapsable con nombre accesible "Reducir/Expandir navegación" (`InstitutionalRail.tsx:100-110`) y preferencia persistida en `localStorage` (`InstitutionalShell.tsx:16,27-42`).
  - `Escape` cierra menú de usuario y overlays; el foco regresa al disparador (verificado en spec; contrato exigido).
- **Navegación**: `aria-current="page"` en el ítem activo (`InstitutionalRail.tsx:80`); grupos con etiqueta (`:71`); breadcrumbs derivados de `appNavigation.ts:303-311`.
- **Estado operativo en barra**: badge "Mi caja abierta/cerrada" con texto (`ContextBar.tsx:43-50`), conexión local como `role="img"` con etiqueta (`:51-62`), estado textual en `role="status"` (`:87`).
- **Doble acción improbable** aquí; las acciones críticas viven en cada pantalla.
- **No-solo-color**: caja abierta/cerrada y conexión tienen texto; el color es refuerzo.
- **Aceptación Tanda 2**: un solo `main` y un solo `h1` por ruta; skip link funcional; foco visible ≥ 3:1; sin overflow horizontal en matriz de 320-1920 px; overlays con nombre accesible y retorno de foco; no usar gradientes decorativos.
- **Pendiente visual**: orden real de tabulación dentro del rail colapsado (tooltips) y contraste del badge de caja en ambos temas.

## SHELL-2 · Paleta de comandos y atajos

- **Comandos** (`CommandPalette.tsx:56-88`): solo pantallas visibles por permiso (`getVisibleNavigation`, `InstitutionalShell.tsx:65`); búsqueda con `autoFocus`; `Enter` abre; `Esc` cierra.
- **Atajos** (`keyboard-shortcuts-palette.tsx:57-93`): lista agrupada por alcance, filtrable, `kbd` semántico; estados vacío "Sin resultados".
- **Hallazgo vinculado**: el catálogo `lib/shortcuts.ts:28-78` anuncia F2/F4/F6/F8 que hoy no tienen handler (ver HS-UX-03). Contrato Tanda 2: o se implementan o se retiran del catálogo y de la ayuda; no dejar promesas muertas.
- **Aceptación**: todo atajo listado debe existir en código y toda tecla implementada debe estar listada; el catálogo es la única fuente para tooltips/ayuda (`shortcuts.ts:1-13`).

## SHELL-3 · Tour guiado (`GuidedTour.tsx:21-95`)

- **Propósito**: recorrido de 6 pasos por las pantallas operativas; navega al cambiar de paso (`:41-45`).
- **Estados**: primer paso, intermedio, último; cierre persistente (`localStorage['hospital-onboarding-completed']`); auto-apertura solo con bandera previa (`:93-95`).
- **Teclado/foco**: botones Anterior/Siguiente/Finalizar; `Esc` cierra (Radix); retorno de foco al disparador (`:31-39`).
- **Riesgo**: los pasos mencionan Rutas que un rol puede no tener permitidas (p. ej. Respaldos). El tour navega igual (`:44`). Contrato Tanda 2: filtrar pasos por permisos o explicar el estado denegado sin callejón sin salida.
- **Pendiente visual**: legibilidad de 6 botones a 320 px.

## ROUTE-1 · 404 y estados de ruta compartidos

- `RouteState` centraliza `loading | empty | error | denied | offline | not-found` (`RouteState.tsx:13`), con rol semántico `alert`/`status` (`:51`) y encabezado configurable.
- **Contrato**: todo estado debe incluir título, descripción y una única acción de recuperación; el `offline` existe y debe usarse cuando falle la red local, no solo como texto.
- **Aceptación**: 404 conserva navegación al inicio; los estados `denied` explican el permiso faltante en lenguaje humano (p. ej. motivo de `appNavigation.ts:76`).
