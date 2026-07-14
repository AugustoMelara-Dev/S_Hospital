# Cierre de rendimiento, UX y accesibilidad de S_Hospital

> **SUPERSEDIDO el 2026-07-10.** La decisión de producto posterior exige un
> rediseño visual total. No implementar este documento. La especificación
> vigente es
> [`2026-07-10-clinical-operations-console-total-redesign-design.md`](./2026-07-10-clinical-operations-console-total-redesign-design.md).

Fecha: 2026-07-10
Estado: diseño derivado del alcance aprobado de reescritura total
Producto: S_Hospital offline para caja, facturación, recibos, reportes y administración

## 1. Veredicto sobre el estado actual

Sí existe un refactor visual real. La interfaz actual ya tiene diseño
institucional, rutas por rol, sidebar colapsable, jerarquía tipográfica,
componentes operativos, estados vacíos, foco visible, modo reducido de
movimiento, matrices axe y adaptación de 320 a 1920 px. No corresponde iniciar
una segunda reescritura visual.

El cierre pendiente es más específico:

- reducir el tiempo hasta que login, Inicio y Nueva factura respondan;
- eliminar información duplicada y cajas que no ayudan a decidir;
- reducir pasos y ruido en facturación, reportes e historial;
- evitar notificaciones simultáneas y estados técnicos en inglés;
- garantizar teclado, foco, anuncios y objetivos táctiles según WCAG 2.2 AA;
- impedir que catálogo y reportes se degraden cuando crezcan los datos;
- acortar el ciclo de verificación sin bajar cobertura.

## 2. Alternativas consideradas

### A. Otra capa cosmética

Cambiar colores, sombras, iconos y animaciones produciría una diferencia rápida
en capturas, pero no reduciría solicitudes, pasos ni carga cognitiva. Se
rechaza porque consume tiempo sin resolver el retraso percibido.

### B. Segunda reescritura completa

Mover todo el frontend a otra estructura o framework permitiría uniformidad,
pero reabriría riesgos ya cerrados en facturación, caja, auditoría e impresión.
Se rechaza por plazo, riesgo y falta de beneficio proporcional.

### C. Cierre dirigido por métricas y tareas operativas

Se conserva React, Laravel, Tailwind y los contratos actuales. Se mide primero,
se optimizan carga y consultas, y luego se simplifican las pantallas donde el
usuario toma decisiones. Es la opción seleccionada porque ofrece el mayor
impacto con cambios pequeños, comprobables y reversibles.

## 3. Principios de producto

1. Cada pantalla tendrá una acción primaria reconocible y no más de dos
   acciones secundarias visibles antes de abrir un menú o detalle.
2. Un mismo estado operativo se mostrará una sola vez por zona visual.
3. La aplicación no explicará conceptos técnicos al cajero cuando puede tomar
   la decisión por él.
4. Los mensajes de progreso no generarán toast; los éxitos repetidos se
   reemplazarán y los errores permanecerán visibles hasta ser entendidos.
5. La velocidad se evaluará con presupuestos reproducibles, no por sensación.
6. No se agregará una dependencia si React, el navegador o las librerías ya
   instaladas resuelven el problema.
7. No se crearán módulos clínicos, contabilidad de partida doble ni funciones
   nuevas durante este cierre.

## 4. Objetivos medibles

### Rendimiento

- LCP de login e Inicio menor o igual a 1.8 s en Chromium con CPU 4x y red LAN
  simulada de 20 Mbps/20 ms.
- CLS menor o igual a 0.10 e INP de interacciones medidas menor o igual a 200 ms.
- JavaScript gzip por archivo: entrada 70 kB, vendor 125 kB, UI 52 kB, charts
  110 kB; CSS total 18 kB.
- Nueva factura precargada por intención y visible en menos de 300 ms después
  del clic cuando el usuario tiene rol de caja.
- Búsqueda de servicios: debounce de 200 ms, cancelación de la solicitud
  anterior y resultados nuevos en menos de 500 ms sobre LAN con 10,000
  servicios sembrados para prueba.
- Recharts, configuración avanzada, ayuda, onboarding y WebSocket no bloquearán
  el primer render de login o Inicio.

### UX

- Nombre de paciente, búsqueda, carrito y acción `Emitir y cobrar` cabrán en un
  flujo continuo sin paneles informativos duplicados.
- El estado de caja aparecerá en topbar y en el contenido que lo necesita, no
  además como tarjeta permanente en sidebar.
- Solo habrá un toast operativo visible; los mensajes de progreso quedarán en
  el control que inició la acción.
- Todos los estados se mostrarán en español mediante un único formateador.
- Reportes mantendrá Ejecutivo, Caja y Auditoría; no se agregarán nuevas vistas.
- Usuarios y permisos conservarán la edición avanzada bajo revelado progresivo.

### Accesibilidad

- Cero violaciones axe críticas o serias en rutas operativas.
- Flujo abrir caja, facturar, cobrar, imprimir y reimprimir completo con teclado.
- Foco inicial, foco al error y restauración de foco al cerrar diálogo.
- `aria-busy` durante cargas, resumen de errores de formulario y un solo canal
  `aria-live` por mensaje operativo.
- Objetivos interactivos de al menos 44x44 px en acciones primarias y 24x24 px
  mínimos en controles compactos con separación suficiente.
- Sin pérdida de información a 200% de zoom ni en 320x640.

## 5. Arquitectura del cierre

### Carga de rutas

`AppRoutes` usará un catálogo único de importadores dinámicos. Sidebar y enlaces
primarios precargarán el módulo en `focus`, `pointerenter` o `touchstart`.
Nueva factura y Caja dejarán de formar parte del bundle inicial, pero se
precargarán al autenticar un cajero y por intención de navegación.

Onboarding, paleta de atajos y puente WebSocket se montarán después del primer
render. El tiempo real seguirá activo; solo dejará de competir con el contenido
inicial.

### Datos de facturación

La carga inicial traerá caja, categorías y áreas. Los servicios se consultarán
cuando exista una búsqueda de dos caracteres, un filtro específico o un código
escaneado. Cada búsqueda cancelará la anterior para impedir resultados fuera
de orden.

El backend reducirá candidatos en SQL antes de aplicar la coincidencia fuzzy en
PHP. El índice existente `services(active, name)` se aprovechará; no se creará
otra migración sin evidencia de `EXPLAIN`.

### Presentación

Se mantendrán los tokens actuales y no se cambiará de tipografía ni librería de
iconos. Se reducirán mayúsculas espaciadas, tarjetas anidadas y bordes que no
expresen jerarquía. Los cambios se concentrarán en facturación, shell,
dashboard, reportes, historial y usuarios.

### Retroalimentación

Los mensajes se clasificarán como `progress`, `success`, `warning` o `error`.
`progress` actualizará estado local y `aria-busy`; los demás compartirán un ID
estable para que un mensaje nuevo reemplace al anterior en vez de apilarse.

## 6. Estrategia de verificación rápida

Se aplicará una escalera de cuatro niveles:

1. `changed`: tests relacionados con los archivos modificados, typecheck
   incremental y lint de esos archivos; objetivo menor a 2 minutos.
2. `module`: suite del módulo y un Playwright enfocado; objetivo menor a 6
   minutos.
3. `phase`: lint, typecheck, build y E2E crítico de la fase; una vez por fase.
4. `release`: cobertura completa, Laravel completo, Pint, PHPStan, build, E2E
   MariaDB y matrices de accesibilidad; una sola vez al final.

Una falla se reproduce primero con la prueba mínima. No se repetirá una matriz
de 20 minutos para comprobar un selector o un texto.

## 7. Orden y plazo interno

El cierre se divide en seis jornadas enfocadas:

1. presupuesto y verificación rápida;
2. carga de rutas y solicitudes;
3. facturación y retroalimentación;
4. shell, Inicio, reportes, historial y usuarios;
5. accesibilidad y crecimiento del catálogo;
6. gate completo, documentación y paquete candidato.

Cada jornada termina en un commit revisable. Si una métrica ya cumple el
presupuesto, se conserva el código y no se inventa una optimización.

## 8. Criterio de terminado

- presupuestos de rendimiento aprobados en build y navegador;
- factura completa con mouse y teclado, sin mensajes duplicados;
- búsqueda sin carreras y catálogo estable con volumen de prueba;
- navegación y pantallas sin duplicación de estado ni inglés técnico;
- WCAG 2.2 AA en automatización y checklist manual;
- escalera de verificación documentada y usada;
- gates finales completos ejecutados una sola vez;
- árbol Git limpio y changelog actualizado;
- aceptación física de LAN e impresora separada y no presentada como prueba
  automatizada.
