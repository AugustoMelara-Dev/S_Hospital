# PROMPT 00 - MODO PLAN MAESTRO PARA CODEX

ActÃƒÂºa como arquitecto senior y tech lead del proyecto **S_Hospital Offline**.

## Contexto obligatorio
Sistema hospitalario local para facturaciÃƒÂ³n y caja. Debe funcionar sin internet en producciÃƒÂ³n, con una computadora servidor en red local y varias computadoras cliente accediendo por navegador. Stack: React + TypeScript + Laravel API + MySQL/MariaDB.

## Tu tarea
Antes de codificar, redacta un plan de implementaciÃƒÂ³n por fases. No escribas cÃƒÂ³digo todavÃƒÂ­a.

## Documentos que debes leer primero
- AGENTS.md
- docs/IMPLEMENTATION_PLAN.md
- docs/DECISIONS.md
- SYSTEM_REQUIREMENTS.md
- database/database_schema_critico.sql
- references/software_architecture.md
- references/database_integrity_mysql.md
- references/offline_lan_deployment.md
- references/security_privacy_hospital_billing.md
- docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md

## Salida obligatoria
Entrega un plan con esta estructura:

1. **Resumen ejecutivo**
2. **Suposiciones explÃƒÂ­citas**
3. **Preguntas bloqueantes** si existen; si no bloquean, continua con supuestos seguros
4. **Arquitectura propuesta**
5. **Modelo de datos y migraciones**
6. **MÃƒÂ³dulos y fases**
7. **Plan de TDD/pruebas por fase**
8. **Plan de commits**
9. **Riesgos tÃƒÂ©cnicos y mitigaciones**
10. **Criterios de aceptaciÃƒÂ³n por fase**
11. **Comandos de verificaciÃƒÂ³n**
12. **Lista de archivos esperados por fase**

## Reglas de calidad
- No propongas Supabase cloud, Firebase ni SQLite multiusuario.
- No supongas internet disponible en producciÃƒÂ³n.
- No metas expediente clÃƒÂ­nico completo; solo nombre del paciente.
- No recalcules facturas histÃƒÂ³ricas desde precios actuales.
- No avances si el diseÃƒÂ±o permite duplicar nÃƒÂºmeros de factura.
- No avances si caja/pagos/anulaciÃƒÂ³n no tienen auditorÃƒÂ­a.
- No avances si el recibo parece un comprobante informal o expone QR, barcode, codigos internos o datos tecnicos; debe existir recibo institucional imprimible en media carta, carta, A5, 80mm y 58mm.

## Estilo del plan
Debe ser implementable por Codex fase por fase. Cada fase debe ser pequeÃƒÂ±a, revisable y commiteable.

---

## MODO HOSPITAL OFFLINE / ON-PREMISE

Este sistema S_Hospital funcionarÃƒÂ¡ offline, en ambiente local, red interna, computadora servidor local o infraestructura del hospital sin depender de internet. Por eso debes evaluar frentes adicionales propios de sistemas offline/on-premise.

No trates el sistema como SaaS, nube o aplicaciÃƒÂ³n dependiente de internet. Asume que puede ejecutarse en:
- Un servidor local.
- Una PC principal.
- Una red LAN interna.
- Varias estaciones conectadas localmente.
- Un ambiente con internet limitado o inexistente.
- Un hospital con apagones, impresoras locales, usuarios no tÃƒÂ©cnicos y riesgo de virus por USB.

Debes crear subagentes adicionales especializados en operaciÃƒÂ³n offline.

### SUBAGENTES EXTRA OBLIGATORIOS PARA MODO OFFLINE

#### 16. Subagente de Infraestructura Local y Hardware
**Goal propio:**
Garantizar que S_Hospital pueda operar correctamente en una mÃƒÂ¡quina local o servidor local del hospital.

**Responsabilidades:**
- Definir requisitos mÃƒÂ­nimos de hardware.
- Verificar compatibilidad con Windows/Linux si aplica.
- Revisar consumo de CPU, RAM y disco.
- Revisar almacenamiento local.
- Revisar instalaciÃƒÂ³n en una sola PC o servidor LAN.
- Revisar dependencia de servicios externos.
- Identificar quÃƒÂ© pasa si la mÃƒÂ¡quina principal falla.

**Checklist:**
- Requisitos mÃƒÂ­nimos documentados.
- Requisitos recomendados documentados.
- Espacio en disco estimado.
- Ruta de instalaciÃƒÂ³n definida.
- Ruta de base de datos definida.
- Ruta de backups definida.
- Procedimiento de reinstalaciÃƒÂ³n definido.
- Procedimiento de migraciÃƒÂ³n a otra mÃƒÂ¡quina definido.

**Criterio de listo:**
El sistema puede instalarse, ejecutarse, respaldarse y moverse a otra mÃƒÂ¡quina sin depender de internet ni intervenciÃƒÂ³n avanzada.

#### 17. Subagente de Red Local / LAN
**Goal propio:**
Asegurar que el sistema funcione correctamente en red interna si varios usuarios lo usan desde diferentes computadoras.

**Responsabilidades:**
- Definir si el sistema corre en localhost o LAN.
- Definir IP/puerto del servidor local.
- Revisar firewall local.
- Revisar acceso desde estaciones.
- Revisar permisos por usuario.
- Revisar quÃƒÂ© pasa si se cae la red.
- Revisar conflictos de IP.
- Documentar configuraciÃƒÂ³n LAN.

**Checklist:**
- IP local fija o nombre de host definido.
- Puerto documentado.
- Firewall configurado.
- Acceso desde otras PCs probado.
- RestricciÃƒÂ³n para que no quede expuesto fuera de la red.
- Manual de conexiÃƒÂ³n de estaciones.
- Prueba de desconexiÃƒÂ³n de red.
- Prueba con varios usuarios simultÃƒÂ¡neos.

**Criterio de listo:**
El sistema puede operar en red local de forma controlada, sin exponer datos fuera del hospital.

#### 18. Subagente de Continuidad Operativa Offline
**Goal propio:**
Garantizar que el hospital pueda seguir operando ante apagones, fallos de red, fallos de equipo, errores humanos o caÃƒÂ­da del sistema.

**Responsabilidades:**
- Crear plan de contingencia.
- Definir modo manual temporal.
- Definir recuperaciÃƒÂ³n posterior.
- Definir quÃƒÂ© formularios fÃƒÂ­sicos se usan si el sistema cae.
- Definir cÃƒÂ³mo reingresar datos despuÃƒÂ©s.
- Definir responsables.
- Definir tiempos mÃƒÂ¡ximos aceptables de caÃƒÂ­da.
- Definir procedimiento de emergencia.

**Checklist:**
- Plan de contingencia documentado.
- Procedimiento si se apaga el servidor.
- Procedimiento si se daÃƒÂ±a la base de datos.
- Procedimiento si falla una estaciÃƒÂ³n.
- Procedimiento si falla la impresora.
- Procedimiento de captura manual temporal.
- Procedimiento de reingreso de datos.
- Responsable de recuperaciÃƒÂ³n asignado.

**Criterio de listo:**
Una caÃƒÂ­da del sistema no paraliza completamente al hospital porque existe procedimiento manual y recuperaciÃƒÂ³n definida.

#### 19. Subagente de Backups, RestauraciÃƒÂ³n y RecuperaciÃƒÂ³n
**Goal propio:**
Evitar pÃƒÂ©rdida irreversible de datos hospitalarios.

**Responsabilidades:**
- Definir polÃƒÂ­tica de backups.
- Crear backup automÃƒÂ¡tico local.
- Crear backup externo/offline.
- Verificar restauraciÃƒÂ³n.
- Definir frecuencia de respaldo.
- Definir retenciÃƒÂ³n.
- Definir cifrado de respaldos.
- Definir almacenamiento seguro.
- Probar recuperaciÃƒÂ³n en otra mÃƒÂ¡quina.

**Checklist:**
- Backup automÃƒÂ¡tico diario.
- Backup manual disponible.
- Backup antes de actualizaciones.
- Backup externo en USB/disco seguro.
- Backup cifrado si contiene datos reales.
- Prueba de restauraciÃƒÂ³n documentada.
- Carpeta de backups protegida.
- RetenciÃƒÂ³n definida: diario/semanal/mensual.
- Evidencia de ÃƒÂºltimo backup.
- Alerta o mensaje si el backup falla.

**Criterio de listo:**
No basta con generar backup. Debe existir prueba real de restauraciÃƒÂ³n exitosa.

#### 20. Subagente de Seguridad FÃƒÂ­sica
**Goal propio:**
Proteger el sistema aunque estÃƒÂ© offline, porque offline no significa seguro.

**Responsabilidades:**
- Revisar acceso fÃƒÂ­sico al servidor.
- Revisar bloqueo de sesiÃƒÂ³n.
- Revisar usuarios compartidos.
- Revisar contraseÃƒÂ±a de administrador.
- Revisar exposiciÃƒÂ³n de base de datos.
- Revisar USBs.
- Revisar impresiones abandonadas.
- Revisar PCs pÃƒÂºblicas.
- Revisar robo o daÃƒÂ±o de equipo.

**Checklist:**
- PC/servidor en lugar restringido.
- Usuario administrador no compartido.
- Pantalla se bloquea por inactividad.
- ContraseÃƒÂ±as individuales.
- Base de datos no visible para usuarios comunes.
- Backups no quedan abiertos en escritorio.
- USBs controlados.
- Impresiones con datos sensibles controladas.
- Manual de seguridad fÃƒÂ­sica incluido.

**Criterio de listo:**
Un usuario comÃƒÂºn no puede copiar, borrar, abrir o manipular la base de datos directamente.

#### 21. Subagente de Seguridad de Endpoints
**Goal propio:**
Reducir riesgos por virus, malware, ransomware, USBs y equipos contaminados.

**Responsabilidades:**
- Revisar antivirus/antimalware.
- Revisar polÃƒÂ­tica de USB.
- Revisar permisos de carpetas.
- Revisar ejecuciÃƒÂ³n de archivos externos.
- Revisar actualizaciones offline.
- Revisar instalaciÃƒÂ³n en PCs no confiables.
- Revisar protecciÃƒÂ³n contra borrado accidental.

**Checklist:**
- Antivirus activo recomendado.
- Usuario del sistema sin permisos de administrador del sistema operativo.
- Carpeta de aplicaciÃƒÂ³n protegida.
- Carpeta de base de datos protegida.
- Backups protegidos.
- ProhibiciÃƒÂ³n de instalar software desconocido.
- PolÃƒÂ­tica de USB definida.
- Procedimiento de revisiÃƒÂ³n de equipo antes de instalar.

**Criterio de listo:**
El sistema no depende de que todos los usuarios tengan acceso administrativo a la PC.

#### 22. Subagente de Instalador y Paquete Offline
**Goal propio:**
Preparar el sistema para instalarse sin internet.

**Responsabilidades:**
- Crear paquete completo.
- Incluir dependencias.
- Incluir instalador o guÃƒÂ­a paso a paso.
- Incluir base de datos inicial.
- Incluir datos demo si aplica.
- Incluir scripts de migraciÃƒÂ³n.
- Incluir guÃƒÂ­a de reinstalaciÃƒÂ³n.
- Incluir guÃƒÂ­a de actualizaciÃƒÂ³n.

**Checklist:**
- Carpeta final de entrega.
- Instalador o comandos claros.
- Dependencias incluidas o documentadas.
- Variables de entorno ejemplo.
- Base de datos inicial.
- Script de seed/demo.
- Script de backup.
- Script de restore.
- Manual de instalaciÃƒÂ³n offline.
- Manual de actualizaciÃƒÂ³n offline.
- Manual de desinstalaciÃƒÂ³n segura.

**Criterio de listo:**
Una persona tÃƒÂ©cnica puede instalar el sistema desde USB o carpeta local sin descargar dependencias crÃƒÂ­ticas de internet.

#### 23. Subagente de Actualizaciones Offline
**Goal propio:**
Permitir corregir errores y actualizar el sistema sin romper datos existentes.

**Responsabilidades:**
- Definir versiÃƒÂ³n del sistema.
- Definir procedimiento de actualizaciÃƒÂ³n.
- Ejecutar backup antes de actualizar.
- Ejecutar migraciones.
- Permitir rollback.
- Documentar cambios.
- Evitar sobrescribir base de datos real.

**Checklist:**
- NÃƒÂºmero de versiÃƒÂ³n visible.
- Changelog.
- Backup obligatorio antes de update.
- Migraciones controladas.
- Script de rollback o restauraciÃƒÂ³n.
- Prueba de actualizaciÃƒÂ³n con datos existentes.
- No borrar datos en update.
- ValidaciÃƒÂ³n posterior al update.

**Criterio de listo:**
Se puede actualizar el sistema sin perder facturas, pagos, recibos, historiales ni usuarios.

#### 24. Subagente de ImpresiÃƒÂ³n y Documentos Locales
**Goal propio:**
Asegurar que recetas, reportes, constancias, facturas o documentos hospitalarios se puedan imprimir o exportar correctamente.

**Responsabilidades:**
- Revisar plantillas imprimibles.
- Revisar formato carta/A4.
- Revisar encabezado del hospital.
- Revisar datos del paciente.
- Revisar numeraciÃƒÂ³n.
- Revisar fecha y hora.
- Revisar exportaciÃƒÂ³n PDF si aplica.
- Revisar impresiÃƒÂ³n sin internet.

**Checklist:**
- Recetas imprimibles.
- Reportes imprimibles.
- Comprobantes imprimibles si aplica.
- Vista previa antes de imprimir.
- Formato limpio.
- Datos sensibles mÃƒÂ­nimos necesarios.
- Pie de pÃƒÂ¡gina o identificaciÃƒÂ³n del sistema.
- Prueba con impresora local.
- Prueba sin impresora disponible.

**Criterio de listo:**
Los documentos crÃƒÂ­ticos se generan y se pueden imprimir sin depender de servicios externos.

#### 25. Subagente de Fecha, Hora y Trazabilidad
**Goal propio:**
Evitar errores graves por fecha/hora incorrecta en un sistema offline.

**Responsabilidades:**
- Revisar hora local del servidor.
- Revisar zona horaria.
- Revisar timestamps.
- Revisar auditorÃƒÂ­a.
- Revisar registros clÃƒÂ­nicos con fecha/hora.
- Revisar cambios manuales de reloj.
- Definir responsable de hora oficial.

**Checklist:**
- Zona horaria configurada.
- Fecha/hora visible en sistema.
- Logs con timestamp.
- AuditorÃƒÂ­a con usuario, acciÃƒÂ³n, fecha y hora.
- Advertencia si la fecha del sistema parece incorrecta.
- Procedimiento para corregir fecha/hora.
- No permitir alterar registros crÃƒÂ­ticos sin auditorÃƒÂ­a.

**Criterio de listo:**
Cada acciÃƒÂ³n importante queda registrada con usuario, fecha y hora confiables.

#### 26. Subagente de AuditorÃƒÂ­a Local
**Goal propio:**
Registrar acciones importantes sin depender de servicios externos.

**Responsabilidades:**
- Registrar inicios de sesiÃƒÂ³n.
- Registrar creaciÃƒÂ³n/ediciÃƒÂ³n/eliminaciÃƒÂ³n de pacientes.
- Registrar acceso a historial clÃƒÂ­nico.
- Registrar cambios de roles.
- Registrar cambios crÃƒÂ­ticos.
- Registrar errores.
- Proteger logs.
- Permitir revisiÃƒÂ³n por administrador/auditor.

**Checklist:**
- Tabla de auditorÃƒÂ­a.
- Usuario responsable.
- AcciÃƒÂ³n realizada.
- Entidad afectada.
- Fecha/hora.
- IP/localizaciÃƒÂ³n si aplica.
- Antes/despuÃƒÂ©s para cambios crÃƒÂ­ticos si aplica.
- ProtecciÃƒÂ³n contra borrado fÃƒÂ¡cil.
- Pantalla o reporte de auditorÃƒÂ­a.

**Criterio de listo:**
Se puede responder quiÃƒÂ©n hizo quÃƒÂ©, cuÃƒÂ¡ndo y sobre quÃƒÂ© registro.

#### 27. Subagente de MigraciÃƒÂ³n, ExportaciÃƒÂ³n e ImportaciÃƒÂ³n
**Goal propio:**
Evitar encierro de datos y permitir rescatar informaciÃƒÂ³n si el sistema cambia.

**Responsabilidades:**
- Exportar datos importantes.
- Importar datos demo o iniciales.
- Exportar reportes.
- Exportar backups.
- Definir formato CSV/Excel/PDF/SQL segÃƒÂºn aplique.
- Evitar exportaciones no autorizadas.

**Checklist:**
- ExportaciÃƒÂ³n de pacientes.
- Exportacion de facturas, pagos, recibos y reportes.
- ExportaciÃƒÂ³n de reportes.
- Backup SQL o equivalente.
- ExportaciÃƒÂ³n protegida por rol.
- Registro de auditorÃƒÂ­a al exportar.
- Manual de migraciÃƒÂ³n.
- Prueba de importaciÃƒÂ³n/restauraciÃƒÂ³n.

**Criterio de listo:**
Los datos no quedan atrapados en una instalaciÃƒÂ³n imposible de recuperar.

#### 28. Subagente de Mantenimiento Local
**Goal propio:**
Definir cÃƒÂ³mo mantener el sistema despuÃƒÂ©s de entregarlo.

**Responsabilidades:**
- Crear rutina diaria.
- Crear rutina semanal.
- Crear rutina mensual.
- Crear revisiÃƒÂ³n de backups.
- Crear revisiÃƒÂ³n de espacio en disco.
- Crear revisiÃƒÂ³n de usuarios.
- Crear revisiÃƒÂ³n de errores.
- Crear procedimiento de soporte.

**Checklist:**
- Checklist diario.
- Checklist semanal.
- Checklist mensual.
- Responsable asignado.
- RevisiÃƒÂ³n de backups.
- RevisiÃƒÂ³n de disco.
- RevisiÃƒÂ³n de usuarios activos.
- RevisiÃƒÂ³n de logs.
- Procedimiento de reporte de errores.
- Procedimiento para soporte tÃƒÂ©cnico.

**Criterio de listo:**
El hospital sabe quÃƒÂ© hacer despuÃƒÂ©s de la entrega, no solo el dÃƒÂ­a de la instalaciÃƒÂ³n.

#### 29. Subagente de CapacitaciÃƒÂ³n y AceptaciÃƒÂ³n
**Goal propio:**
Preparar al personal para usar el sistema sin depender del desarrollador todo el tiempo.

**Responsabilidades:**
- Crear guÃƒÂ­a rÃƒÂ¡pida por rol.
- Crear usuarios demo.
- Crear flujo de capacitaciÃƒÂ³n.
- Crear prueba de aceptaciÃƒÂ³n.
- Crear acta de entrega tÃƒÂ©cnica.
- Crear acta de capacitaciÃƒÂ³n.
- Crear lista de pendientes.

**Checklist:**
- GuÃƒÂ­a para administrador.
- GuÃƒÂ­a para recepciÃƒÂ³n.
- GuÃƒÂ­a para mÃƒÂ©dico.
- Guia para caja, supervision y administracion.
- GuÃƒÂ­a para farmacia/lab/facturaciÃƒÂ³n si aplica.
- Usuarios demo.
- Ejercicios de prÃƒÂ¡ctica.
- Acta de capacitaciÃƒÂ³n.
- Acta de entrega.
- Lista de pendientes firmable.

**Criterio de listo:**
El usuario final puede ejecutar los flujos principales sin que el desarrollador estÃƒÂ© explicando cada clic.

#### 30. Subagente de Escenario Sin Internet
**Goal propio:**
Verificar que nada crÃƒÂ­tico falle por no tener conexiÃƒÂ³n.

**Responsabilidades:**
- Revisar librerÃƒÂ­as externas.
- Revisar CDNs.
- Revisar fuentes externas.
- Revisar mapas, correos, SMS, WhatsApp, APIs.
- Revisar licencias.
- Revisar validaciones que dependan de internet.
- Revisar login offline.
- Revisar impresiÃƒÂ³n offline.
- Revisar reportes offline.

**Checklist:**
- Sin CDN obligatorio.
- Sin fuentes remotas obligatorias.
- Sin APIs externas obligatorias para flujos crÃƒÂ­ticos.
- Login funciona offline.
- Dashboard funciona offline.
- Pacientes funciona offline.
- Citas funciona offline.
- Historial funciona offline.
- Reportes bÃƒÂ¡sicos funcionan offline.
- ImpresiÃƒÂ³n/exportaciÃƒÂ³n funciona offline.
- Mensajes claros para funciones no disponibles sin internet.

**Criterio de listo:**
El sistema cumple sus funciones principales aun con internet completamente desconectado.

### REGLAS ESPECIALES PARA S_Hospital OFFLINE

1. **Offline no significa inseguro**
Debes tratar el sistema como crÃƒÂ­tico aunque no tenga internet. Los riesgos vienen de usuarios internos, USBs, daÃƒÂ±o fÃƒÂ­sico, malware local, robo de equipo, backups mal guardados, permisos incorrectos y errores humanos.

2. **Backup probado o no cuenta**
No declares "backup listo" si no se probÃƒÂ³ restauraciÃƒÂ³n. Un backup que no se puede restaurar no sirve.

3. **Debe existir plan de caÃƒÂ­da**
Si el sistema falla, debe existir procedimiento manual temporal y recuperaciÃƒÂ³n posterior.

4. **No depender de internet**
NingÃƒÂºn flujo crÃƒÂ­tico debe depender de CDN, API externa, licencia online, fuente remota, mapa online, correo, WhatsApp o servicio cloud.

5. **Actualizaciones con respaldo**
Cada actualizaciÃƒÂ³n debe exigir backup previo y tener plan de rollback.

6. **Proteger base de datos local**
La base de datos no debe quedar como archivo abierto en escritorio o carpeta pÃƒÂºblica. Debe tener permisos restringidos.

7. **Usuarios individuales**
Evitar usuario compartido tipo "recepcion" para todo el mundo si el sistema maneja datos sensibles. Si hay usuarios por rol, cada persona debe tener cuenta propia cuando sea posible.

8. **AuditorÃƒÂ­a obligatoria**
Toda acciÃƒÂ³n crÃƒÂ­tica debe registrar usuario, fecha, hora y acciÃƒÂ³n.

9. **ImpresiÃƒÂ³n controlada**
Los documentos impresos pueden exponer informaciÃƒÂ³n sensible. Debe haber control sobre recetas, reportes, historiales y facturas.

10. **Entrega defendible**
El sistema puede entregarse tÃƒÂ©cnicamente sin validaciÃƒÂ³n clÃƒÂ­nica definitiva, pero debe quedar claro:
- Listo para entrega tÃƒÂ©cnica.
- Listo para demo/UAT.
- Listo para despliegue controlado.
- Pendiente de validaciÃƒÂ³n operativa con usuarios reales antes de uso clÃƒÂ­nico definitivo, si aplica.

### CHECKLIST FINAL ESPECIAL OFFLINE

Antes de declarar listo S_Hospital offline, verificar:

**INFRAESTRUCTURA**
- Corre en mÃƒÂ¡quina local.
- Corre sin internet.
- Requisitos mÃƒÂ­nimos documentados.
- InstalaciÃƒÂ³n reproducible.
- Ruta de datos definida.
- Ruta de backups definida.
- Espacio en disco suficiente.

**RED LOCAL**
- Funciona en localhost o LAN segÃƒÂºn alcance.
- IP/puerto definidos.
- Firewall configurado.
- No estÃƒÂ¡ expuesto innecesariamente fuera de la red.
- Varias estaciones pueden acceder si aplica.

**BASE DE DATOS**
- Base protegida.
- Migraciones listas.
- Datos demo disponibles.
- No hay datos reales de prueba.
- Integridad referencial.
- AuditorÃƒÂ­a.
- Backup y restore probados.

**SEGURIDAD**
- Login obligatorio.
- Roles funcionando.
- ContraseÃƒÂ±as seguras.
- Sesiones protegidas.
- Permisos por mÃƒÂ³dulo.
- Sin credenciales hardcodeadas.
- Sin datos sensibles en logs innecesarios.
- Bloqueo por inactividad si aplica.

**OPERACIÃƒâ€œN OFFLINE**
- No depende de CDN.
- No depende de APIs externas.
- No depende de internet para login.
- No depende de internet para reportes.
- No depende de internet para impresiÃƒÂ³n.
- Funciones externas marcadas como no disponibles o futuras.

**BACKUP Y RECUPERACIÃƒâ€œN**
- Backup automÃƒÂ¡tico.
- Backup manual.
- Backup externo/offline.
- Backup cifrado si contiene datos reales.
- Restore probado.
- Procedimiento de recuperaciÃƒÂ³n documentado.
- Responsable asignado.

**CONTINUIDAD**
- Procedimiento ante apagÃƒÂ³n.
- Procedimiento ante fallo de servidor.
- Procedimiento ante fallo de red.
- Procedimiento ante fallo de impresora.
- Modo manual temporal.
- Reingreso de datos posterior.

**IMPRESIÃƒâ€œN**
- Recetas imprimibles.
- Reportes imprimibles.
- Facturas/comprobantes si aplica.
- Vista previa.
- Formato correcto.
- No se imprimen datos innecesarios.

**MANTENIMIENTO**
- Checklist diario.
- Checklist semanal.
- Checklist mensual.
- RevisiÃƒÂ³n de backups.
- RevisiÃƒÂ³n de disco.
- RevisiÃƒÂ³n de usuarios.
- RevisiÃƒÂ³n de logs.
- Procedimiento de soporte.

**ENTREGA**
- README.
- Manual de instalaciÃƒÂ³n offline.
- Manual de usuario.
- Manual por rol.
- GuÃƒÂ­a de backup/restore.
- GuÃƒÂ­a de actualizaciÃƒÂ³n.
- GuÃƒÂ­a de contingencia.
- Guion de demo.
- Acta de entrega tÃƒÂ©cnica.
- Lista de pendientes.
- Dictamen final.

### DICTAMEN PARA SISTEMA OFFLINE
Al final, entrega uno de estos estados:

1. Listo para demo offline.
2. Listo para entrega tÃƒÂ©cnica offline.
3. Listo para despliegue local controlado.
4. No listo por riesgo crÃƒÂ­tico de datos, seguridad, instalaciÃƒÂ³n o recuperaciÃƒÂ³n.

No declarar "listo para uso hospitalario definitivo" si no se probÃƒÂ³ operaciÃƒÂ³n real, backup/restore, roles, auditorÃƒÂ­a, continuidad e instalaciÃƒÂ³n local.
