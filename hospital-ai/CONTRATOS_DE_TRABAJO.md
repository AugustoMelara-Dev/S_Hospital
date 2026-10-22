# Contratos de trabajo y propiedad de archivos

Esta asignación es una propuesta técnica para el código descrito en la auditoría, no el resultado de inspeccionar el repositorio en esta conversación. El coordinador verifica rutas y consolida ownership antes de lanzar escritores.

## Archivos con propietario único

| Superficie compartida | Dueño inicial | Colaboración sin escritura concurrente |
|---|---|---|
| `.github/workflows/ci.yml`, configuración PHPUnit, TestCase | hs-qa | db/finance entregan casos y requisitos |
| nuevas migraciones y su orden | hs-db | finance/receipts/backups entregan contratos |
| `scripts/deploy_hospital_lan.ps1`, preflight y loader offline | hs-install | recovery/backups/security revisan sus call sites |
| restore y maintenance | hs-recovery | install enlaza; finance revisa reconciliación |
| `nginx/default.conf`, Compose prod y configuración de red | hs-security | install/backups solicitan cambios concretos |
| `backend/docker/entrypoint.sh` | hs-install | security revisa; db especifica guardas |
| scheduler y configuración de respaldos | hs-backups | install/release consumen contratos |
| `frontend/src/AppRoutes.tsx`, tokens y shell de la app | hs-frontend | receipts/ux proponen rutas, no editan a la vez |
| receipt-settings y plantillas PDF | hs-receipts | ux define; frontend integra navegación |
| seeders de roles/perfiles | coordinador asigna uno por archivo | no cambiar una política por accidente |
| manifiestos/lockfiles | coordinador asigna un dueño | instalaciones concurrentes prohibidas |
| progreso compartido, ownership, decisiones | hs-orchestrator | trabajadores entregan informes exclusivos |
| scripts/gates de certificación | hs-release, tarea explícita | no alterar criterios para obtener PASSED |

Una transferencia de ownership termina la tarea escritora anterior y registra el nuevo dueño. Los agentes no utilizan el tamaño de contexto como excusa para ignorar este archivo. El coordinador verifica el diff integrado completo.

## Separación de datos y procesos

Worktree distinto no significa base distinta. Cada job que escribe en DB declara motor, hostname/servicio, nombre seguro, Compose project, volúmenes y puertos. Antes de tests destructivos se comprueba el destino. No ejecutar dos fixtures/migraciones sobre la misma base al mismo tiempo. Solo dos cargas pesadas simultáneas; lectura/revisión pueden continuar en otras tareas.

## hs-recovery

**Responsabilidad:** Repara consola de mantenimiento y restauración Docker-only con pruebas desechables y controles de recuperación.

**Rutas iniciales a verificar:** scripts/maintenance_hospital_windows.ps1; scripts/restore_hospital_windows.ps1; scripts/lib/recovery_docker.ps1; pruebas de sus contratos. El script de deploy tiene otro dueño.

Revalidar F001. Corregir parámetros reales, prompts de confirmación coherentes, detección Docker-only, rutas y errores. Probar consola→restore desechable→validación con bases sintéticas. Conservar guardas destructivas. Diseñar recuperación operativa con mantenimiento, suspensión de writers y rollback sin ejecutarla sobre producción. Coordinar con hs-install el acceso directo y con hs-finance el bloqueo por correlativos después de restore.

**Contrato de cierre:** La consola funciona sin PHP/backend del host; binding y confirmaciones coherentes; prueba integrada en layout distribuible; el recurso original permanece intacto.

## hs-install

**Responsabilidad:** Repara preflight, instalador, actualización segura y verificación de imágenes offline de S_Hospital.

**Rutas iniciales a verificar:** scripts/deploy_hospital_lan.ps1; scripts/production_readiness_preflight.ps1; scripts/install_hospital_startup_shortcut.ps1; scripts/load_offline_images.ps1; setup.bat; installer/S_Hospital.iss; pruebas específicas.

F003/F004/F005/F028. Docker-only no exige PHP/MySQL host. Shortcut abre consola, no restore. Verificación de checksum previa a cargar cada imagen; integridad no equivale a firma. Actualización verifica backup recuperable y distingue primera instalación vacía. Preservar claves existentes y hacer escritura de configuración segura. Solicitar dueño exclusivo para entrypoint/compose si hace falta; no pisar hs-security.

**Contrato de cierre:** Tests del call site del shortcut, preflight Docker-only, rechazo tar alterado, instalación vacía y upgrade con/sin backup; salidas y cancelación consistentes.

## hs-backups

**Responsabilidad:** Completa respaldos, copia externa cifrada, alerta de fallos, custodia de claves y prueba de recuperabilidad.

**Rutas iniciales a verificar:** backend/app/Actions/Backups/; clases de cifrado/dump encontradas en código; backend/config/backups.php; tareas de copia externa; pruebas de backup. Config y scheduler compartidos solo con ownership explícito.

F019 y HS-BK-KEY. Inventariar backup, retención, llave y APP_KEY cuando corresponda. Probar roundtrip con llaves sintéticas, corrupción, llave errónea, destino ausente y copia externa. No inventar criptografía ni publicar secretos. Implementar alerta local verificable y adapter a canal externo configurable; sin destino real, no declarar copia/alerta externa desplegada. Medir última copia recuperable y RPO observado; corregir extrapolaciones de calendario sin evidencia.

**Contrato de cierre:** Copia cifrada y hash verificados, recuperación de datos sintéticos, fallos visibles, no reescritura de claves existentes; límites y custodia documentados.

## hs-db

**Responsabilidad:** Sanea constraints, dinero duplicado y deuda de esquema mediante cambios compatibles y pruebas MariaDB reales.

**Rutas iniciales a verificar:** backend/database/migrations/; modelos y comandos de diagnóstico concretos asignados; backend/tests de integridad. Único dueño de nuevas migraciones y su orden.

F013–F018/F020. Verificar centavos/decimales, singleton, asignaciones, series, tipos, IP/autoría, idempotencia legacy y áreas. Proponer expansión compatible antes de retiros; no editar migraciones aplicadas para maquillar historial. No modificar dinero/fechas históricos arbitrariamente. Verificar TZ de conexión/serialización; timestampTz no es una solución automática. Separar inmutabilidad de snapshots de archivo PDF binario. Probar constraints con SQL directo en DB desechable y migraciones en datos representativos sintéticos.

**Contrato de cierre:** Invariantes expresadas y verificadas, ausencia de pérdida de datos en migraciones probadas, compatibilidad y rollback documentados, decisiones no necesarias justificadas.

## hs-finance

**Responsabilidad:** Protege cobros, idempotencia, correlativos, cierres y reglas EPO; implementa únicamente mejoras financieras justificadas.

**Rutas iniciales a verificar:** backend/app/Actions/Billing/; Payments/; Cash/; backend/app/Support/Money.php; pruebas financieras asignadas. Modelos/migraciones requieren coordinación con hs-db.

Revalidar F007/F008/F011/F013. Preservar aritmética, locks y snapshots. Probar requests simultáneos, retry después de commit y cierre bloqueado por recibo pendiente; jamás duplicar pago para generar PDF. Caso extra: restore antiguo y números ya impresos, con bloqueo/reconciliación fiable antes de reemitir. EPO: flag raíz y política no inventada. Caja única puede ser intencional: no convertirla en multicaja sin requisito confirmado.

**Contrato de cierre:** Saldos e importes reconciliados, cero duplicación en escenarios probados, permisos respetados, comportamiento de recuperación y decisiones de negocio explícitos.

## hs-security

**Responsabilidad:** Endurece exposición de servicios, HTTPS/WSS, sesiones, endpoints, permisos y dependencias sin romper la operación LAN.

**Rutas iniciales a verificar:** nginx/default.conf; docker-compose.prod.yml; middleware/config de sesión/CORS; endpoints de estado; plantilla de entorno sin secretos; pruebas de seguridad. EntryPoint/deploy se coordinan con hs-install.

F010/F029/F030/F031/F033. Minimizar health público, proteger detalle operativo, conservar branding/bootstrap mínimo. TLS/WSS y cookies coherentes con CA/trust real; no desactivar validación ni introducir HSTS que bloquee acceso sin plan. Ajustar puertos/firewall mínimos. Dependencias según advisory oficial actual; no upgrade mayor indiscriminado. Revisar bypass de auditoría/privilegios sin confundir triggers con protección ante DBA. MFA es decisión opcional, no requisito automático.

**Contrato de cierre:** Pruebas de autorizado/no autorizado, payload público mínimo, conexiones TLS coherentes en prueba, sin fuga de secretos ni regresión Sanctum/CSRF/realtime.

## hs-receipts

**Responsabilidad:** Completa configuración, copias, PDF, reimpresión y recuperación idempotente de recibos institucionales.

**Rutas iniciales a verificar:** backend/app/Actions/InstitutionalReceipts/; backend/app/Actions/Receipts/; plantilla classic.blade.php; frontend/src/features/receipt-settings/; ReceiptPreview.tsx/printing asignados; pruebas locales. AppRoutes es compartido y necesita ownership.

F002/F012/F024. Reconectar vista/contrato y eliminar enlace circular. Copias configurables disponibles, propuesta de tres para nuevas instalaciones sin modificar perfiles históricos. Media carta y A5 exactos, sello/firma legítimos. Reimpresión visible #n, contador persistente, motivo humano en rutas legacy e institucionales. Verificar GET/POST PDF permisos sin afirmar control de impresión física de archivos descargados. Conservar pago registrado/receipt recovery_required. Corregir specs sin ejecutar navegador restringido.

**Contrato de cierre:** Pantalla conectada y permisos backend, copias/formato verificados por medios autorizados, reimpresión no falsifica primera impresión, recuperación no duplica cobro.

## hs-ux

**Responsabilidad:** Define y revisa una experiencia completa y coherente de caja hospitalaria con contratos de pantalla y accesibilidad operativa.

**Rutas iniciales a verificar:** hospital-ai/diseno/ y contratos visuales. No editar las mismas pantallas que hs-frontend/hs-receipts; solo implementar componentes si se le transfiere ownership explícito.

Mapear rutas reales y estados; proponer navegación, densidad, jerarquía, tipografía, tokens y comportamiento de teclado para aplicación administrativa. Cubrir POS, historial, caja, informes, catálogo, usuarios, recibos, backups y soporte. No landing page ni pantallas mock como entrega final. Revisar antes/después con evidencia permitida, distinguir revisión estática de inspección visual real. No fabricar sellos/firmas ni política hospitalaria.

**Contrato de cierre:** Contratos precisos por pantalla, estados y accesibilidad, tokens reutilizables y lista de problemas corregibles; aprobación visual no presumida por tener tests.

## hs-frontend

**Responsabilidad:** Implementa el rediseño operativo completo React/TypeScript, divide componentes críticos y preserva flujos reales.

**Rutas iniciales a verificar:** frontend/src/ salvo receipt-settings/printing y archivos con otro dueño; tokens/componentes compartidos y AppRoutes bajo ownership explícito. Vitest/typecheck/lint/build de sus cambios.

F021/F022/F023 y todas las pantallas del contrato UX. Claridad de caja/pago, formularios recuperables, tablas, permisos, estados, normalización de acentos, foco/teclado y prevención de doble submit. Separar componentes por responsabilidades sin migrar stack. Mantener contratos HTTP/idempotencia, no introducir as any ni desactivar reglas. Sin Playwright/automatización de navegador salvo autorización explícita posterior.

**Contrato de cierre:** Rutas reales conectadas, contratos preservados, typecheck/tests/build autorizados actuales, rediseño coherente sin botones vacíos; evidencia visual honesta.

## hs-qa

**Responsabilidad:** Construye evidencia nueva: CI MariaDB efectiva, concurrencia real, regresiones y comprobaciones autorizadas del producto integrado.

**Rutas iniciales a verificar:** .github/workflows/ci.yml; backend/phpunit*.xml; backend/tests/TestCase.php; configuraciones de pruebas asignadas; fixtures/runner; hospital-ai/evidencia/qa/. No reescribir producción que tenga dueño.

F006/F007/F024/F034. Medir baseline actual y confirmar motor DB efectivo; job MariaDB falla si conecta a SQLite. DB prefijada desechable y procesos independientes para locks. Inventariar scripts antes de ejecutarlos. Respetar restricción previa de navegador: reparar specs y mantener suite, no ejecutarla ni disparar CI para eludir restricción. No subir umbrales artificialmente, quitar assertions, mockear integraciones críticas o usar evidencia antigua como nueva. Controlar máximo dos cargas pesadas simultáneas.

**Contrato de cierre:** Comandos/logs con fecha/root/fingerprint, pass/fail/skip razonados, driver real, regresiones identificadas y cierre sustentado; límites de browser/certificación declarados.

## hs-review

**Responsabilidad:** Revisión independiente y solo lectura de cambios financieros, seguridad, UX e integración; rechaza cierres sin evidencia.

**Rutas iniciales a verificar:** Solo lectura del briefing, diff, archivos y evidencias autorizadas. Sin shell, edición, Task ni herramientas externas con side effects.

No confíes en el resumen del autor. Verifica comportamiento, contrato, pruebas y alcance. Busca regresiones, cambios de reglas de negocio no autorizados, PII/secretos, claims de producción sin evidencia, mocks sustituyendo integración y errores de interacciones entre lotes. Clasifica hechos, hipótesis y deuda opcional. Devuelve VEREDICTO: ACEPTABLE / REQUIERE_CAMBIOS / EVIDENCIA_INSUFICIENTE con rutas y razones. No escribir tus propias correcciones ni inventar ejecución.

**Contrato de cierre:** Revisión de evidencia y diff concreta, bloqueos reproducibles o razonamiento explícito; el autor resuelve observaciones y QA verifica.

## hs-release

**Responsabilidad:** Unifica runbooks, trazabilidad, estado real y candidato final congelado sin fabricar certificación de Windows o impresión.

**Rutas iniciales a verificar:** docs/ canónicos asignados; hospital-ai/propuestas-release/; CHANGELOG y reports con ownership; scripts de certificación solamente por tarea específica, sin cambiar gates por conveniencia.

F009/F025/F026/F027/F032 y certificación final. Corregir docs muertos/contradictorios Docker-only, conteos/imágenes/nombres. Preservar históricos del usuario. Mantener evidencia nueva separada de QA julio. Congelar árbol y registrar HEAD+dirty fingerprint+hash candidato; no certificar mientras cambie el artefacto. NO editar PASSED/production_certified ni promover USB sin pruebas reales. RTO/RPO, firma, impresión física/Windows/segunda PC se documentan con sus pruebas o estado pendiente.

**Contrato de cierre:** Runbooks ejecutables alineados al paquete, documentación canónica enlazada, manifiesto y estado correctos, cero falsa certificación.

## Cierre integrado mínimo

La reparación de una familia debe incluir código, pruebas autorizadas, interacción con otras familias, documentación afectada y revisión independiente. No dar por resuelto el problema de recibos solo con montar un componente ni el de MariaDB solo con iniciar un servicio. Ningún worker decide por sí solo promover el release.
