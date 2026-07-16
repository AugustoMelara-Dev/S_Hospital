# Test Artifact Isolation Design

## Contexto

`SystemStatusTest::test_loopback_app_url_is_treated_as_local_single_machine_mode`
crea un frontend simulado dentro de
`backend/storage/framework/testing-local-mode-status`. Esa ruta no está
ignorada y el test no registra limpieza. El caso funcional pasa, pero deja dos
archivos no rastreados en el repositorio, lo que contamina revisiones, commits
y otros gates.

## Objetivo

Aislar ese fixture fuera del repositorio y hacer que el CI falle si la suite
backend vuelve a modificar archivos rastreados o a crear archivos no ignorados.

## Diseño aprobado

- Crear el fixture local bajo `sys_get_temp_dir()` con un sufijo aleatorio por
  ejecución.
- Registrar su eliminación con `beforeApplicationDestroyed` inmediatamente
  después de definir la ruta, de modo que se limpie también si una aserción
  posterior falla.
- Mantener los fixtures históricos rastreados de evidencia de producción sin
  cambios; no aplicar una limpieza global a `storage/framework`.
- Añadir al job `backend-sqlite` un paso posterior a PHPUnit que inspeccione
  `git status --porcelain --untracked-files=all` y falle mostrando el estado si
  detecta residuos.
- Proteger la presencia y el orden de ese gate con el test de contratos CI
  existente.

## Alternativas descartadas

- Añadir la ruta a `.gitignore`: ocultaría el defecto y permitiría acumulación
  silenciosa de archivos.
- Limpiar todo `storage/framework` al terminar PHPUnit: podría borrar fixtures
  de evidencia que sí están versionados.
- Añadir solo un callback sobre la ruta actual: corrige este caso, pero no
  previene futuras fugas de otras pruebas.

## Riesgos y mitigaciones

- **Colisión de fixtures:** el sufijo de `random_bytes` hace única cada ruta.
- **Residuo por error temprano:** el callback se registra antes de crear los
  directorios.
- **Falso positivo en CI:** `.env`, `vendor`, caches y artefactos conocidos ya
  están ignorados; el gate observa únicamente cambios rastreados y archivos no
  ignorados.
- **Exposición de datos:** el fixture contiene solo HTML/JS sintético y se
  elimina al destruir la aplicación de prueba.

## Pruebas y aceptación

1. Antes del cambio, el test enfocado deja dos archivos no rastreados bajo
   `testing-local-mode-status`.
2. Una regresión de contrato CI falla antes de añadir el gate de limpieza.
3. Después del cambio, el test enfocado pasa y no crea entradas bajo
   `backend/storage/framework/testing-local-mode-status`.
4. La ruta temporal creada fuera del repositorio tampoco existe al finalizar.
5. El test de contratos CI y Pint pasan.
6. El commit no incluye `frontend/package-lock.json` ni cambios funcionales.
