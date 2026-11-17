---
version: 1
slug: "web-src"
primary_target: "web/src"
related_targets: []
---

# Surface brief — S_Hospital web app (todas las pantallas)

Scope: toda la aplicación web `web/src` (shell, login, Resumen, Cobrar, Recibos, Caja, Reportes, Administración, Ayuda). Mode: Operate.
Audience: cajeros de ventanilla y supervisión, uso diario en PC de escritorio, teclado primero.
Constraints: conservar funcionalidad, rutas, llamadas API, textos de docs/TERMINOLOGIA.md y pruebas; todo offline (fuentes empaquetadas).
Memorable moment: el ladrillo del turno en la barra superior que se completa cuarto a cuarto durante la jornada.

## Direction contract

THESIS: La caja como un piso de ladrillo hidráulico: módulos cuadrados, una sola junta fina y pigmento mate que hace trabajo real. Rechaza el dashboard genérico de tarjetas blancas iguales sobre gris con un acento.

OWN-WORLD: Riel lateral verde botella (#24493F) con texto hueso; suelo piedra cálida-gris (#E4DFD5) y superficies #F4F1EB; tinta #2A2724; óxido #9C3B2A solo para la acción principal; ocre #C8902F como campo del total; pizarra #3E5C76 para información y selección. Una sola regla de 1px (la junta, #CFC8BA). Archivo (UI y cifras tabulares). Radios pequeños (2–4px), sin sombras decorativas.

STORY: El cajero ve de un vistazo si su caja está abierta y en qué etapa del turno va, cobra con teclado sin dudar del total, y la supervisión lee números alineados y estados inequívocos.

FIRST VIEWPORT: Cobrar a 1440×900: riel 216px verde botella (marca-ladrillo, navegación rotulada, usuario abajo); barra superior 56px con título, chip del ladrillo del turno, buscador Ctrl K y fecha; columna izquierda paciente → buscador de conceptos → tabla de cuenta en grilla de juntas; columna derecha 420px con panel ocre del total (total como cifra más grande de la pantalla) y botón óxido "Cobrar · L x F4" arriba, sin estirarse a toda la altura.

FORM: Ladrillo hidráulico (pisos de cemento pigmentado de pasillos hondureños), posición 6 de 7 en mi lista; seed:d4d1aa449a5a8f6b. Raises: estados por forma y etiqueta (emission-line rail); una sola regla de 1px (reference-setting); montos tabulares alineados duro a la derecha (j-card); óxido solo para lo presionable principal (warm consumer); número de documento como titular de cada vista de documento (Saville sleeve). Signature move: el ladrillo de 4 cuartos solo en marca, estado del turno y grilla del arqueo.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Chosen decision sketch (critique reference): .impeccable/mocks/decision/assigned.html
