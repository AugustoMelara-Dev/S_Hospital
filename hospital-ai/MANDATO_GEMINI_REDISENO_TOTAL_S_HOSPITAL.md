# MANDATO_GEMINI_REDISENO_TOTAL_S_HOSPITAL.md

S_HOSPITAL — RECONSTRUCCIÓN VISUAL TOTAL CON GEMINI 3.8 FLASH
Destino: sesión nueva del agente de desarrollo con acceso a las fuentes actuales de S_Hospital.
Modelo solicitado: Gemini 3.8 Flash, seleccionado por el usuario en su entorno. Comprueba la selección efectiva y utiliza su proveedor actual. El código de modelo publicado por Google es gemini-3.8-flash; no inventes el prefijo que necesita la integración ni cambies credenciales. No heredes un override antiguo de DeepSeek.
Encargo principal: diseñar de nuevo, implementar e integrar TODAS las vistas y documentos del Sistema de Caja del Hospital General San Isidro, utilizando realmente better-ui y emil-design-eng.
Base de esta adaptación: el archivo “S_HOSPITAL — EJECUCIÓN INTEGRAL CON SUBAGENTES REALES” y las instrucciones posteriores del propietario. Se conserva su método de implementación por lotes, pero se reemplazan el modelo, las restricciones visuales obsoletas y el orden de prioridades.

## 1. Misión: una aplicación nueva en su experiencia, no otro informe
Actúa como director de producto, diseñador de interfaces e ingeniero responsable de la integración. Coordina especialistas reales cuando el entorno lo permita. Tu entrega principal es el software renderizado y funcionando, no el plan, la auditoría, los tokens CSS ni una tabla de pruebas.
El propietario ha rechazado la apariencia de versiones anteriores. Debes reemplazar su composición y lenguaje visual en todas las superficies: acceso, navegación, Resumen, Cobrar, confirmaciones, resultados, Recibos, Caja, Reportes, Administración, ajustes y documentos exportados.
No es suficiente cambiar colores, reducir padding, renombrar componentes, añadir una sidebar, sustituir iconos o reparar recortes. Diseña nuevas jerarquías, agrupaciones, áreas de trabajo, formularios, tablas y relaciones entre información y acciones. Una vista no queda exenta del rediseño porque compile o tenga pruebas aprobadas.
Tienes autorización para sustituir componentes, layouts, estilos, hooks, estado y módulos completos. Puedes refactorizar contratos y backend cuando la nueva experiencia lo requiera, manteniendo sus garantías. Integra el reemplazo y retira la implementación activa sustituida: no dejes dos productos permanentes ni una capa de CSS peleando contra otra.
Reconstruir la interfaz no significa borrar los datos. Conserva operaciones, importes históricos, permisos, auditoría, idempotencia, correlativos y la posibilidad de recuperar el trabajo previo. Las reglas visuales antiguas no son una obligación de conservación.
Este es exclusivamente un sistema de caja hospitalaria. No construyas un CRM, una historia clínica, un ERP, un SaaS multiempresa ni una plataforma de IA. Los ejemplos del CRM son referencia de calidad, no de alcance funcional.

## 2. Contexto que debes obtener al iniciar
Identifica la raíz real, el proceso que sirve la aplicación, el modelo seleccionado, los scripts, el gestor de paquetes canónico y las instrucciones aplicables. Las rutas conocidas son C:\Projects\S_Hospital_AI y C:\Projects\S_Hospital; comprueba cuál contiene los cambios más recientes. El HEAD histórico baa41f97… no identifica el contenido completo de un árbol modificado.
Lee el estado actual y los contratos relevantes, no toda la historia de campañas por obligación. Las cifras y aprobaciones anteriores son antecedentes; no las presentes como resultados propios. No reabras defectos ya resueltos únicamente porque un documento viejo los enumera.
Inventaría las rutas y subrutas reales, diálogos, formularios y estados. Usa una matriz breve:
Superficie | tarea del usuario | rol | ruta/componente | datos/API | diseño nuevo | implementación | revisión visual.
Abre la aplicación y registra las vistas actuales como ANTES, incluyendo datos llenos y no solamente estados vacíos. Las capturas rechazadas sirven para entender qué sustituir. Si están disponibles referencias visuales del CRM que el usuario aprobó, estúdialas; si no están, no inventes haberlo visto ni prometas reproducirlo exactamente.
El stack histórico incluye React/TypeScript, Laravel, MariaDB, Dompdf y PhpSpreadsheet. Verifica versiones y ubicación reales. Puedes reescribir su implementación sin migrar todo a otro framework para demostrar actividad.

## 3. Reglas del hospital y simplicidad del producto
### Paciente y operación
El único dato personal obligatorio es Nombre del paciente. No añadas identificación, expediente, diagnóstico, teléfono, seguro ni un registro previo de pacientes. Cajero, caja, fechas y números proceden de la sesión y del servidor.
Mantén las secciones principales Resumen, Cobrar, Recibos, Caja y Reportes. Administración reúne catálogo, usuarios, ajustes, impresión y mantenimiento. El cajero puede entrar directamente en Cobrar; el administrador puede comenzar en Resumen.
Ayuda debe ser contextual y breve. No necesitas una gran sección de soporte o una pantalla de bienvenida ornamental. Simplifica la exposición de respaldos y mantenimiento, pero no elimines sus funciones de protección. Conserva acceso autorizado a auditoría sin duplicar menús.

### Medicamento con receta de diálisis
Localiza la regla real de Eritropoyetina/EPO y su código de elegibilidad. La condición puede conservarse en la raíz del request si ese es el contrato; su efecto monetario se aplica únicamente a la línea elegible y con autorización validada por el servidor.
No vuelvas gratuito el resto de la cuenta. No hagas gratuito un servicio de diálisis separado por inferencia. No confundas gratuidad del producto con exención de impuesto. No sobreescribas el catálogo usando precios de un informe antiguo.
Ejemplos de aceptación con precios sintéticos y sin impuesto, exclusivamente para aislar la regla:
Cuenta | Condición válida | Total esperado
EPO de L 25 | No | L 25.00
EPO de L 25 | Sí, con permiso | L 0.00
EPO de L 25 + diez productos de L 100 | Sí, con permiso | L 1,000.00
EPO de L 25 + diez productos de L 100 | No | L 1,025.00

Una emisión sin cobro no se presenta como efectivo recibido ni crea un ingreso ficticio. Un error de valoración o un dato ausente tampoco se presenta como cero legítimo.

### Dinero y documentos
Calcula y valida dinero en el servidor con representación exacta. Separa importe interno, decimal de intercambio y texto localizado. No vuelvas a parsear cadenas de presentación como 1,025.00 para calcular.
Antes de confirmar, el usuario ve paciente, líneas, total y método aplicable. Prevén doble envío y conserva idempotencia. Un Enter desde búsqueda o cantidad no cobra accidentalmente; un botón enfocado mantiene su activación accesible.
Si el pago se registró y el PDF falló, recupera el comprobante sin cobrar de nuevo. Anulaciones, reversos y reimpresiones conservan autorización, motivo y trazabilidad conforme al contrato vigente.

## 4. Protección del entorno y autorización de herramientas
Trabaja en el checkout actual de desarrollo, no sobre producción. Conserva un snapshot recuperable de las fuentes modificadas y nuevas; el diff de Git por sí solo no incluye todo archivo no rastreado. Excluye secretos y datos reales de evidencias y paquetes.
No recrees el worktree por costumbre, no restaures archivos desde el HEAD antiguo para resolver un error y no uses git reset --hard, git clean ni reemplazos globales indiscriminados. No hagas commits, push, publicación, compras o cambios de producción sin autorización específica.
Está autorizada expresamente la automatización del navegador en el laboratorio local con datos sintéticos. La antigua prohibición general de Playwright/Puppeteer/E2E del prompt de septiembre queda superada para este encargo. No la reintroduzcas.
Comprueba y ajusta únicamente permisos de proyecto necesarios para lectura, edición, skills, delegación y QA local. No conviertas todo a allow, no edites políticas superiores de la plataforma ni rodees sus rechazos usando herramientas alternativas.
Antes de pruebas que escriban, identifica positivamente la base desechable, proceso, puerto y almacenamiento. localhost y un worktree separado no garantizan aislamiento. No resetees bases compartidas, volúmenes Docker/WSL ni instalaciones ajenas.
No envíes nombres de pacientes reales, claves o archivos privados a búsquedas externas. Mantén activos los límites de recursos; no eludas cuotas ni compres capacidad. Un bloqueo real de una comprobación no detiene las vistas independientes.

## 5. Instala y utiliza las dos skills
Las dos skills solicitadas son exactamente:
- better-ui, de jakubkrehel/skills.
- emil-design-eng, de emilkowalski/skills.

## 6. Dirección visual y equipo ejecutor
### 6.1 Una nueva dirección de arte
Diseña un panel administrativo contemporáneo, elegante y reconocible. Busca precisión y calma: tipografía sans legible, jerarquía clara, neutrales bien elegidos, un acento dominante, iconografía consistente, tablas proporcionadas y controles cómodos. Los montos usan cifras tabulares y no parten el símbolo de moneda del número.
No tienes obligación de conservar la paleta, shell o tokens actuales. Un acento azul puede ser válido, pero el cambio no se demuestra por usar cobalto. Tampoco se demuestra cambiando el acento otra vez. La diferencia debe estar en el diseño de la aplicación y su uso.
Estudia brevemente referencias reales de buenas aplicaciones administrativas. Distingue dashboards de páginas de marketing. Explica la dirección elegida en una nota corta y materialízala temprano. No dediques la sesión a una galería de inspiración o a un sistema de diseño desconectado.
Evita paneles editoriales gigantes, serif ornamental en acceso, glassmorphism en cobros, degradados gratuitos, tarjetas dentro de tarjetas, decenas de chips y párrafos técnicos. Las cards se permiten cuando agrupan una tarea real; no es obligatorio encerrar cada sección.
Crea componentes compartidos para navegación, encabezados, campos, botones, tablas, diálogos, estados y resultados. Misma identidad no significa la misma composición para todas las páginas: Cobrar es una estación de trabajo; Recibos es búsqueda/lista/detalle; Reportes es análisis; Administración es configuración.
Elimina del copy visible instrucciones como “el servidor resuelve”, “snapshot”, “misma fuente PDF/Excel” o explicaciones de la implementación. La pantalla debe hablarle al cajero, no al desarrollador.

### 6.2 Doce especialidades, con varios agentes escribiendo vistas
Especialidades requeridas:
1. Dirección de diseño
2. Shell y acceso
3. Resumen
4. Cobrar
5. Recibos
6. Caja
7. Reportes
8. Administración
9. Documentos
10. Backend e integridad
11. QA visual e integración
12. Revisión independiente

## 7. Lotes de implementación completos — el diseño va primero
- Lote A: Identidad, acceso y navegación
- Lote B: Resumen y estación de Cobrar
- Lote C: Recibos, detalle y resultado de la operación
- Lote D: Caja y Administración
- Lote E: Reportes en pantalla, PDF y Excel
- Lote F: Comprobante para impresora convencional
- Lote G: Integración, responsive y revisión visual independiente
- Lote H: Validación final, continuidad local y entrega

## 8. Criterios de entrega y comprobación
1. Galería actual de TODAS las familias de vistas rediseñadas, desktop/móvil y estados relevantes.
2. Comprobantes reales descargados de operaciones de laboratorio, PDF de reportes y Excel abierto/revisado.
3. Matriz de cobertura completa.
4. Resumen de código sustituido o retirado, pruebas ejecutadas, omisiones y hallazgos resueltos.
5. Comando real de arranque, identidad del árbol y artefacto actual, snapshot recuperable sin secretos.
