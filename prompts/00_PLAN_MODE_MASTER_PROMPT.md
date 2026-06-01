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
