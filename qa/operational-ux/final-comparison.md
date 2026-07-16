# Comparación visual canónica: antes y después

Fecha de regeneración y revisión: 16 de julio de 2026.

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

## Evidencia complementaria posterior a las capturas

Esta sección no agrega, reemplaza ni vuelve a interpretar ninguna de las doce
parejas `before/after`.

- El recibo institucional Laravel ahora desglosa cada pago mixto con fecha,
  método, monto, referencia y cajero. La cabecera muestra `Pagos mixtos (n)` en
  vez de asociar el total de la factura al último método.
- La vista compatible sin recibo autorizado se identifica dentro del área
  imprimible como `COMPROBANTE HISTÓRICO DE FACTURA` y `No institucional`, usa
  `Factura No.` y declara que no asigna correlativo de recibo.
- El snapshot y el HTML autorizado cubren CAI, rango y fecha límite de emisión;
  el bloque se omite si no hay datos fiscales. Su disposición compacta conserva
  los conteos de la matriz de seis tamaños y 30 PDF documentada en
  [`after/receipt-matrix/manifest.md`](after/receipt-matrix/manifest.md).
- El ciclo TDD dejó RED reproducible para pagos mixtos, vigencia fiscal,
  etiquetado histórico, fechas de pagos y paginación de media carta. El GREEN
  final fue **31 pruebas Laravel/1,323 aserciones** en Docker y **18 pruebas
  Vitest**; los comandos, tiempos y fallos exactos están en
  [`completion-matrix.md`](completion-matrix.md).
- El contador de arqueo usa L1, L2, L5, L10, L20, L50, L100, L200 y L500,
  conforme a la familia descrita por el
  [Boletín No. 66/2019 del BCH](https://www.bch.hn/administrativas/RI/Enlaces%20Comunicados%20FMI%20%20ES/Bolet%C3%ADn%20de%20prensa%20no%2066%20Directorio%20del%20Banco%20Central%20de%20Honduras%20aprueba%20emisi%C3%B3n%20de%20billete%20de%20doscientos%20lempiras%20%28L200.00%29.pdf).
  `Monedas y otros` queda separado porque esa fuente enumera billetes, no
  monedas.
- El cierre conserva el desglose contado y lo incluye en auditoría. El ciclo
  backend comenzó con **2 RED** —desglose inconsistente aceptado con HTTP 200 y
  desglose válido no persistido— y terminó con **5 pruebas/18 aserciones** en
  `CloseCashSessionDifferenceTest`.
- `migrate:fresh --seed --force` pasó completo sobre MariaDB 11 e incluyó
  `2026_07_15_000001_add_closing_breakdown_to_cash_register_sessions_table.php`.
  La captura complementaria
  [`cashbox-denominations-1366.png`](after/cashbox-denominations-1366.png)
  documenta el arqueo real antes del cierre, con desglose, diferencia L 0.00 y
  conciliación lista.
- La evidencia frontend posterior ya tiene gate global: **147 archivos y
  1,127 pruebas Vitest**, además de **3/3** E2E de caja mock y el gate real de
  factura, cobro, recibo, reporte y cierre sobre MariaDB. Estos resultados no
  cambian ni reinterpretan las doce capturas canónicas.
- El gate release también verificó RBAC: un administrador creó un cajero, el
  usuario cambió su contraseña obligatoria y la navegación ocultó módulos sin
  permiso. El resultado estructurado se conserva en
  [`after/mariadb-release-e2e-report.json`](after/mariadb-release-e2e-report.json).

## Integridad de las capturas after

| Archivo | Dimensiones | SHA-256 |
|---|---:|---|
| `01-login.png` | 1917×1018 | `98b0e61bd7b4e714e1696b5410c24589aa9ae7a7a3b1543bd1039632a3e6a428` |
| `02-dashboard.png` | 1917×1027 | `26ed35173ba1c5e9098d2cedfdbbedf472e65c7112c0e2e180355b1211ef2f4c` |
| `03-billing-empty.png` | 1917×1027 | `43eb8f63b173d34ab748612da9176a8d01a3d23d9f0963a19fa57ec084696571` |
| `04-billing-results.png` | 1917×1027 | `7ceba542c08b1621b411f6643451f0186606b80e0a8f8d3e64d54542f324187d` |
| `05-billing-cart.png` | 672×921 | `ed3e4e8728c2a84caeefc7d3434677451d51b4bcf460ce229eb3ac265666242a` |
| `06-cashbox-summary.png` | 1917×1032 | `b4e35341c17a9070474d3ad32b288263e99c19eae5f71647c6bf23bc8038685f` |
| `07-cashbox-movements.png` | 1917×1027 | `2679b2d2cb26e3101a5dfdece4e787643b592af4c1c29c981d11c828450d413a` |
| `08-cashbox-close.png` | 1917×1028 | `5b0a763320c4a4edbf45decd67a5e8d1e42d3e0d062459f4a9d82467e8661cb5` |
| `09-history.png` | 1917×1026 | `58219828f31542c69494573ff5ede4b69406a18ec083fa8005e1fa7b628938ae` |
| `10-catalog-intro.png` | 1917×1033 | `009c4e13a386e3f1a21e1905519bf690a487892c5479c544093db2ab10f97cd9` |
| `11-catalog-grid.png` | 1917×1027 | `fe96bb0bd85a6acdd84d7d1ebcd08ba2214eb0af36151964122f1a9a0030c3a8` |
| `12-settings.png` | 1917×1018 | `bac0f8ed0ec11f00b0baa8b0738cd46f73002ff0ab2896ba272f24a6251d7c52` |

## Alcance de esta evidencia

Las doce parejas canónicas usan API mockeada y Chromium; por sí solas
demuestran composición y estado operativo determinista. La corrida release
separada sí valida el flujo de un cliente real contra Laravel/MariaDB local,
pero no una prueba simultánea desde varias computadoras de la LAN ni una
impresora física. La migración, el gate real y la revisión PDF quedan
delimitados como evidencias independientes.
