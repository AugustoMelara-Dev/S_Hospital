# ESTADO_DEV.md

## Campaña de entrega 2026-10-21 — instalador `.exe` de doble clic

Encargo: `PLAN_DEEPSEEK_ENTREGA_20261021.md`. Rama de entrega
`release/entrega-20261021` (sin push). Dos hospitales distintos: nada del
hospital queda fijo en código, instalador ni seeders de producción.

- **F0 cerrada** (`evidencia/ENTREGA-20261021/F0-CONSOLIDACION.md`): respaldo
  completo (7.09 GB), 6 commits coherentes, `main` integrado (`HEAD..main` = 0),
  `git status` limpio, guard de secretos corregido y probado (16 casos).
  Sin binarios en git y sin secretos en el diff de rama.
- **Respuestas del propietario aplicadas**: rama/commits autorizados; «Importe»
  de línea sin impuesto (solo totales desglosan ISV); H-02 por impuestos
  configurables (semilla exenta con aviso); sin Electron (Edge `--app`);
  sin firma Authenticode (SmartScreen documentado); Windows limpio con
  VirtualBox si está instalado.
- **Baseline F1**: frontend tsc 0 · eslint 0 · vitest 151/1240 PASS. Backend
  PHP 8.3 (payload): 1458 tests, 7 fallos (Dockerfile 1, recibo 3, Excel 3);
  Argon2id OK. Pendiente: corregir los 7 y ejecutar pint/phpstan/build.

## Campaña vigente — identidad dark institucional (2026-10-16/17)

Revoca la dirección azul-blanco del 2026-09-28 (decisión explícita del dueño) y
sustituye sus tokens por dark único sin toggle. Los recibos/documentos conservan
papel blanco (§4). Snapshot previo:
`C:\Projects\_snapshots\S_Hospital_AI_dark_20261016\tree.tar.gz` (824 MB;
excluye `node_modules`, `vendor`, artifacts y temporales — materializado).

- **Spec vinculante**: `diseno/IDENTIDAD_DARK_20261016.md` (hs-ux, con token
  block literal + 6 medidos extra + orden de integración). Tokens canónicos en
  `design-system/admin/tokens.css` (incluye `--ui-elevated #191C22` W3).
- **Olas entregadas**: W2 infraestructura (15 archivos, hs-frontend) +
  re-theme por módulo (cobro, caja/resumen, recibos, reportes, admin,
  recibos-papel) con `W2-*.md` en `evidencia/DARK-20261016/`; baseline vitest
  18 fallos clasificados 17 STALE + 1 AMBIENTE, 0 implementación
  (`BASELINE_VITEST.md`), todos re-anclados por sus dueños sin suavizar.
- **Retiros declarados** (mandato §retiro): `hooks/useTheme.ts`,
  `design-system/themes/colorThemes.ts` + test, `institutional-tokens.css` +
  su test (0 consumidores vivos; paleta papel `--color-receipt-*` reubicada
  como `:root` plano en styles.css). Toggle light/dark eliminado.
- **Gates centralizados verde (RUN 3)**: typecheck 0 · lint 0 · ui-rules 0 ·
  `check:ui-legacy:strict` 0/391 · `:final` 0/391 · **vitest pleno
  151 archivos 1240/1240 PASS** · build 0 (tsc + vite +
  `check-product-delivery`). Reconciliación de conteo: 152→151 archivos y
  1247→1240 tests por el retiro declarado de la suite institucional (7 tests
  de identidad revocada).
- **W4 en curso**: hs-qa re-ancla la suite E2E (`azul-blanco-*` →
  `identidad-dark-*`, fixtures visuales, patrón wait del menú→Detalle) con
  dominio exclusivo `frontend/e2e/**`; evidencia en `W4-E2E.md`. Después:
  `hs-review` independiente.
- **Pendiente físico (igual que la entrada siguiente, no cambia)**: instalar
  `.7` elevado (cerrar asistente `.6`), crear admin inicial, respaldo inicial,
  impresora, segunda PC. SHA `.7`: `1405d5…b99ad`.

## Candidato `.7` listo; ejecución cancelada por Windows — 2026-09-30

EXE artifacts/release/S_Hospital-2026.09.28.7-Windows-x64.exe, 102.282.425 bytes, SHA-2561405d59c7810af5215ace8be53be2451348de06737598125b23119887e6b99ad confirmado independientemente. 10 suites focales WinPS5.1 PASS y payload/compilación PASS. Windows canceló el lanzamiento RunAs: no proceso ni bootstrap .7. No instalación completa. Estado real queda .6/services_installed/in_progress, seis servicios Running y login8000 accesible, sin administrador/respaldo inicial certificados. Falta autorización de Windows directa, cerrar asistente .6 y completar credenciales en formulario; no automatizar autenticación. Detalle y pasos en ENTREGA_ACTUAL/GUIA_UNA_COMPUTADORA.


## Resultado real `.6` y reparación en preparación — 2026-09-30

`.6` superó configuración SQL, creación de tablas y arranque de los seis servicios; `/up` responde200 y el login nativo carga en navegador. Falló en configure_initial_administrator antes de abrir el formulario. Journal services_installed/in_progress. No es entrega completa.

Causas nuevas confirmadas: la máscara ACL de recuperación incluía bits RX dentro de Modify/FullControl y rechazaba lectura normal; WinSW2.12 ignora serviceaccount/username y requiere domain/user, dejando cinco wrappers bajo LocalSystem. Fuente corregida con focales PS7/WinPS5.1; no se editaron bytes instalados. `.7` se prepara para conservar DB/config/keys, corregir cuentas y continuar admin+backup. Windows canceló el lanzamiento independiente del helper corregido; no se creó administrador. Evidencia en VERIFICACION-PC-ACTUAL y native-initial-admin-helper-20260930.json.


## Reparación `.6` ejecutándose en esta computadora — 2026-09-29

Último estado observado: `payload_validation`, PID bootstrap 39804 y proceso activo. Lanzamiento elevado `/SILENT /NORESTART` autorizado, EXE SHA-256 confirmado `3003037a28f117fa2b70081e6cadbbbda338c6a51795f02bac4cc75fbfbdec8e`. No afirmar instalación completa hasta journal final, seis servicios, HTTP, respaldo inicial y revisión UI.

La causa de `.5` se confirmó mediante fixture real: ERROR1290 por DCL en `--bootstrap/--skip-grant-tables`. `.6` usa servidor temporal sin TCP y cliente named-pipe, SQL por stdin y credenciales protegidas. Primera ejecución y repetición con base ya asegurada aprobaron con exits0 y eliminación del archivo temporal. Reparación pinned preserva base/configuración/DPAPI. El historial inferior documenta candidatos anteriores, no el estado actual.


## Fallo real `.5` en configuración SQL — 2026-09-29

El usuario autorizó reintentar («hazlo tu») y Windows aceptó el lanzamiento. `.5` superó validación del candidato, integridad histórica y staging, pero falló a las 23:02 en `secure_database`. Diagnóstico elevado: `current=.5-9b637d42ed3a`, journal schema2, `database_files_initialized/in_progress`, PHP CLI aprobado, sin servicios registrados; XAMPP funcionando. Hay que diagnosticar SQL y preparar continuación compatible del journal existente, preservando base/configuración/DPAPI. No considerar `.5` entregable ni borrar/reinicializar la base.

## Instalador `.5` generado — 2026-09-29

Resultado del lanzamiento: Windows devolvió «El usuario ha cancelado la operación»; no se creó proceso del instalador y el bootstrap `.5` no comenzó. No relanzar automáticamente. La instalación real sigue pendiente de ejecución directa/autorización de Windows.

`artifacts/release/S_Hospital-2026.09.28.5-Windows-x64.exe`, 102.288.522 bytes, SHA-256 `4f17865381c22f1acb4b1beef9033b2ac443a0e1402a3ac32da87a0198df34c1`. ReleaseId `2026.09.28.5-9b637d42ed3a`; 8.785 archivos, 20 scripts de prueba aprobados, catálogo/frontend sin cambio de hashes. Regresión de integridad histórica aprobada sobre paquetes reales; diagnóstico sanitizado y tipos CIM comprobados mediante lectura del esquema de Windows. Ejecución elevada `/SILENT /NORESTART` solicitada; cancelada por Windows antes de crear proceso, sin bootstrap/servicios completados. [Estado actual](evidencia/CATALOGO-INSTALACION-20260928/VERIFICACION-PC-ACTUAL.md).

## Candidato corregido y prueba real — 2026-09-29

Actualización posterior: `.4` falló durante la comprobación de la versión `.3` en la reparación inicial. Sus 8.783 archivos están íntegros, pero el contrato `.4` exige dos archivos nuevos inexistentes en `.3`. Visual C++ aprobó y ACL ya permite lectura; no hay servicios registrados. Se prepara `.5` con separación de integridad histórica, regresión focal y diagnóstico de fase preciso. No reintentar `.4` ni presentarlo como instalable certificado.

Se generó `.4`: `artifacts/release/S_Hospital-2026.09.28.4-Windows-x64.exe`, 102.274.979 bytes, SHA-256 `ed651a97e482c8ed8c05e65de54821d5207bbd6722914b2a425752543cd400bb`. ReleaseId `2026.09.28.4-bc9ada2e76c9`; 8.785 archivos, 20 contratos aprobados y verificación focal sin diferencias. Corrige permisos, invocación PHP en PowerShell 5.1, recuperación de instalación parcial, registro WinSW, espera de servicios y estado de fallo del asistente. El catálogo y el frontend conservan la versión previamente verificada. Asistente abierto en «Listo para instalar», pendiente de clic manual porque la ventana elevada no responde a los inputs automatizados. No se declara instalación completada. [Evidencia vigente](evidencia/CATALOGO-INSTALACION-20260928/VERIFICACION-PC-ACTUAL.md).

## Verificación de tarifas e instalación en este equipo — en curso (2026-09-28)

Las fotografías recibidas después de la entrega revelaron 22 diferencias de precio y conceptos omitidos. Catálogo corregido: 151 entradas, 149 activas y dos K.D.H. inactivas; reconciliación independiente aprobada. El candidato `artifacts/release/S_Hospital-2026.09.28.3-Windows-x64.exe` está construido y validado: 8.783 archivos, cuatro contratos nativos afectados, SHA-256 `d495d5fc2d1105a84a8fe738be0f1c623c63d95424f8ac8b591d69aae1b507a8`. El `.2` queda como antecedente. Se aprobaron 63 pruebas focales del catálogo y las ocho suites financieras mediante corrida conjunta y revalidación focal. Impuestos pendientes de confirmación.

El usuario autorizó la prueba en esta computadora Windows 11 Home, que contiene herramientas de desarrollo y no equivale a Windows limpio. La instalación real `.3` falló antes de registrar servicios. Se reprodujo un error de comillas al invocar PHP desde Windows PowerShell 5.1. Reparación en curso; conservar la instalación parcial y no reintentar ese EXE. Evidencia vigente en [VERIFICACION-PC-ACTUAL.md](evidencia/CATALOGO-INSTALACION-20260928/VERIFICACION-PC-ACTUAL.md). Los apartados siguientes conservan la evidencia previa de UI, documentos y actualización.

## Entrega para una computadora — rediseño integral (2026-09-28)

Estado vigente, artefactos y límites: [ENTREGA_ACTUAL_20260928.md](ENTREGA_ACTUAL_20260928.md).
UI actual `index-CzNgLEiZ.js` / `index-mu7J-Bh0.css`. Se rediseñaron rutas
operativas y Administración, incluidos formularios y diálogos. Catálogo editable,
recuperación offline, recibo carta y respaldos conservan su integración real.
Recorrido visual con backend real y capturas directas; 79 pruebas focales de
interacciones; TypeScript, lint, build y gate sin laboratorio aprobados.
El recorrido financiero del build final aprobó 7/7 casos: cantidad 1.001,
doble envío, gratuidad mixta/cero, error de valoración, fallo de PDF sin recobro,
exportaciones y cierre de sesión 13 con diferencia cero.

Instalador histórico: `artifacts/release/S_Hospital-2026.09.28.2-Windows-x64.exe`,
102.275.029 bytes, SHA-256
`e7c63bc930379855fdc4dbd0a45da7abda9a64590354cd38d49bd0078a5b9115`.
8.782 archivos validados y once contratos nativos aprobados. Ensayo real de
actualización aprobado: factura pagada de L.184,00 conservada tras ambas
recuperaciones y la activación; respaldo scheduled ID4 cifrado y verificado,
disparado por Laravel schedule:run. Procesos aislados detenidos al terminar.
El instalador anterior es histórico. El nuevo es candidato para validación del
equipo de destino: todavía no se certificaron UAC/servicios Windows, apertura
al login, reinicio, Windows limpio ni impresora física. EXE sin firma de código.
## Dirección vigente — azul y blanco (2026-09-28)

Encargo actual: `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` y texto completo
aportado por el propietario. La cuenta continua queda integrada en `/cobrar`;
acceso, Resumen, Recibos, Caja, Reportes y Administración comparten los tokens
azules, blancos y neutros. El laboratorio de propuestas está archivado fuera
del producto y su excepción de autenticación fue retirada.

La implementación y evidencia de esta sesión se registran en
`evidencia/AZUL-BLANCO-20260928/INTEGRACION.md`. Las cifras y comprobaciones
históricas que siguen no sustituyen los resultados actuales. Snapshot previo:
`C:\Projects\_snapshots\S_Hospital_AI_azul_blanco_20260928`.

Estado de cierre: reemplazo integrado y verificado en laboratorio; entrega en
`evidencia/AZUL-BLANCO-20260928/ENTREGA.md`. Núcleo UI 7/7 aprobado con backend
real, compilación final `index-D6fx_LJu.js`, 79 capturas directas y documentos
descargados desde sus botones. No se ha certificado impresora física, segunda
computadora LAN ni teclado móvil nativo. La restauración fue asistida; la
restauración automática sin intervención sigue sin acreditarse.

## Campaña vigente — identidad "Panel administrativo" (2026-09-20)

Encargo: `MANDATO_DEV.md` §19–20 (sustituye la identidad anterior). Coordinador:
Dev (OpenCode, DeepSeek 4.1 Flash). Identidad vigente: `diseno/IDENTIDAD_DEV.md`.

### Preparación

- [x] Snapshot recuperable: `C:\Projects\_snapshots\S_Hospital_AI_20260920_135010\tree.tar.gz`.
- [x] Skills `better-ui` y `emil-design-eng` cargadas con la herramienta nativa
      `skill` y aplicadas (radios concéntricos, `scale(0.96)`, `cubic-bezier`
      custom, foco visible, `currentColor`, movimiento reducido).

### Retiro de la identidad anterior (mecánico, verificado)

- `--led-*` → `--ui-*`; `design-system/ledger` → `design-system/admin`;
  `shell/ledger` → `shell/admin`; `navigation/ledgerNavigation` →
  `navigation/adminNavigation`; `Ledger*` → `Admin*`; `data-ledger-*` →
  `data-ui-*`. **147 archivos** de contenido y los nombres de archivo/carpeta.
  Verificación: `grep ledger` = 0 en `src`, `e2e`, `scripts`.
- Retirados: `shell/admin/TopAdminBar.tsx` y `shell/admin/AdminContextStrip.tsx`
  (barra superior y franja técnica permanente), sustituidos por
  `shell/admin/AdminSidebar.tsx` + `AdminShell` con cajón móvil.

### Nuevo sistema visual

- `design-system/admin/tokens.css`: neutros fríos, blanco, cobalto `#2563eb`,
  sans en todo el panel (`--ui-font-doc` = sans), radios 6/8/12/14, sombra-como-
  borde reutilizada de better-ui.
- Primitivas ajustadas: `AdminMetric` sin borde editorial, `StatusStamp` a badge
  suave, acento cobalto en tabs/búsqueda/pasos/avisos.
- `AdminTable` gana `minTableWidth`: las tablas extensas desplazan en horizontal
  en vez de comprimir texto o recortar cifras (Recibos y Reportes).
- Login y Cobrar recompuestos (§19, §41). Cobrar pasa de tres torres a dos áreas
  con la cuenta integrada.

### Validación real (2026-09-20)

- Frontend: `npm run typecheck` PASS; `npm run lint` 0 errores / 1 aviso
  preexistente; `check:ui-legacy:strict` **0/382**; `npm run build` PASS;
  `vitest run` **143 archivos, 1058/1058 tests PASS**.
- E2E visual real (Chromium, mock, sin backend): `visual-capture` **17/17**;
  capturas en `evidencia/VISUAL_ADMIN/` y revisión en
  `evidencia/VISUAL_ADMIN/REVISION_VISUAL.md`.
- E2E de flujo (`npm run test:e2e:mock`): cobrar, recibos-caja y reportes-rbac
  **aprobados**.
- Accesibilidad (axe-core en Playwright, Chromium): **10/10** sin violaciones
  critical/serious (Login, Resumen, Cobrar, Recibos detalle, Caja, Reportes,
  Administración, diálogo de recibo) + proxy de reflujo 200 % (683×384) en
  Cobrar y Resumen sin desborde.
- **Comprobante PDF (backend, motor real Dompdf)**: `php vendor/bin/phpunit
  tests/Feature/InstitutionalReceiptCompactTemplateTest.php` → **10 tests / 134
  aserciones OK** (1 omitido: escribe PDFs de evidencia solo si se configura
  `RECEIPT_COMPACT_EVIDENCE_DIR`). Prueba 1/2/5/10/11 conceptos en **una página
  por ejemplar** (carta vertical), A4 con 11 líneas, dos copias → 2 páginas,
  detalle en la ventana 10–11 pt, línea gratuita visible sin alterar el resto, y
  ausencia de QR/códigos internos/identidad fiscal inventada.

### Segunda pasada (composición)

- **Reportes** (§10.10): período rápido y rango de emisión siempre visibles; el
  resto de filtros (método, estado, cajero, caja, categoría) se pliega bajo
  «Filtros» con el número de filtros activos. Se retiró el párrafo decorativo
  «Misma fuente para pantalla, PDF y Excel…» (§47).
- **Caja** (§10.8): un único bloque de identidad (caja física, usuario, sesión,
  cajero, apertura del turno) y un único resumen monetario en «Turno de caja»;
  se eliminó la repetición de apertura/efectivo esperado y el borde izquierdo
  editorial de las fichas. Se retiró la nota permanente sobre el conteo por
  método (§47).
- **Cobrar**: dos áreas (catálogo + cuenta integrada), tarjetas móviles por
  línea sin recorte, acción «Agregar» con nombre del primer resultado y
  categoría en su propia fila.

### Fase 2 — auditoría adversarial (2026-09-20)

Revisión independiente: `evidencia/REVIEW_FASE2/INFORME_REVISION.md` (agente
`hs-review`, no autor) y respuesta del coordinador en
`evidencia/REVIEW_FASE2/CORRECCIONES_FASE2.md`.

- **2 HIGH encontrados y cerrados**: la columna Acciones de Recibos quedaba fuera
  de vista a 1366 (lista estrangulada por el panel lateral) y el botón Quitar de
  Cobrar se partía. Correcciones: Recibos apila el detalle hasta `2xl`; Cobrar
  mueve el precio unitario bajo la descripción y elimina la columna. Medición de
  cierre en `REVIEW_FASE2/measurements3.json` (956=956 y 460=460).
- **10 casos adversariales nuevos** (`tests/Feature/Adversarial/`): servicio
  inactivo/no facturable, caja de otro usuario, factura de otro cajero, caja
  cerrada, pago mayor al saldo, parcial deshabilitado, importes mal formados,
  factura anulada y cero legítimo. **10/10 OK en SQLite y en MariaDB 10.4.32**.
- **Concurrencia real en MariaDB**: `--testsuite Concurrent` con
  `HOSPITAL_RUN_CONCURRENT_TESTS=1` → **8/8 OK con 45 aserciones**.
- **Correcciones de afirmaciones**: eran 16 PNG (no 17); inspeccioné 10 de 16;
  las citas de secciones corresponden al mandato maestro 2026-09-20, no a
  `MANDATO_DEV.md`; la suite por defecto es SQLite salvo
  `HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1` (con prefijo `s_hospital_test_`), hallazgo
  de método que explicaba un "run MariaDB" que en realidad era SQLite.
- Skills: evidencia en `evidencia/DEV/skills_fase2.md`.

### Fase 3 — cierre y pulido (2026-09-20)

- **Último defecto local cerrado**: la fila de Recibos ofrecía hasta cuatro
  controles. Ahora expone **una acción contextual principal** (Cobrar / Ver
  recibo / Generar PDF / Reimprimir / Detalle según el estado y el permiso) y el
  resto en un **menú «⋯» accesible**. La tarjeta móvil conserva objetivos
  táctiles de 44 px. Verificado en la captura `05` y en `RecibosTable.test.tsx`.
- **Manifiesto**: `release/MANIFIESTO_FASE3.json` (1185 archivos, 0 secretos,
  incluye no rastreados) + `release/CIERRE_FASE3.md` con artefacto, hashes,
  comandos y estados.
- **Citas corregidas**: la autoridad es `01_MANDATO_MAESTRO_HOSPITAL.md`, no
  `hospital-ai/MANDATO_DEV.md` (ese es el mandato de la campaña anterior).
- Estados: implementación **PASS**; técnica **PASS** (SQLite + MariaDB 10.4.32);
  visual **PARTIAL**; instalación/LAN/impresora **NOT VERIFIED**.

### Pendiente declarado

- **Recibos**: la fila de escritorio aún expone hasta cuatro controles; falta
  consolidar en una acción principal + menú «⋯» accesible para las secundarias
  (§10.7/§19). No se inició para no dejarlo sin verificar.
- Rediseñar la plantilla Blade del comprobante a la nueva identidad formal
  (hoy es monócroma y ya cumple paginación y campos obligatorios).
- Inspección visual de `10`, `11`, `12`, `13`, `15`, `16` (flujos automatizados
  aprobados; inspección humana pendiente).
- Impresión física, segunda PC, Windows limpio y zoom 200 % real.

---

# Histórico — reconstrucción integral 2026-09-18 (identidad retirada)

> La identidad "Libro de Caja" descrita a continuación fue **sustituida** por la
> campaña vigente. Se conserva como evidencia histórica; su implementación ya no
> está en el producto. Snapshot previo: `S_Hospital_AI_20260918_131326`.


## Preparación completada

- [x] Snapshot recuperable: `C:\Projects\_snapshots\S_Hospital_AI_20260918_131326\tree.tar`.
- [x] Skills instaladas con el CLI: `better-ui` y `emil-design-eng` en `.agents/skills/`
      (ver `skills-lock.json` y `evidencia/dev/skills_instalacion.txt`).
      Hashes: better-ui `C7CB0156…9FDB`, emil-design-eng `A2EE9DA0…A5BF`.
- [x] Skills cargadas con la herramienta nativa `skill` por Dev y por cada autor/revisor visual.
- [x] Permiso de proyecto `opencode.json` (`skill * allow`).
- [x] `MANDATO_DEV.md` vigente; `AGENTS.md` actualizado (identidad nueva, EPO por línea).
- [x] Defecto corregido: `frontend/vite.config.ts` declaraba `plugins` dos veces.

## Implementación (frentes entregados)

| ID | Frente | Propietario | Estado |
|---|---|---|---|
| T-FE-01 | Identidad nueva, shell "Libro de Caja", navegación y rutas | hs-frontend | ENTREGADO |
| T-UI-01 | Cobrar (paciente único, catálogo, cuenta, regla EPO por línea, cobro/emisión sin cobro, resultado) | hs-ui-cobro | ENTREGADO |
| T-UI-02 | Resumen y Caja | hs-ui-caja | ENTREGADO |
| T-UI-03 | Recibos (búsqueda, detalle, reimpresión) | hs-ui-recibos | ENTREGADO |
| T-UI-04 | Reportes pantalla + PDF + XLSX | hs-ui-reportes | ENTREGADO |
| T-UI-05 | Administración (catálogo, usuarios, ajustes, mantenimiento) | hs-ui-admin | ENTREGADO |
| T-BE-01 | Emisión sin cobro (sin pago ficticio) + EPO por línea + causa | hs-backend | ENTREGADO |
| T-BE-02 | Ajuste persistido, nombre normalizado, ceros fuera de cobros | hs-backend | ENTREGADO |
| T-RC-01 | Comprobante compacto, 1 página por ejemplar | hs-receipts | ENTREGADO |
| T-RC-02 | Adopción del perfil nuevo en instalaciones existentes | hs-receipts | ENTREGADO |
| T-UX-01 | Contratos de pantalla y revisión de identidad | hs-ux | ENTREGADO |
| T-UX-02 | Revisión de identidad sobre el código (3 HIGH) | hs-ux | ENTREGADO |
| T-FE-02/03 | Reparación de hallazgos HIGH y tests de auth/diálogo | hs-frontend | ENTREGADO |
| T-UI-06/07/08/09/10/11 | Overlays, errores de Cobrar, ceros falsos y tests de Caja/Cobrar | hs-ui-* | ENTREGADO |
| T-BE-02/03 | Ajuste persistido, nombre, ceros y `paid_count` | hs-backend | ENTREGADO |
| T-RC-02 | Adopción del perfil compacto en instalaciones existentes | hs-receipts | ENTREGADO |
| T-QA-01 | Validación técnica completa | hs-qa | ENTREGADO |
| T-QA-02 | Reconstrucción de la suite E2E al producto nuevo | hs-qa | ENTREGADO |
| T-QA-03/05 | Capturas reales (16 PNG) y estados adicionales | hs-qa | ENTREGADO |
| T-FE-05/06/09/10/11 | Gate ledger, retiro R2, archivo de código muerto | hs-frontend | ENTREGADO |
| T-UI-14..23 | Administración, ajustes, recibos, arqueo, responsive, ceros | hs-ui-* | ENTREGADO |
| T-FE-12 | Cierre del puente teal shadcn + gate ampliado | hs-frontend | ENTREGADO |
| T-REV-01 | Revisión independiente (MEDIUM puente teal, evidencia) | hs-review | ENTREGADO y resuelto |
| T-QA-06 | Axe, cross-browser (Firefox/WebKit) y proxy de zoom | hs-qa | ENTREGADO |
| T-FE-13 / T-UI-24..26 | Corrección CRITICAL `LedgerTabs`, `dl`, landmarks y tabla | hs-frontend / hs-ui-* | ENTREGADO |
| T-UX-04 | Auditoría de calidad UI (estándar del mandato CRM) | hs-ux | ENTREGADO |
| T-FE-14/15, T-UI-27/28/29 | Command palette, sorting, Resumen accionable, móvil Recibos, debounce, Toaster | hs-frontend / hs-ui-* | ENTREGADO |
| T-FE-16 | Modo tarjeta móvil universal en `LedgerTable` (todas las tablas) | hs-frontend | ENTREGADO |

## Nota de reconciliación de conteos

Los conteos de pruebas bajaron al **retirar tests de las pantallas R2 archivadas**
(1441 → 1017 → 989 → 998 → 1001), no por fallos: cada reducción corresponde a suites
de vistas retiradas, y las nuevas suites del producto (Cobrar, Recibos, Caja, Reportes,
Administración, E2E mock) se conservan. Conteo actual: frontend **1001/1001**,
backend **1366/1366** (0 fallos).

## Cambios de contrato y migraciones

- `invoices.settlement` (`pending|paid|free_by_rule|zero_price`) — migración
  `2026_09_18_000001` (aplicada al laboratorio).
- `invoice_items.unit_price_registered_cents` / `rule_adjustment_cents` —
  migración `2026_09_18_000002` (aplicada al laboratorio).
- Adopción del perfil de recibo nuevo (compacto, `original_only`) en
  instalaciones existentes — migración `2026_09_18_000003` (aplicada al laboratorio).
- Emisión con total 0 ya no crea `Payment` en `other` ni movimiento de caja.

## Verificación real (laboratorio no-Docker: backend :18080, MariaDB 10.4.32, `sh_ai_lab_local`)

Evidencia en `hospital-ai/evidencia/DEV/`:
- `flow-output-v2.txt`: EPO con receta → 0 sin pago; EPO + 10 productos → solo EPO
  a 0 (L 517.50 con ISV); sin receta → L 1,232.50; otro producto con receta → nada gratis.
- `payment-output-v2.txt`: cobro 201, recibo `institutional_compact` `original_only`,
  PDF real 3,731 bytes, primera impresión + reimpresión con motivo durable.
- `report-check.txt`: nombre normalizado `Juan Perez O'Brien`; Detalle/Gratuidades con
  ajuste L 25.00 persistido; `payment_methods` `other` count 0; `collections` sin ceros.
- `verify_artifacts.py` (verificación directa con openpyxl/pypdf): XLSX con hojas
  `Resumen/Operaciones/Detalle/Cobros/Caja`, nombre del paciente en
  Operaciones/Detalle/Cobros, gratuidad en Resumen/Detalle, tipos numéricos
  (`#,##0.00`); recibos compactos de **1 página** por ejemplar (incluido el mixto con
  `SIN COBRO`); históricos conservan su presentación (recibo clásico de 3 copias).

## Validación técnica (resultados reales, 2026-09-19)

- Frontend: `npm run typecheck` PASS; `npm run lint` 0 errores / 2 avisos;
  `npm run build` PASS; `check:ui-legacy:strict` **0/382** y `:final` **0/382**;
  `vitest run` **143 archivos, 1056/1056 tests PASS**.
- **Responsive universal de tablas**: `LedgerTable` gana modo tarjeta móvil
  (`mobileCards`, `mobilePrimary`, `mobileHidden`) con `dt/dd` y activación por
  teclado. Verificado a 390×844 sin desborde en Resumen, Reportes (5 tablas),
  Catálogo, Usuarios y Respaldos (`evidencia/T-FE-16/`).
- Accesibilidad axe: **30/30** en Chromium, Firefox y WebKit (0 critical/serious).
- Pase de calidad UI (mandato CRM como estándar, no scope): **command palette**
  (Ctrl/Cmd+K, teclado, permisos, instantánea), **sorting accesible** en `LedgerTable`
  (Caja/Recibos), **Resumen accionable** ("Atención ahora"), buscador de Caja solo en
  Movimientos, **Recibos en tarjetas móviles** (≥44 px), debounce único 250 ms y
  Toaster light-first. Auditoría: `diseno/AUDITORIA_CALIDAD_UI.md`.
- Accesibilidad (axe-core inyectado en Playwright): **0 violaciones critical/serious**
  en Login, Resumen, Cobrar, Recibos (detalle y diálogo), Caja, Reportes y
  Administración/Catálogo, en **Chromium, Firefox y WebKit**. Se corrigieron el
  CRITICAL de `LedgerTabs` (`aria-controls` colgante), `definition-list`,
  `scrollable-region-focusable` y `region`/`landmark-unique`.
- Cross-browser: visual-capture **17/17** en los 3 navegadores; specs mock 13/13
  (chromium/webkit) y 12/13 (firefox, 1 ruta RBAC por aborto de chunk).
- Zoom 200 %: **proxy de reflujo** a 683×384 sin desborde en Cobrar y Resumen
  (declarado como proxy, no zoom de navegador real).
- Puente shadcn re-mapeado a ledger (`--primary → --led-action`); escaneo de los 16 PNG
  con **0 píxeles teal** exactos.
- Auditoría del árbol activo: **0** primitivas R2 (`Card/Badge/Alert/Button/Pagination/Spinner`)
  en `features/**`, **0** restos de paleta teal/institucional, **0** imports a código
  retirado. Todo el render vivo usa componentes/tokens ledger.
- Revisión visual ampliada a **16 PNG** (incluye diálogo de recibo, cambio de
  contraseña, emisión sin cobro, resultado cobrado y arqueo); informe actualizado en
  `evidencia/VISUAL/REVISION_VISUAL.md`.
- Conformidad de skills (T-UX-03 + T-FE-07/T-FE-08/T-UI-17/18): toda superficie
  activa en identidad ledger; movimiento con curvas custom, press `scale(0.96)`,
  overlays por transición (enter 200 / exit 150 ms), hover en puntero fino,
  foco `--led-focus`, iconos `currentColor`. Informe: `diseno/REVISION_SKILLS.md`.
- Backend: `php vendor/bin/phpunit` (SQLite) **1366 tests, 9506 aserciones, 0 fallos, 69 omitidos**.
- E2E: `npm run test:e2e:mock` **aprobado** (Cobrar, Recibos, Caja, Reportes, RBAC).
- Manifiesto reconstruible: `hospital-ai/release/MANIFIESTO_DEV.json` + `MANIFIESTO_DEV.md`
  + `scripts/generate_dev_manifest.ps1` (0 secretos).
- Revisión visual: 10 PNG reales inspeccionados por Dev; informe en
  `evidencia/VISUAL/REVISION_VISUAL.md`.
- Entorno: laboratorio no-Docker MariaDB 10.4.32; objetivo de despliegue 11.4.3.

## Retirado / reescrito

- **112 archivos** de la implementación R2 movidos a
  `hospital-ai/archivo-retirado/frontend/` (shell y navegación R2, POS antiguo,
  dashboard, reportes antiguos, ayuda/soporte/acerca, onboarding y sus tests
  exclusivos). El build ya no contiene chunks R2 y el gate `strict` da 0/386.
- Nuevos `shell/ledger/**` y `navigation/ledgerNavigation.ts`; rutas antiguas
  redirigidas a las nuevas.
- Comprobante: nueva plantilla `compact.blade.php`; la clásica queda solo para
  documentos ya emitidos (snapshot).

## Pendientes declarados

- Validación en impresora física, segunda PC, Windows limpio y zoom 200 % real:
  no verificable aquí (VALIDACIÓN EN EL HOSPITAL).
- Revisión visual limitada a Chromium headless; sin lector de pantalla ni Firefox/Safari.
- El cuerpo renderizado del recibo dentro del diálogo se validó con PDF real, no con
  backend en la captura (mock).
- `package.json` `test:clinical`/`test:critical` aún nombran vistas archivadas
  (filtros; no rompen porque otros patrones coinciden).

## Siguiente paso

Continuar la validación en el equipo hospitalario (impresora, segunda PC, Windows
limpio) y revisar cross-browser/lector de pantalla cuando haya acceso.






