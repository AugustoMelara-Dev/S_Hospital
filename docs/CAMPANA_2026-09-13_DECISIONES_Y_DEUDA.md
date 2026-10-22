# Campaña 2026-09-13 — Decisiones canónicas y deuda diferida

Superficie única de decisiones técnicas y deuda diferida de la campaña. No
declara certificación: el estado sigue siendo `NOT_READY`
(`../reports/CURRENT_RELEASE_TRUTH.md`). Cada punto cita su evidencia; las
decisiones de política externa indican estado y a quién corresponde
formalizarlas. "Por confirmar" significa que el expediente no registra todavía
un responsable institucional concreto.

## 1. Decisiones técnicas de campaña

### F018 — `pdf_*`: snapshots JSON, sin archivo PDF firmado

- **Decisión:** el registro semántico inmutable del recibo es el snapshot JSON;
  el PDF se genera on-demand. No se construye un archivo PDF firmado por
  iniciativa técnica ni se pueblan `pdf_disk` / `pdf_path` / `pdf_sha256`.
- **Estado:** columnas nunca escritas; permanecen reservadas y vacías. Su retiro
  (o la persistencia byte-exacta) pertenece a la fase destructiva, con
  autorización y copia verificada; la política de retención es externa.
- **Evidencia:** [`T2-004/INFORME.md` §6](../hospital-ai/evidencia/T2-004/INFORME.md);
  `hospital-ai/progreso/HALLAZGOS.json` F018 (`decided_by: hospital`).

### F016 — consolidación `areas` / `service_areas`: fase 1 hecha; fases 2–3 diferidas

- **Regla obligatoria:** mapear por **slug**, nunca por `id`. En la segunda
  siembra sobre la misma base los ids divergen (`areas` 32-36 vs `service_areas`
  37-42; `T2-040/preflight-phase2-output.log`); cualquier join por id es inválido.
- **Fase 1 (hecha):** 0 huecos legacy referenciados en la base sembrada; la
  migración
  `2026_09_13_220001_ensure_canonical_areas_for_legacy_taxonomy.php` garantiza
  por slug la contraparte canónica en `areas` (incluye `otros` en instalación
  nueva, antes del seed) y registra lo creado en `legacy_area_backfill_map`;
  es idempotente y fail-closed. Aplicada y verificada con rollback y reapply en
  base desechable MariaDB (T2-040); el POS ya consume `/api/areas`.
- **Fases 2–3 (no ejecutadas):** plan en
  [`T2-040/fases-2-3.md`](../hospital-ai/evidencia/T2-040/fases-2-3.md).
  Prerequisito obligatorio: preflight sobre instalación real (huecos/duplicados
  por slug) y autorización para la fase destructiva (soltar FKs y `DROP TABLE
  service_areas` con copia verificada; snapshots históricos intactos).
- **Evidencia:** [`T2-040/INFORME.md`](../hospital-ai/evidencia/T2-040/INFORME.md),
  [`T2-004/INFORME.md` §4](../hospital-ai/evidencia/T2-004/INFORME.md).

### F014 — `operation_idempotency_keys`: retiro diferido

- **Decisión:** no se borra en esta campaña. El retiro se hará en una próxima
  versión mayor, con export/copia verificada y autorización; no se eliminan la
  migración histórica ni los índices de poda.
- **Guard:** `backend/tests/Feature/OperationIdempotencyKeysLegacyConsumerGuardTest.php`
  falla si aparece un consumidor de runtime nuevo o una migración no listada;
  `PruneIdempotencyKeysCommand` marca la poda legacy como `@deprecated`.
- **Evidencia:** [`T2-004/INFORME.md` §2](../hospital-ai/evidencia/T2-004/INFORME.md),
  [`T2-040/INFORME.md` §2](../hospital-ai/evidencia/T2-040/INFORME.md).

### F015 — `audit_logs.ip_address`: retiro destructivo diferido

- **Hecho (local):** backfill `ip ← ip_address` con el trigger append-only
  activo y FK `audit_logs.user_id` cambiada a RESTRICT (T2-032,
  `CORREGIDO_SIN_VALIDAR`).
- **Diferido:** el `DROP` de `ip_address` y el ajuste del consumidor/test legacy
  quedan para la fase destructiva con copia verificada + autorización. Los
  escritores mantienen ambas columnas durante la ventana de compatibilidad.
- **Evidencia:** [`T2-004/INFORME.md` §3](../hospital-ai/evidencia/T2-004/INFORME.md),
  [`T2-032/INFORME.md` §3](../hospital-ai/evidencia/T2-032/INFORME.md).

### F013 / F017 — ventana de mantenimiento para aplicar las migraciones

- **Decisión:** las 6 migraciones de la OLA 1 (coherencia monetaria, singleton
  fiscal, assignment activo único, rango de series, métodos, caja en
  paid/partial) se aplican primero con `preflight.sql` sobre la
  instalación/copia y dentro de una ventana de mantenimiento.
- **Motivo:** `ALTER … ADD CONSTRAINT` valida la tabla completa (lectura +
  metadata lock) y el DDL no es transaccional: una interrupción deja esquema
  parcial; los `up()` son idempotentes y re-ejecutables. Son fail-closed: si el
  preflight detecta una violación, abortan sin reparar históricos.
- **Estado:** verdes y revertidas en base desechable MariaDB; **aplicación real
  pendiente** (RV-T2-014).
- **Evidencia:** [`T2-014/INFORME.md` §1/§2/§5](../hospital-ai/evidencia/T2-014/INFORME.md);
  `hospital-ai/progreso/HALLAZGOS.json` F013/F017.

### F020 — zona horaria de conexión (nota de campaña)

- `DB_TIMEZONE=-06:00` por defecto en las conexiones `mysql`/`mariadb`, sin
  conversión masiva de datos. Evidencia:
  [`T2-032/INFORME.md` §2](../hospital-ai/evidencia/T2-032/INFORME.md).

## 2. Decisiones externas pendientes (estado y quién decide)

Ninguna se resolvió en la campaña. La columna "Decide" indica el rol al que
corresponde formalizarla y queda "por confirmar" donde el expediente no registra
responsable. Fuente base: `hospital-ai/progreso/DECISIONES.md`.

| Tema | Pregunta | Estado | Decide |
|---|---|---|---|
| Multicaja (F011) | ¿Cuántas cajas simultáneas debe soportar el hospital? Hoy la regla es caja única global, documentada sin cambios. | `PENDIENTE_EXTERNO` | Dirección/administración del hospital (por confirmar) |
| EPO: autorización (F008) | ¿Quién autoriza la receta de diálisis, con qué evidencia, y qué hacer sin supervisor en turno? Opciones A/B en T2-008. | `PENDIENTE_EXTERNO` | Dirección clínica + administración (por confirmar) |
| Copias por recibo (F002) | ¿Cuántas copias (ORIGINAL/PRIMERA/SEGUNDA) se imprimen por defecto en producción? La capacidad es configurable; instalaciones nuevas proponen 3. | `PENDIENTE_EXTERNO` | Administración del hospital (por confirmar) |
| Adopción TLS (F010) | ¿HTTPS definitivo o HTTP LAN con controles compensatorios? Existe modo TLS/WSS opt-in listo, apagado por defecto. | `PENDIENTE_EXTERNO` | TI/seguridad del hospital + dirección (por confirmar) |
| Custodia de claves (HS-BK-KEY) | Custodia externa y recuperación de `HOSPITAL_BACKUP_ENCRYPTION_KEY` y `APP_KEY`. | `PENDIENTE_EXTERNO` | Custodio designado por la institución (por confirmar) |
| RPO/RTO (HS-BK-RPO / F019) | Objetivos reales de recuperación. Hueco planificado: 8 h Docker, 24 h bare-metal; sin medición ni último número emitido. | `PENDIENTE_EXTERNO` | Dirección del hospital (por confirmar) |
| Firma de código (F009) | Certificado legítimo para el instalador; hoy `NotSigned`. | `PENDIENTE_EXTERNO` | Institución (certificado a su nombre) |
| Retención legal (F015) | Plazos legales para auditoría y respaldos. | `PENDIENTE_EXTERNO` | Función legal/administración (por confirmar) |
| Soporte bare-metal | ¿La entrega final debe soportar instalación bare-metal? El paquete offline es Docker; el instalador conserva la opción 2 para repositorio completo. | `PENDIENTE_EXTERNO` | Institución/proveedor (por confirmar) |
| Destino externo de respaldo (F019 / T2-010) | Destino real, custodia y verificación de la copia externa cifrada. El adaptador está probado en local y el wiring Docker está mapeado (T2-036: `docker-compose.prod.yml:51-56,181-186,344-349`, bind único en scheduler `:353-359`; `.env.example:126-137`), pero la copia sigue **no desplegada**: `HOSPITAL_BACKUP_EXTERNAL_ENABLED=false`, sin destino real montado/verificado (el bind por defecto `./backup-external` es del mismo host) y sin evidencia de copia. | `PENDIENTE_EXTERNO` | Hospital (medio externo) + despliegue hs-install |
| PDF firmado (F018) | ¿Se exige evidencia byte-exacta del PDF emitido o basta el snapshot JSON? | `PENDIENTE_EXTERNO` | Hospital (por confirmar) |
| MFA (F031) | ¿Se requiere segundo factor? Evaluado como mejora opcional, no requisito. | `MEJORA_OPCIONAL_NO_REQUERIDA` | Seguridad institucional (si se reabre) |
| Restore y correlativos (HS-RESTORE-SEQUENCE) | ¿Se acepta bloquear emisión hasta reconciliar el último número con custodia externa? ¿Quién ejecuta el doble control? | `PENDIENTE_EXTERNO` | Dirección + custodio designado (por confirmar) |

## 3. Deuda diferida vinculada

- Aplicación real de las migraciones F013/F017 con preflight + ventana
  (sección 1).
- Retiros destructivos F015 (`ip_address`), F018 (`pdf_*`), F014
  (`operation_idempotency_keys`) y F016 (`service_areas`): todos requieren copia
  verificada y autorización, y no se ejecutan en esta campaña.
- Pruebas externas: Windows limpio, impresión física, segunda PC LAN y firma de
  código. Estado y pendientes en `../reports/CURRENT_RELEASE_TRUTH.md` y
  `hospital-ai/progreso/`.

> Esta superficie no sustituye los runbooks operativos
> (`docs/BACKUP_RESTORE.md`, `docs/SAFE_UPDATE_ROLLBACK.md`,
> `docs/DISASTER_RECOVERY.md`) ni el registro histórico `docs/DECISIONS.md`.
