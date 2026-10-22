#!/usr/bin/env python3
"""Reconstruccion real del producto desde el manifiesto (C1-REL-01).

No depende de archivos "olvidados" del worktree: parte del commit base del
repositorio + el parche binario del manifiesto + la lista `archivos_nuevos`.

Procedimiento:
  1. Extrae los blobs del arbol HEAD byte a byte (`git cat-file`), sin filtros
     de atributos (necesario porque .gitattributes declara `*.ps1 eol=crlf`
     mientras los blobs y el arbol actual estan en LF).
  2. Aplica `PARCHE_TRACKED.patch` con `git apply --binary`, neutralizando
     temporalmente `.gitattributes` para evitar la conversion eol=crlf.
  3. Copia byte a byte los `archivos_nuevos` del manifiesto.
  4. Aplica las `eliminaciones` (si hubiera).
  5. Verifica:
     a. cada entrada del manifiesto contra el arbol reconstruido (sha256);
     b. cobertura completa: todo archivo del alcance de producto en el
        worktree debe existir en el arbol reconstruido con el mismo sha256
        (clasifica diferencias de solo-EOL aparte).

Uso:
  python reconstruir_y_verificar.py <raiz> <release_dir> <destino> [--json <salida>]
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inventario_no_rastreados import clasificar  # noqa: E402


def sha256_file(path: str, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def normalizar_eol(data: bytes) -> bytes:
    return data.replace(b"\r\n", b"\n")


def git_bytes(root: str, *args: str, check: bool = True) -> bytes:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, check=check).stdout


def listar_arbol(root: str, rev: str = "HEAD"):
    out = git_bytes(root, "ls-tree", "-r", "-z", rev)
    entradas = []
    for token in out.decode("utf-8", "surrogateescape").split("\0"):
        if not token:
            continue
        meta, _, path = token.partition("\t")
        modo, tipo, sha = meta.split(" ")
        entradas.append((modo, tipo, sha, path))
    return entradas


def extraer_blobs(root: str, entradas, destino: str):
    """Escribe los blobs byte a byte. Devuelve {ruta: sha256}."""
    hashes: dict[str, str] = {}
    proc = subprocess.Popen(["git", "cat-file", "--batch"], cwd=root,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    stdout = proc.stdout
    assert stdout is not None and proc.stdin is not None
    for modo, tipo, sha, path in entradas:
        proc.stdin.write((sha + "\n").encode())
        proc.stdin.flush()
        header = stdout.readline().decode().strip()
        if not header or header.endswith("missing"):
            raise RuntimeError(f"blob no encontrado: {sha} ({path})")
        partes = header.split(" ")
        tam = int(partes[2])
        data = stdout.read(tam)
        stdout.read(1)  # newline final
        abs_path = os.path.join(destino, path.replace("/", os.sep))
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "wb") as fh:
            fh.write(data)
        hashes[path] = hashlib.sha256(data).hexdigest()
    proc.stdin.close()
    proc.wait()
    return hashes


def main() -> int:
    raiz = os.path.abspath(sys.argv[1])
    release = os.path.abspath(sys.argv[2])
    destino = os.path.abspath(sys.argv[3])
    salida_json = None
    if "--json" in sys.argv:
        salida_json = os.path.abspath(sys.argv[sys.argv.index("--json") + 1])

    with open(os.path.join(release, "MANIFIESTO_PRODUCTO.json"), encoding="utf-8") as fh:
        manifiesto = json.load(fh)

    head = manifiesto["base"]["head"]
    head_actual = git_bytes(raiz, "rev-parse", "HEAD").decode().strip()
    parche = os.path.join(release, "PARCHE_TRACKED.patch")

    if os.path.exists(destino):
        shutil.rmtree(destino)
    os.makedirs(destino, exist_ok=True)

    informe: dict = {
        "destino": destino,
        "head_base": head,
        "head_actual": head_actual,
        "head_coincide": head == head_actual,
        "pasos": {},
        "discrepancias_manifiesto": [],
        "cobertura_worktree": [],
        "diferencias_solo_eol": [],
        "diferencias_eol_atributo": [],
        "faltantes_en_reconstruccion": [],
    }

    # --- 1. base byte-exacta -------------------------------------------------
    entradas = listar_arbol(raiz, head)
    hashes_base = extraer_blobs(raiz, entradas, destino)
    informe["pasos"]["1_base_blobs"] = {"archivos": len(entradas)}

    # --- 2. parche binario con atributos neutralizados -----------------------
    attrs_root = os.path.join(destino, ".gitattributes")
    attrs_backup = None
    if os.path.exists(attrs_root):
        with open(attrs_root, "rb") as fh:
            attrs_backup = fh.read()
        os.remove(attrs_root)
    attrs_nested = []
    for dirpath, _dirs, files in os.walk(destino):
        for nombre in files:
            if nombre == ".gitattributes":
                p = os.path.join(dirpath, nombre)
                with open(p, "rb") as fh:
                    attrs_nested.append((p, fh.read()))
                os.remove(p)

    aplicado = subprocess.run(
        ["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "-c", "core.safecrlf=false",
         "apply", "--binary", "--whitespace=nowarn", parche],
        cwd=destino, capture_output=True)
    informe["pasos"]["2_parche"] = {
        "comando": ("git -c core.autocrlf=false -c core.eol=lf apply --binary "
                    "--whitespace=nowarn PARCHE_TRACKED.patch (con .gitattributes neutralizado)"),
        "returncode": aplicado.returncode,
        "stdout": aplicado.stdout.decode("utf-8", "replace")[-4000:],
        "stderr": aplicado.stderr.decode("utf-8", "replace")[-4000:],
    }
    if attrs_backup is not None:
        with open(attrs_root, "wb") as fh:
            fh.write(attrs_backup)
    for p, data in attrs_nested:
        with open(p, "wb") as fh:
            fh.write(data)

    # --- 3. archivos nuevos --------------------------------------------------
    copiados = 0
    for entrada in manifiesto["archivos_nuevos"]:
        rel = entrada["ruta"]
        src = os.path.join(raiz, rel.replace("/", os.sep))
        dst = os.path.join(destino, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        copiados += 1
    informe["pasos"]["3_archivos_nuevos_copiados"] = copiados

    # --- 4. eliminaciones ----------------------------------------------------
    borrados = 0
    for entrada in manifiesto["eliminaciones"]:
        dst = os.path.join(destino, entrada["ruta"].replace("/", os.sep))
        if os.path.exists(dst):
            os.remove(dst)
            borrados += 1
    informe["pasos"]["4_eliminaciones_aplicadas"] = borrados

    # --- 5a. lectura de la instantanea + ajuste de fin de linea -------------
    # Se compara contra SNAPSHOT_PRODUCTO.sha256.txt (tomada al generar el
    # manifiesto) y no contra el arbol vivo: el worktree puede seguir cambiando
    # por otras tareas y eso no debe contaminar esta verificacion.
    #
    # El parche binario transporta el contenido normalizado por git (LF). Los
    # archivos cuyo atributo `eol=crlf` se materializa en disco se registran con
    # `eol_en_disco=crlf`; reconstruirlos byte a byte exige reaplicar ese salto.
    snapshot_path = os.path.join(release, "SNAPSHOT_PRODUCTO.sha256.txt")
    snapshot: list[tuple[str, str, str]] = []
    with open(snapshot_path, encoding="utf-8") as fh:
        for linea in fh:
            linea = linea.rstrip("\n")
            if not linea or linea.startswith("#"):
                continue
            partes = linea.split("\t")
            if len(partes) == 3:
                digest, eol, rel = partes
            else:  # compatibilidad con el formato antiguo
                digest, _, rel = linea.partition("  ")
                eol = "?"
            snapshot.append((rel, digest, eol))
    informe["pasos"]["5a_instantanea_archivos"] = len(snapshot)

    convertidos = 0
    for rel, _digest, eol in snapshot:
        if eol != "crlf":
            continue
        dst = os.path.join(destino, rel.replace("/", os.sep))
        if not os.path.exists(dst):
            continue
        with open(dst, "rb") as fh:
            data = fh.read()
        if data.count(b"\r\n") == data.count(b"\n"):
            continue  # ya esta en CRLF
        nuevo = data.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
        with open(dst, "wb") as fh:
            fh.write(nuevo)
        convertidos += 1
    informe["pasos"]["5a_eol_crlf_reaplicado"] = convertidos

    # --- 5b. verificacion de las entradas del manifiesto ---------------------
    verificados = 0
    for grupo in ("archivos_reemplazados", "archivos_nuevos"):
        for entrada in manifiesto[grupo]:
            rel = entrada["ruta"]
            abs_path = os.path.join(destino, rel.replace("/", os.sep))
            if not os.path.exists(abs_path):
                informe["discrepancias_manifiesto"].append({"grupo": grupo, "ruta": rel, "causa": "no_existe"})
                continue
            with open(abs_path, "rb") as fh:
                recon_data = fh.read()
            digest = hashlib.sha256(recon_data).hexdigest()
            if digest != entrada["sha256"]:
                src = os.path.join(raiz, rel.replace("/", os.sep))
                eol_disco = entrada.get("eol_en_disco", "?")
                if os.path.exists(src):
                    with open(src, "rb") as fh:
                        src_data = fh.read()
                    if normalizar_eol(src_data) == normalizar_eol(recon_data):
                        informe["diferencias_eol_atributo"].append(
                            {"grupo": grupo, "ruta": rel, "eol_en_disco": eol_disco})
                        continue
                informe["discrepancias_manifiesto"].append(
                    {"grupo": grupo, "ruta": rel, "causa": "sha256", "eol_en_disco": eol_disco,
                     "esperado": entrada["sha256"], "obtenido": digest})
                continue
            verificados += 1
    informe["pasos"]["5b_entradas_manifiesto_verificadas"] = verificados
    informe["pasos"]["5b_entradas_manifiesto_totales"] = (
        len(manifiesto["archivos_reemplazados"]) + len(manifiesto["archivos_nuevos"]))

    # --- 5c. cobertura completa contra la instantanea ------------------------
    for rel, esperado, _eol in snapshot:
        dst = os.path.join(destino, rel.replace("/", os.sep))
        if esperado == "ELIMINADO":
            if os.path.exists(dst):
                informe["cobertura_worktree"].append({"ruta": rel, "origen": "eliminado", "causa": "existe_en_reconstruccion"})
            continue
        if not os.path.exists(dst):
            informe["faltantes_en_reconstruccion"].append({"ruta": rel, "origen": "instantanea"})
            continue
        with open(dst, "rb") as fh:
            dst_data = fh.read()
        digest = hashlib.sha256(dst_data).hexdigest()
        if digest == esperado:
            continue
        src = os.path.join(raiz, rel.replace("/", os.sep))
        if os.path.exists(src):
            with open(src, "rb") as fh:
                src_data = fh.read()
            if normalizar_eol(src_data) == normalizar_eol(dst_data):
                informe["diferencias_solo_eol"].append({"ruta": rel, "origen": "instantanea"})
                continue
        informe["cobertura_worktree"].append(
            {"ruta": rel, "origen": "instantanea", "causa": "sha256",
             "esperado": esperado, "obtenido": digest})

    informe["resumen"] = {
        "archivos_instantanea": len(snapshot),
        "discrepancias_manifiesto": len(informe["discrepancias_manifiesto"]),
        "diferencias_eol_atributo": len(informe["diferencias_eol_atributo"]),
        "faltantes_en_reconstruccion": len(informe["faltantes_en_reconstruccion"]),
        "diferencias_solo_eol": len(informe["diferencias_solo_eol"]),
        "contenido_distinto": len(informe["cobertura_worktree"]),
        "reconstruccion_identica": (
            not informe["discrepancias_manifiesto"]
            and not informe["faltantes_en_reconstruccion"]
            and not informe["cobertura_worktree"]
            and not informe["diferencias_eol_atributo"]
            and not informe["diferencias_solo_eol"]
        ),
    }

    print(json.dumps(informe["resumen"], indent=2))
    print(json.dumps(informe["pasos"], indent=2)[:2000])
    for clave in ("discrepancias_manifiesto", "faltantes_en_reconstruccion",
                  "diferencias_eol_atributo", "diferencias_solo_eol", "cobertura_worktree"):
        if informe[clave]:
            print(f"--- {clave} ({len(informe[clave])}) ---")
            for item in informe[clave][:60]:
                print("   ", item)

    if salida_json:
        os.makedirs(os.path.dirname(salida_json), exist_ok=True)
        with open(salida_json, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(informe, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
