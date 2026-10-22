# Fase 3 — Cierre operativo y manifiesto (2026-09-20)

Sistema de Caja del Hospital General San Isidro. Identidad vigente: panel
administrativo cobalto/neutros fríos/sans (`hospital-ai/diseno/IDENTIDAD_DEV.md`).
Autoridades: `01_MANDATO_MAESTRO_HOSPITAL.md` (fase 1),
`02_AUDITORIA_ADVERSARIAL_HOSPITAL.md` (fase 2), este cierre (fase 3).

## Artefacto y fuentes

| Elemento | Valor |
|---|---|
| HEAD | `baa41f97` (sin commit; árbol de trabajo con la entrega) |
| Bundle principal | `frontend/dist/assets/index-DOAlLNQA.js` (222 605 B) sha256 `71b5d5ec…464d1c` |
| Assets de build | 30 archivos en `frontend/dist/assets` |
| Manifiesto de fuentes | `hospital-ai/release/MANIFIESTO_FASE3.json` — **1185 archivos**, 26 directorios, 8 583 698 B, **0 secretos** |
| sha256 (manifiesto) | `c2c53488…7178e48` · sha256 (json) `1efd1d31…f49a4e` |
| Lockfiles | `frontend/pnpm-lock.yaml` `a892d7ef…ac3094` · `frontend/package-lock.json` `b81830ea…34bfdd` · `backend/composer.lock` `2e76c912…7204a` |

El manifiesto incluye archivos **no rastreados** necesarios (contra el defecto de
"un git diff no cubre lo no rastreado"). Excluye por construcción dependencias,
caches, `.env*`, material criptográfico y la propia carpeta `release`.

## Comandos de operación (verificados en este entorno)

```powershell
# Backend (suite rápida, SQLite en memoria)
cd backend; php vendor/bin/phpunit

# Backend sobre MariaDB real (requiere base desechable con prefijo y flag)
$env:HOSPITAL_TEST_ALLOW_EXTERNAL_DB='1'
$env:HOSPITAL_RUN_CONCURRENT_TESTS='1'      # solo para la suite Concurrent
$env:DB_CONNECTION='mysql'; $env:DB_HOST='127.0.0.1'; $env:DB_PORT='3306'
$env:DB_DATABASE='s_hospital_test_<sufijo>'; $env:DB_USERNAME='root'; $env:DB_PASSWORD=''
php vendor/bin/phpunit -c phpunit.mysql.xml --testsuite Concurrent

# Frontend
cd frontend
npm run typecheck ; npm run lint ; npm run test ; npm run build
npm run test:e2e:mock                        # levanta Vite + Chromium
npx playwright test e2e/visual-capture.spec.ts --project=chromium
npx playwright test e2e/a11y-audit.spec.ts --project=chromium

# Manifiesto
powershell -ExecutionPolicy Bypass -File scripts\generate_dev_manifest.ps1 `
  -OutputPath "hospital-ai\release\MANIFIESTO_FASE3.json"
```

## Estados (no se convierten entre sí)

| Dimensión | Estado | Nota |
|---|---|---|
| Implementación funcional | PASS | Alcance del prompt 01 implementado; último defecto local (fila de Recibos) cerrado |
| Validación técnica | PASS (SQLite + MariaDB 10.4.32) | 11.4.3 objetivo: NOT VERIFIED |
| Validación visual | PARTIAL | 16 PNG; 6 sin inspeccionar; sin lector de pantalla ni papel |
| Instalación/paquete | NOT VERIFIED | No ejecutada en esta sesión |
| LAN / impresora / aceptación | NOT VERIFIED | Requiere hardware y decisión institucional |

## Límites declarados

- No se probó en una segunda PC física, impresora, Windows limpio ni WAN
  bloqueada con navegador.
- El motor alcanzable es MariaDB 10.4.32; el objetivo declarado 11.4.3 no se
  ejecutó.
- La cuenta demo y los endpoints de seed **no** se habilitan en el paquete
  operativo.
- Sin aprobación del propietario: el veredicto visual interno no la sustituye.
