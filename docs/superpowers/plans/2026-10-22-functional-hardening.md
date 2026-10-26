# Correcciones funcionales e identidad hospitalaria

> Ejecutar por áreas independientes con pruebas antes/después y revisión de integración.

**Goal:** resolver el cambio de identidad hospitalaria y los hallazgos de reportes,
API, auditoría, ayuda, diagnóstico y operación aceptados por el usuario.

**Architecture:** React mantiene TanStack Query, formularios y diseño claro existentes.
Laravel conserva Actions, Form Requests, permisos y snapshots históricos. La fuente
backend se modifica primero en copia QA, publicándose después de verificar.

**Tech Stack:** React/TypeScript, Laravel 12, MySQL/MariaDB local, Vitest/PHPUnit/Playwright.

**Spec:** autorización del usuario «PROCEDE CON TODAS» y fallo de nombre en Ajustes,
más la revisión de mejoras del mismo chat. AGENTS.md conserva sus reglas de negocio.

## Restricciones

- No modificar datos, credenciales o cajas de `18462` ni `127.0.0.2:18482`.
- QA mutable únicamente `18472` / `sh_ai_f3_fixes_20261022`, serializado por el coordinador.
- Backend de trabajo: `%TEMP%/sh-fixes-20261022/backend`; vendor compartido solo lectura.
- Frontend de trabajo: `C:/Projects/S_Hospital_AI/frontend`; build nuevo temporal.
- Sin commits, push, reset, clean, migraciones destructivas ni dependencias nuevas.
- Dinero en centavos; filtros de permisos intactos; documentos emitidos inmutables.

## Criterios de revisión

Nombre real configurado y largo; guardar fallido no anuncia éxito; cambio en la
misma pestaña, recarga y móvil; factura nueva con nombre nuevo e histórica sin
alteración; filtro combinado y más de50 turnos; 5001 gratuidades; rol gerencial
que no cierra cajas ajenas; API completa sin filtrar secretos; pérdida de error
diagnosticable; recuperación únicamente en base nueva y aislada.

## Entregables

Las casillas de implementación no equivalen a publicación ni sustituyen la
verificación integrada pendiente. El backend candidato continúa en la copia QA.

- [x] Identidad: `hospital-name.ts`, `useFiscalSettings.ts`, `HospitalSettingsView.tsx`,
  helper backend `HospitalName.php` y regresiones shell/factura/recibo/PDF.
- [x] Reportes backend: totales sin límite de vista previa; alcance gerencial
  uniforme JSON/PDF/Excel; pruebas de volumen y roles personalizados.
- [x] Frontend: filtros URL completos; invalidación de reportes al operar caja;
  opciones paginadas con búsqueda y filtros históricos.
- [x] API de caja: filtros y opciones paginadas autorizadas, respuestas mínimas.
- [x] Sección Auditoría conectada a API existente; acceso `audit.view` coherente;
  ayuda para gratuidades, anulaciones/reversiones y cierres bloqueados.
- [x] Diagnóstico backend: error de respaldo registrado sin secretos e identificador
  de solicitud generado por servidor, compartido en respuesta y registros.
- [x] Contrato OpenAPI: cobertura de rutas reales, schemas de núcleo financiero,
  errores, códigos HTTP e idempotencia; verificación automática de contrato.
- [x] Descomponer configuración de impresión conservando reglas y pruebas.
- [x] Añadir accesibilidad y contraste al gate E2E habitual.
- [x] Ensayar restauración en otra base, comparar datos y comprobar escritura/lectura.
- [x] Verificar explícitamente que el reinicio aislado del servidor conserva sesión y datos.
- [x] Verificación integrada, publicación y comprobación de preservación.

La impresora física y el reinicio real de Windows necesitan recursos/intervención
que se comprobarán explícitamente. Un ensayo de procesos aislados no se presentará
como un reinicio del equipo ni una verificación de papel impreso.

## Evidencia final y límites de verificación

Evidencia local de esta fase: `%TEMP%/sh-hardening-20261022/`; los grupos focales
de backend también están en `%TEMP%/sh-fixes-20261022/`. No sumar grupos que se
superponen como si fueran un total único de pruebas.

- `typecheck-final.log`, `eslint-verified.log` y `build-final.log`: TypeScript, ESLint global y build
  temporal completados sin errores. No se construyó sobre los estáticos activos.
- `mock-gate-final.log`: 24 escenarios de navegador con backend simulado aprobados.
  La comprobación real de las pantallas sigue siendo una verificación separada.
- `report-aggregate-regression-isolated.log` (directorio `sh-fixes-20261022`):
  51 pruebas y 440 aserciones aprobadas en reportes, PDF, Excel y procedencia
  histórica. Incluye 5,001 líneas gratuitas con resumen completo, rol gerencial
  sin `cash.close_any` y denegación de turnos ajenos para cajeros. PHPUnit usó
  `APP_BASE_PATH` de QA explícito y SQLite en memoria; Pint y sintaxis PHP pasan.
- `restore-result.json`: restauración aislada comprobada; 11 tablas críticas
  coinciden, cero líneas de factura huérfanas y prueba de escritura/lectura aprobada.
- `restart-session-result.json`: mismo navegador y cookie conservan acceso después
  de reiniciar únicamente PHP; respuesta autenticada en 519 ms y hashes de tablas
  protegidas iguales. OPcache aislado por instancia y versión, con comprobación
  de archivos activa. No equivale a reiniciar Windows.
- `backend-integrated-final.log`: corrida backend final aprobada, 439 pruebas,
  5,068 aserciones, 20 omisiones y cero fallas. En la primera corrida
  (`backend-integrated.log`) fallaron dos fixtures de comandos de respaldo que
  necesitaban crear su directorio de salida y una expectativa obsoleta del nombre
  del hospital. Se corrigieron los fixtures y la expectativa, conservando el
  nombre configurado y las reglas del producto.
- `final-proof.json`: 13 escenarios reales únicos aprobados. Conserva los ocho
  aprobados de `playwright-real-verified.json` y las cinco repeticiones afectadas
  aprobadas de `playwright-real-corrected.json`; no altera las corridas fallidas.
  Se corrigieron selectores de campos obligatorios y el fixture de caja disponible.
  El ensayo respeta el límite de solicitudes del servidor; no se desactivó.
- Catálogo real: administrador y supervisor crean un servicio, verifican IDs de
  categoría/área enviados y guardados, cambian precio con motivo y observan la nueva
  tarifa. `ServiceDrawer` conserva 25 pruebas aprobadas; no se cambió su lógica
  por una hipótesis de desincronización que el navegador no reprodujo.
- Pantallas reales: 15 rutas a 1366 y 390 px, sin errores de página ni infracciones
  graves de accesibilidad. Se eliminó la transición de opacidad al habilitar botones;
  dos regresiones comprueban contraste inmediato con movimiento normal y reducido.
- `real-evidence/workflow-results.json`: cobros efectivo/transferencia, impuestos,
  eritropoyetina, emisión sin pago ficticio, reimpresión, anulación por supervisor,
  PDF/Excel, creación/descarga de respaldo y cierre conciliado, sin incidencias.
- `branding-receipt.png`: PDF real renderizado e inspeccionado, una página carta,
  con el nombre nuevo. Los documentos históricos mantienen sus snapshots.
- Publicación: `deployment-1792705401605/result.json`, 29 archivos backend idénticos
  a QA y el mismo build en 18462 y 127.0.0.2:18482. Comparación antes/después de
  usuarios, roles, permisos, movimientos, cajas, facturas, pagos, recibos y ajustes
  sin cambios. No se ejecutaron migraciones ni seeders en esos entornos.
- Comprobación posterior anónima: ambas URLs responden 200, muestran la identidad
  configurada, sirven el HTML verificado y generan `X-Request-ID`, sin errores de
  consola. No se inició sesión con las cuentas del usuario para probarlas.

La fase de software está publicada y comprobada localmente. La impresión física,
el reinicio de una instalación final de Windows y el acceso desde otro puesto LAN
siguen pendientes de verificación; esto no certifica esos entornos ni el instalador.
