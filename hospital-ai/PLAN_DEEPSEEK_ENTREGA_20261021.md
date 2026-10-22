# PLAN DE ENTREGA — S_Hospital listo para instalar (para DeepSeek / OpenCode)

Fecha: 2026-10-21 · Preparado por: Claude Code tras recorrido real del sistema.
Destinatario: agente coordinador DeepSeek (OpenCode, agente Dev y especialistas `hs-*`).
Raíz de trabajo: `C:\Projects\S_Hospital_AI` (worktree). **No tocar** `C:\Projects\S_Hospital`.

Objetivo único: dejar un **instalador Windows de un solo archivo (.exe)** que el
personal del hospital ejecute con doble clic, sin internet, y que al terminar
deje S_Hospital abierto en una ventana propia, con administrador creado,
respaldo inicial y el flujo diario funcionando: **abrir caja → cobrar →
imprimir → reimprimir → reportar → cerrar caja**.

Lea primero `AGENTS.md`. Este plan no lo sustituye; lo concreta.

**Primer mensaje sugerido al agente:**
> Lee `AGENTS.md` y `hospital-ai/PLAN_DEEPSEEK_ENTREGA_20261021.md`. Ejecuta
> la Fase 0 hasta el punto 1 (respaldo) y luego detente y pídeme autorización
> para crear la rama y los commits. No avances de fase sin evidencia.

---

## 0. Reglas para DeepSeek (no negociables)

1. Fuente de verdad: código, pruebas y migraciones. No crea lo que dicen los
   informes anteriores sin re-ejecutar la comprobación.
2. Trabaje por fases en el orden de este documento. No empiece una fase sin
   cerrar la anterior con su criterio de aceptación y su evidencia.
3. Prohibido: `git push`, `git reset --hard`, `git clean`, `migrate:fresh`,
   `db:wipe`, `docker compose down -v`, tocar bases que no sean de laboratorio,
   secretos, gasto o servicios externos. **Commits: solo con aprobación
   explícita del propietario** (ver Fase 0).
4. Base de laboratorio autorizada: `sh_ai_lab_local` (MySQL de XAMPP, puerto
   3306, `backend/.env.local`). Usuarios de prueba del seeder
   `DevelopmentValidationSeeder` (`admin.validacion`, `supervisor.validacion`,
   `cajero.validacion`; clave en ese seeder).
5. La instalación nativa de esta PC (servicios `SHospital*`, puerto 8000,
   MariaDB 3307) **no es laboratorio**: solo se toca en la Fase 5 y con el
   instalador nuevo.
6. Cada fase termina con un archivo de evidencia en
   `hospital-ai/evidencia/ENTREGA-20261021/F<n>-*.md` con comandos ejecutados,
   salida real (resumen + cifras) y lo que **no** se pudo verificar.
7. Si algo bloquea (decisión de negocio, permiso de Windows, hardware), pare y
   pregunte al propietario. No invente la respuesta ni la marque como hecha.

---

## 1. Estado real verificado hoy (2026-10-21)

### 1.1 Repositorio

- El worktree está en **HEAD desacoplado `baa41f97`** con **~820 cambios sin
  commitear** (390 M, 155 D, 275 ??). Contiene la campaña de identidad
  **dark única** (16–17 oct, `hospital-ai/evidencia/DARK-20261016/`).
- `main` (en `C:\Projects\S_Hospital`) tiene **5 commits más nuevos** que HEAD
  (17 oct): `36031c16` pagos en respuesta de factura, `2e6322ca` auth JSON sin
  redirección, `8b1d2bd6` tipado modo plantilla recibos, `9c82b22a` pint,
  `65c8c572` gitignore. **Este worktree no los tiene.**
- Rama `snapshot/redesign-pre-fixes-2026-10-17` (`8a286243`) guarda un estado
  intermedio, pero **no coincide** con el árbol actual (620 archivos de
  diferencia). Riesgo alto de perder trabajo.

### 1.2 Instalador

- Arquitectura ya construida: Inno Setup 6.5.4 + PHP 8.3 + MariaDB 11.4 +
  Caddy 2.11 + WinSW, servicios Windows, loopback `127.0.0.1:8000`, launcher
  que abre **Edge en modo app** (`--app=`), actualizador offline con respaldo y
  reversión. Scripts: `scripts/native/*`, `installer/native/S_Hospital_Native.iss`.
- Último candidato: `artifacts/S_Hospital-2026.09.28.7-Windows-x64.exe`
  — **nunca se ejecutó** (Windows canceló la elevación).
- En esta PC está instalado **`.6`** (releases `.3`, `.5`, `.6` en
  `C:\Program Files\S_Hospital\releases`). `/up` responde 200 y el login carga,
  pero `.6` falló al crear el administrador inicial. Sirve el build viejo
  azul/blanco (`index-CzNgLEiZ.js`), no el dark actual.
- `.7` y anteriores se construyeron **antes** de la campaña dark: hay que
  reconstruir el instalador con el código consolidado.

### 1.3 Recorrido de páginas (laboratorio, admin, 1366×768, build de desarrollo)

| Sección | Ruta | Resultado |
|---|---|---|
| Login | `/login` | OK. Sesión correcta, redirige a `/resumen`. |
| Resumen | `/resumen` | OK. KPIs del día, operaciones recientes (33→34). |
| Caja | `/caja` | OK: abrir caja (sesión 14, L 0.00) con confirmación. **H-04**: justo tras abrir mostró «No disponible / No se pudo confirmar el trabajo pendiente» y luego se corrigió solo. Pestañas Movimientos/Arqueo/Cierre **no recorridas**. |
| Cobrar | `/cobrar` | OK: paciente, búsqueda sin acentos («acido» → Ácido Úrico), Enter agrega, modal de confirmación, efectivo, factura `000-001-01-00000034` L 17.25. **H-05**: el chip «1 concepto en cuenta» sigue visible tras cobrar. |
| Recibos | `/recibos` | OK: listado, filtros, «Ver recibo» con vista previa carta, 2 ejemplares, línea de corte. PDF por API: 200 `application/pdf`. |
| Reportes | `/reportes` | OK: resumen, desglose Operaciones/Detalle/Cobros/Caja/Gratuidades. Exportar PDF 200 (~2 s), Excel 200 (**~8 s**, ver H-07). |
| Admin · Catálogo | `/administracion/catalogo` | OK: 124 conceptos, filtros. Hay categorías de QA (`EUPC-entrega-un-pc-*`) en el laboratorio: verificar que no viajen a producción (H-03). |
| Admin · Usuarios | `/administracion/usuarios` | Carga. **H-06**: el admin ve «Roles en modo consulta» aunque la tarjeta dice «4 roles editables». |
| Admin · Ajustes | `?panel=identidad/numeracion/reglas/impresion` | OK los 4 paneles. Carta vertical por defecto. |
| Admin · Mantenimiento | `/administracion/mantenimiento/respaldos` | Carga. Último respaldo íntegro del 28/9; «Automatismo: requiere prueba». Crear respaldo **no probado** hoy. |
| Admin · Ayuda | `/administracion/ayuda` | OK. |
| 404 | ruta inexistente | OK, «Ruta no encontrada». |

Datos que dejó este recorrido en `sh_ai_lab_local`: factura sintética 34
(«QA Plan DeepSeek Prueba», L 17.25) y **sesión de caja 14 abierta** en «Caja
principal». Úsela para probar el cierre en la Fase 3.

Para levantar el laboratorio: `.claude/launch.json` (backend
`APP_ENV=local php artisan serve --port=18080` y Vite en 18362 con
`VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:18080`).

No recorrido hoy: roles supervisor/cajero/auditor, cierre de caja completo,
anulación, reimpresión desde menú «…», móvil/zoom 200 %, impresora física.

### 1.4 Calidad automática (ejecutada hoy en este árbol)

| Gate | Resultado |
|---|---|
| `tsc --noEmit` (frontend) | **0 errores** |
| `eslint .` (frontend) | **0 problemas** |
| `vitest run` (frontend) | **151 archivos, 1240/1240 OK** (184 s) |
| `phpunit` (backend, PHP 8.2 de XAMPP) | **1458 tests: 7 fallos + 4 errores**, 69 omitidos (ver H-11/H-12/H-13) |

Detalle de los 11 rojos del backend:

- 4 errores `Tests\Unit\Backups\BackupRecoveryKitServiceTest::*` →
  `RuntimeException: El runtime no incluye Argon2id institucional`. Es del
  **entorno**: el PHP 8.2 de XAMPP no trae Argon2id. Hay que correr las
  pruebas con el PHP 8.3 que viaja en el instalador (`artifacts/native-cache`)
  y confirmar que ahí pasan. Si no pasan, el kit de recuperación está roto en
  producción (crítico).
- 3 fallos de exportación Excel (`ExecutiveExportOutputTest` ×2,
  `ExecutiveExportEvidenceC2B8Test`): el formato numérico es ahora
  `"L." #,##0.00` y los tests esperan `#,##0.00`. Decidir cuál es el contrato
  (las celdas deben seguir siendo numéricas) y alinear test o código.
- `InstitutionalReceiptCompactTemplateTest`, `InstitutionalReceiptPdfTest`,
  `InstitutionalReceiptTrc02EvidenceTest`: plantilla del recibo (línea
  gratuita visible, campos institucionales, una página por copia). **Recibo
  = documento legal**: tratar como producto hasta demostrar lo contrario.
- `ProductionDockerfileTest`: contexto Docker incluye fuentes/artefactos no
  runtime (`.dockerignore` modificado). Bajo impacto para el instalador nativo,
  pero dejar verde.

---

## 2. Hallazgos que DeepSeek debe resolver

| ID | Severidad | Hallazgo | Acción |
|---|---|---|---|
| H-01 | **Bloqueante** | ~820 cambios sin commitear y HEAD sin los 5 commits de `main`. | Fase 0. |
| H-02 | **Bloqueante (decisión del dueño)** | Los **151** conceptos de `backend/database/seeders/data/catalogo_servicios_inicial.csv` tienen `taxable=si`: todo el hospital cobraría **+15 % ISV** sobre el precio del cartel (Ácido Úrico L 15.00 → L 17.25). | **PENDIENTE del propietario (2026-10-21: «lo decido después»).** No cambiar el CSV ni el catálogo. Se puede avanzar Fases 0–5 con el catálogo actual, pero el `.exe` **no se declara entregable** (Fase 8) hasta que el propietario responda. |
| H-03 | Alta | El instalador debe sembrar solo `ProductionInstallationSeeder`: sin usuarios `*.validacion`/`azb.qa.*`, sin categorías `EUPC-*`/`AZB-*`, sin CAI de prueba. | Test que lo garantice (Fase 4). |
| H-04 | Media | Caja: error transitorio «No se pudo confirmar el trabajo pendiente» justo después de abrir. | Reproducir con el servidor real (Caddy + PHP-FCGI, no `artisan serve`). Si persiste, corregir la carrera de consultas (invalidar/esperar `cash-sessions/current` antes de `reports/cash-sessions/{id}`). Test de componente. |
| H-05 | Baja | Chip «1 concepto en cuenta» persiste en la pantalla de resultado de cobro. | Ocultarlo en estado `cobrado`. Test. |
| H-06 | Media | Usuarios: admin en «modo consulta» de roles vs. «4 roles editables». | Revisar permiso `roles.manage` en `RolesAndPermissionsSeeder` y la UI; texto coherente. |
| H-07 | Media | Exportar Excel tarda ~8 s con 1 factura. | Medir en servidor real; si >3 s, perfilar `ExecutiveExcelExportService`. |
| H-08 | Media (dueño) | En recibo y en Cobrar, «Importe» de línea incluye ISV (L 17.25) mientras el precio unitario es L 15.00 y el subtotal L 15.00. | Confirmar con el propietario el formato fiscal; si cambia, solo presentación (el backend decide totales). |
| H-09 | Baja | `package.json` `test:clinical`/`test:critical` nombran vistas archivadas. | Actualizar nombres a las vistas vivas. |
| H-11 | **Alta** | Kit de recuperación de respaldos falla en PHP 8.2 (Argon2id). | Correr con PHP 8.3 del payload; si falla, corregir antes de construir. |
| H-12 | **Alta** | 3 tests de plantilla de recibo institucional en rojo. | Diagnosticar y corregir (producto o test con justificación). |
| H-13 | Media | 3 tests de Excel ejecutivo en rojo por formato `"L."`; 1 test Dockerfile. | Fijar contrato y dejar verde. |
| H-10 | Info | Laravel Echo/Pusher en el bundle: verificar que sin servidor de websockets no haya errores ni reintentos en consola (offline). | Comprobar en el instalado; desactivar si no se usa. |

---

## 3. Decisión de empaquetado: ¿Electron?

**Recomendación: NO usar Electron.** El objetivo «instalar fácil» ya está
resuelto mejor con lo existente:

- El instalador Inno Setup ya incluye **todo el servidor** (PHP, MariaDB,
  Caddy, servicios). Electron no sustituye eso: solo sería una ventana, y
  habría que seguir instalando PHP/MariaDB igual.
- La ventana propia ya existe: el launcher abre **Edge en modo app**
  (`--app=http://127.0.0.1:8000`), sin barra de direcciones, con icono en
  escritorio/inicio. Edge viene con Windows 10/11; 0 MB extra.
- Electron añadiría ~100–150 MB, otro runtime que actualizar y otra superficie
  de seguridad, sin beneficio funcional.

Lo que sí hay que pulir para que «se sienta app»:
1. El acceso directo debe esperar a que `/up` responda (con una ventana de
   «Iniciando S_Hospital…») antes de abrir Edge, y mostrar error claro si un
   servicio no arranca.
2. Usar `--app` con `--user-data-dir` dedicado en `%LOCALAPPDATA%\S_Hospital\edge`
   para que no mezcle sesión/caché con el Edge personal, y tamaño de ventana
   razonable.
3. Fallback si no hay Edge: abrir el navegador por defecto (ya existe).

Solo si el propietario **pide expresamente** Electron, hacerlo como Fase 8
opcional: wrapper mínimo que carga `http://127.0.0.1:8000`, sin Node en el
renderer, `contextIsolation: true`, sin auto-update por internet, empaquetado
dentro del mismo Inno Setup.

---

## 4. Fases

### Fase 0 — Consolidar el código (BLOQUEANTE, requiere al propietario)

1. Respaldar el árbol actual sin perder nada: copiar `C:\Projects\S_Hospital_AI`
   (sin `node_modules`, `vendor`, `artifacts/native-*`) a
   `C:\Projects\_snapshots\S_Hospital_AI-20261021\`.
2. **Pedir al propietario autorización** para crear la rama
   `release/entrega-20261021` desde HEAD y commitear el árbol en commits
   coherentes (Conventional Commits; frontend identidad dark, backend, scripts,
   documentación/evidencia por separado).
3. Integrar los 5 commits de `main` (`36031c16..65c8c572`) con `cherry-pick` o
   `merge`, resolviendo conflictos a favor del comportamiento probado.
4. Criterio: `git status` limpio en la rama; `git log main..HEAD` y
   `git log HEAD..main` explicados en la evidencia.

### Fase 1 — Gates verdes

Ejecutar y dejar en 0 fallos:

```powershell
cd frontend; npx tsc --noEmit; npx eslint .; npx vitest run; npm run build
cd ..\backend; php vendor/bin/phpunit; vendor/bin/pint --test; vendor/bin/phpstan analyse
```

- Un test se corrige solo si se demuestra que quedó obsoleto (indicar el
  contrato vigente); si el producto está mal, se corrige el producto.
- Criterio: las 7 salidas en verde, cifras en `F1-GATES.md`.

### Fase 2 — Correcciones funcionales

Resolver H-04, H-05, H-06, H-07, H-09, H-10 con TDD (test rojo → fix → verde).
H-02 y H-08 **solo** con la respuesta del propietario.

### Fase 2B — Producto genérico para 2 hospitales (requisito del propietario, 2026-10-21)

El sistema se entregará a **dos hospitales distintos**. Cada uno tiene su
propia instalación (una PC cada uno), su catálogo, sus impuestos y sus datos.
**Nada del hospital puede estar escrito en el código, el instalador ni los
seeders de producción**: todo se configura desde la aplicación.

1. **Sin nombre fijo (H-14).** Eliminar «San Isidro», «Tocoa», RTN y textos de
   un hospital concreto de: `frontend/src/lib/hospital-name.ts`,
   `backend/app/Support/HospitalName.php`, `ReportController.php`,
   `ExecutivePdfExportService.php`, `HondurasDistributionSeeder.php`,
   `installer/native/S_Hospital_Native.iss` (`AppPublisher`, textos),
   `scripts/generate_local_ca.ps1`, logos, títulos HTML y PWA manifest. El
   nombre de producto es neutro: «S_Hospital». Mientras no haya datos, login y
   encabezados muestran «S_Hospital» y la app obliga al admin a completar
   **Ajustes → Identidad** antes del primer cobro (ya existe la regla; verificar).
   Test: `grep` de esos literales en `src`/`app`/`resources`/payload = 0
   (excepto seeders de desarrollo y tests).
2. **Impuestos configurables (H-15).** Hoy hay un único `default_tax_rate`
   global y `services.taxable` booleano. Cambiar a:
   - Tabla `tax_rates` (nombre, porcentaje decimal, activo, predeterminado),
     administrable en **Ajustes → Impuestos** (nueva pestaña): p. ej. «ISV 15 %»,
     «ISV 18 %», «Exento 0 %». Cambios con motivo y auditoría.
   - Cada producto/servicio elige su tasa (`services.tax_rate_id`, nullable =
     exento). Editable en Catálogo, individual y **en lote** por categoría.
   - Migración aditiva: `taxable=true` → tasa predeterminada actual;
     `false` → exento. No reescribir facturas históricas: `invoice_items.tax_rate`
     sigue siendo snapshot.
   - El backend calcula; pruebas de totales con mezcla de tasas, exentos,
     gratuidad de eritropoyetina y redondeo en centavos.
   - Recibo y reportes desglosan por tasa (Exento / Gravado 15 % / ISV 15 % /
     Gravado 18 % / ISV 18 %).
   - H-02 queda resuelto por diseño: cada hospital decide sus tasas en el
     sistema. El catálogo semilla se instala con la tasa que elija el
     instalador/administrador; por defecto **exento** y aviso visible
     «Revise impuestos del catálogo antes de cobrar».
3. **Catálogo por hospital (H-16).** El catálogo de un hospital no debe viajar
   obligatoriamente al otro. Añadir **Importar catálogo (CSV/XLSX)** en
   Administración → Catálogo con vista previa, validación y reporte de errores,
   y **Exportar catálogo**. El instalador deja catálogo vacío o la plantilla
   de ejemplo según elección en el primer arranque.
4. **Configurable desde el sistema (H-17)**: identidad, logo, CAI/rango,
   series de recibo, impuestos, catálogo, cajas físicas, usuarios/roles,
   papel e impresora predeterminada, reglas de cobro. Revisar que ninguna de
   estas cosas requiera editar archivos o la base a mano.

### Fase 2C — Recibo nítido en impresora normal y térmica (H-18)

Requisito: la factura debe salir **nítida** en impresora láser/tinta (carta,
media carta) **y** en impresora térmica (80 mm y 58 mm).

- PDF vectorial (texto real, no imagen). Logo en PNG/SVG de resolución
  suficiente (≥300 dpi a su tamaño impreso) y versión monocroma para térmica.
- Plantilla térmica dedicada (no la carta encogida): ancho útil 72 mm (80 mm)
  y 48 mm (58 mm), márgenes 0–2 mm, fuente sans o mono ≥ 8 pt (≥ 9 pt en
  totales), negro puro `#000`, sin grises ni fondos, líneas ≥ 0.5 pt, alto de
  página dinámico (rollo continuo), sin cortar líneas a mitad.
- Carta/media carta: negro puro para texto, grises solo en bordes, tamaño
  mínimo 8 pt, márgenes seguros 10 mm.
- Imprimir: el diálogo del navegador con `@page { size: … ; margin: … }`
  correcto por formato, sin encabezados/pies del navegador (indicar en la
  guía «Más opciones → desactivar encabezados y pies»), escala 100 %.
- Perfil de impresión por caja/equipo seleccionable en Ajustes → Impresión
  (ya existe el perfil; verificar que térmico sea opción real y probada).
- Evidencia: PDFs de los 4 formatos (carta, media carta, 80 mm, 58 mm) con
  cuenta corta, cuenta larga (30 líneas), nombre de paciente largo,
  eritropoyetina gratuita e importes de 6 cifras; renders a 203 dpi (térmica) y
  300 dpi (carta) revisados visualmente; tests de snapshot HTML. La prueba con
  impresora física queda para la Fase 7 y debe constar como pendiente.

### Fase 3 — Recorrido real completo (laboratorio)

Con backend real (`APP_ENV=local`, `sh_ai_lab_local`) y el **build de
producción** servido como en el instalado:

- Por cada rol (admin, supervisor, cajero): login, menú visible, rutas
  denegadas muestran mensaje correcto.
- Flujo cajero: abrir caja → cobrar efectivo → cobrar transferencia → cuenta
  con eritropoyetina + receta (solo esa línea a L 0) → cuenta solo
  eritropoyetina (emitida sin cobro, sin pago ficticio) → reimprimir desde
  Recibos (no crea cobro) → anular con motivo (supervisor) → arqueo → cierre
  con diferencia 0.
- Reportes del día: PDF y Excel cuadran con la API para el mismo filtro.
- Respaldos: crear manual, verificar integridad, descargar.
- Playwright: `npm run test:e2e:mock` y `npm run test:e2e:release` en verde.
- Criterio: `F3-RECORRIDO.md` con capturas y la tabla rol × ruta.

### Fase 4 — Construir el instalador `.8`

Seguir `installer/native/README.md` (build de frontend → backend `--no-dev`
en staging → runtimes con hash → payload → ISCC portátil).

- Versión: `2026.10.21` (o fecha del build) con identidad de contenido.
- Test nuevo: el payload no contiene `DevelopmentValidationSeeder` activo,
  usuarios QA, categorías `EUPC-*`/`AZB-*`, `.env` de laboratorio ni secretos.
- Ejecutar las suites `scripts/native/*.test.ps1` y
  `scripts/certification/*.test.ps1` en PowerShell 5.1.
- Criterio: `.exe` en `artifacts/release/`, SHA-256, manifiesto y recibo.

### Fase 5 — Instalar en esta PC (actualizar/reparar `.6`)

Esta PC tiene `.6` a medias. Con autorización del propietario (UAC):

1. Ejecutar el `.8`. Debe detectar `.6`, conservar DB/config y continuar con
   el administrador y el respaldo inicial.
2. Verificar: servicios `SHospital*` Running con `LocalService`; `/up` 200;
   acceso directo abre la ventana app; login con el admin creado;
   `Administración → Ajustes` pide completar datos.
3. Reiniciar Windows y comprobar que todo vuelve solo (servicios + launcher al
   iniciar sesión).
4. Probar el actualizador: reconstruir `.8.1` con un cambio trivial e
   instalar encima; datos intactos.
5. Criterio: `F5-INSTALACION-PC.md` con capturas y estado de servicios.

### Fase 6 — Windows limpio

Windows 11 **Home** no tiene Hyper-V ni Windows Sandbox: el script
`scripts/certification/provision_clean_hyperv_vm.ps1` no sirve aquí. Opciones
(preguntar al propietario): VirtualBox con una VM Windows 10/11, u otra PC.
Ejecutar el `.8` desde cero, registrar con
`scripts/certification/record_windows_clean_test.ps1` y validar con
`validate_windows_clean_result.ps1`.

### Fase 7 — Validación en el hospital

Requiere al propietario/personal: impresora física (carta, 2 ejemplares, corte),
datos reales de institución y CAI/rango SAR, revisión del catálogo y del ISV
(H-02), respaldo externo en USB y prueba de restauración.

### Fase 8 — Kit de entrega

Carpeta `S_Hospital_Entrega_<versión>/` para USB:
- `S_Hospital-<versión>-Windows-x64.exe` + `SHA256SUMS.txt`.
- `GUIA_UNA_COMPUTADORA.md` actualizada (y en PDF), con capturas de la
  identidad dark actual.
- `LEEME.txt` de una página: doble clic, aceptar Windows, crear admin, completar
  Ajustes, revisar catálogo, primer cobro de prueba.
- Script `scripts/certification/promote_to_usb.ps1`.

---

## 5. Decisiones que solo puede tomar el propietario

1. Autorizar commits y la rama de entrega (Fase 0).
2. ISV por concepto (H-02) y formato de «Importe» en recibo (H-08).
3. Una sola PC (actual, loopback) o red LAN con varias cajas (AGENTS.md lo
   contempla; el instalador hoy solo escucha en 127.0.0.1).
4. Electron sí/no (recomendado: no; ver §3).
5. Dónde se hace la prueba de Windows limpio (Fase 6).
6. Firma de código Authenticode (sin ella, Windows SmartScreen avisará al
   instalar; se puede entregar sin firma explicando «Más información →
   Ejecutar de todas formas»).

## 5B. Respuestas del propietario (2026-10-21, transmitidas por Claude)

1. Fase 0: **autorizado** crear `release/entrega-20261021`, commitear en
   commits coherentes e integrar los 5 commits de `main`. **Sin push.**
2. H-02/H-08: se resuelven con la Fase 2B/2C (impuestos configurables por
   producto; en el recibo, «Importe» de línea **sin** impuesto =
   cantidad × precio − ajuste; el ISV va solo en el bloque de totales,
   desglosado por tasa).
3. Una PC por hospital (loopback) es el modo por defecto. Dejar en el
   instalador una opción avanzada «Permitir acceso desde la red local»
   (desactivada) solo si no retrasa la entrega; si no, queda documentada como
   siguiente versión.
4. Electron: **no**. Ventana Edge en modo app (§3).
5. Windows limpio: no hay Hyper-V. Usar VirtualBox si está instalado; si no,
   registrar como pendiente para hacerlo el propietario en una PC del hospital
   con `record_windows_clean_test.ps1`. No bloquea el resto.
6. Firma Authenticode: **sin firma** en esta entrega; la guía explica el aviso
   de SmartScreen.
7. Destino: **dos hospitales**; ver Fase 2B. Ningún dato de un hospital en el
   código ni en el instalador.

## 6. Definición de terminado

- Rama de entrega con todo commiteado y gates en verde.
- `.exe` reconstruido desde esa rama, hashes publicados.
- Instalado y reiniciado en esta PC con admin creado y respaldo inicial.
- Instalado en un Windows limpio.
- Flujo diario completo recorrido en el instalado (no solo en laboratorio).
- Impresión física aprobada en el hospital.
- Cada «no verificado» listado explícitamente en `ENTREGA_ACTUAL`.
