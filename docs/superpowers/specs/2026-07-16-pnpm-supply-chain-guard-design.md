# Pnpm Supply-Chain Guard Design

## Contexto

S_Hospital mantiene un guard local contra indicadores de compromiso conocidos.
El guard valida manifiestos npm, `package-lock.json`, `composer.lock`, archivos
instalados y nombres sospechosos. Sin embargo, CI instala el frontend desde
`pnpm-lock.yaml`, cuyas versiones no son interpretadas por el guard. Una versión
prohibida presente únicamente en el lockfile autoritativo de CI podría pasar.

El script también filtra rutas mediante expresiones que solo reconocen `\`, por
lo que ejecutarlo en `ubuntu-latest` podría recorrer `node_modules` como si fuera
código del repositorio o ignorar sus raíces de escaneo.

La ejecución local actual del guard termina limpia en 50.7 s: cero hallazgos y
cero warnings.

## Objetivo

Hacer que el guard detecte paquetes y versiones prohibidas dentro de lockfiles
pnpm v9, funcione con rutas Windows/Linux y se ejecute como gate probado dentro
del job frontend de CI.

## Diseño aprobado

- Añadir `Test-PnpmLock`, que lee únicamente claves de paquete con indentación de
  dos espacios (`name@version` y `@scope/name@version`) y elimina sufijos de peers
  antes de consultar `Test-DeniedNpmVersion`.
- Deduplicar cada combinación nombre/versión porque pnpm puede repetirla en
  `packages` y `snapshots`.
- Descubrir todos los `pnpm-lock.yaml` fuera de dependencias instaladas y aplicar
  el nuevo detector.
- Cambiar filtros de ruta relevantes a `[\\/]` y construir raíces anidadas con
  `Join-Path`, sin asumir el separador del host.
- Añadir un test PowerShell sin Pester que cree fixtures temporales:
  paquete prohibido universal, versión exacta prohibida con contexto de peers y
  lockfile seguro.
- Ejecutar primero el self-test y luego el guard real en CI, después de la
  instalación congelada y antes de `pnpm audit`.
- Proteger presencia, comandos y orden mediante el contrato CI existente.

## Alternativas descartadas

- Confiar solo en `pnpm audit`: los indicadores internos pueden bloquear una
  versión antes o independientemente de que el registro publique un advisory.
- Convertir YAML completo desde PowerShell: requeriría módulo/dependencia nueva
  para reconocer una estructura muy acotada y estable del lockfile.
- Buscar texto sin interpretar nombre y versión: produciría falsos positivos en
  metadata, hashes o referencias y no distinguiría una versión segura.
- Ejecutar el guard sin self-test: una refactorización podría convertirlo en un
  gate que siempre retorna éxito.

## Riesgos y mitigaciones

- **Cambios futuros de formato pnpm:** fixtures reproducen claves sin scope, con
  scope, comillas y contexto de peers; el self-test falla si dejan de reconocerse.
- **Hallazgos duplicados:** un `HashSet` conserva una sola evidencia por
  nombre/versión.
- **Borrado temporal:** el test usa una ruta UUID bajo el temp del sistema,
  verifica que permanezca dentro de ese directorio y elimina solo esa raíz.
- **Costo CI:** el self-test usa fixtures mínimos; el guard real reutiliza la
  instalación ya hecha y su baseline local es menor a un minuto.
- **Compatibilidad PowerShell:** se invoca el mismo ejecutable que corre el test,
  válido para Windows PowerShell y `pwsh` en Ubuntu.

## Pruebas y aceptación

1. El self-test falla antes del parser porque el fixture pnpm malicioso obtiene
   exit 0.
2. Después del cambio, ambos fixtures maliciosos fallan con evidencia
   `pnpm-lock` y el fixture seguro aprueba.
3. El guard real aprueba el repositorio actual sin warnings.
4. El contrato CI exige self-test → guard real → auditoría del registro.
5. El workflow pasa parseo YAML y los tests/Pint relevantes aprueban.
6. El cambio no modifica ningún lockfile ni añade dependencias.
