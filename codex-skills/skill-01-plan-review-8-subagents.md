# Skill Codex: Plan Review con 8 subagentes

## Disparador
Usar cuando exista un plan redactado.

## Subagentes
- subagents/01_architecture_reviewer.md
- subagents/02_database_integrity_reviewer.md
- subagents/03_security_privacy_reviewer.md
- subagents/04_ui_ux_cashier_reviewer.md
- subagents/05_performance_reviewer.md
- subagents/06_offline_lan_backup_reviewer.md
- subagents/07_qa_tdd_reviewer.md
- subagents/08_domain_fiscal_reviewer.md

## Procedimiento
1. Revisar el plan desde cada subagente.
2. Clasificar hallazgos por severidad.
3. Marcar BLOQUEADO si hay riesgos en datos, caja, seguridad, facturación o offline.
4. Proponer corrección concreta.

## Salida
Tabla de hallazgos y decisión final.
