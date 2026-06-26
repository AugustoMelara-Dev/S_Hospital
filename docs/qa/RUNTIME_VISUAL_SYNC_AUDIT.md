# Runtime Visual Sync Audit

Fecha: 2026-06-25 23:30 America/Tegucigalpa

## 1. Main auditado

| Item | Resultado |
| --- | --- |
| Rama actual al iniciar | `main` |
| Status inicial | limpio |
| `main` | `6ba95fd0bd4334ae1a710ffc9d96d42fb8f6ecf3` |
| `origin/main` | `6ba95fd0bd4334ae1a710ffc9d96d42fb8f6ecf3` |
| SHA esperado | `6ba95fd0bd4334ae1a710ffc9d96d42fb8f6ecf3` |
| Coincide | SI |
| Produccion fisica aprobada | NO |
| Tag creado | NO |

Conclusión: `main` si contiene la linea esperada. No se modifico `main`.

## 2. Ramas revisadas

Ramas visuales ya contenidas en `main`:

| Rama | SHA | Clasificacion |
| --- | --- | --- |
| `origin/codex/ui-foundations-shadcn` | `494762e29f11` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-dashboard-page` | `f4281dbe3881` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-cashbox` | `c28eeae42efc` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-catalog-page` | `9a60da70d83b` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-invoice-builder-components` | `bd370ba6d68d` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-invoice-history` | `9588d19437e9` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-payment-modal` | `5187ededb771` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-institutional-receipt` | `dbf7aac2aa0e` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-fiscal-settings` | `802b1640676d` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-backups-page` | `0553662c7241` | YA INTEGRADA EN MAIN |
| `origin/codex/ui-support-pages` | `4d7c68bc3ccf` | YA INTEGRADA EN MAIN |
| `origin/codex/visual-completion-rc` | `23788fde5145` | YA INTEGRADA EN MAIN |
| `origin/codex/v1-1-production-polish` | `eb2449187192` | YA INTEGRADA EN MAIN |
| `origin/codex/v1-1-polish-review` | `526e1548231b` | YA INTEGRADA EN MAIN |

Ramas no fusionadas con diff relevante:

| Rama | SHA | Ahead/behind vs main | Archivos UI | Clasificacion | Accion recomendada |
| --- | --- | ---: | ---: | --- | --- |
| `codex/f6-operational-polish` | `a979d5b79833` | `246/1` | 5 | CONTIENE CODIGO OBSOLETO/PELIGROSO | No mezclar. Rama muy atrasada; su commit mezcla backend sensible y frontend anterior. |
| `codex/final-rc-scope-cutover` | `70df4b7edcdd` | `272/4` | 74 | DUPLICADA/SUPERADA | No mezclar. Trabajo anterior a la linea final integrada. |
| `codex/operational-role-simulation` | `b1a728aca416` | `841/10` | 39 | DUPLICADA/SUPERADA | No mezclar sin auditoria separada. |
| `codex/production-readiness-preflight` | `ab17005df5b0` | `358/406` | 153 | CONTIENE CODIGO OBSOLETO/PELIGROSO | No mezclar en esta auditoria. Divergencia grande. |
| `fix/f8-audit-hardening-2026-06-14` | `81d74d6e7607` | `224/5` | 8 | DUPLICADA/SUPERADA | No mezclar. |
| `hardening-audit-complete-2026-06-15` | `6cecb4afbb6b` | `147/4` | 15 | DUPLICADA/SUPERADA | No mezclar. |
| `rescue/no-perder-nada-20260615-171019/uncommitted/004-C-/tmp/S_Hospital_f6_global_design` | `fc76059c475a` | `272/1` | 145 | REQUIERE DECISION / SNAPSHOT WIP | No cherry-pick automatico. La base `worktree-head/004` si es ancestro de `main`; lo restante es WIP rescatado. |

No se encontro una rama visual limpia, actual y no integrada que explique por si sola el reporte del usuario.

## 3. V1.1 en main

Commits esperados encontrados:

- `7c495929` merge: v1.1 production polish.
- `526e1548` test(qa): add v1.1 polish review gates.
- `8f6aeee5` docs(qa): clarify final v1.1 backend gate evidence.
- `6ba95fd0` merge: finalize field acceptance audit evidence.

Diff desde `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac..main`:

- 80 archivos en `frontend/src`, `frontend/e2e`, `docs/qa` y `qa/screenshots`.
- Cambios productivos reales en:
  - `frontend/src/features/reports/**`
  - `frontend/src/features/invoices/**`
  - `frontend/src/features/receipt-settings/**`
  - `frontend/src/features/settings/FiscalSettingsView.tsx`
  - `frontend/src/layout/**`
  - `frontend/src/styles.css`
  - `frontend/e2e/v1-1-full-a11y.spec.ts`
- Desde `7c495929..main` no hay cambios productivos en `frontend/src` ni `frontend/e2e`; lo posterior son docs/QA de field acceptance.

Pantallas que debian verse diferentes:

| Pantalla | Archivos cambiados | Cambio esperado visible | Nivel |
| --- | --- | --- | --- |
| Login / shell | `LoginView.tsx`, `Sidebar.tsx`, `OperationalStatus.tsx`, `styles.css` | Copy institucional, shell mas sobrio, estados de operacion local. | Medio |
| Nueva factura | `NewInvoiceViewLayout.tsx`, `ServiceSearch.tsx` | Mejor wrapping y barra movil de totales/acciones. | Medio |
| Confirmacion factura | `InvoiceConfirmation.tsx` | Nombres largos y contenido denso no se cortan. | Bajo/Medio |
| Reportes | `ReportsView.tsx`, tabs y chart components | Tabs/filtros mas responsive, charts con tokens y labels. | Medio |
| Recibos settings | `InstitutionalReceiptSettingsView.tsx`, preview | Copy mas claro, preview institucional. | Medio |
| Fiscal settings | `FiscalSettingsView.tsx` | Evita texto legal inventado y deja campos opcionales vacios. | Bajo visual, alto funcional |
| Usuarios/admin | `PermissionGate.tsx`, screenshots y a11y | Estados y permisos mas robustos. | Bajo/Medio |

## 4. Runtime activo

Contenedores S_Hospital activos:

| Stack | Contenedor NGINX | URL | Creado | Estado | Observacion |
| --- | --- | --- | --- | --- | --- |
| `shospital_offlinetest` | `shospital_offlinetest-nginx-1` | `http://192.168.1.10:8081` | 2026-06-22 | healthy | Stack mas cercano a V1.1. |
| `shospital_prodtest` | `shospital_prodtest-nginx-1` | `http://192.168.1.10:8080` | 2026-06-16 | healthy | Stack anterior; titulo y assets viejos. |
| `s_hospital_f7_verify` | `s_hospital_f7_verify-nginx-1` | `http://localhost:18080` | 2026-06-14 | healthy | Stack de verificacion antiguo. |

Safe GET:

| URL | Resultado |
| --- | --- |
| `http://192.168.1.10:8081` | PASS `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status` |
| `http://192.168.1.10:8080` | PASS `/`, `/login`, `/api/health`, `/api/system/health`, `/api/system/setup-status` |

El log de `shospital_offlinetest-nginx-1` muestra trafico real de Chrome a `http://192.168.1.10:8081/login`, `/dashboard` y `/billing/new`. Esa es la mejor evidencia disponible de la URL que el usuario esta viendo.

## 5. Puertos y stacks

| URL | Titulo HTML | Assets principales |
| --- | --- | --- |
| `http://192.168.1.10:8081` | `Sistema de Caja Hospitalaria` | `index-Cpf-GTF4.js`, `ui-BhLfDv7l.js`, `charts-JUI4aW6N.js` |
| `http://192.168.1.10:8080` | `Caja hospitalaria` | `index-D5Pn6EAE.js`, `ui-BrnZqWXP.js`, `charts-JUI4aW6N.js` |
| `http://localhost:18080` | `Caja hospitalaria` | `index-zRILqW4r.js`, `ui-NFJj54dP.js`, `charts-p5HLSj-f.js` |

`8080` y `18080` son claramente anteriores por branding y chunks. `8081` usa el branding institucional y coincide visualmente con la evidencia V1.1.

Hallazgo adicional: el backend de `shospital_offlinetest` mantiene `APP_URL`, `SERVER_IP`, CORS y Sanctum apuntando a `192.168.1.41:8081`, mientras la URL auditada responde en `192.168.1.10:8081`. Esto no explica que "se vea igual", pero si puede explicar fallos de login/cookies en clientes LAN y debe corregirse con el runbook LAN/rebuild.

## 6. Assets servidos

Build fresco desde `main` en `frontend/dist` genero:

| Asset | SHA256 | Bytes |
| --- | --- | ---: |
| `index-CBIkWHC-.js` | `46D3B2C3D83EFDCB59155A4492EA12DC17996610A0DB83516DAE9B582234E628` | 196815 |
| `index-HZ3HlHfx.css` | `5126D808EC5BCDC59DC9D762E0F06994035BDD49FF98DBFA5F641ED9174D7560` | 74495 |
| `ui-BhLfDv7l.js` | `C4A2847CDB20750F7B1868D47D12E81C78C4D7E7DE185FA9386C51CBE28A6BE6` | 159797 |
| `vendor-Txi_p2nM.js` | `79C73AB32E22E36BE01F28AFB1FF76F54506FAA8E028A1775330F95ED557A268` | 348154 |

HTTP asset checks:

| URL | Resultado |
| --- | --- |
| `http://192.168.1.10:8081/assets/index-CBIkWHC-.js` | 404 |
| `http://192.168.1.10:8081/assets/index-Cpf-GTF4.js` | 200 |
| `http://192.168.1.10:8080/assets/index-CBIkWHC-.js` | 404 |
| `http://192.168.1.10:8080/assets/index-D5Pn6EAE.js` | 200 |

Interpretacion: ningun stack sirve exactamente el build fresco generado durante esta auditoria. Sin embargo, no hay cambios frontend entre el merge V1.1 y `main`, por lo que el mismatch exacto de hash en `8081` no implica por si solo que falte UI. `8080` si es un build/stack visualmente viejo.

## 7. Cache

Evidencia:

- No se encontro `navigator.serviceWorker`, `serviceWorker`, Workbox ni `registerSW` en `frontend/src`.
- `nginx/default.conf` sirve HTML con `Cache-Control: no-store, no-cache, must-revalidate, private`.
- Assets versionados se sirven con cache immutable por hash.

Conclusion: `BROWSER_CACHE` no es la causa raiz principal. Una pestaña abierta puede seguir ejecutando JS viejo hasta recarga completa, pero no hay service worker persistente que explique el problema.

## 8. Capturas reales

Carpeta generada:

- `qa/runtime-visual-audit/20260625-2317/`

Capturas contra backend real:

- `lan-8081-login-desktop.png`
- `lan-8081-mobile-login-desktop.png`
- `lan-8080-login-desktop.png`
- `lan-8080-mobile-login-desktop.png`
- `local-18080-login-desktop.png`

Resultado: login con usuario sintetico de validacion no autentico en estos stacks, por lo que no se tomaron capturas internas reales para evitar mutaciones o datos reales.

Capturas mockeadas sobre assets reales:

- `qa/runtime-visual-audit/20260625-2317/mock-over-runtime-8081/`: 34 PNG.
- `qa/runtime-visual-audit/20260625-2317/mock-over-runtime-8080/`: 33 PNG.

Resultado Playwright:

| Target | Resultado |
| --- | --- |
| `8081` | 3/4 specs PASS; una falla por recurso 429 durante verificacion final. Capturas completas generadas y reporte sin `console_issues`. |
| `8080` | 4/4 specs FAIL por warnings/errores esperados en runtime viejo y 404 no alineado; capturas parciales/completas generadas. |

## 9. Comparacion contra V1.1

`mock-over-runtime-8081/dashboard-light.png` y `qa/screenshots/v1-1-production-polish/dashboard-light.png` son visualmente equivalentes. Lo mismo se observa en login, reportes, facturacion y recibos en la matriz mockeada.

`8080` conserva indicadores de version anterior:

- Titulo HTML `Caja hospitalaria`, no `Sistema de Caja Hospitalaria`.
- `index-D5Pn6EAE.js`, no el bundle de `8081` ni el build fresco.
- Backend configurado para `APP_URL=http://127.0.0.1:8080`, no para LAN real.
- Playwright V1.1 falla en consola y estados esperados.

Por tanto:

- Si el usuario esta viendo `8080`, la causa raiz es `WRONG_PORT_OR_STACK` + `RUNTIME_OLD_BUILD`.
- Si el usuario esta viendo `8081`, la causa raiz visual es `V1_1_CHANGES_SUBTLE`: V1.1 esta aplicado, pero el cambio fue sobrio e incremental, no una intervencion visual fuerte.

## 10. Causa raiz

Causa raiz primaria:

- `WRONG_PORT_OR_STACK` para cualquier acceso a `http://192.168.1.10:8080`.
- `V1_1_CHANGES_SUBTLE` para `http://192.168.1.10:8081`.

Causas secundarias:

- `RUNTIME_OLD_BUILD`: `8080` y `18080` son builds anteriores. `8081` no sirve el hash exacto del build fresco auditado, aunque el frontend source no cambio desde V1.1.
- Configuracion LAN desalineada en `8081`: backend env aun apunta a `192.168.1.41`.

No confirmado:

- `BRANCH_NOT_IN_MAIN`: NO.
- `MISSING_BRANCH_WORK`: NO como rama limpia integrable.
- `BROWSER_CACHE`: NO como causa raiz principal.

## 11. Acciones recomendadas

1. Confirmar con el usuario la URL exacta del navegador. Si es `8080`, cambiar a `http://192.168.1.10:8081` o retirar/rotular el stack viejo.
2. Ejecutar el runbook `docs/qa/RUNTIME_REBUILD_RUNBOOK.md` para reconstruir/reiniciar el stack correcto sin borrar datos y alinear `APP_URL`, CORS, Sanctum y `SERVER_IP` a `192.168.1.10`.
3. Hacer hard refresh en el navegador despues del rebuild: `Ctrl+F5` o cerrar todas las pestañas de la app.
4. Si despues de ver `8081` actualizado el usuario sigue percibiendo "igual", ejecutar un nuevo plan visual visible basado en `docs/ux/VISIBLE_UI_DELTA_PLAN.md`.

## 12. Riesgos

- No reiniciar stack operativo real sin autorizacion, backup previo y ventana breve.
- No mezclar ramas rescue/stash sin auditoria especifica.
- No declarar produccion fisica aprobada; impresora, segunda PC LAN y aceptacion externa siguen pendientes.

## 13. Decision

No se integra ninguna rama faltante.

No se reinicia produccion.

Se deja evidencia de que `main` esta correcto, `8081` refleja V1.1 de forma sobria, `8080` es puerto/stack viejo, y la configuracion LAN de `8081` debe alinearse antes de pedir al usuario una aceptacion visual final.
