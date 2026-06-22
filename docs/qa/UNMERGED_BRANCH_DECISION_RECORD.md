# Unmerged Branch Decision Record

## Resumen

- Main evaluado: `555a14f7529a566dc4e050e41451e76810eda301`.
- Informe forense base: `297621a25bb268c2e1c326ba4f6fce52a892fbce`.
- Siete ramas revisadas: audit/f6-post-approval-sensitive-a979d5b7, audit/f6-post-approval-sensitive-c851057f, codex/operational-role-simulation, codex/production-readiness-preflight, codex/supply-chain-hardening, fix/f8-audit-hardening-2026-06-14, hardening-audit-complete-2026-06-15.
- Trabajo recuperado: cinco runbooks operativos actuales.
- Trabajo rechazado: ramas completas antiguas, modulos legacy, artefactos generados, migraciones antiguas de idempotencia, vistas compiladas y package-lock bajo backend.
- Trabajo diferido: metadatos extendidos de `backup_logs`.
- Estado de worktrees sucios: un respaldo exacto y dos respaldos parciales en rescue; worktrees preservados.

## Decision por rama

| Rama | Decision | Motivo | Elementos recuperados | Elementos rechazados | Pruebas |
|---|---|---|---|---|---|
| audit/f6-post-approval-sensitive-a979d5b7 | REIMPLEMENTAR_PUNTUALMENTE | La rama contiene una prueba FK antigua y ajustes de voiding, pero main ya tiene hardening posterior. | Decision documentada para gate FK MySQL/MariaDB. | Rama completa, migracion legacy de idempotencia y cambios de UI antiguos. | Prueba FK intentada en SQLite; no se conserva porque SQLite no reproduce la restriccion. |
| audit/f6-post-approval-sensitive-c851057f | YA_CUBIERTO_POR_MAIN | Main contiene `EncryptLegacyIdempotencyKeysCommand`, prueba actual en `backend/tests/Feature/Console`, y modelo de idempotencia cifrado. | Ninguno. | Migracion antigua de idempotencia. | Cobertura existente. |
| codex/operational-role-simulation | SUPERADO_POR_MAIN | Todos sus archivos existen por ruta en main y la rama esta muy atrasada. | Ninguno. | Rama completa. | Cobertura actual de CashBox, pagos, reportes y backups se conserva. |
| codex/production-readiness-preflight | RECHAZAR_POR_OBSOLETO | Reactiva superficie legacy y modulos fuera del alcance final. | Ninguno. | AreaPaidServices, controladores no vigentes, reportes/pacientes legacy y documentacion RC antigua. | No aplica. |
| codex/supply-chain-hardening | RECHAZAR_POR_OBSOLETO | Contiene artefactos generados, rutas Windows incrustadas y estructura antigua. | Ninguno. | Vistas compiladas, package-lock bajo backend, public generado y rama completa. | No aplica. |
| fix/f8-audit-hardening-2026-06-14 | DIFERIR_DECISION_PRODUCTO | La prueba vieja de lock order es textual y los metadatos de backup cambian contrato/schema sin defecto actual demostrado. | Ninguno. | `CashPaymentLockOrderTest` textual y migracion `backup_logs` no aprobada. | Lock risk cubierto por idempotencia/concurrencia existentes; no se agrega prueba fragil. |
| hardening-audit-complete-2026-06-15 | REIMPLEMENTAR_PUNTUALMENTE | Habia referencias rotas a runbooks operativos que siguen siendo utiles. | `docs/DATA_MIGRATION.md`, `docs/DATETIME_POLICY.md`, `docs/ENDPOINT_SECURITY.md`, `docs/MAINTENANCE_ROUTINE.md`, `docs/PHYSICAL_SECURITY.md`. | Copia literal de docs antiguos y afirmaciones no verificadas. | Documentacion validada con diff/link grep. |
| codex/final-rc-scope-cutover | SUPERADO_POR_MAIN | RC antigua basada antes del cierre visual y de hardening final. | Ninguno. | Rama completa, evidencia visual antigua y smoke antiguo. | No aplica. |

## Documentacion

- Referencias rotas: cinco rutas en `KNOWN_LIMITATIONS.md`, `OFFLINE_CHECKLIST_FINAL.md`, `OFFLINE_DICTAMEN_FINAL.md` y `OFFLINE_MODE_PLAN.md`.
- Documentos creados: `DATA_MIGRATION.md`, `DATETIME_POLICY.md`, `ENDPOINT_SECURITY.md`, `MAINTENANCE_ROUTINE.md`, `PHYSICAL_SECURITY.md`.
- Documentos sustituidos: ninguno.
- Documentos descartados: copias antiguas de la rama hardening; se reescribieron contra `main`.

## Tests

- FK invoice_items: no habia prueba conductual equivalente por ruta. Se intento una prueba focal contra el entorno SQLite de `phpunit.xml`; fallo porque SQLite no reproduce la restriccion final de MySQL/MariaDB. No se commitea una prueba fallida ni un skip silencioso. La verificacion queda como gate MySQL/MariaDB descartable.
- Lock order caja/pagos: main ya contiene idempotencia, doble pago, concurrencia de caja/fiscal y guardas existentes. La prueba candidata leia el codigo fuente como texto; se rechaza por fragil.
- Cobertura actual: `RegisterPaymentAction` bloquea caja antes de factura; `CloseCashSessionAction` bloquea caja antes de facturas y pagos. Existen pruebas de doble pago, idempotencia, apertura de caja y concurrencia fiscal.
- Nuevas pruebas: ninguna commiteada.

## Backups

DIFERIR_DECISION_PRODUCTO

Evaluacion:

1. El backup actual ya genera `.sql.enc`.
2. El backup actual guarda `checksum_sha256`.
3. Restore puede operar con extension y checksum actuales.
4. No se reprodujo bug por ausencia de `format`, `compression`, `encrypted` o `encryption_key_id`.
5. No existe requerimiento operativo firmado para esos campos.
6. Rotacion de claves podria necesitarlos en el futuro, pero no esta aprobada.
7. Agregarlos cambiaria schema/modelo/API de backups.

## Worktrees

| Worktree | Rescue correspondiente | Hash current | Hash rescue | Clasificacion | Accion recomendada |
|---|---|---|---|---|---|
| C:\tmp\S_Hospital_f6_global_design | rescue/no-perder-nada-20260615-180121/uncommitted/004 | E867BB1DCD835217BAA7B08CFD9334489DCC22E1FC7159D68ABDCE1BEBD9EE47 | E867BB1DCD835217BAA7B08CFD9334489DCC22E1FC7159D68ABDCE1BEBD9EE47 | RESPALDO_EXACTO_EN_RESCUE | Conservar; no subir archive adicional. |
| C:\tmp\S_Hospital_release_12062039 | rescue/no-perder-nada-20260615-180121/uncommitted/009 | C0D4A3F9B3947D6A78DF51D142C205110D7FF7C16E166E890832BD22F037BA9C | 0CEE13CB3F10D57E00D89BE5F97F6708CD6B8B9FBFC28E00DB73B69D018547DB | RESPALDO_PARCIAL_EN_RESCUE | Conservar worktree; rescue es superconjunto por ruta, no hash exacto. |
| C:\tmp\S_Hospital_verify_b2fe0b43 | rescue/no-perder-nada-20260615-171019/uncommitted/052-C-/tmp/S_Hospital_verify_b2fe0b43 | 8198B44A57809620560D7767A94AF5CDF97F9B574C51BFF6C121D20C9027DC8C | 51C1AAED5D857CE586D768913ACF217B4D720401E324B97EF2389D2ACF8DEBF0 | RESPALDO_PARCIAL_EN_RESCUE | Conservar worktree; rescue es superconjunto por ruta, no hash exacto. |

## Decision final

NO HAY CODIGO PRODUCTIVO IMPORTANTE PENDIENTE

No se debe fusionar ninguna rama antigua completa. La unica recuperacion lista para revision es documental y actualizada contra `main`. Las decisiones de producto restantes deben abrirse solo si operaciones demuestra necesidad real o defecto reproducible.
