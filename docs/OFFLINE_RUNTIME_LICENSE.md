# Runtime license: Docker Desktop vs Docker Engine (S_Hospital)

- **Estado:** documento de decision. NO constituye asesoría legal ni aprobacion
  institucional.
- **Fecha de revision:** 2026-09-17.
- **Alcance:** runtime de contenedores del servidor S_Hospital (Windows y Linux).
- **Fuentes:** Docker Subscription Service Agreement, Docker Desktop license
  (`https://docs.docker.com/subscription-billing/desktop-license/`), Docker
  Public Sector SSA, Docker Plans FAQ y Docker Terms of Use. Verificar
  vigencia antes de una compra; los terminos pueden cambiar.

## 1. Por que importa

S_Hospital ejecuta su stack de produccion (PHP-FPM/Laravel, nginx, MariaDB,
Soketi, worker y scheduler) como contenedores Linux. En Windows el camino
soportado por `setup.bat` / `S_Hospital-Instalador.exe` es **Docker Desktop**;
el instalador exige detectar Docker Desktop y no ofrece un fallback automatico
(`installer/S_Hospital.iss:59-79`). La eleccion del runtime tiene condiciones
de licencia distintas, y un hospital publico no puede asumir la exencion de
"pequena empresa".

## 2. Situacion de licencia (resumen verificado)

### Docker Desktop

- Se rige por el **Docker Subscription Service Agreement (SSA)**.
- Es gratuito para: uso personal, educacion, proyectos de codigo abierto no
  comerciales y pequenas empresas con **menos de 250 empleados Y menos de
  USD 10 millones** de ingreso anual.
- Requiere **suscripcion pagada** para: uso profesional en organizaciones mas
  grandes, uso comercial fuera del tramo gratuito y, de forma explicita,
  **entidades gubernamentales (Government Entities)**.
- El SSA define "Government Entity" de forma amplia: incluye entidades cuyo
  financiamiento principal proviene del gobierno (por ejemplo, un hospital
  publico). Las entidades de gobierno de EE. UU. quedan ademas sujetas al
  Public Sector Subscription Service Agreement y **no** tienen derecho a los
  servicios sin cargo.
- El tramo gratuito de "pequena empresa" **no** se puede invocar por tratarse
  de un hospital: la propia clausula excluye a las entidades gubernamentales.

### Docker Engine

- Es software de codigo abierto del proyecto Moby, bajo **Apache License 2.0**.
- Los terminos de licencia y distribucion de Docker Engine (y de Moby) **no
  cambian** por el SSA de Docker Desktop.
- Si se obtiene de forma independiente, los derechos y obligaciones se rigen
  por su licencia open source, **sin suscripcion por puesto**.
- En Windows, Docker Engine no ejecuta imagenes Linux de forma nativa: el stack
  actual (nginx, php-fpm, MariaDB, Soketi) es Linux, por lo que Docker Engine
  requiere un host Linux o un entorno Linux (p. ej. WSL2) administrado por el
  hospital. Contenedores Windows no aplican a estas imagenes.

## 3. Consecuencia para S_Hospital

| Escenario de runtime | Licencia | Nota tecnica |
| --- | --- | --- |
| Windows + Docker Desktop (ruta actual de `setup.bat`) | Suscripcion pagada obligatoria para entidad gubernamental | Es el unico camino empaquetado hoy en el instalador Windows |
| Servidor Linux + Docker Engine | Apache-2.0, sin suscripcion | `docker-compose.prod.yml` es portable; cambia el SO del servidor |
| Windows + Docker Engine en WSL2 | Docker Engine Apache-2.0; el SO base sigue siendo Windows | Requiere decision y administracion de WSL2; no esta empaquetado |

**No se debe declarar apto para produccion** un despliegue Windows/Docker
Desktop en un hospital publico hasta que la institucion resuelva la licencia.

## 4. Decision institucional requerida (externa)

Esta decision pertenece a la institucion; el equipo tecnico no la toma, no
compra licencias y no cambia silenciosamente el sistema operativo.

- **Opcion A - Adquirir suscripcion de Docker Desktop** (Docker Business /
  Public Sector). Responsable: administracion/adquisiciones del hospital.
  Beneficio: conserva el instalador Windows ya empaquetado.
- **Opcion B - Adoptar un servidor Linux con Docker Engine.** Responsable:
  TI del hospital. Beneficio: runtime open source sin suscripcion; costo:
  cambio de SO del servidor y re-validacion fisica de la instalacion.
- **Opcion C - Evaluar un runtime alternativo compatible** (por ejemplo
  Podman u otro motor OCI sobre Linux). Responsable: TI + proveedor. Requiere
  una validacion tecnica nueva; fuera del alcance actual.

Criterio de cierre: registrar por escrito la opcion elegida, el responsable y
la fecha antes de promover el artefacto a produccion.

## 5. Lo que este repositorio NO hace

- No incluye claves, ordenes de compra ni binarios licenciados de Docker.
- No implementa un rodeo del requisito de suscripcion.
- No cambia el sistema operativo destino.
- No descarga ni instala Docker en el servidor del hospital.

## 6. Verificacion en este entorno (M-W1-INST-01)

- `docker` CLI presente (`C:\Program Files\Docker\Docker\resources\bin\docker.exe`).
- Daemon de Docker Desktop **detenido**: `docker version` devuelve
  `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
  Por eso no se pudo ejecutar `docker load` ni levantar el stack; ver
  `hospital-ai/evidencia/M-W1-INST-01/`.
- No se realizo ninguna compra, activacion ni cambio de licencia.
