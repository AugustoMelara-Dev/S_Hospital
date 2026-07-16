# Pnpm Build Policy And Preinstall Scan Design

## Contexto

El job frontend fija pnpm 11.7 y usa `pnpm install --frozen-lockfile`, pero no
versiona una política `allowBuilds`. Una instalación limpia con pnpm 11 verificó
702 entradas del lockfile e instaló 595 paquetes, pero terminó con
`ERR_PNPM_IGNORED_BUILDS` porque `esbuild@0.28.1` necesita ejecutar su build y no
está aprobado. pnpm generó como propuesta `allowBuilds: esbuild` y devolvió exit
1; por tanto el CI actual no puede llegar a typecheck.

El guard de indicadores agregado en la fase anterior corre después de instalar.
Ese orden permite inspeccionar artefactos, pero un IOC conocido del lockfile debe
bloquearse antes de que cualquier lifecycle script aprobado pueda ejecutarse.

El runbook también afirma que existen `.npmrc` en frontend/backend, pero ninguno
está presente en el árbol actual.

## Objetivo

Restaurar la instalación reproducible con pnpm 11 mediante una allowlist mínima
de builds y establecer defensa en dos momentos: locks/manifiestos antes de
instalar y artefactos instalados antes del audit y los tests.

## Diseño aprobado

- Crear `frontend/pnpm-workspace.yaml` con una única entrada:
  `allowBuilds.esbuild: true`.
- Prohibir contractualmente `dangerouslyAllowAllBuilds` y
  `strictDepBuilds: false`.
- Ejecutar el self-test del guard y un escaneo preinstalación antes de
  `pnpm install --frozen-lockfile`.
- Conservar un segundo escaneo después de instalar para revisar `node_modules`.
- Mantener `pnpm audit --audit-level high` después de ambos escaneos.
- Proteger el orden completo con el contrato CI y corregir el runbook.

## Alternativas descartadas

- `--ignore-scripts`: impediría el build legítimo de esbuild y puede dejar el
  binario no funcional para Vite.
- `dangerouslyAllowAllBuilds: true`: autorizaría scripts presentes y futuros de
  toda dependencia transitiva, ampliando innecesariamente la superficie.
- `strictDepBuilds: false`: convertiría una dependencia nueva con scripts no
  revisados en warning y permitiría que el job continúe con estado incompleto.
- Mantener solo el escaneo postinstall: detecta evidencia después de que el
  código de instalación pudo ejecutarse.
- Aprobar por rango/version exacta de esbuild: la clave simple `esbuild` conserva
  la aprobación funcional requerida; cualquier versión seguirá congelada por el
  lockfile y revisada por audit/guard.

## Riesgos y mitigaciones

- **Nuevo paquete con build legítimo:** la instalación fallará explícitamente y
  exigirá revisión/allowlist en un cambio separado.
- **Cambio de versión esbuild:** el lockfile congelado controla la versión y la
  allowlist no autoriza ningún otro paquete.
- **Costo de dos escaneos:** el preinstall en un checkout limpio no tiene
  `node_modules`; el postinstall mantiene la cobertura de archivos instalada.
- **Deriva de configuración:** tests exigen allowlist exacta y niegan las dos
  opciones que relajan la política global.
- **Cambios del usuario:** `frontend/package-lock.json` permanece sin stage.

## Pruebas y aceptación

1. Un test falla inicialmente porque `pnpm-workspace.yaml` no existe.
2. El contrato de orden falla mientras el self-test/guard estén después de
   instalar y no exista escaneo postinstall separado.
3. Una instalación limpia `pnpm install --frozen-lockfile` aprueba con la
   política versionada, ejecuta el postinstall y el binario transitivo de esbuild
   responde con su versión.
4. Self-test, guard real, audit, contrato CI, YAML y Pint aprueban.
5. Ningún lockfile se modifica y el commit mantiene una sola allowlist de build.
