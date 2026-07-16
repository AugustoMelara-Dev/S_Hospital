# CI Workflow Recovery Design

## Contexto

Las ejecuciones recientes de GitHub Actions terminan inmediatamente sin crear
jobs. La auditoría del workflow vigente identificó que
`jobs.backend-sqlite.services` se serializa como `null`: existe una clave
`services:` sin ningún servicio definido. GitHub Actions rechaza el workflow
antes de programar los jobs, por lo que ningún gate automatizado protege
`main`.

## Objetivo

Restaurar la validez estructural de `.github/workflows/ci.yml` y prevenir la
regresión sin cambiar la matriz de pruebas, las dependencias ni el
comportamiento de S_Hospital.

## Diseño aprobado

- Eliminar del job `backend-sqlite` la clave `services:` vacía y el comentario
  que quedó dentro de ella.
- Mantener intacto el servicio MariaDB real del job `backend-mariadb`.
- Ampliar `WindowsInstallSecretsTest`, que ya protege contratos del workflow,
  con una regresión que detecte claves `services:` cuyo bloque no contiene un
  servicio con mayor indentación.
- Verificar primero que la regresión falle con el workflow actual y después
  que pase con la corrección.
- Validar adicionalmente que el YAML pueda parsearse y que no existan valores
  nulos fuera de las formas válidas de los triggers de GitHub Actions.

## Límites

- No cambiar código funcional, base de datos, Docker, dependencias ni secretos.
- No modificar `frontend/package-lock.json`, que contiene cambios preexistentes
  del usuario.
- No combinar en esta fase la fuga de artefactos temporales de PHPUnit ni la
  optimización del runner Vitest de Windows.

## Pruebas y aceptación

La fase se acepta cuando:

1. La prueba enfocada falla contra el workflow defectuoso por la clave
   `services:` vacía.
2. La misma prueba pasa después de eliminar el bloque vacío.
3. `backend-sqlite` no declara `services` y `backend-mariadb` conserva
   `services.mariadb`.
4. Pint confirma estilo limpio en el test modificado.
5. El diff final contiene solo el workflow, la regresión y la documentación de
   esta fase, además del cambio ajeno preexistente que queda sin incluir.
