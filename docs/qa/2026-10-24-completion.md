# Verificación de entrega — 24 de octubre de 2026

Raíz: `C:\Projects\S_Hospital_AI`. Rama: `release/entrega-20261021`,
HEAD inicial `46a233a1`. La consulta remota confirmó que `origin/main`
continúa en `baa41f97`; la rama de entrega local contiene el trabajo más reciente
del producto. Se conservaron los cambios anteriores sin commit y el árbol
original `C:\Projects\S_Hospital`.

## Alcance

Cinco agentes con propiedad separada: backend, recibos, frontend, E2E e
instalador. El coordinador revisa integración y documentación. Solo bases
sintéticas y carpetas de laboratorio; sin instalación elevada, publicación,
compras, cambios en producción ni commits.

## Evidencia confirmada

- TypeScript y ESLint global: salida 0 en el árbol de frontend.
- Build Vite final: salida 0; candidato aislado en
  `%TEMP%/sh-completion-20261024/frontend-dist-final`, sin sustituir `frontend/dist`.
- Guard de entrega sobre ese candidato: aprobado. SHA-256 de `index.html`:
  `C7B6C0FB74B4EE2E5DDF649D850B10E84B19AF757597CD756A67C4E042D6D1FC`.
- Playwright mock: 24 escenarios aprobados (Cobrar, Recibos, Caja, Reportes,
  permisos, accesibilidad y contraste); log `%TEMP%/sh-completion-mock.log`.
- Guard `check-product-delivery --dist-dir`: dos pruebas Node aprobadas.
- Vitest inicial: 1,351/1,353 pruebas aprobadas, con dos contratos obsoletos.
  Corregidos y repetidos: 26/26. La integración posterior de restauración y
  contraste pasó 72/72 en cinco archivos; TypeScript y ESLint focal pasan.
  No se presenta esta combinación como una segunda corrida global.
- Backend SQLite inicial: 1,529 pruebas, 1,456 aprobadas, 69 omitidas y cuatro
  fallos. Tres eran expectativas antiguas de identidad y uno la respuesta
  genérica al bloquear emisión después de restaurar. Focal corregido: 77
  pruebas, 2,781 aserciones, cinco omisiones justificadas por motor y cero fallos.
  Se conservan los informes iniciales y las repeticiones.
- Recibos: 53 pruebas y 1,672 aserciones aprobadas con PHP 8.3.35 y SQLite
  aislado (`InstitutionalReceiptPdfTest`, `InstitutionalReceiptPaperCompositionTest`
  y `ReceiptFormatsEvidenceTest`). Diez PDF generados: cuentas de cuatro líneas
  en carta, media carta, A5, 80 mm y 58 mm ocupan una página cada una; cuentas
  de 30 líneas ocupan respectivamente 2, 2, 3, 1 y 1 páginas. El coordinador
  inspeccionó las imágenes finales de media carta, A5 y totales de 58 mm.
- MariaDB de laboratorio: 11.4.13 del payload, comprobada por cliente y PDO;
  las pruebas deben usar `HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1` y bases con
  prefijo `s_hospital_test_`. Esto evita declarar MariaDB cuando corrió SQLite.
  La corrida global concluyó: 1,526 pruebas, 13,769 aserciones, 1,496 aprobadas,
  21 omitidas y nueve errores. Dos errores correspondían al singleton fiscal
  de preparación; siete, al aislamiento entre casos del guard de respaldo
  previo a migraciones. Se conservan XML/log originales; las correcciones y
  repeticiones focales se registran por separado, sin declarar una segunda
  corrida global verde.
  Repetición focal final de esas causas en MariaDB y SQLite: **32 pruebas, 526
  aserciones, cero omisiones, errores o fallos en cada motor**. Incluye los 13 casos del
  guard de respaldo, los dos singleton con ID distinto de 1 y el seeder
  productivo sin datos QA. Los nueve errores globales quedan corregidos y
  cubiertos por esta repetición; no se eliminan del informe original.
- Concurrencia real MariaDB 11.4.13: **ocho pruebas, 46 aserciones, cero
  omisiones, errores o fallos** con `HOSPITAL_RUN_CONCURRENT_TESTS=1` en otra
  base desechable. Incluye aperturas simultáneas, cobro frente a cierre,
  idempotencia posterior al commit, correlativos fiscales y reimpresiones
  con procesos PHP separados. El marcador antiguo dependiente de `pcntl`
  omitido en SQLite/Windows no sustituye esta ejecución real.
- Descubrimiento de pruebas: la exclusión de `tests/Feature/Concurrent` en
  `phpunit.mysql.xml` también ocultaba por prefijo el archivo hermano
  `ConcurrentFiscalNumberTest.php`. Se corrige la selección explícita y se
  comprueba esa clase aparte: **cuatro casos, tres aprobados, 13 aserciones,
  una omisión por `pcntl` en Windows y cero errores/fallos**. No se atribuyen
  sus resultados ni su omisión a la corrida global anterior.
- Restauración real MariaDB: respaldo cifrado, copia verificada por hash,
  pérdida simulada de la copia local, recuperación, descifrado e importación
  en otra base desechable. **16 tablas idénticas por conteo y SHA-256**, cero
  líneas de factura huérfanas y lectura/escritura posterior comprobada.
  Incluye una factura pagada, movimientos, auditoría y un recibo emitido con
  snapshots no vacíos y su serie. El primer intento del arnés usaba `.name`
  en lugar de `institution_snapshot.hospital_name`; se corrigió el arnés y se
  conservó su log. El JSON final declara `status: passed` y las verificaciones
  anteriores. La copia externa simulada está en otra carpeta de la misma PC:
  no certifica un dispositivo externo ni una restauración productiva.
- Excel: aplicar juntas las tres propiedades de alineación redujo construcción
  de 3,561 a 2,291 ms en el ensayo aislado. Comparación de valores, tipos,
  estilos y alturas idéntica; ocho pruebas y 66 aserciones pasan. El tiempo
  HTTP inicial (105 facturas, 9,543/4,825/5,219 ms) no aprobó el objetivo de
  tres segundos. Agrupar después las celdas de texto consecutivas por columna
  redujo otro ensayo de 2,313 a 1,394 ms, también con igualdad exacta. Prueba
  HTTP final: una serie prefijada de tres descargas tras reiniciar el laboratorio,
  106 facturas, **2,565 / 1,399 / 1,511 ms**, todas HTTP 200 y XLSX válido.
  Las mediciones anteriores se conservan; no es una garantía para cualquier
  hardware o volumen. Hash del exportador final:
  `1e51fed83ded460527aaab7dd9d6a37a5caf8c91ff816b018807f0664e42b2fd`.
- Release E2E: 13 escenarios únicos aprobados mediante corridas focales
  documentadas. La corrida inicial tuvo cuatro fallos de estado/fixture/latencia;
  los cuatro se repitieron y aprobaron. No se presenta como una sola corrida
  global verde. `final-proof.json` conserva la procedencia de cada escenario.
- UI final: 15 rutas a 1366 y 390 px, datos cargados y sin errores de página,
  desbordamientos ni infracciones graves/críticas de accesibilidad. Auditoría
  comprueba habilitación inmediata y hover. El coordinador inspeccionó Reportes
  en escritorio y Recibos en móvil. Los procesos del laboratorio E2E se detuvieron.
- Primer instalador candidato `2026.10.24.8` (sustituido tras el guard de tipo):
  compilación aprobada en 223.047 s,
  102,330,428 bytes. SHA-256:
  `20818e230609312f860e0669b151203d178592b5993382a509111c39b9c39cca`.
  No se ejecutó. Firma `NotSigned`, conforme a la decisión vigente del propietario.
  34 suites PowerShell 5.1 aprobadas; ACL elevada y probe con EXE ejecutado no
  corridos. Manifiesto estricto: 8,806 archivos válidos; higiene: 8,807 archivos,
  447 textos y 41,551 comprobaciones aprobadas.
- Primer payload ReleaseId `2026.10.24.8-c74c2e8ba22c`, contenido SHA-256
  `c74c2e8ba22c9bb783e555ec601ff1da0efef1e55869f3c937e422d0e067e096`.
  Contiene el build frontend final y las correcciones de recibos, API y Excel.
  Comparación del coordinador antes del guard de tipo: los 418 archivos distribuidos de
  app, configuración, rutas, recursos, migraciones, seeders y bootstrap
  coincidían por SHA-256 con sus fuentes de ese momento; cero divergencias.
  Las herramientas DevelopmentValidationSeeder y PrepareE2eReleaseDataCommand
  están excluidas del runtime. PHP 8.3.35, doce extensiones y sodium/Argon2id
  comprobados. El kit incluye fuente oficial MariaDB 11.4.13 (221,118,336 bytes),
  SHA-256 `1bb254b106d0a7ca871cfa18fa6e18d4b80a7430f9ec9d1571ec4271a13def96`,
  cotejado con el archivo de hashes del proveedor; no se instala en el runtime.
- Payload final tras PHPStan: ReleaseId `2026.10.24.8-239966d4d5f0`, contenido
  SHA-256 `239966d4d5f052d5a0fe4afd2d1a894e464c745a4c24c6cd739699105fd7d2bc`,
  manifiesto SHA-256 `66262640be83635f37abfc37608f0f5ffe8945ed24d4ce25507af3261f34f895`.
  Verificación estricta e higiene aprobadas (8,806 archivos y 41,551 checks).
  Comparación con el primer manifiesto: exactamente un archivo cambiado, el
  builder, y el mismo inventario. Compilación final mediante el mismo CLI de
  ISCC, ligado al manifiesto verificado y al payload congelado; se evita solo
  una tercera lectura completa redundante del wrapper, sin omitir la
  validación completa previa ni modificar scripts/allowlists.
- EXE final corregido: `S_Hospital-2026.10.24.8-Windows-x64.exe`,
  **102,328,024 bytes**, compilación aprobada en **246.813 s**, SHA-256
  `b91e2dddc1d9152466762228c5c333a70d205ee8fa0b44382726bb17d1a07a67`.
  Copias del kit y release verificadas; estado del recibo
  `LAB_VALIDATED_WITH_TARGETED_RETESTS_PENDING_INSTALLATION`.
  No firmado ni ejecutado. El candidato inicial se conserva fuera del kit.

## Correcciones verificadas

- Recibos: fallback de caja exponía una PK interna; la plantilla clásica A5
  omitía la explicación del ajuste de eritropoyetina. El caso corto de media
  carta con impuestos mixtos también saltaba a dos páginas. Corregidos y
  verificados con PDF real: se conserva la tipografía y el espacio de firmas.
- Migraciones: pruebas de idempotencia omitidas en ambos motores o con
  `assertTrue(true)` no eran evidencia suficiente; se reemplazan por ejecución
  real de migraciones y conservación de esquema/datos.
- Backup: el test de dump nativo no debe convertir cualquier excepción en una
  omisión de herramienta faltante.
- Restauración: la API devuelve `409 RESTORE_RECONCILIATION_PENDING` con
  instrucción segura para el administrador, en vez de `500 SERVER_ERROR`.
  No consume correlativos. El frontend reconoce ese rechazo definitivo,
  conserva el borrador y no lo presenta como un cobro de resultado incierto.
  Prueba de navegador con respuesta simulada: aprobada, incluyendo reintento
  explícito después de resolver el bloqueo y ausencia de pagos/recibos previos.
- Contraste: Button deja de interpolar opacidad al habilitarse; su estado hover
  primario usa el token de contraste. Regresión de componentes aprobada;
  comprobación final de navegador aprobada en ambos anchos.
- Empaquetado: faltaba el aviso de licencia WinSW. Se incluye desde la copia
  del tag oficial y se comprueba que el payload lo conserva.
- Actualización: las dos migraciones de impuestos añadidas desde `.6` requieren
  la política `backward_compatible_additive`, con respaldo previo; todas las
  migraciones anteriores se compararon sin cambios.
- Documentación: Docker ya no es obligatorio para la entrega nativa. Se
  diferencian el instalador de una computadora y la alternativa LAN.
- Preparación de pruebas: el seeder de desarrollo y el comando E2E asumían
  que el registro fiscal único tenía ID 1. MariaDB expuso inserciones duplicadas
  cuando el autoincremento había avanzado. Ambos reutilizan el singleton real;
  regresiones con ID 47 comprueban idempotencia. No se modificó el constraint
  ni el seeder productivo. Las herramientas están excluidas del instalador.
- Aislamiento de pruebas: VerifyMigrationBackupCommandTest limpiaba el esquema
  MariaDB una sola vez por clase y después recreaba tablas ya existentes.
  Se corrige el fixture por caso dentro de la base desechable protegida; no se
  cambia el guard productivo que exige respaldo antes de actualizar.
- PHPStan detectó acceso a `cash_register_label` sobre un contexto de tipo
  `mixed`. El builder comprueba ahora `is_array` antes de leer/escribir y
  conserva el contexto completo. PHPStan final aprueba sin errores, un worker
  y límite de 384 MB. La regresión legada aprueba una prueba/seis aserciones;
  Pint y sintaxis focales pasan. SHA-256 del builder final:
  `84045583ad8c320cbc8df178ef4422e36f7aa3ed5085945fe14b3a5cf3ba509f`.
  Se reconstruye el candidato; el primer EXE y su manifiesto se preservan en
  `artifacts/native-history/2026.10.24.8-c74c2e8ba22c`, como antecedente.
  Pint global final también aprueba. No se silenció el diagnóstico de PHPStan.

## Límites actuales

El [detalle backend](../../artifacts/qa-20261024-backend/summary.md) conserva
las 21 omisiones originales, sus sustitutos o límites y los comandos sin
secretos. Ocho se cubrieron con concurrencia real; recuperación y generación
de PDF tienen evidencia separada. No se midió cobertura instrumentada
(`pcov`/`xdebug` ausentes) ni el costo opt-in de consultas del consolidado de
caja; no se afirma porcentaje de cobertura ni rendimiento global.

La primera corrida E2E real y su probe de Auditoría no concluyeron: PHP tardó
entre 4 y 10 segundos por solicitud y el login superó el límite de la prueba.
El host tenía 0.43 GB libres de 15.69 GB. Se conservaron los logs y se pausaron
las repeticiones bajo carga. Tras finalizar la copia pesada y preparar OPcache,
la salud respondió en 197–219 ms y Auditoría aprobó con los límites originales.
El resto de verificaciones posteriores y sus resultados figuran arriba;
los fallos iniciales no se eliminaron del historial.

No existen las rutas estándar `C:\Program Files\S_Hospital` y
`C:\ProgramData\S_Hospital`, ni servicios `SHospital*`, según comprobación
de solo lectura de esta sesión. La `.6` descrita en documentos antiguos no
representa una instalación activa verificada hoy.

Los laboratorios E2E y backend quedaron detenidos. El MariaDB propio del
backend se cerró limpiamente: PID 12988 ausente y puerto 18517 sin listener;
la evidencia se conserva en `artifacts/qa-20261024-backend/lab-shutdown.json`.
No se detuvieron servicios del usuario ni se eliminó la evidencia.

La reconstrucción final y el recibo del kit están cerrados. MariaDB,
concurrencia, restauración y análisis estático se documentan arriba.
El flujo financiero real aprobó efectivo/transferencia, impuestos, EPO,
reimpresión, anulación, reportes, respaldo descargable y cierre. Las pruebas
reforzadas y su procedencia sobre el build final se detallan arriba.
Windows limpio, reinicio de Windows, impresoras físicas y otro puesto LAN
requieren verificaciones de entorno separadas; no se certifican con unit tests.
