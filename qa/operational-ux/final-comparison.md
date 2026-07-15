# Comparación visual canónica: antes y después

Fecha de regeneración y revisión: 15 de julio de 2026.

Las doce imágenes `before/originals` son copias inalteradas de las capturas
entregadas por el usuario. Las doce imágenes `after/canonical` fueron generadas
de nuevo por `frontend/e2e/operational-ux-canonical.spec.ts` con datos locales
deterministas. La prueba comprueba, para cada captura, ausencia de overflow
horizontal de documento y usa el guard estricto para fallar ante API no
mockeada, `console.error`, `pageerror`, `requestfailed`, HTTP 500 o advertencias
de deprecación de Ant Design.

La revisión visual fue manual y a imagen completa, no solamente por snapshots.

| # | Antes | Después equivalente | Comparación de la tarea |
|---|---|---|---|
| 1 | [`01-login.png`](before/originals/01-login.png) | [`01-login.png`](after/canonical/01-login.png) | Antes, “Validando credenciales” estaba pintado como error rojo durante el envío. Después, el estado inicial comunica “Listo para iniciar sesión local”, conserva campos y acción en una sola columna y no muestra severidad de error sin un fallo. |
| 2 | [`02-dashboard.png`](before/originals/02-dashboard.png) | [`02-dashboard.png`](after/canonical/02-dashboard.png) | Antes, el timeout de configuración reemplazaba el centro operativo con detalle técnico. Después, caja, facturado, cobrado, pendientes, facturas recientes y “Nueva factura” permanecen disponibles en el primer viewport; la cola usa iconos semánticos consistentes y ya no deja un ordinal aislado. |
| 3 | [`03-billing-empty.png`](before/originals/03-billing-empty.png) | [`03-billing-empty.png`](after/canonical/03-billing-empty.png) | Antes, “Identificar paciente” ocupaba una gran superficie y el resultado inicial quedaba debajo del viewport; categorías tenían scroll interno. Después, paciente, búsqueda, categorías y cuenta están simultáneamente visibles, sin scroll interno de categorías y con totales fijos en la cuenta. |
| 4 | [`04-billing-results.png`](before/originals/04-billing-results.png) | [`04-billing-results.png`](after/canonical/04-billing-results.png) | Antes, cada fila repetía un botón “Agregar” dominante y el usuario llegaba a resultados después de desplazarse por bloques altos. Después, cinco filas compactas entran en el viewport; toda la fila es el target operativo y el extremo derecho muestra un estado “Disponible” secundario. La cuenta permanece visible. |
| 5 | [`05-billing-cart-overlap.png`](before/originals/05-billing-cart-overlap.png) | [`05-billing-cart.png`](after/canonical/05-billing-cart.png) | Antes, resumen, controles de cantidad y alerta se superponían, y la acción principal no era alcanzable. Después, un drawer dedicado ordena línea, cantidad, subtotal, ISV, total y “Emitir y cobrar”; la acción es visible sin desplazamiento y no cubre los controles del carrito. |
| 6 | [`06-cashbox-summary.png`](before/originals/06-cashbox-summary.png) | [`06-cashbox-summary.png`](after/canonical/06-cashbox-summary.png) | Antes, una alerta verde redundante y un bloque de conciliación consumían el primer viewport. Después, Resumen abre seleccionado, presenta una sola franja de estado y métricas operativas, y deja métodos de pago como única superficie principal. |
| 7 | [`07-cashbox-movements.png`](before/originals/07-cashbox-movements.png) | [`07-cashbox-movements.png`](after/canonical/07-cashbox-movements.png) | Antes, el grid tenía scroll interno, controles “Page Size” y referencias truncadas. Después, las dos filas usan altura de contenido, referencias de factura accionables y un control de detalle por movimiento, sin paginación duplicada ni scroll horizontal de página. |
| 8 | [`08-cashbox-close.png`](before/originals/08-cashbox-close.png) | [`08-cashbox-close.png`](after/canonical/08-cashbox-close.png) | Antes, el usuario llegaba a una lista extensa y a una alerta genérica lejos del conteo. Después, monto contado y diferencia están juntos; cada bloqueo es una fila corta con “Resolver en Historial”, y el botón de cierre queda explícitamente inhabilitado hasta resolverlos. |
| 9 | [`09-history.png`](before/originals/09-history.png) | [`09-history.png`](after/canonical/09-history.png) | Antes, dos registros ocupaban un grid alto con scrollbar interno y doble paginación. Después, filtros, dos filas, conteo y una sola paginación usan altura de contenido; la columna ampliada muestra completos los correlativos fiscales y el estado del recibo. |
| 10 | [`10-catalog-intro.png`](before/originals/10-catalog-intro.png) | [`10-catalog-intro.png`](after/canonical/10-catalog-intro.png) | Antes, métricas y categorías duplicadas empujaban filtros y servicios fuera del primer viewport. Después, filtros y seis servicios son la superficie principal desde la entrada; categorías se reducen a un bloque colapsable. |
| 11 | [`11-catalog-grid.png`](before/originals/11-catalog-grid.png) | [`11-catalog-grid.png`](after/canonical/11-catalog-grid.png) | Antes, el grid tenía scroll interno y paginación separada del contenido. Después, la búsqueda “hemo” conserva filtros, devuelve una fila distinguible y mantiene una sola paginación debajo de la tabla, sin overflow horizontal de documento. |
| 12 | [`12-settings.png`](before/originals/12-settings.png) | [`12-settings.png`](after/canonical/12-settings.png) | Antes, “Configuración” se repetía como título de shell y página, y seis valores fiscales se convertían en tarjetas grandes. Después, la ruta queda como contexto secundario, “Configuración hospitalaria” es el único H1, los tabs son compactos y los seis datos usan una definición tabular de una sola superficie. |

## Integridad de las capturas after

| Archivo | Dimensiones | SHA-256 |
|---|---:|---|
| `01-login.png` | 1917×1018 | `0cc354e5e0b0382eadfbfd34004448d9c6385ffcb3889f9a360f50063bc991b3` |
| `02-dashboard.png` | 1917×1027 | `cb2acf762ec2846fc8076266dd0a0a5fc83fa348f260fe47039dcfd1713c88b8` |
| `03-billing-empty.png` | 1917×1027 | `267afbb405b3e11c146d1c47b4eb1e123110226542f2cc89295c2ceab2b0e4d5` |
| `04-billing-results.png` | 1917×1027 | `24d39192563110dda1c5a490b02b87304f6342c83897f99705d6f68bb1a9f158` |
| `05-billing-cart.png` | 672×921 | `af80870bf9aced9e8052f77d3627e2ccb14d173fcd74b6859295df1ef77b43d4` |
| `06-cashbox-summary.png` | 1917×1032 | `644f6226928c8065c804ed68e551c133f3f0272a37dc64d41ae5e52abc2f40d0` |
| `07-cashbox-movements.png` | 1917×1027 | `a6a75b647965e761a851b01cad21a64f39dcda16e5656b31be60dbc263455d7c` |
| `08-cashbox-close.png` | 1917×1028 | `804389594f161a486984b2f16d4e23efe075fba294778fd90d43130183faadf5` |
| `09-history.png` | 1917×1026 | `897b674ba338f3e23aa8fa302a7f979b61b0f5c0012dd85a3e30ae3d60b3b9dc` |
| `10-catalog-intro.png` | 1917×1033 | `5cc2e5e8ce965ad27361560eb093ec2eb181460d991858f75f18ab62d80028f3` |
| `11-catalog-grid.png` | 1917×1027 | `3411ed19fa1261f143ae577661d5dc376c8e2b072964cfeb6e19d04953d3207c` |
| `12-settings.png` | 1917×1018 | `03deb64c62e401ccba180d87ee29f697d337d567c075c7ea35dc4c22a8a2c786` |

## Alcance de esta evidencia

Las capturas usan API mockeada y Chromium; demuestran composición y estado
operativo determinista, no sustituyen una prueba contra Laravel/MySQL en LAN,
una impresora física ni una revisión de los PDF generados.
