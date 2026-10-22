# Manifiesto de producto — C1-REL-01

Artefactos de reconstrucción del candidato local de S_Hospital. **No certifica
nada**: describe *qué bytes* componen el producto en un instante concreto y
prueba que ese conjunto se puede reconstruir desde el commit base.

## Archivos

| Archivo | Rol | Se incluye en su propio hash |
|---|---|---|
| `MANIFIESTO_PRODUCTO.json` | Manifiesto canónico (rutas, tamaño, SHA-256 completo, categoría) | **no** |
| `MANIFIESTO_PRODUCTO.sha256.txt` | Lista plana `sha256  ruta` de las 420 entradas | **no** |
| `MANIFIESTO_PRODUCTO.json.sha256` | Sidecar con el SHA-256 del propio JSON | — |
| `SNAPSHOT_PRODUCTO.sha256.txt` | Instantánea del alcance completo (1990 rutas: todos los rastreados + nuevos necesarios) con `eol_en_disco` | **no** |
| `PARCHE_TRACKED.patch` | `git diff HEAD --binary` en bytes crudos | es una *entrada*, no una salida |
| `tools/*.py` | Scripts reproducibles | **no** |

El manifiesto **no se incluye a sí mismo**: no aparece en `archivos_nuevos`, no
aparece en `SNAPSHOT_PRODUCTO.sha256.txt`, y su hash vive solo en el sidecar.
`hospital-ai/release/**` está registrado en `exclusiones` como
`manifiesto_release`.

## Huellas registradas

| Huella | Comando |
|---|---|
| `fingerprint_git_hash_object` | `git diff HEAD --binary > f; git hash-object f` (el fingerprint de campaña) |
| `diff_binario_sha256` / `parche_sha256` | `sha256(git diff HEAD --binary)` |
| `status_porcelain_v1_z_sha256` | `sha256(git status --porcelain=v1 -z)` |

## Reconstrucción reproducible

```powershell
# 1) Verificar que las citas del manifiesto siguen existiendo en el árbol
python hospital-ai/release/tools/verificar_manifiesto.py . hospital-ai/release

# 2) Reconstruir desde el commit base + parche + archivos nuevos, y verificar
$dest = Join-Path $env:TEMP ("C1-REL-01-recon-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
python hospital-ai/release/tools/reconstruir_y_verificar.py . hospital-ai/release $dest `
       --json hospital-ai/evidencia/C1-REL-01/reconstruccion.json

# 3) Volver a inventariar las entradas no rastreadas
python hospital-ai/release/tools/inventario_no_rastreados.py . `
       hospital-ai/evidencia/C1-REL-01/inventario-no-rastreados.json `
       hospital-ai/evidencia/C1-REL-01/inventario-archivos.tsv `
       hospital-ai/evidencia/C1-REL-01/inventario-entradas.tsv
```

`reconstruir_y_verificar.py` es autocontenido: no lee archivos "olvidados" del
worktree para los 290 reemplazados (los obtiene del parche) y solo copia las 130
rutas declaradas en `archivos_nuevos`.

### Procedimiento que aplica el script (y que hay que replicar a mano)

1. **Base**: extraer *blobs* del árbol `HEAD` con `git cat-file` — **no** usar
   `git checkout`/`git archive`, que aplican filtros de atributos.
2. **Parche**: `git -c core.autocrlf=false -c core.eol=lf apply --binary
   --whitespace=nowarn PARCHE_TRACKED.patch`, con `.gitattributes` neutralizado
   (renombrado temporalmente) y restaurado después.
3. **Nuevos**: copiar byte a byte las 130 rutas de `archivos_nuevos`.
4. **Eliminaciones**: aplicar `eliminaciones` (vacío en este candidato).
5. **EOL**: para las rutas con `eol_en_disco = crlf`, reaplicar `\n → \r\n`
   (la Fase 1 deja LF normalizado por git).
6. **Verificar**: comparar SHA-256 de las 420 entradas del manifiesto y del
   alcance completo de 1990 rutas.

### Por qué hacen falta los pasos 1 y 5

`.gitattributes` declara `*.ps1 text eol=crlf`, pero el árbol está mezclado: hay
`.ps1` en LF (la mayoría) y `.ps1`/`.cmd`/`.bat` en CRLF. Un `git checkout`
normal produciría CRLF en todos los `.ps1` y no sería byte-idéntico. Además
`core.autocrlf=true` está puesto en el `gitconfig` de sistema
(`C:/Program Files/Git/etc/gitconfig`): cualquier `git apply` fuera del
repositorio convierte LF→CRLF salvo que se desactive explícitamente. Ambos
efectos se neutralizan en los pasos 1–2 y se reaplican selectivamente en el
paso 5, siguiendo el campo `eol_en_disco` de la instantánea.

## Clasificación de lo no rastreado

El inventario (`inventario_no_rastreados.py`) separa:

- **producto** (`necesaria_para_reconstruir = true`): `codigo_producto`,
  `migracion`, `prueba`, `configuracion`, `documentacion_producto`,
  `tooling_producto`;
- **no producto** (se registra como exclusión, sin exponer valores):
  `artefacto_campana_*` (evidencia/progreso/diseño/gobernanza), `tooling_agentes`,
  `manifiesto_release`, `prescindible`.

La clasificación es **fail-closed**: una ruta sin regla cae en
`por_clasificar` con `necesaria_para_reconstruir = true` y el script devuelve
código 2. Así nunca se pierde un archivo de producto nuevo; hay que añadir una
regla explícita.

Los secretos y datos operativos **no se leen ni se hashean**: la lista de
entrada sale de `git ls-files --others --exclude-standard`, de modo que `.env*`,
`backend/storage/**`, `backups`, `installer-output/`, `offline-release/`,
`node_modules`, `vendor`, `dist`, `nginx/ssl` y `qa/screenshots` quedan fuera por
construcción.

## Estado

- `estabilidad` en el manifiesto registra si el árbol se movió durante la
  generación. Con otros agentes escribiendo en paralelo, un `false` en
  `estable_durante_generacion` **no** invalida el producto ya emitido: mirar
  `diff_rastreado_estable` y `hashes_del_manifiesto_estables_al_cierre`.
- Este manifiesto es una **instantánea**, no una certificación. Mientras el
  worktree cambie, cualquier hash citado deja de valer para el estado actual.
