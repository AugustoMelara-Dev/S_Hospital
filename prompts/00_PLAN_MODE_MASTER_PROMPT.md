# PROMPT 00 - MODO PLAN MAESTRO PARA CODEX

Actúa como arquitecto senior y tech lead del proyecto **S_Hospital Offline**.

## Contexto obligatorio
Sistema hospitalario local para facturación y caja. Debe funcionar sin internet en producción, con una computadora servidor en red local y varias computadoras cliente accediendo por navegador. Stack: React + TypeScript + Laravel API + MySQL/MariaDB.

## Tu tarea
Antes de codificar, redacta un plan de implementación por fases. No escribas código todavía.

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
2. **Suposiciones explícitas**
3. **Preguntas bloqueantes** si existen; si no bloquean, continua con supuestos seguros
4. **Arquitectura propuesta**
5. **Modelo de datos y migraciones**
6. **Módulos y fases**
7. **Plan de TDD/pruebas por fase**
8. **Plan de commits**
9. **Riesgos técnicos y mitigaciones**
10. **Criterios de aceptación por fase**
11. **Comandos de verificación**
12. **Lista de archivos esperados por fase**

## Reglas de calidad
- No propongas Supabase cloud, Firebase ni SQLite multiusuario.
- No supongas internet disponible en producción.
- No metas expediente clínico completo; solo nombre del paciente.
- No recalcules facturas históricas desde precios actuales.
- No avances si el diseño permite duplicar números de factura.
- No avances si caja/pagos/anulación no tienen auditoría.
- No avances si el recibo parece un comprobante informal o expone QR, barcode, codigos internos o datos tecnicos; debe existir recibo institucional imprimible en media carta, carta, A5, 80mm y 58mm.

## Estilo del plan
Debe ser implementable por Codex fase por fase. Cada fase debe ser pequeña, revisable y commiteable.

---

## MODO HOSPITAL OFFLINE / ON-PREMISE

Este sistema S_Hospital funcionará offline, en ambiente local, red interna, computadora servidor local o infraestructura del hospital sin depender de internet. Por eso debes evaluar frentes adicionales propios de sistemas offline/on-premise.

No trates el sistema como SaaS, nube o aplicación dependiente de internet. Asume que puede ejecutarse en:
- Un servidor local.
- Una PC principal.
- Una red LAN interna.
- Varias estaciones conectadas localmente.
- Un ambiente con internet limitado o inexistente.
- Un hospital con apagones, impresoras locales, usuarios no técnicos y riesgo de virus por USB.

Debes crear subagentes adicionales especializados en operación offline.

### SUBAGENTES EXTRA OBLIGATORIOS PARA MODO OFFLINE

#### 16. Subagente de Infraestructura Local y Hardware
**Goal propio:**
Garantizar que S_Hospital pueda operar correctamente en una máquina local o servidor local del hospital.

**Responsabilidades:**
- Definir requisitos mínimos de hardware.
- Verificar compatibilidad con Windows/Linux si aplica.
- Revisar consumo de CPU, RAM y disco.
- Revisar almacenamiento local.
- Revisar instalación en una sola PC o servidor LAN.
- Revisar dependencia de servicios externos.
- Identificar qué pasa si la máquina principal falla.

**Checklist:**
- Requisitos mínimos documentados.
- Requisitos recomendados documentados.
- Espacio en disco estimado.
- Ruta de instalación definida.
- Ruta de base de datos definida.
- Ruta de backups definida.
- Procedimiento de reinstalación definido.
- Procedimiento de migración a otra máquina definido.

**Criterio de listo:**
El sistema puede instalarse, ejecutarse, respaldarse y moverse a otra máquina sin depender de internet ni intervención avanzada.

#### 17. Subagente de Red Local / LAN
**Goal propio:**
Asegurar que el sistema funcione correctamente en red interna si varios usuarios lo usan desde diferentes computadoras.

**Responsabilidades:**
- Definir si el sistema corre en localhost o LAN.
- Definir IP/puerto del servidor local.
- Revisar firewall local.
- Revisar acceso desde estaciones.
- Revisar permisos por usuario.
- Revisar qué pasa si se cae la red.
- Revisar conflictos de IP.
- Documentar configuración LAN.

**Checklist:**
- IP local fija o nombre de host definido.
- Puerto documentado.
- Firewall configurado.
- Acceso desde otras PCs probado.
- Restricción para que no quede expuesto fuera de la red.
- Manual de conexión de estaciones.
- Prueba de desconexión de red.
- Prueba con varios usuarios simultáneos.

**Criterio de listo:**
El sistema puede operar en red local de forma controlada, sin exponer datos fuera del hospital.

#### 18. Subagente de Continuidad Operativa Offline
**Goal propio:**
Garantizar que el hospital pueda seguir operando ante apagones, fallos de red, fallos de equipo, errores humanos o caída del sistema.

**Responsabilidades:**
- Crear plan de contingencia.
- Definir modo manual temporal.
- Definir recuperación posterior.
- Definir qué formularios físicos se usan si el sistema cae.
- Definir cómo reingresar datos después.
- Definir responsables.
- Definir tiempos máximos aceptables de caída.
- Definir procedimiento de emergencia.

**Checklist:**
- Plan de contingencia documentado.
- Procedimiento si se apaga el servidor.
- Procedimiento si se daña la base de datos.
- Procedimiento si falla una estación.
- Procedimiento si falla la impresora.
- Procedimiento de captura manual temporal.
- Procedimiento de reingreso de datos.
- Responsable de recuperación asignado.

**Criterio de listo:**
Una caída del sistema no paraliza completamente al hospital porque existe procedimiento manual y recuperación definida.

#### 19. Subagente de Backups, Restauración y Recuperación
**Goal propio:**
Evitar pérdida irreversible de datos hospitalarios.

**Responsabilidades:**
- Definir política de backups.
- Crear backup automático local.
- Crear backup externo/offline.
- Verificar restauración.
- Definir frecuencia de respaldo.
- Definir retención.
- Definir cifrado de respaldos.
- Definir almacenamiento seguro.
- Probar recuperación en otra máquina.

**Checklist:**
- Backup automático diario.
- Backup manual disponible.
- Backup antes de actualizaciones.
- Backup externo en USB/disco seguro.
- Backup cifrado si contiene datos reales.
- Prueba de restauración documentada.
- Carpeta de backups protegida.
- Retención definida: diario/semanal/mensual.
- Evidencia de último backup.
- Alerta o mensaje si el backup falla.

**Criterio de listo:**
No basta con generar backup. Debe existir prueba real de restauración exitosa.

#### 20. Subagente de Seguridad Física
**Goal propio:**
Proteger el sistema aunque esté offline, porque offline no significa seguro.

**Responsabilidades:**
- Revisar acceso físico al servidor.
- Revisar bloqueo de sesión.
- Revisar usuarios compartidos.
- Revisar contraseña de administrador.
- Revisar exposición de base de datos.
- Revisar USBs.
- Revisar impresiones abandonadas.
- Revisar PCs públicas.
- Revisar robo o daño de equipo.

**Checklist:**
- PC/servidor en lugar restringido.
- Usuario administrador no compartido.
- Pantalla se bloquea por inactividad.
- Contraseñas individuales.
- Base de datos no visible para usuarios comunes.
- Backups no quedan abiertos en escritorio.
- USBs controlados.
- Impresiones con datos sensibles controladas.
- Manual de seguridad física incluido.

**Criterio de listo:**
Un usuario común no puede copiar, borrar, abrir o manipular la base de datos directamente.

#### 21. Subagente de Seguridad de Endpoints
**Goal propio:**
Reducir riesgos por virus, malware, ransomware, USBs y equipos contaminados.

**Responsabilidades:**
- Revisar antivirus/antimalware.
- Revisar política de USB.
- Revisar permisos de carpetas.
- Revisar ejecución de archivos externos.
- Revisar actualizaciones offline.
- Revisar instalación en PCs no confiables.
- Revisar protección contra borrado accidental.

**Checklist:**
- Antivirus activo recomendado.
- Usuario del sistema sin permisos de administrador del sistema operativo.
- Carpeta de aplicación protegida.
- Carpeta de base de datos protegida.
- Backups protegidos.
- Prohibición de instalar software desconocido.
- Política de USB definida.
- Procedimiento de revisión de equipo antes de instalar.

**Criterio de listo:**
El sistema no depende de que todos los usuarios tengan acceso administrativo a la PC.

#### 22. Subagente de Instalador y Paquete Offline
**Goal propio:**
Preparar el sistema para instalarse sin internet.

**Responsabilidades:**
- Crear paquete completo.
- Incluir dependencias.
- Incluir instalador o guía paso a paso.
- Incluir base de datos inicial.
- Incluir datos demo si aplica.
- Incluir scripts de migración.
- Incluir guía de reinstalación.
- Incluir guía de actualización.

**Checklist:**
- Carpeta final de entrega.
- Instalador o comandos claros.
- Dependencias incluidas o documentadas.
- Variables de entorno ejemplo.
- Base de datos inicial.
- Script de seed/demo.
- Script de backup.
- Script de restore.
- Manual de instalación offline.
- Manual de actualización offline.
- Manual de desinstalación segura.

**Criterio de listo:**
Una persona técnica puede instalar el sistema desde USB o carpeta local sin descargar dependencias críticas de internet.

#### 23. Subagente de Actualizaciones Offline
**Goal propio:**
Permitir corregir errores y actualizar el sistema sin romper datos existentes.

**Responsabilidades:**
- Definir versión del sistema.
- Definir procedimiento de actualización.
- Ejecutar backup antes de actualizar.
- Ejecutar migraciones.
- Permitir rollback.
- Documentar cambios.
- Evitar sobrescribir base de datos real.

**Checklist:**
- Número de versión visible.
- Changelog.
- Backup obligatorio antes de update.
- Migraciones controladas.
- Script de rollback o restauración.
- Prueba de actualización con datos existentes.
- No borrar datos en update.
- Validación posterior al update.

**Criterio de listo:**
Se puede actualizar el sistema sin perder pacientes, citas, historiales ni usuarios.

#### 24. Subagente de Impresión y Documentos Locales
**Goal propio:**
Asegurar que recetas, reportes, constancias, facturas o documentos hospitalarios se puedan imprimir o exportar correctamente.

**Responsabilidades:**
- Revisar plantillas imprimibles.
- Revisar formato carta/A4.
- Revisar encabezado del hospital.
- Revisar datos del paciente.
- Revisar numeración.
- Revisar fecha y hora.
- Revisar exportación PDF si aplica.
- Revisar impresión sin internet.

**Checklist:**
- Recetas imprimibles.
- Reportes imprimibles.
- Comprobantes imprimibles si aplica.
- Vista previa antes de imprimir.
- Formato limpio.
- Datos sensibles mínimos necesarios.
- Pie de página o identificación del sistema.
- Prueba con impresora local.
- Prueba sin impresora disponible.

**Criterio de listo:**
Los documentos críticos se generan y se pueden imprimir sin depender de servicios externos.

#### 25. Subagente de Fecha, Hora y Trazabilidad
**Goal propio:**
Evitar errores graves por fecha/hora incorrecta en un sistema offline.

**Responsabilidades:**
- Revisar hora local del servidor.
- Revisar zona horaria.
- Revisar timestamps.
- Revisar auditoría.
- Revisar registros clínicos con fecha/hora.
- Revisar cambios manuales de reloj.
- Definir responsable de hora oficial.

**Checklist:**
- Zona horaria configurada.
- Fecha/hora visible en sistema.
- Logs con timestamp.
- Auditoría con usuario, acción, fecha y hora.
- Advertencia si la fecha del sistema parece incorrecta.
- Procedimiento para corregir fecha/hora.
- No permitir alterar registros críticos sin auditoría.

**Criterio de listo:**
Cada acción importante queda registrada con usuario, fecha y hora confiables.

#### 26. Subagente de Auditoría Local
**Goal propio:**
Registrar acciones importantes sin depender de servicios externos.

**Responsabilidades:**
- Registrar inicios de sesión.
- Registrar creación/edición/eliminación de pacientes.
- Registrar acceso a historial clínico.
- Registrar cambios de roles.
- Registrar cambios críticos.
- Registrar errores.
- Proteger logs.
- Permitir revisión por administrador/auditor.

**Checklist:**
- Tabla de auditoría.
- Usuario responsable.
- Acción realizada.
- Entidad afectada.
- Fecha/hora.
- IP/localización si aplica.
- Antes/después para cambios críticos si aplica.
- Protección contra borrado fácil.
- Pantalla o reporte de auditoría.

**Criterio de listo:**
Se puede responder quién hizo qué, cuándo y sobre qué registro.

#### 27. Subagente de Migración, Exportación e Importación
**Goal propio:**
Evitar encierro de datos y permitir rescatar información si el sistema cambia.

**Responsabilidades:**
- Exportar datos importantes.
- Importar datos demo o iniciales.
- Exportar reportes.
- Exportar backups.
- Definir formato CSV/Excel/PDF/SQL según aplique.
- Evitar exportaciones no autorizadas.

**Checklist:**
- Exportación de pacientes.
- Exportación de citas.
- Exportación de reportes.
- Backup SQL o equivalente.
- Exportación protegida por rol.
- Registro de auditoría al exportar.
- Manual de migración.
- Prueba de importación/restauración.

**Criterio de listo:**
Los datos no quedan atrapados en una instalación imposible de recuperar.

#### 28. Subagente de Mantenimiento Local
**Goal propio:**
Definir cómo mantener el sistema después de entregarlo.

**Responsabilidades:**
- Crear rutina diaria.
- Crear rutina semanal.
- Crear rutina mensual.
- Crear revisión de backups.
- Crear revisión de espacio en disco.
- Crear revisión de usuarios.
- Crear revisión de errores.
- Crear procedimiento de soporte.

**Checklist:**
- Checklist diario.
- Checklist semanal.
- Checklist mensual.
- Responsable asignado.
- Revisión de backups.
- Revisión de disco.
- Revisión de usuarios activos.
- Revisión de logs.
- Procedimiento de reporte de errores.
- Procedimiento para soporte técnico.

**Criterio de listo:**
El hospital sabe qué hacer después de la entrega, no solo el día de la instalación.

#### 29. Subagente de Capacitación y Aceptación
**Goal propio:**
Preparar al personal para usar el sistema sin depender del desarrollador todo el tiempo.

**Responsabilidades:**
- Crear guía rápida por rol.
- Crear usuarios demo.
- Crear flujo de capacitación.
- Crear prueba de aceptación.
- Crear acta de entrega técnica.
- Crear acta de capacitación.
- Crear lista de pendientes.

**Checklist:**
- Guía para administrador.
- Guía para recepción.
- Guía para médico.
- Guía para enfermería.
- Guía para farmacia/lab/facturación si aplica.
- Usuarios demo.
- Ejercicios de práctica.
- Acta de capacitación.
- Acta de entrega.
- Lista de pendientes firmable.

**Criterio de listo:**
El usuario final puede ejecutar los flujos principales sin que el desarrollador esté explicando cada clic.

#### 30. Subagente de Escenario Sin Internet
**Goal propio:**
Verificar que nada crítico falle por no tener conexión.

**Responsabilidades:**
- Revisar librerías externas.
- Revisar CDNs.
- Revisar fuentes externas.
- Revisar mapas, correos, SMS, WhatsApp, APIs.
- Revisar licencias.
- Revisar validaciones que dependan de internet.
- Revisar login offline.
- Revisar impresión offline.
- Revisar reportes offline.

**Checklist:**
- Sin CDN obligatorio.
- Sin fuentes remotas obligatorias.
- Sin APIs externas obligatorias para flujos críticos.
- Login funciona offline.
- Dashboard funciona offline.
- Pacientes funciona offline.
- Citas funciona offline.
- Historial funciona offline.
- Reportes básicos funcionan offline.
- Impresión/exportación funciona offline.
- Mensajes claros para funciones no disponibles sin internet.

**Criterio de listo:**
El sistema cumple sus funciones principales aun con internet completamente desconectado.

### REGLAS ESPECIALES PARA S_Hospital OFFLINE

1. **Offline no significa inseguro**
Debes tratar el sistema como crítico aunque no tenga internet. Los riesgos vienen de usuarios internos, USBs, daño físico, malware local, robo de equipo, backups mal guardados, permisos incorrectos y errores humanos.

2. **Backup probado o no cuenta**
No declares "backup listo" si no se probó restauración. Un backup que no se puede restaurar no sirve.

3. **Debe existir plan de caída**
Si el sistema falla, debe existir procedimiento manual temporal y recuperación posterior.

4. **No depender de internet**
Ningún flujo crítico debe depender de CDN, API externa, licencia online, fuente remota, mapa online, correo, WhatsApp o servicio cloud.

5. **Actualizaciones con respaldo**
Cada actualización debe exigir backup previo y tener plan de rollback.

6. **Proteger base de datos local**
La base de datos no debe quedar como archivo abierto en escritorio o carpeta pública. Debe tener permisos restringidos.

7. **Usuarios individuales**
Evitar usuario compartido tipo "recepcion" para todo el mundo si el sistema maneja datos sensibles. Si hay usuarios por rol, cada persona debe tener cuenta propia cuando sea posible.

8. **Auditoría obligatoria**
Toda acción crítica debe registrar usuario, fecha, hora y acción.

9. **Impresión controlada**
Los documentos impresos pueden exponer información sensible. Debe haber control sobre recetas, reportes, historiales y facturas.

10. **Entrega defendible**
El sistema puede entregarse técnicamente sin validación clínica definitiva, pero debe quedar claro:
- Listo para entrega técnica.
- Listo para demo/UAT.
- Listo para despliegue controlado.
- Pendiente de validación operativa con usuarios reales antes de uso clínico definitivo, si aplica.

### CHECKLIST FINAL ESPECIAL OFFLINE

Antes de declarar listo S_Hospital offline, verificar:

**INFRAESTRUCTURA**
- Corre en máquina local.
- Corre sin internet.
- Requisitos mínimos documentados.
- Instalación reproducible.
- Ruta de datos definida.
- Ruta de backups definida.
- Espacio en disco suficiente.

**RED LOCAL**
- Funciona en localhost o LAN según alcance.
- IP/puerto definidos.
- Firewall configurado.
- No está expuesto innecesariamente fuera de la red.
- Varias estaciones pueden acceder si aplica.

**BASE DE DATOS**
- Base protegida.
- Migraciones listas.
- Datos demo disponibles.
- No hay datos reales de prueba.
- Integridad referencial.
- Auditoría.
- Backup y restore probados.

**SEGURIDAD**
- Login obligatorio.
- Roles funcionando.
- Contraseñas seguras.
- Sesiones protegidas.
- Permisos por módulo.
- Sin credenciales hardcodeadas.
- Sin datos sensibles en logs innecesarios.
- Bloqueo por inactividad si aplica.

**OPERACIÓN OFFLINE**
- No depende de CDN.
- No depende de APIs externas.
- No depende de internet para login.
- No depende de internet para reportes.
- No depende de internet para impresión.
- Funciones externas marcadas como no disponibles o futuras.

**BACKUP Y RECUPERACIÓN**
- Backup automático.
- Backup manual.
- Backup externo/offline.
- Backup cifrado si contiene datos reales.
- Restore probado.
- Procedimiento de recuperación documentado.
- Responsable asignado.

**CONTINUIDAD**
- Procedimiento ante apagón.
- Procedimiento ante fallo de servidor.
- Procedimiento ante fallo de red.
- Procedimiento ante fallo de impresora.
- Modo manual temporal.
- Reingreso de datos posterior.

**IMPRESIÓN**
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
- Revisión de backups.
- Revisión de disco.
- Revisión de usuarios.
- Revisión de logs.
- Procedimiento de soporte.

**ENTREGA**
- README.
- Manual de instalación offline.
- Manual de usuario.
- Manual por rol.
- Guía de backup/restore.
- Guía de actualización.
- Guía de contingencia.
- Guion de demo.
- Acta de entrega técnica.
- Lista de pendientes.
- Dictamen final.

### DICTAMEN PARA SISTEMA OFFLINE
Al final, entrega uno de estos estados:

1. Listo para demo offline.
2. Listo para entrega técnica offline.
3. Listo para despliegue local controlado.
4. No listo por riesgo crítico de datos, seguridad, instalación o recuperación.

No declarar "listo para uso hospitalario definitivo" si no se probó operación real, backup/restore, roles, auditoría, continuidad e instalación local.
