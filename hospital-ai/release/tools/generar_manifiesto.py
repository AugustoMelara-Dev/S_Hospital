#!/usr/bin/env python3
"""Genera el MANIFIESTO_PRODUCTO (C1-REL-01).

Contenido:
  - HEAD base.
  - Huella del diff rastreado en dos variantes:
      * status_porcelain_sha256 : sha256 de `git status --porcelain=v1 -z`
      * diff_binario_sha256     : sha256 de `git diff HEAD --binary` (sin
                                  conversion de texto en la salida; se guarda
                                  como PARCHE_TRACKED.patch)
      * diff_texto_sha256       : sha256 de `git diff HEAD` (referencia)
  - Archivos rastreados reemplazados: ruta | tamano | sha256 completo.
  - Archivos nuevos necesarios:       ruta | tamano | sha256 completo.
  - Eliminaciones registradas.
  - Exclusiones registradas por patron (sin exponer valores).
  - Requisitos de reconstruccion.

El manifiesto NO se incluye a si mismo: su sha256 se publica en el sidecar
`MANIFIESTO_PRODUCTO.json.sha256`, nunca dentro del propio JSON.

Uso:
  python generar_manifiesto.py <raiz> <release_dir>
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inventario_no_rastreados import clasificar, sha256_file  # noqa: E402

BASE_FINGERPRINT_DECLARADO = "1713bd59ec0a076b01de07461559550a3d4fac9e"


def git(root: str, *args: str, check: bool = True) -> bytes:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, check=check).stdout


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def detectar_eol(path: str) -> str:
    """Clasifica el fin de linea realmente presente en disco."""
    with open(path, "rb") as fh:
        data = fh.read()
    crlf = data.count(b"\r\n")
    lf_total = data.count(b"\n")
    if lf_total == 0:
        return "sin_salto_de_linea"
    if crlf == 0:
        return "lf"
    if crlf == lf_total:
        return "crlf"
    return "mixto"


def parse_porcelain_z(blob: bytes) -> list[tuple[str, str]]:
    """Devuelve [(XY, ruta)] para porcelain v1 -z. Los renames traen dos rutas."""
    tokens = [t for t in blob.decode("utf-8", "surrogateescape").split("\0") if t]
    out: list[tuple[str, str]] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        xy, path = tok[:2], tok[3:]
        out.append((xy, path))
        if xy[0] in ("R", "C") or xy[1] in ("R", "C"):
            i += 1  # ruta original
        i += 1
    return out


def main() -> int:
    root = os.path.abspath(sys.argv[1])
    release = os.path.abspath(sys.argv[2])
    tools = os.path.join(release, "tools")
    os.makedirs(tools, exist_ok=True)

    head = git(root, "rev-parse", "HEAD").decode().strip()

    # --- huellas antes/despues para detectar arbol inestable -----------------
    status_blob_ini = git(root, "status", "--porcelain=v1", "-z")
    diff_bin_ini = git(root, "diff", "HEAD", "--binary")
    diff_txt_ini = git(root, "diff", "HEAD")
    untracked_ini = git(root, "ls-files", "--others", "--exclude-standard", "-z")

    # --- parche binario a disco (bytes crudos, sin conversion de PowerShell) --
    # Se escribe EXACTAMENTE el mismo buffer que se usa para la huella, de modo
    # que parche_sha256/fingerprint_git_hash_object no puedan desincronizarse.
    patch_path = os.path.join(release, "PARCHE_TRACKED.patch")
    with open(patch_path, "wb") as fh:
        fh.write(diff_bin_ini)
    patch_bytes = diff_bin_ini
    fingerprint_git = git(root, "hash-object", patch_path).decode().strip()

    entradas = parse_porcelain_z(status_blob_ini)
    modificados = sorted(p for xy, p in entradas if xy.strip() == "M" or xy in (" M", "MM", "AM"))
    eliminados = sorted(p for xy, p in entradas if "D" in xy and xy.strip() in ("D", "AD", "MD"))
    no_rastreadas = sorted(p for xy, p in entradas if xy == "??")

    # --- archivos producto ---------------------------------------------------
    archivos_rastreados = git(root, "ls-files", "-z").decode("utf-8", "surrogateescape").split("\0")
    archivos_rastreados = {p for p in archivos_rastreados if p}

    def registrar(rel: str) -> dict:
        abs_path = os.path.join(root, rel.replace("/", os.sep))
        return {
            "ruta": rel,
            "tamano": os.path.getsize(abs_path),
            "sha256": sha256_file(abs_path),
            "eol_en_disco": detectar_eol(abs_path),
        }

    reemplazados = []
    for rel in modificados:
        item = registrar(rel)
        item["categoria"] = "codigo_producto"
        reemplazados.append(item)

    todos_no_rastreados = [p for p in untracked_ini.decode("utf-8", "surrogateescape").split("\0") if p]
    nuevos = []
    por_clasificar = []
    excluidos: dict[str, dict] = {}
    for rel in todos_no_rastreados:
        categoria, necesaria, motivo = clasificar(rel)
        if categoria == "por_clasificar":
            por_clasificar.append(rel)
        if necesaria:
            item = registrar(rel)
            item["categoria"] = categoria
            nuevos.append(item)
        else:
            acc = excluidos.setdefault(categoria, {"patron": _patron(rel), "archivos": 0, "bytes": 0, "motivo": motivo})
            acc["archivos"] += 1
            acc["bytes"] += os.path.getsize(os.path.join(root, rel.replace("/", os.sep)))

    nuevos.sort(key=lambda x: x["ruta"])

    # --- instantanea completa del alcance de producto ------------------------
    # Permite que la verificacion sea determinista aunque el arbol siga cambiando.
    # Formato: <sha256>\t<eol_en_disco>\t<ruta>
    snapshot: list[tuple[str, str, str]] = []
    for rel in sorted(archivos_rastreados):
        abs_path = os.path.join(root, rel.replace("/", os.sep))
        if os.path.exists(abs_path):
            snapshot.append((rel, sha256_file(abs_path), detectar_eol(abs_path)))
        else:
            snapshot.append((rel, "ELIMINADO", "-"))
    for entrada in nuevos:
        snapshot.append((entrada["ruta"], entrada["sha256"], entrada["eol_en_disco"]))

    # --- deteccion de inestabilidad -----------------------------------------
    status_blob_fin = git(root, "status", "--porcelain=v1", "-z")
    diff_bin_fin = git(root, "diff", "HEAD", "--binary")
    untracked_fin = git(root, "ls-files", "--others", "--exclude-standard", "-z")
    estable = (status_blob_ini == status_blob_fin) and (diff_bin_ini == diff_bin_fin) and (untracked_ini == untracked_fin)

    # --- consistencia interna: los hashes citados siguen siendo validos? ----
    hashes_cambiados = []
    for grupo, lista in (("archivos_reemplazados", reemplazados), ("archivos_nuevos", nuevos)):
        for entrada in lista:
            abs_path = os.path.join(root, entrada["ruta"].replace("/", os.sep))
            if not os.path.exists(abs_path):
                hashes_cambiados.append({"grupo": grupo, "ruta": entrada["ruta"], "causa": "desaparecio"})
                continue
            if sha256_file(abs_path) != entrada["sha256"]:
                hashes_cambiados.append({"grupo": grupo, "ruta": entrada["ruta"], "causa": "sha256"})
    hashes_estables = not hashes_cambiados

    bytes_producto = sum(f["tamano"] for f in reemplazados) + sum(f["tamano"] for f in nuevos)

    manifiesto = {
        "esquema": "hospital-ai/release/MANIFIESTO_PRODUCTO",
        "version": 1,
        "generado_utc": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "generado_por": "hospital-ai/release/tools/generar_manifiesto.py",
        "raiz_absoluta": root,
        "base": {
            "head": head,
            "comando_parche": "git diff HEAD --binary",
            "parche_archivo": "hospital-ai/release/PARCHE_TRACKED.patch",
            "parche_sha256": sha256_bytes(patch_bytes),
            "parche_bytes": len(patch_bytes),
            "fingerprint_git_hash_object": fingerprint_git,
            "fingerprint_git_hash_object_comando": "git diff HEAD --binary > f; git hash-object f",
            "status_porcelain_v1_z_sha256": sha256_bytes(status_blob_ini),
            "diff_binario_sha256": sha256_bytes(diff_bin_ini),
            "diff_texto_sha256": sha256_bytes(diff_txt_ini),
            "fingerprint_declarado_en_briefing": BASE_FINGERPRINT_DECLARADO,
            "fingerprint_declarado_coincide": fingerprint_git == BASE_FINGERPRINT_DECLARADO
            or sha256_bytes(diff_txt_ini) == BASE_FINGERPRINT_DECLARADO,
            "snapshot_archivo": "hospital-ai/release/SNAPSHOT_PRODUCTO.sha256.txt",
        },
        "estabilidad": {
            "estable_durante_generacion": estable,
            "diff_rastreado_estable": diff_bin_ini == diff_bin_fin,
            "status_estable": status_blob_ini == status_blob_fin,
            "lista_no_rastreados_estable": untracked_ini == untracked_fin,
            "hashes_del_manifiesto_estables_al_cierre": hashes_estables,
            "rutas_con_hash_cambiado_al_cierre": hashes_cambiados,
            "archivos_por_clasificar_fail_closed": por_clasificar,
            "nota": ("true = la huella de status, el diff binario y la lista de no rastreados "
                     "no cambiaron entre el inicio y el fin de la generacion."
                     if estable else
                     "FALSO: otro proceso toco el arbol durante la generacion. Revisar los tres "
                     "subindicadores: si `diff_rastreado_estable` y "
                     "`hashes_del_manifiesto_estables_al_cierre` son true, el PRODUCTO descrito "
                     "no cambio; la deriva estuvo en artefactos de campana no incluidos."),
        },
        "resumen": {
            "archivos_rastreados_modificados": len(reemplazados),
            "archivos_rastreados_eliminados": len(eliminados),
            "archivos_nuevos_necesarios": len(nuevos),
            "entradas_no_rastreadas_en_status": len(no_rastreadas),
            "archivos_no_rastreados_expandidos": len(todos_no_rastreados),
            "bytes_producto": bytes_producto,
        },
        "archivos_reemplazados": reemplazados,
        "archivos_nuevos": nuevos,
        "eliminaciones": [{"ruta": p, "nota": "Eliminacion requiere borrar la ruta tras aplicar el parche."} for p in eliminados],
        "exclusiones": [
            {
                "categoria": cat,
                "patron": info["patron"],
                "archivos": info["archivos"],
                "bytes": info["bytes"],
                "motivo": info["motivo"],
                "valores_incluidos": False,
            }
            for cat, info in sorted(excluidos.items())
        ],
        "exclusiones_por_gitignore": {
            "mecanismo": "git ls-files --others --exclude-standard",
            "nota": ("Todo patron ignorado (.env*, backend/.env, backend/storage/**, backups, "
                     "node_modules, vendor, dist, installer-output, offline-release, nginx/ssl, "
                     "qa/screenshots) quedo FUERA del inventario: no se leyo ni se hasheo ningun "
                     "valor. Los secretos y datos operativos no aparecen en este manifiesto."),
            "patrones_relevantes_no_leidos": [
                ".env*", "backend/.env", "backend/storage/app/private/backups/",
                "backend/storage/logs/", "backend/vendor/", "frontend/node_modules/",
                "frontend/dist/", "installer-output/", "offline-release/",
                "nginx/ssl/", "backup-external/", "qa/screenshots/**",
            ],
        },
        "requisitos_de_reconstruccion": [
            "1. Partir de un clon del repositorio en el commit base HEAD indicado en `base.head`.",
            "2. Extraer los blobs del arbol base SIN filtros de atributos (p. ej. `git cat-file blob`), "
            "porque .gitattributes declara `*.ps1 text eol=crlf` mientras los blobs y el arbol actual "
            "estan en LF: un `git checkout` normal produciria CRLF y no seria byte-identico.",
            "3. Aplicar `hospital-ai/release/PARCHE_TRACKED.patch` (generado con `git diff HEAD --binary`) "
            "con `git -c core.autocrlf=false -c core.eol=lf apply --binary`, neutralizando "
            "temporalmente `.gitattributes` para evitar la conversion eol; restaurarlo despues. "
            "El `core.autocrlf=true` del gitconfig de sistema NO debe aplicarse: convertiria a CRLF "
            "y romperia la igualdad byte a byte.",
            "4. Copiar byte a byte los archivos de `archivos_nuevos` (los que tienen "
            "`necesaria_para_reconstruir` en el inventario).",
            "5. Aplicar las `eliminaciones` (vacio en este candidato).",
            "6. Ejecutar `python hospital-ai/release/tools/verificar_manifiesto.py <raiz> <release_dir>` "
            "y exigir 0 discrepancias.",
            "7. `composer install` / `pnpm install --frozen-lockfile` requieren red o cache local: "
            "no forman parte del presente manifiesto (lockfiles si estan incluidos).",
        ],
        "no_incluido_en_su_propio_hash": [
            "hospital-ai/release/MANIFIESTO_PRODUCTO.json",
            "hospital-ai/release/MANIFIESTO_PRODUCTO.sha256.txt",
            "hospital-ai/release/MANIFIESTO_PRODUCTO.json.sha256",
            "hospital-ai/release/PARCHE_TRACKED.patch",
            "hospital-ai/release/tools/**",
            "hospital-ai/release/README_MANIFIESTO.md",
        ],
    }

    json_path = os.path.join(release, "MANIFIESTO_PRODUCTO.json")
    with open(json_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifiesto, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    flat_path = os.path.join(release, "MANIFIESTO_PRODUCTO.sha256.txt")
    with open(flat_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"# MANIFIESTO_PRODUCTO C1-REL-01\n")
        fh.write(f"# head={head}\n")
        fh.write(f"# diff_binario_sha256={manifiesto['base']['diff_binario_sha256']}\n")
        fh.write(f"# parche_sha256={manifiesto['base']['parche_sha256']}\n")
        for f in reemplazados:
            fh.write(f"{f['sha256']}  {f['ruta']}\n")
        for f in nuevos:
            fh.write(f"{f['sha256']}  {f['ruta']}\n")

    sidecar = os.path.join(release, "MANIFIESTO_PRODUCTO.json.sha256")
    with open(sidecar, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"{sha256_file(json_path)}  MANIFIESTO_PRODUCTO.json\n")

    snap_path = os.path.join(release, "SNAPSHOT_PRODUCTO.sha256.txt")
    with open(snap_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# SNAPSHOT_PRODUCTO C1-REL-01\n")
        fh.write("# formato: sha256 \\t eol_en_disco \\t ruta\n")
        fh.write(f"# head={head}\n")
        fh.write(f"# fingerprint_git_hash_object={fingerprint_git}\n")
        fh.write(f"# status_porcelain_v1_z_sha256={sha256_bytes(status_blob_ini)}\n")
        fh.write(f"# archivos={len(snapshot)}\n")
        for rel, digest, eol in snapshot:
            fh.write(f"{digest}\t{eol}\t{rel}\n")

    print(json.dumps({
        "manifest_sha256": sha256_file(json_path),
        "snapshot_sha256": sha256_file(snap_path),
        "head": head,
        "modificados": len(reemplazados),
        "nuevos": len(nuevos),
        "eliminados": len(eliminados),
        "estable": estable,
        "hashes_estables": hashes_estables,
        "fingerprint_git_hash_object": fingerprint_git,
        "diff_binario_sha256": manifiesto["base"]["diff_binario_sha256"],
        "diff_texto_sha256": manifiesto["base"]["diff_texto_sha256"],
    }, indent=2))
    return 0


def _patron(rel: str) -> str:
    for prefijo in ("hospital-ai/evidencia/", "hospital-ai/progreso/", "hospital-ai/diseno/",
                    ".opencode/", ".agents/", ".superpowers/", "reports/", "qa/"):
        if rel.startswith(prefijo):
            return prefijo + "**"
    return rel


if __name__ == "__main__":
    raise SystemExit(main())
