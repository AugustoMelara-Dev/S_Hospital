# Central Supply-Chain Preflight Design

## Contexto

Los cuatro jobs actuales arrancan en paralelo. El job frontend ejecuta el guard
antes de pnpm, pero ambos jobs backend pueden haber iniciado `composer install`
al mismo tiempo. Cada backend ejecuta `composer audit` solo después de instalar.
Composer documenta que `install` puede ejecutar código de terceros y que
`composer audit --locked` audita directamente `composer.lock` sin requerir
`vendor`.

El repositorio ya cuenta con un self-test y un guard multiplataforma que leen
manifiestos y locks npm, pnpm y Composer sin instalar dependencias.

## Objetivo

Establecer un único preflight obligatorio que inspeccione todos los locks antes
de cualquier instalación en CI, y mover el audit de Composer antes de cada
instalación backend usando explícitamente el lockfile.

## Diseño aprobado

- Crear job `supply-chain` con checkout, self-test y guard `-SkipTemp`.
- Hacer que `backend-sqlite`, `backend-mariadb` y `frontend` dependan de ese job.
- Retirar del frontend el self-test y escaneo preinstall duplicados; conservar su
  escaneo postinstall de `node_modules`.
- Mover `composer audit --locked --no-interaction` antes de `composer install` en
  ambos jobs backend y ejecutar exactamente una auditoría por job.
- Mantener instalaciones Composer sin otros cambios: no alterar scripts/plugins
  hasta disponer de un entorno local que certifique ese flujo más invasivo.
- Actualizar tests para proteger la barrera central, el orden Composer y el
  escaneo postinstall frontend.

## Alternativas descartadas

- Duplicar el guard preinstall en tres jobs: triplica tiempo/salida y aún permite
  que una instalación comience mientras otro guard falla.
- Confiar solo en audits del registro: el guard interno contiene IOCs que pueden
  adelantarse o complementar advisories públicos.
- Cambiar Composer a `--no-scripts --no-plugins` en esta fase: sería más fuerte,
  pero exige reconstruir y certificar package discovery/autoload en un runtime
  Composer local hoy no disponible.
- Serializar todos los jobs: solo el preflight necesita precederlos; backend y
  frontend deben volver a correr en paralelo después.

## Riesgos y mitigaciones

- **Latencia inicial:** el preflight agrega una barrera corta, después mantiene
  paralelismo completo.
- **Fallo de red del audit Composer:** cada backend ya dependía del mismo audit;
  solo cambia el orden y `--locked` hace explícita la fuente.
- **Job omitido por configuración:** tests exigen `needs: supply-chain` en los
  tres consumidores de dependencias.
- **Pérdida de escaneo instalado:** frontend conserva el guard posterior a pnpm.
- **Lockfile del usuario:** no se modifica ni se prepara para commit.

## Pruebas y aceptación

1. Los contratos fallan inicialmente porque no existe job central ni `needs` y
   Composer se audita después de instalar.
2. YAML contiene cinco jobs y el preflight tiene self-test → guard.
3. Los tres jobs de instalación dependen de `supply-chain`.
4. Ambos backends ejecutan audit locked → install exactamente una vez.
5. Frontend conserva install → escaneo instalado → pnpm audit.
6. Self-test, guard real, audit pnpm, contratos CI, YAML y Pint aprueban.
7. Ningún lockfile cambia.
