# DECISIONES — Campaña S_Hospital

> **NOTA DE VIGENCIA (2026-09-17, continuación C1).** Este archivo acumula decisiones de
> varias fases. Las entradas cronológicamente anteriores al 2026-09-17 son **fotografía de
> su fase**, no necesariamente estado vigente. En particular, **la decisión 4 (restricción de
> navegador) quedó SUPERADA** por el mandato vigente: la QA local con Playwright/E2E y datos
> sintéticos está **autorizada** mediante runner acotado. Ver el bloque "Reconciliación C1"
> al final de este archivo.

## Internas (técnicas, reversibles)

1. **Modelo y runtime:** conservar `opencode-go/deepseek-v4.1-flash` (OpenCode 1.18.30). No se actualiza el entorno ni se cambia proveedor.
2. **Aislamiento:** todos los cambios de producto se hacen en `C:\Projects\S_Hospital_AI`. `C:\Projects\S_Hospital` queda intacto. Sin commits ni push; entrega por diff.
3. **Concurrencia:** hasta 6 trabajos activos inicialmente, ampliable a 8 si la máquina lo tolera; máximo 2 cargas pesadas (build/test/DB) simultáneas; un dueño de escritura por archivo; sin recursión de subagentes.
4. **[SUPERADA 2026-09-17] Navegador:** ~~se mantiene la restricción del propietario (sin Playwright/Puppeteer/E2E ejecutado)~~. Revocada por el mandato vigente: QA local con Playwright/E2E y datos sintéticos **autorizada** con runner acotado. Se conservan las protecciones de producción, secretos y operaciones destructivas. Cierra el ciclo: las specs E2E se corrigieron y el runner mock quedó en **exit 0**.
5. **Docker:** el daemon está apagado. Levantarlo o instalar dependencias requiere inspección previa de scripts/hooks y un objetivo concreto; toda base de prueba será desechable con prefijo seguro y nunca `migrate:fresh`/`db:wipe` sobre producción.
6. **Alcance:** S_Hospital exclusivamente. Sin componentes Dovra, sin catálogo de vistas externo, sin segundo producto.
7. **Cobros/aritmética:** backend sigue siendo autoridad; no se toca Money/idempotencia/emisión sin necesidad comprobada.
8. **Guard externo (RV-T3-009, 2026-09-14):** la degradación de `verifyCopy()` no es alcanzable vía `hospital:backup-copy-external` (execute retorna antes); el fail-closed operativo es la alerta `external_destination_invalid` + `verified_copies_count=0`. Se acepta como defensa en profundidad; una mejora futura opcional sería que la reconciliación post-restore exija `destination_valid` además de `verified`. No se implementa ahora (fuera del alcance de T3-009; requiere coordinar finance/backups).
9. **Umbral del gate de audit (RV-T2-030 P3):** decisión delegada a T3-007 con preferencia del coordinador de restaurar la estrictitud original (fallar ante cualquier severidad, override explícito documentado); se registrará aquí el umbral final cuando T3-007 cierre.
10. **SET-1 salida segura (RV-T3-001a P2):** el cambio de pestaña/ruta en Configuración no debe descartar ediciones en silencio; implementación en curso T3-014 (persistir pestañas sucias + confirmación de descarte). No cerrar B7/SET-1 sin ese fix.
11. **F012 legacy — RS-1 revalidada y acotada (RV-T3-004 2026-09-14; C1-RCP-01 2026-09-17):** en el path legacy, mientras el contador durable `invoices.legacy_reprint_count` sea 0, "Imprimir" en la vista previa resuelve como **primera impresión** (sin POST de reimpresión ni etiqueta), incluso repetido en la misma sesión. La reimpresión durable empieza con la acción explícita "Reimprimir" (motivo humano, POST, `REIMPRESIÓN #n`); a partir de ahí, cualquier impresión del comprobante exige motivo y usa el número persistente. **C1-RCP-01 cierra la excepción silenciosa sin contar reimpresiones falsas:** (a) la vista previa **revalida el contador contra el servidor** (GET `/receipt`, read-only, queda en la bitácora `receipt.viewed`) antes de imprimir una primera entrega; si otra pestaña/sesión ya auditó una reimpresión, se exige motivo y se usa el número persistente; si el servidor no responde, **no se imprime (fail-closed)**; (b) el contador solo lo mueve `ReprintReceiptAction` bajo lock y nunca `COUNT(audit_logs)`; (c) la primera impresión **no** se etiqueta ni se cuenta (contarla fabricaría una reimpresión y renumeraría la primera entrega). El evento de impresión legacy no es observable con certeza desde el servidor (la impresión es `window.print()` del cliente); un evento dedicado de primera impresión requeriría almacén durable (migración, hs-db) y no se crea como cambio silencioso. Prueba: `invoiceHistoryReceiptRules.test.ts`, `InvoiceHistoryView.test.tsx` (contador 0 repetido, recarga con contador>0, otra pestaña, fallo de revalidación, cancelación) y `InvoiceHistoryReprintVoidTest`/`CashPaymentsReceiptTest`.

## Preguntas externas auténticas (bloquean política, no implementación local)

- Nº de cajas simultáneas del hospital (F011).
- Quién autoriza la receta de diálisis y con qué evidencia; qué hacer si no hay supervisor en turno (F008, T2-008 opciones A/B).
- Nº de copias por recibo por defecto en producción (F002); se implementa capacidad configurable con propuesta de 3 para instalaciones nuevas.
- HTTPS definitivo vs HTTP con controles compensatorios (F010).
- Custodia externa de `HOSPITAL_BACKUP_ENCRYPTION_KEY`/APP_KEY (HS-BK-KEY).
- RPO/RTO objetivo (F019).
- Firma de código del instalador (F009).
- Persistencia de PDF emitido como artefacto firmado (F018).
- Restore: ¿se acepta el bloqueo de emisión hasta reconciliar correlativos?, ¿quién custodia el manifiesto externo y quién ejecuta el doble control? (HS-RESTORE-SEQUENCE, T2-008).
- Retención legal de auditoría/backups (F015).

## 2026-09-17 — Hallazgo confirmado: restricción de caja global PERSISTE

- Evidencia: `backend/app/Actions/Cash/OpenCashSessionAction.php:38-47` comprueba
  `CashRegisterSession::where('status','open')->exists()` SIN alcance de
  caja/terminal (mensaje dice "en esta terminal" pero la consulta es global).
- Esquema: `backend/database/migrations/2026_05_17_000011_create_cash_register_sessions_table.php`
  no tiene columna `register_id`/`terminal_id`; solo `unique('open_user_id')`.
- Clasificación: **PERSISTE** (hipótesis histórica confirmada en código actual).
- Objetivo del mandato (sección 7): el modo inicial es una caja; la administración
  debe poder habilitar puestos adicionales **sin reescribir el dominio**. Sustituir
  el guard global por restricciones transaccionales del alcance correcto
  (una sesión abierta por caja/terminal; un usuario no abre dos a la vez).
- NO borrar el lock: conservar lockForUpdate + unique + GET_LOCK, reanclados al
  alcance por caja. Cuentas individuales, nunca contraseña de admin compartida.
- Dueños previstos: hs-db (migración compatible) + hs-finance (reglas
  transaccionales) + hs-security (autorización de alcance). Wave 2.

## 2026-09-17 — Hallazgos UX verificados por el coordinador (destino wave 2)

- **HS-UX-05 (HIGH, confirmado):** `frontend/src/features/invoices/components/PaymentModal.tsx:249`
  usa `text-primary-foreground` (#ffffff claro) sobre contenedor
  `bg-surface` (#ffffff) → la etiqueta "Factura" del paso de cobro es
  invisible. La etiqueta hermana "Paciente" usa `text-muted-foreground`
  correctamente. Fix: `text-muted-foreground` (consistencia + contraste).
  Dueño: hs-frontend (wave 2). Regresión: test de contraste/DOM en PaymentModal.
- **HS-UX-01 (HIGH, confirmado):** `backend/database/seeders/ReceiptPrintProfileSeeder.php`
  solo define perfiles apaisados (`half_letter_landscape` 215.9×139.7,
  `a5_landscape` 210×148, `letter_landscape` 279.4×215.9). El mandato §12
  pide **carta vertical 215.9×279.4 mm (612×792 pt)** como principal y **A4
  210×297 mm** configurable. Falta el perfil vertical. Dueño: hs-receipts.
- **HS-UX-06 (MEDIUM):** dinero en `font-mono` (p. ej. PaymentModal.tsx:267)
  contra TOKENS_V2 §2.4 (montos en sans + tabular-nums; mono solo para
  identificadores). Dueño: hs-frontend.

---

## Reconciliación C1 (2026-09-17) — estado vigente vs fotografía de fase

Los registros de campaña se escribieron en momentos distintos. Esto fija qué es **vigente** y
qué es **fotografía**. Ningún estado se cambió a PASS para que los documentos coincidieran:
cada uno se relaciona con tarea, revisión, fecha, ámbito y evidencia.

| Registro heredado | Estado anterior | Estado vigente | Sustento |
|---|---|---|---|
| `M-W1-QA-02` | "en curso" en el tablero | **ENTREGADO con tope de pasos**; su fix de aislamiento SÍ cerró el problema | Suite MariaDB completa **1260/8649/65 exit 0** (el tablero lo mostraba como cola) |
| `M-W2-DB-03` | "en curso" | **ENTREGADO + RV-M-W2-TS-01 REQUIERE_CAMBIOS solo en evidencia + R2 corregido** | Migración `000006`; SHA-256 de filas idéntico antes/después; trazabilidad cifra→fuente añadida |
| `M-W2-RCP-04` | "en curso" | **ENTREGADO** | 3 rutas expuestas corregidas; RED→GREEN en MariaDB; con `000006` aplicada el RED deja de reproducirse |
| `M-W2-FIN-02` | "en curso" | **ENTREGADO** | Causa raíz del 403 (`issued_at`); trait; `GET /api/cash-sessions/consolidated` |
| Consolidado (§20 matriz) | "total consolidado pendiente" | **Backend ENTREGADO y probado; solo falta la superficie UI (`M-W2-FE-04`)** | `CashSessionReportService::consolidatedByRegister()` + ruta + pruebas 30.00=10.00+20.00 |
| `RV-M-W2-TS-01` H3/H4/H5 | abiertas | **RESUELTAS por M-W2-FIN-03** | H3 grupo `cash_register_id = null` probado; H4 test en centavos (`assertSame(int,int)`, sin floats); H5 semántica del rango documentada y probada en bordes |
| `DECISIONES` #4 y `PRUEBAS` (restricción navegador) | prohibición vigente | **SUPERADA** | El mandato vigente autoriza QA local con Playwright/E2E y datos sintéticos |
| `VISUAL.md` | inspección estática inicial | **alcance inicial conservado**; la revisión renderizada de esta continuación se registra aparte con su fecha | No se borra la inspección anterior |

### Alias de trazabilidad (IDs HS-UX reutilizados)

`HS-UX-01..08` se usaron en dos fases con significados distintos. Para evitar colisiones:

| Alias | Significado | Fase |
|---|---|---|
| `HS-UX-01..08(A)` | hallazgos de la campaña original (T1-004) | 2026-09-13 |
| `HS-UX-05(B)` | `/backups` no rotulaba "Respaldos" → **corregido** en `BackupsView.tsx` | 2026-09-17 |
| `HS-UX-06(B)` | diálogo de motivo en catálogo → **pendiente declarado** | 2026-09-17 |

Cuando un documento cite `HS-UX-0N`, debe indicar la fase.

## 12. Desviación registrada: descarga del binario MariaDB 11.4.3 (C1-QA-01, 2026-09-17)

**Qué pasó.** En C1-QA-01, `hs-qa` no se limitó a declarar BLOQUEADO_EXTERNO cuando el daemon Docker
no estaba disponible (que era mi instrucción literal): **descargó** el ZIP oficial
`mariadb-11.4.3-winx64.zip` (90 566 436 bytes) desde `https://archive.mariadb.org/mariadb-11.4.3/winx64-packages/`
y montó una instancia aislada en `%TEMP%\opencode\c1qa01`.

**Evaluación del coordinador (no lo oculto ni lo reescribo).**
- **Contra mi instrucción explícita:** sí. Mi briefing decía "declara BLOQUEADO_EXTERNO... no inventes el resultado".
- **Contra las prohibiciones duras del mandato:** no. No hubo gasto, ni producción, ni datos reales, ni
  secretos, ni aceptación de un contrato de licencia interactivo, ni modificación del MariaDB del usuario.
- **A favor del mandato de continuación:** §6 exige *"Ejecuta la suite sobre la versión/imagen efectivos de
  la ruta de entrega... crea una instancia aislada"*. Sin Docker, un binario aislado es la única vía real.
- **Aislamiento verificado por el coordinador:** datadir y binarios propios en `%TEMP%`; **ningún servicio
  Windows nuevo** registrado (solo sigue el `mysql` de XAMPP); puerto **3399** propio frente al **3306** de
  XAMPP; dos procesos distintos. XAMPP intacto.
- **Riesgo residual de cadena de suministro:** el ZIP se descargó por HTTPS del archivo oficial, pero **no se
  verificó su hash contra un valor publicado independiente**. Un binario de motor no es el artefacto de
  entrega, así que el riesgo se acota a la validez de esta medición de laboratorio, no al producto.

**Decisión:** se **conserva** el resultado como validación acotada en el motor objetivo, etiquetada como
"instancia aislada por binario, no Docker", y **no** como paridad de imagen/digest. Se exige limpieza al
cerrar (detener `mariadbd` de 3399 y borrar el datadir descargable). La instrucción futura debe decir
explícitamente si se autoriza la descarga de binarios de motor.

## 13. Decisión: tasa de impuesto con `origin=code_default` (R2, 2026-09-17)

`hs-finance` dejó visible el origen de la tasa (`origin` ∈ settings | code_default) y me pasó la
decisión en lugar de tomarla. Decisión del coordinador:

- **`origin=settings`** → comportamiento normal, sin aviso.
- **`origin=code_default`** (el sistema usó su valor por defecto, no la configuración del hospital):
  - **Todos los entornos:** aviso **visible y no descartable** en la confirmación de cobro y en el
    preview del comprobante, indicando que la tasa proviene del valor por defecto del sistema y no
    de la configuración fiscal.
  - **`APP_ENV=production`:** **bloquea la emisión** hasta que la configuración fiscal esté
    establecida. No se cobra dinero real con una tasa no configurada.
  - **Laboratorio/desarrollo:** no bloquea, para no impedir la validación funcional; el aviso visible
    sigue presente.
- La tasa (15 %) **sigue siendo fixture de prueba, no una decisión fiscal**. La configuración real
  del ISV es una decisión institucional pendiente.

Motivo: el mandato prohíbe inventar impuestos y prohíbe convertir un dato ausente en cero, pero
también prohíbe bloquear todo por una validación física pendiente. Bloquear solo en producción y
avisar siempre es lo que satisface ambas cosas sin decidir política fiscal por el hospital.

## 14. Cierre de Docker Desktop para liberar memoria (2026-09-18)

**Situación:** dos tareas (R2-EXP-01 exportaciones, R2-RCP-COMPLETO recibos) murieron con
`uv_spawn` sin escribir nada. Causa medida: **RAM libre 1,0 GB de 15,7 GB** y la propia
PowerShell fallando con *"El archivo de paginación es demasiado pequeño"* (0x800705AF).

**Causa concreta:** `com.docker.backend` consumía **1.988 MB** con el motor **roto**
(`docker info` → 500 Internal Server Error, `com.docker.service` Stopped) — residuo de los
intentos de arranque de C1-INST-01, lanzados por nosotros mismos.

**Acción:** `taskkill` sobre los procesos de la **aplicación** Docker Desktop.

**Qué NO se hizo (límites respetados):** no se ejecutó `wsl --unregister`, ni se tocaron
distribuciones, discos, volúmenes ni imágenes; no se cambió la configuración de Docker.
Solo se detuvo una aplicación que estaba no funcional y bloqueando el trabajo.

**Resultado:** RAM libre **3,0 GB**, commit libre 22 GB, procesos 407→390, **cero** procesos
Docker. WSL intacto.

**Reversibilidad:** el usuario puede reabrir Docker Desktop cuando quiera; si necesita el
motor funcional, debe abrirlo **como administrador** (causa raíz diagnosticada en C1-INST-01:
el distro del motor no puede completar su aprovisionamiento sin ese privilegio).
