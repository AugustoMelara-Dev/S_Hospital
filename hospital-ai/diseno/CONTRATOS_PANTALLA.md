# CONTRATOS_PANTALLA — identidad "Libro de Caja" (DEV, no R2)

**TASK_ID:** T-UX-01 · **Autor:** hs-ux · **Fecha:** 2026-09-18
**Raíz:** `C:\Projects\S_Hospital_AI` (worktree aislado, detached).
**Ámbito de escritura de hs-ux:** `hospital-ai/diseno/**` y `hospital-ai/evidencia/T-UX-01/**`. Este documento **no edita código de producto**.

**Fuentes vinculantes, en orden de prioridad:**
1. `hospital-ai/MANDATO_DEV.md` §5, §6, §7, §8, §9, §11, §12, §13, §14, §15, §16.
2. `hospital-ai/MAPA_PRODUCTO.md` (secciones, rutas y contratos de datos).
3. `hospital-ai/diseno/IDENTIDAD_DEV.md` (contrato visual vinculante; este documento lo desarrolla por superficie, no lo sustituye).
4. Skills `better-ui` y `emil-design-eng` (cargadas con la herramienta nativa `skill` en esta tarea; referencias `surfaces.md`, `animations.md`, `icons.md` leídas).

**Naturaleza de este documento:** contrato de composición, jerarquía, estados, teclado y accesibilidad para los implementadores. **No es aprobación visual.** No existe todavía render de la identidad nueva; ver §9 y `REVISION_IDENTIDAD.md`.

**Regla de propiedad:** este contrato describe el destino de `frontend/src/**` y `hospital-ai/diseno/**`; los archivos de código pertenecen a `hs-frontend`, `hs-ui-*` y `hs-receipts`. hs-ux no edita esos árboles.

---

## 0. Contrato común a toda superficie

### 0.1 Arquitectura de navegación (sustituye al riel R2)

- **Barra superior horizontal fija** (`TopLedgerBar`), 52 px de alto, no un riel lateral de iconos.
- Secciones primarias como **texto**: `Resumen · Cobrar · Recibos · Caja · Reportes`. Se filtran por permiso; una sección sin permiso no se dibuja (no se dibuja deshabilitada).
- Sección activa: **subrayado de tinta + peso 600**. Sin "pills", sin iconos con color de acento, sin bloque de administración abierto.
- **Administración** como menú secundario discreto a la derecha (`Administración ▾`): catálogo, usuarios, ajustes, mantenimiento.
- **Franja de contexto** bajo la barra (una sola línea, 32–36 px): caja/turno actual, hora, estado de conexión **textual** (no solo color), usuario. Reemplaza la combinación R2 de barra de contexto + `PageHeader` repetido.
- **Sin títulos duplicados.** Una sola vez por pantalla: el `h1` de sección en la franja de contexto o en el encabezado de la superficie, nunca ambos con el mismo texto (defecto R2 medido en 4 rutas).
- Aterrizaje: **cajero → `/cobrar`**; supervisión/admin → `/resumen`.
- **Móvil:** la barra se convierte en una fila de textos desplazable. Sin drawer de iconos.

### 0.2 Composición: zonas, no solo tamaños

Cada superficie declara zonas nombradas con una **función**, no un ancho:

| Zona | Función |
|---|---|
| `Franja` | contexto global (barra + franja de contexto) |
| `Acción` | dónde vive la acción primaria y su estado |
| `Trabajo` | la tarea continua (búsqueda, cuenta, tabla, formulario) |
| `Detalle` | panel/expansión de un elemento de `Trabajo` |
| `Resultado` | salida confirmada (comprobante, cierre, exportación) |
| `Aviso` | error/bloqueo/motivo **junto a la tarea afectada** |

Reglas de composición aplicables a todas:
- **Una sola dirección de acción:** la acción primaria de cada pantalla es única y evidente; el resto son secundarias discretas.
- **El dato manda:** nombre de paciente, líneas, totales y advertencias pesan más que cromo. Sin rejillas de tarjetas gigantes, encabezados de marketing ni bloques de carga de media pantalla.
- **Superficies con borde, no sombra**, salvo overlays (diálogo/menú), que usan `box-shadow` suave. Los separadores son hairline (`--led-line`).
- **Concentricidad de radios:** `radio_exterior = radio_interior + padding`. Base `--led-radius: 6px` (control 6, panel 8, overlay 10). Sin píldoras (R2 usaba `rounded-full` en badges y pills).
- **Un solo acento de acción** (`--led-action`, naranja quemado). El violeta `--led-free` está **reservado** a la regla de gratuidad y **siempre** lleva etiqueta textual.
- **Números:** dinero `tabular-nums` alineado a la derecha; cantidades centradas. Nunca `L 0.00` para un error o dato ausente.
- **Iconografía:** un solo juego, `currentColor`, outline por defecto y relleno solo para estado activo. Trazo 1,5 px junto a texto 400; 2 px junto a 600. Tamaño relativo a la altura de mayúscula (1–1,25 em inline). Sin iconos decorativos por fila.
- **Movimiento:** `ease-out` 120–200 ms; solo `transform`/`opacity`/`color`. Interacciones de alta frecuencia (filas, hover, cambio de pestaña en herramienta) reciben transición ≤150 ms de color/opacidad o feedback instantáneo; **nunca** una entrada animada por cada acción. `scale(0.96)` solo en press de botones ocasionales; se desactiva en flujos de teclado repetitivos. Popovers escalan desde su disparador; modales permanecen centrados. Nada entra desde `scale(0)`. Se respeta `prefers-reduced-motion` (se elimina desplazamiento, se conserva cambio de color).
- **Press feedback:** botón primario con `scale(0.96)` en `:active`, transición `transform 140 ms` + `background-color 140 ms` (identidad §Controles). Botones de alta frecuencia de teclado pueden ser estáticos.

### 0.3 Jerarquía transversal

1. El **dato crítico de la tarea** (total a cobrar, diferencia de caja, nombre del paciente, número de documento).
2. El **estado** (cobrado / sin cobro / pendiente / anulado), siempre **textual** además de color.
3. La **acción primaria**.
4. Metadatos en `xs`/`sm`.

Máximo **dos niveles de superficie** visibles por pantalla (fondo `--led-paper` + superficie `--led-surface`), más overlays.

### 0.4 Estados transversales (definiciones canónicas)

Toda ruta debe poder renderizar, como mínimo, los estados aplicables de esta lista. Se prohíbe representar un fallo como contenido vacío.

| Clave | Estado | Requisito |
|---|---|---|
| `VAC` | Vacío | Distinguir **"no hay datos"** de **"sin coincidencias por filtro"**; causa + **una** acción. |
| `CAR` | Cargando | `role="status"` con texto "Cargando…"; sin salto de layout; no bloquear la tarea que sí puede usarse (p. ej. seguir escribiendo paciente). |
| `ERR` | Error | `role="alert"`, causa legible, botón **Reintentar**; **no perder** el formulario/borrador. |
| `INV` | Inválido | Error junto al campo/acción, texto útil; la acción afectada se bloquea con motivo; nunca `L 0.00`. |
| `SIN` | Sin permiso | Motivo textual + salida; el backend es la autoridad. No se resuelve ocultando botones. |
| `SRV` | Servidor no disponible | Aviso **junto a la tarea afectada**; no tapar toda la app por un dato no crítico; no confirmar cobros ficticios; no usar LocalStorage para "completar" una operación. |
| `LIS` | Listo para cobrar | Importe positivo validado por el servidor; acción primaria habilitada con etiqueta descriptiva. |
| `SINCOBRO` | Emisión sin cobro | Total L 0 **válido** (regla aplicada); sin pago ficticio, sin efectivo, sin conteo de cobro; estado propio y trazable. |
| `PAG` | Pagado | Pago confirmado asociado a caja/cajero/método/fecha; habilita comprobante. |
| `PEND` | Emitido pendiente de cobrar | Documento emitido sin pago; reintento de cobro sin duplicar documento. |
| `REC` | Recuperación | Timeout/estado desconocido tras envío: **recuperar el resultado previo** antes de ofrecer otra operación. |

Regla de oro: **un error nunca se muestra como cero**, y **un botón oculto no es una autorización**.

### 0.5 Accesibilidad transversal (§16)

- **Foco:** contorno `2px` con color `--led-focus` y `offset 2px` en todo interactivo. **Nunca** `outline: none` sin reemplazo. El foco no queda oculto tras barras fijas.
- **Teclado:** orden de Tab = orden visual/funcional; sin `tabindex > 0`. Primer Tab = *skip link* al contenido. `Esc` cierra overlays y devuelve foco al disparador. Tablas: fila activable con `Enter`/`Espacio` cuando tenga acción. Pestañas y radiogroups con flechas + roving tabindex.
- **Regla de Enter seguro:** `Enter` en un campo **nunca** dispara una operación monetaria irreversible. La confirmación de emisión/cobro exige acción deliberada sobre el botón (clic o Enter sobre el botón enfocado) y una revisión previa; no se impone un atajo poco visible como única forma.
- **Etiquetas:** todo control tiene `label` asociado y nombre accesible; los botones de solo icono llevan nombre accesible; errores con texto real, no solo borde rojo.
- **Contraste:** texto normal ≥4,5:1; texto grande/UI ≥3:1; el color nunca es el único canal.
- **Zoom 200 %:** reflow hasta 320 CSS px sin scroll horizontal de documento; la acción primaria y el total permanecen alcanzables; el foco visible.
- **Reduced motion:** se respeta `prefers-reduced-motion`.
- **Hover:** solo bajo `@media (hover: hover) and (pointer: fine)`.

---

## 1. Login

**Ruta:** `/login` (la nueva superficie de acceso; se conserva la ruta).

### Tarea del operador
Autenticarse en la LAN para entrar a la herramienta de trabajo. Es un paso de fricción mínima, no una portada de producto.

### Zonas
| Zona | Contenido |
|---|---|
| `Acción` | Formulario centrado: usuario, contraseña, mostrar/ocultar, enviar. |
| `Franja` | Estado de conexión/servidor local y aviso de cápsulas si aplica. |
| `Aviso` | Error de credenciales/bloqueo/sesión vencida junto al formulario. |

- **Identidad institucional real** (nombre/logo autorizado si existe) como texto/firma, **no** como `h1` inventado. No se dibuja escudo, sello ni firma no autorizados.
- Tarjeta sobria `max-w-md` centrada; sin héroe, sin gradientes, sin ilustración.

### Jerarquía
`h1` = acción ("Iniciar sesión"); identidad institucional antes del `h1` en menor peso; campos; acción primaria.

### Acción primaria
`Entrar` (única). Al enviar: `aria-busy`, inputs deshabilitados, sin doble submit.

### Estados
- `CAR`: botón con spinner + `aria-busy`; inputs deshabilitados.
- `VAC`: no aplica (formulario obligatorio).
- `ERR`: `role="alert"` con el mensaje real del servidor sin filtrar credenciales.
- `INV`: campos vacíos/incompletos bloquean el envío con texto junto al campo.
- `SIN`: no aplica.
- `SRV`: "No se puede conectar con el servidor local" junto al formulario; reintentar sin perder lo escrito (salvo contraseña).
- Bloqueo: cuenta regresiva visible. Sesión vencida: mensaje explícito, **no** "error".
- `LIS`/`SINCOBRO`/`PAG`: no aplican.

### Accesibilidad
Autofocus en usuario; Tab → contraseña → mostrar/ocultar → Entrar; `Enter` en el formulario envía (acción no monetaria). Aviso de Bloq Mayús con texto. Contraste ≥4,5:1. A 200 % la tarjeta fluye a una columna sin cortar el botón. Manejo de foco al aparecer el error.

---

## 2. Resumen

**Ruta:** `/resumen`. Reemplaza `DashboardView` (`/dashboard`).

### Tarea del operador
Saber, de un vistazo, **cuánto se emitió, cuánto se cobró, qué saldo existe al corte, cuántas operaciones fueron sin cobro** y **cuál es la caja/turno** del usuario, con ámbito y período explícitos. No es una réplica de reportes ni una pantalla obligatoria antes de cobrar.

### Zonas
| Zona | Contenido |
|---|---|
| `Franja` | Barra + contexto (caja/turno, hora, conexión, usuario). |
| `Trabajo` | **Franja de 4 métricas como texto alineado** (no tarjetas gigantes): Emitido/Facturado · Cobrado · Saldo al corte · Operaciones sin cobro. |
| `Detalle` | Estado de la caja actual + **operaciones recientes** en tabla densa. |
| `Aviso` | Bloqueos de caja, fallos de conexión, respaldos degradados **junto al bloque afectado**, no como banner global. |

- Cada métrica lleva **rótulo de ámbito y período**; **no** mezclar métricas del día con las del mes bajo un solo rótulo.
- El saldo al corte declara su cohorte; no se asume `facturado − cobrado = saldo`.
- El cajero con permiso puede saltar a `/cobrar` desde la acción primaria; no se le fuerza a leer Resumen.

### Jerarquía
1. **Acción primaria** y **estado de caja** (¿se puede cobrar o no?) — el dato que desbloquea el trabajo.
2. Métricas de texto, con jerarquía por tipografía (números grandes `tabular-nums`, rótulos `xs`).
3. Tabla de operaciones recientes.

### Acción primaria
`Cobrar` / `Nueva operación` (según permiso). En supervisión: `Abrir caja` o `Ir a Caja` si la sesión no está operativa.

### Estados
- `CAR`: métricas como esqueletos de texto; no bloquear los accesos.
- `VAC`: "Aún no hay operaciones en este período" + acción `Cobrar`.
- `ERR`: error de carga con `Reintentar`; el bloque de caja no se cae por un reporte.
- `INV`: no aplica como formulario.
- `SIN`: secciones protegidas no se dibujan; la ruta con guard ausente muestra motivo y salida.
- `SRV`: estado de conexión en la `Franja` + aviso junto a la métrica fallida; no se declara "todo correcto".
- `LIS`/`SINCOBRO`/`PAG`: visibles **como conteo**, con vocabulario separado: "sin cobro" ≠ "no cobrado" ≠ "pendiente".
- `REC`: no aplica.

### Accesibilidad
Un `h1`. Métricas legibles por lector de pantalla con rótulo+valor (no valores sueltos). Tabla con encabezados asociados y `caption`/nombre. A 200 % las 4 métricas refluyen a 2 columnas sin cortar cifras; el guion de miles y el prefijo `L` no se separan del número. `tabular-nums` siempre.

---

## 3. Cobrar (POS) — recorrido continuo

**Ruta:** `/cobrar`. Reemplaza `NewInvoiceView` (`/billing/new`).
**Guards:** `invoices.create + catalog.view + cash.view + payments.create + receipts.view` (backend autoridad).

### 3.1 Tarea del operador
Emitir la operación de un paciente en **un solo recorrido continuo**, sin registro previo en CRM y sin cadena de confirmaciones equivalentes:

> **paciente → catálogo → cuenta → revisión → cobro o gratuidad → resultado**

El operador no cambia de pantalla para cada paso: la tarea entera vive en una vista con zonas estables; solo el `Resultado` puede reemplazar el `Trabajo` tras confirmar.

### 3.2 Zonas (una sola vista, tres zonas de trabajo + acción fija)
| Zona | Contenido | Comportamiento |
|---|---|---|
| `Paciente` | Campo único **Nombre del paciente** (obligatorio) + estado de caja. | Autofocus al entrar. Acepta tildes, apóstrofos y nombres largos; normaliza espacios. **No** pide RTN/contacto/expediente/edad. "Paciente identificado" es solo confirmación de captura, no una ficha. |
| `Catálogo` | Búsqueda + filtro de categoría/área + resultados. | Búsqueda usable con teclado; `Enter` agrega el primer resultado (acción **reversible**, nunca cobra). Fila = descripción, categoría, precio. Una fila por servicio, sin 4 etiquetas de estado por fila (defecto R2). |
| `Cuenta` | Lista de líneas (descripción, cantidad editable, precio registrado, importe), ajuste por regla, subtotal/ISV si aplica, **Total** y acción primaria. | Columna estable en escritorio; en móvil, barra inferior con **Total siempre visible** + botón "Ver cuenta" que abre el detalle. |
| `Revisión` | Resumen del borrador + advertencias + condición de diálisis (cuando hay medicamento elegible y permiso). | Se invalida si cambia paciente, carrito, condición, precio o regla. Una versión vieja **no** se puede confirmar. |
| `Resultado` | Número, paciente, total, método/fecha, y acciones `Imprimir/Guardar PDF` · `Nueva operación`. | Un fallo de PDF/impresora **no** vuelve a cobrar. El siguiente paciente **no** hereda nombre, condición ni datos. |

**Especificación de la regla EPO en la interfaz (obligatoria):**
- La opción de condición (receta/diálisis) aparece **solo** si hay un medicamento elegible (`special_rule_code = ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`) **y** el operador tiene permiso (`patients.mark_dialysis_prescription`).
- El texto explica que **solo afecta al medicamento elegible**. **Prohibido** el rótulo "Factura gratis", "Total gratis" o cualquier equivalente.
- El efecto es **por línea**: la línea gratuita se muestra con la etiqueta del medicamento, un ajuste visible (`LedgerBadge` violeta reservado + texto "Sin cobro por receta de diálisis") y **no se borra**. El resto de líneas conserva precio.
- La valoración (preview) y la emisión las decide el **servidor**; el frontend solo previsualiza. Un booleano raíz no descuenta toda la factura.
- Si la condición está activa pero **no** hay producto elegible, **ningún** producto se vuelve gratuito y la UI lo dice.

### 3.3 Jerarquía
1. **Total** (mayor peso, `tabular-nums`, mayor tamaño).
2. **Nombre del paciente** (segunda jerarquía; sin truncar).
3. Líneas de cuenta (descripción, cantidad, importe).
4. Metadatos (precio registrado, categoría, ISV, regla) en `xs`/`sm`.
5. La acción primaria es parte de la jerarquía: su etiqueta repite importe y verbo (`Cobrar L 1,025.00`), pero **sin prometer** cobro cuando es gratuidad (`Emitir sin cobro`).

### 3.4 Acción primaria
Única y deliberada: `Cobrar` (importe positivo) o `Emitir sin cobro` (total L 0 con regla aplicada). Bloqueada **con motivo textual** cuando falta caja abierta, paciente, permiso o la valoración está inválida. La lista "Pendiente para emitir" vive junto al botón.

### 3.5 Estados (aplican todos)
| Estado | Tratamiento en Cobrar |
|---|---|
| `VAC` | Cuenta sin líneas: "Agregue un servicio" + causa; nunca un botón activo para cobrar cero. |
| `CAR` | Catálogo/valoración: `role="status"` con "Calculando…"; la búsqueda sigue usable; el total no muestra `L 0.00`. |
| `ERR` | Falla de catálogo/valoración: alerta + `Reintentar`; se conserva el borrador. |
| `INV` | Sin paciente, cantidad ≤0, precio no numérico, caja cerrada: bloqueo con motivo **junto al campo/acción**. |
| `SIN` | Sin `payments.create` no aparece el botón de cobro; el servidor rechaza aunque se fuercen flags/precios. |
| `SRV` | "Servidor no disponible": no se habilita confirmar; no se crea operación ficticia; no se "completa" con LocalStorage. |
| `LIS` | Importe positivo validado; botón habilitado con etiqueta que incluye el importe. |
| `SINCOBRO` | Total L 0 válido por regla: estado propio, sin pago ni efectivo; el botón dice "Emitir sin cobro". |
| `PAG` | Cobro confirmado con caja/cajero/método/fecha; pasa a `Resultado`. |
| `PEND` | Emitido sin pago: ofrece cobro posterior **sin** duplicar documento. |
| `REC` | Timeout tras commit o doble activación: recuperar el resultado previo antes de proponer otra operación; identidad de operación idempotente en servidor. |

Además, el diálogo de confirmación/revisión debe tener **cuerpo con scroll interno y acciones visibles** para carrito largo (defecto R2: con 30 líneas las acciones quedaban fuera del viewport). Con 1, 2, 5, 10 y 11 conceptos, la revisión cabe legible sin scroll.

### 3.6 Accesibilidad
- Foco inicial en paciente. Orden Tab: paciente → caja/estado → búsqueda → resultados → cuenta → cantidad → acción → revisión → confirmar.
- `Enter` en búsqueda agrega (reversible). **`Enter` en un campo nunca cobra.** El botón enfocado responde a `Enter`.
- Diálogos atrapan foco, `Esc` cancela sin cobrar; el foco vuelve al disparador.
- Cantidad con `inputMode` numérico y etiqueta asociada; errores junto al campo.
- Total siempre visible a cualquier zoom; a 200 % el recorrido refluye a una columna sin perder la acción. Tablas/líneas permiten scroll dentro de su contenedor, nunca del documento.
- La etiqueta de gratuidad no depende **solo** del color violeta.

---

## 4. Recibos

**Ruta:** `/recibos`. Reemplaza `InvoiceHistoryView` (`/invoices`). **No** se duplica Historial y Recibos como dos productos.

### Tarea del operador
Encontrar una operación por **paciente, número, fecha, estado o caja autorizada**, abrir su detalle conectado a la operación y sus pagos, y **recuperar o reimprimir** el comprobante ya emitido. La primera impresión y la reimpresión **no** generan nuevos cobros ni números.

### Zonas
| Zona | Contenido |
|---|---|
| `Franja` | Contexto + contador de resultados. |
| `Trabajo` | **Una barra de búsqueda + una tabla principal** (número, fecha, paciente, total, estado, documento, acciones). |
| `Detalle` | Panel lateral contextual con la operación, sus pagos y el documento vinculado (deep link `?operacion=<id>`). |
| `Aviso` | Error de carga vs error de refresco (diferenciados); confirmaciones persistentes de reimpresión. |
| `Resultado` | Descarga/impresión del comprobante recuperado o reimpreso. |

- Se muestra el **tipo real de documento** emitido, sin obligar a entender tablas internas.
- Motivo de reimpresión y contador **durables** donde corresponda; no se usan frases automáticas que simulen un motivo humano.

### Jerarquía
Número de documento y total como referencias primarias; paciente y fecha secundarias; **estado de pago siempre textual** (+ estado del recibo). La reimpresión es acción secundaria dentro del detalle.

### Acción primaria
`Buscar` (o `Ver detalle` según contexto). La acción de reimprimir/descargar es la primaria **del detalle**, no de la pantalla.

### Estados
- `VAC`: distinguir "no hay operaciones" de "sin coincidencias" (con `Limpiar filtros`).
- `CAR`: esqueletos de fila con `role="status"`; filtros usables.
- `ERR`: `Reintentar`; si el error es solo del refresco, no descartar la tabla ya vista.
- `INV`: rangos de fecha/número inválidos se rechazan con texto; nunca un `<select>` vacío.
- `SIN`: sin `receipts.view`/`invoices.view` la ruta es `denied`; acciones por fila se omiten por permiso (backend manda).
- `SRV`: aviso junto a la búsqueda; no se pierden los filtros.
- `PEND`: operación emitida sin cobro o pendiente de pago visible con su estado propio.
- `PAG`: comprobante disponible; si el PDF falla, se informa sin alterar el cobro.
- `SINCOBRO`: operación sin cobro visible como tal, **sin** fingir un pago.
- `REC`: recuperación de comprobante nunca ofrece un segundo cobro.

### Accesibilidad
Filtros operables por teclado en orden → tabla → paginación. Fila seleccionable con `Enter`/`Espacio`. El panel de detalle cierra con `Esc` y devuelve foco al disparador. Estado del documento con texto, no solo badge de color. A 200 % la tabla scrollea **dentro** de su contenedor. Encabezados de columna asociados.

---

## 5. Caja

**Ruta:** `/caja`. Reemplaza `CashBoxView` (`/cashbox`).

### Tarea del operador
Abrir la caja del turno, registrar y revisar movimientos, conciliar **efectivo esperado vs contado**, cerrar con confirmación y obtener un resumen imprimible/exportable. Una caja por defecto; selección adicional solo si hay varias habilitadas.

### Zonas
| Zona | Contenido |
|---|---|
| `Franja` | Contexto + estado de sesión (abierta/cerrada) **textual**. |
| `Trabajo` | Pestañas: **Resumen · Movimientos · Arqueo · Cierre** (una página, no cuatro rutas). |
| `Detalle` | Denominaciones y movimientos con más ancho. |
| `Aviso` | Bloqueo de cierre (pendientes/recibos) **junto a la acción**, con motivo. |
| `Resultado` | Resumen de cierre imprimible/exportable. |

- `Resumen`: apertura, efectivo esperado, ingresos, saldo pendiente, recibos pendientes — **con clasificación explícita por método** (efectivo vs tarjeta/transferencia). Las operaciones gratuitas y las transferencias **no** se cuentan como billetes.
- `Arqueo`: conteo por denominación con `inputMode` numérico; `Enter` avanza al siguiente campo, **no cierra**.
- `Cierre`: confirmación explícita; motivo obligatorio cuando hay diferencia.

### Jerarquía
**Efectivo esperado, contado y diferencia** son la jerarquía máxima de la conciliación/cierre. Nunca se afirma "cuadra" solo por color.

### Acción primaria
Depende del estado: `Abrir caja` → `Registrar movimiento` → `Cerrar caja` (con pasos). Única por estado.

### Estados
- `CAR`: esqueletos por bloque; no bloquear la lectura del estado de sesión.
- `VAC`: sin movimientos → "Sin movimientos en el turno" + acción.
- `ERR`: error de sesión/movimiento con `Reintentar`.
- `INV`: conteo no numérico o negativo; cierre con pendientes → bloqueo con motivo textual.
- `SIN`: sin `cash.*` no se edita; la vista es de consulta o `denied`.
- `SRV`: no se declara "listo" si falta validar una condición imprescindible; el aviso va junto a la tarea.
- `PEND`: saldo/recibos pendientes que bloquean cierre, visibles con motivo.
- `SINCOBRO`: no suma como efectivo ni como conteo de cobros.
- `PAG`: los pagos reales alimentan el efectivo esperado únicamente si el método es efectivo.
- `REC`: no aplica como flujo principal, pero la UI no debe duplicar movimientos por doble submit.

### Accesibilidad
Tab predecible por denominación; `Enter` avanza, no cierra. Diálogo de cierre con foco atrapado y `Esc` sin cerrar caja. Diferencia y totales nunca truncados ni a 200 %. El foco no queda oculto por barras fijas. Etiquetas por campo de conteo.

---

## 6. Reportes

**Ruta:** `/reportes/*` (Subrutas vivas). Reemplaza `ReportsView` (`/reports/*`).

### Tarea del operador
Elegir período y filtros autorizados, leer un resumen numérico y el detalle de operaciones, servicios, cobros, caja/cajero y gratuidades, y **exportar** a XLSX/PDF con la **misma fuente de datos** que la pantalla.

### Zonas
| Zona | Contenido |
|---|---|
| `Trabajo` | Filtros arriba (hoy / rango / cajero / caja / categoría según permiso). |
| `Detalle` | **Una tabla por propósito** (Operaciones, Detalle, Cobros, Caja, Gratuidades), con desglose bajo demanda. |
| `Aviso` | Errores por bloque sin tumbar el resto; advertencia de que la exportación digital no prueba salida física. |
| `Resultado` | Exportación con nombre de archivo real. |

- Sin dos tablas iguales ni gráficos vacíos de adorno. Los gráficos **acompañan**, nunca reemplazan la tabla.
- Separar **fecha de emisión, fecha de cobro y saldo al corte**, con ámbito y filtros identificados en cada salida.
- **Gratuidades:** medicamento/servicio, cantidad entregada gratuitamente, valor del ajuste y motivo. No confundir unidades entregadas con unidades cobradas.

### Jerarquía
Totales y deltas con signo **y texto** ("aumentó/disminuyó"); período y filtros visibles; el detalle por debajo del resumen.

### Acción primaria
`Aplicar filtros`. `Exportar` es **secundaria**.

### Estados
- `CAR`: esqueletos por bloque.
- `VAC`: "Sin datos en el rango" + acción para ampliar período.
- `ERR`: error por bloque con `Reintentar`; el resto permanece.
- `INV`: rango inválido rechazado con texto.
- `SIN`: sin permiso de exportación el botón no aparece; sin permiso del informe, `denied` con motivo.
- `SRV`: aviso junto al bloque.
- `SINCOBRO`/`PAG`/`PEND`: columnas de estado legibles y conteos separados.
- `REC`: no aplica.

### Accesibilidad
Pestañas navegables con flechas; tablas ordenables por teclado; montos alineados y fechas legibles; etiquetas de ejes/montos no se solapan a 200 %. Importes como números, **no** como texto formateado en el archivo exportado. A 200 % una columna; sin scroll horizontal de documento.

---

## 7. Administración

**Ruta:** `/administracion/*` (catálogo `/administracion/catalogo`, usuarios `/administracion/usuarios`, ajustes `/administracion/ajustes`, mantenimiento incluido respaldos). Reemplaza `CatalogView`, `UsersView`, `FiscalSettingsView`, `InstitutionalReceiptSettingsView`, `BackupsView`.

### Tarea del operador (admin)
Mantener el catálogo/precios, los usuarios/permisos, la identidad institucional, el papel/copias del comprobante y el mantenimiento mínimo (respaldos/recuperación), **sin** constructor de plantillas ni paneles técnicos para el cajero.

### Zonas
| Zona | Contenido |
|---|---|
| `Trabajo` | Navegación interna simple (Catálogo · Usuarios · Ajustes · Mantenimiento). |
| `Detalle` | Alta/edición en panel o diálogo; **un solo** diálogo de motivo. |
| `Aviso` | Errores de guardado junto al campo; separación clara de mantenimiento peligroso. |
| `Resultado` | Confirmación persistente de guardado. |

- **Catálogo:** nombre, precio vigente, categoría/área, disponibilidad, regla específica. Los cambios **no** alteran históricos. Estado activo/inactivo **textual**. Sin repetir 4 etiquetas de estado por fila cuando 3 son el valor por defecto (defecto R2).
- **Usuarios:** roles/permisos agrupados por módulo; no se borran usuarios (se desactivan); autoría conservada.
- **Ajustes:** identidad institucional real; papel carta/A4; número explícito de ejemplares. No se inventan RTN/CAI/tasas/sellos/firmas. Guardar → recargar → emitir una operación nueva usa el valor esperado.
- **Mantenimiento/Respaldos:** estado real (fecha, integridad, destino) **antes** que botones; nunca afirmar "copia externa protegida" si todo está en el mismo disco. Restaurar no aparece junto a acciones inocuas.

### Jerarquía
Estado real y datos antes que acciones. La numeración/identidad institucional por delante de la personalización cosmética. En mantenimiento, un estado **desconocido** nunca se muestra como "todo correcto".

### Acción primaria
`Guardar cambios` (en formularios) o `Crear` (en listados). En mantenimiento, la acción destructiva es **secundaria y confirmada**.

### Estados
- `CAR`: esqueletos; no bloquear la lectura.
- `VAC`: "sin datos" vs "sin coincidencias"; causa + acción.
- `ERR`: error junto al campo o de carga con `Reintentar`.
- `INV`: validación con texto útil; doble submit bloqueado.
- `SIN`: sin permiso, solo lectura o `denied`; los botones de edición no se montan (pero el backend decide).
- `SRV`: aviso junto a la sección; no se pierde el formulario.
- `PEND`/`SINCOBRO`/`PAG`: propios del catálogo/histórico si se muestran; no se confunden con salud del sistema.
- `REC`: restauración con confirmación y motivo.

### Accesibilidad
Diálogos con foco atrapado, `Esc` cierra y devuelve foco. Matriz de permisos navegable con `Espacio`. El guard de cambios no oculta el botón de guardar. A 200 % el formulario fluye a una columna; los errores quedan junto al campo. Encabezados y etiquetas asociadas; sin `outline: none`.

---

## 8. Matriz de estados por superficie

`●` obligatorio · `○` no aplica

| Superficie | VAC | CAR | ERR | INV | SIN | SRV | LIS | SINCOBRO | PAG | PEND | REC |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Login | ○ | ● | ● | ● | ○ | ● | ○ | ○ | ○ | ○ | ○ |
| Resumen | ● | ● | ● | ○ | ● | ● | ● | ● | ● | ● | ○ |
| Cobrar | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Recibos | ● | ● | ● | ● | ● | ● | ○ | ● | ● | ● | ● |
| Caja | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ○ |
| Reportes | ● | ● | ● | ● | ● | ● | ○ | ● | ● | ● | ○ |
| Administración | ● | ● | ● | ● | ● | ● | ○ | ○ | ○ | ● | ● |

---

## 9. Lo que este contrato NO autoriza y NO verifica

**No autoriza:**
- Cambiar aritmética monetaria, impuestos, idempotencia, locks, snapshots, auditoría ni numeración.
- Cambiar la regla EPO, el flag de receta de diálisis ni su evaluación por línea.
- Fusionar factura fiscal y recibo institucional; inventar sellos, firmas, RTN, CAI, escudos, teléfonos o datos legales.
- Ocultar acciones necesarias para "simplificar"; resolver permisos solo con botones ocultos.
- Declarar aprobación visual global.

**No verifica (se declara, no se falsifica):**
- No existe todavía código `frontend/src/shell/ledger/**` ni `frontend/src/design-system/ledger/**` al 2026-09-18; por tanto no hay inspección de la identidad nueva ni comparación antes/después renderizada.
- No se ejecutó navegador, Playwright, lector de pantalla, `prefers-reduced-motion`, ni zoom real de navegador para esta tarea.
- No se midió contraste con herramienta; los umbrales son requisito, no resultado.
- La fidelidad de la implementación queda sujeta a inspección posterior de `hs-review`/`hs-qa`.
