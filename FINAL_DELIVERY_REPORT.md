# Reporte Final de Entrega y Checklist Operativo (LAN/Offline)

## 1. Estado Técnico Final

- **Rama:** `main`
- **Commit:** `0f25a76c189d9947b7e82b4d43c9eae1faf03184`
- **Tag final:** `f6-p0-004-hotfix-main-2026-06-14`
- **Checkpoint final:** `checkpoint/f6-p0-004-hotfix-main-2026-06-14`
- **Evidencia preservada:** `preserve/sensitive-post-merge-audit`
- **Resultado de Tests:** `PASS` (suites completas de Backend y Frontend superadas, 256 tests de frontend, sin errores funcionales).
- **Estado del árbol:** Limpio (`git status` vacío).
- **Confirmación:** `FINAL_RELEASE_GATE_PASS`
- **Hotfix Integrado:** `P0-004` (comando seguro para cifrar registros legacy de idempotencia sin truncar producción).

---

## 2. Pasos Manuales Obligatorios Antes de Producción

> [!WARNING]
> La instalación de este release en un entorno de producción (LAN/offline) debe seguir de manera estricta y secuencial los siguientes pasos. Omitir el respaldo inicial podría resultar en pérdida irrecuperable de datos históricos.

### Pre-Requisitos y Entorno
1. [ ] **Hacer backup previo:** Generar y descargar un respaldo completo de la base de datos de producción actual ANTES de subir cualquier cambio.
2. [ ] **Verificar `.env` real:** Revisar que las credenciales de base de datos coincidan con el servidor de producción.
3. [ ] **Confirmar `APP_DEBUG=false`:** Garantizar que el entorno esté en modo de producción cerrado para evitar exposición de información de diagnóstico.
4. [ ] **Confirmar `APP_KEY` estable:** Asegurarse de que el `APP_KEY` sea el mismo usado en despliegues anteriores para no invalidar contraseñas o sesiones actuales.

### Despliegue de Base de Datos y Hotfix P0-004
5. [ ] **Ejecutar migraciones:** Correr `php artisan migrate --force` para ejecutar migraciones pendientes y validar que la tabla `idempotency_keys` existente quede compatible con el comando seguro de cifrado legacy.
6. [ ] **Simulacro de cifrado (DRY-RUN):** Ejecutar obligatoriamente `php artisan idempotency:encrypt-legacy --dry-run`.
7. [ ] **Revisar conteos:** Validar que el conteo de llaves a procesar en el reporte del dry-run coincida con la realidad de la base de datos de producción.
8. [ ] **Ejecutar cifrado definitivo:** **SOLO SI** los pasos anteriores están confirmados y **EXISTE EL BACKUP**, ejecutar:
   `php artisan idempotency:encrypt-legacy --force`
9. [ ] **Hacer backup posterior:** Realizar un segundo respaldo completo, garantizando que el estado cifrado post-migración esté resguardado.

### Validación Operativa en Sitio
10. [ ] **Validar Login:** Ingresar al sistema con una cuenta operativa de cajero o administrador.
11. [ ] **Validar Caja:** Abrir turno de caja sin problemas.
12. [ ] **Validar Facturación y Pago:** Emitir una factura de prueba y asentar el pago.
13. [ ] **Validar Reimpresión y Fiscal:** Confirmar que el formato 80mm/58mm imprime correctamente con el número fiscal correlativo.
14. [ ] **Validar Reportes:** Descargar el reporte diario o dashboard financiero.
15. [ ] **Validar Backup Manual:** Solicitar un backup desde la UI del sistema.

---

## 3. Riesgos Residuales

> [!CAUTION]
> **No se declara riesgo cero.** El sistema ha superado con éxito el "Release Gate" técnico en CI y validaciones locales en contenedores de desarrollo; sin embargo, un entorno de **producción requiere validación operativa en la máquina final del hospital.**

* **Validación de Hardware Requerida:** La impresión térmica a través del navegador no es automatizable al 100% mediante CI. Requiere validación física con las impresoras reales del centro de salud.
* **Políticas de Entrada de Datos Reales:** Cualquier dato real del hospital debe ser introducido al sistema **exclusivamente después** de comprobar la restauración exitosa del backup inicial.

---

## 4. Entregables Disponibles

* [ ] **Release notes:** Registro de la integración del hotfix P0-004.
* [ ] **Checklist de Instalación:** Cubierto en la sección 2.
* [ ] **Checklist de Operador:** Verificación funcional en sitio descrita en validación operativa.
* [ ] **Checklist de Reversión:** Restaurar el backup previo completo en caso de fallar el dry-run o si las migraciones fallan en producción.
* [ ] **Evidencia de Tests:** Logs retenidos en el sistema local confirmando suites de backend y frontend en PASS (frontend `npm run test` y backend `php artisan test`).
* [ ] **Tag final y checkpoint final:** `f6-p0-004-hotfix-main-2026-06-14` y `checkpoint/f6-p0-004-hotfix-main-2026-06-14`.
* [ ] **Evidencia preservada:** `preserve/sensitive-post-merge-audit` salvaguardada en remoto.

---

## 5. Veredicto

`FINAL_RELEASE_GATE_PASS / READY_FOR_OPERATIONAL_INSTALLATION_TEST`
