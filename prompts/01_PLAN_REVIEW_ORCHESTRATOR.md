# PROMPT 01 - ORQUESTADOR DE REVISIÓN DEL PLAN CON 8 SUBAGENTES

Toma el plan redactado para S_Hospital Offline y revisa su calidad antes de codificar.

## Instrucción principal
Ejecuta mentalmente 8 subagentes especializados. Cada subagente debe revisar el plan desde su área, usando los documentos de referencia indicados. No seas complaciente. Busca fallos reales, riesgos ocultos, ambigüedades, sobreingeniería, falta de pruebas, problemas offline, problemas fiscales y problemas de concurrencia.

## Subagentes obligatorios

### 1. Arquitectura y mantenibilidad
Referencia: references/software_architecture.md
Revisar SOLID, DRY, KISS, YAGNI, separación de capas, acoplamiento frontend/backend, controllers delgados, services/actions, modularidad.

### 2. Base de datos e integridad transaccional
Referencia: references/database_integrity_mysql.md
Revisar transacciones, locks, numeración de facturas, snapshots, claves, índices, anulaciones, pagos parciales, caja, migraciones y seeders.

### 3. Seguridad, privacidad y permisos
Referencia: references/security_privacy_hospital_billing.md
Revisar roles, permisos, Sanctum, secrets, auditoría, no borrado destructivo, CSRF/CORS, hardening local, exposición LAN.

### 4. UI/UX de caja hospitalaria
Referencia: references/ui_ux_cashier_workflows.md
Revisar rapidez, buscador de servicios, accesibilidad, errores humanos, modo de alto volumen, recibo, confirmaciones, reimpresión.

### 5. Rendimiento y escalabilidad local
Referencia: references/performance_laravel_react_mysql.md
Revisar queries, índices, paginación, reportes, N+1, frontend bundle, cache local, latencia LAN, impresiones.

### 6. Offline LAN, instalación y respaldos
Referencia: references/offline_lan_deployment.md
Revisar servidor local, IP fija, backups, restauración, sin internet, Docker, Windows/Linux, recuperación ante cortes eléctricos.

### 7. Pruebas, TDD y QA
Referencia: references/tdd_quality_gates.md
Revisar test plan, unit/feature/e2e, fixtures, casos borde, quality gates, criterios de aceptación.

### 8. Dominio hospitalario y facturación fiscal
Referencia: references/hospital_billing_domain.md
Revisar reglas del cliente: paciente solo nombre, servicios enviados, eritropoyetina, caja, pagos, factura con nombre y recibo institucional media carta/carta/A5 sin QR, barcode, codigos internos ni datos tecnicos.

## Salida obligatoria
Devuelve:

1. **Decisión:** APROBADO / APROBADO CON CAMBIOS / BLOQUEADO
2. **Tabla de hallazgos:** subagente, severidad, hallazgo, evidencia del plan, recomendación concreta
3. **Cambios obligatorios antes de codificar**
4. **Cambios recomendados**
5. **Plan corregido resumido** si encontraste problemas importantes
6. **Checklist de entrada a implementación**

## Severidades
- BLOQUEANTE: no se debe codificar hasta corregir.
- ALTA: corregir antes de cerrar la fase.
- MEDIA: puede corregirse durante la fase.
- BAJA: mejora opcional.
