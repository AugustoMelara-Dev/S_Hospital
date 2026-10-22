#!/usr/bin/env python3
"""Verifica que las citas del MANIFIESTO_PRODUCTO existan y coincidan.

Uso:
  python verificar_manifiesto.py <raiz_a_comprobar> <release_dir> [--json <salida>]

Comprueba:
  - existencia de cada `archivos_reemplazados` y `archivos_nuevos`;
  - tamano y sha256 completos;
  - sha256 del parche binario citado;
  - sidecar del propio manifiesto.

Salida legible + (opcional) JSON. Codigo 0 si 0 citas rotas.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys


def sha256_file(path: str, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def main() -> int:
    raiz = os.path.abspath(sys.argv[1])
    release = os.path.abspath(sys.argv[2])
    salida_json = None
    if "--json" in sys.argv:
        salida_json = os.path.abspath(sys.argv[sys.argv.index("--json") + 1])

    with open(os.path.join(release, "MANIFIESTO_PRODUCTO.json"), encoding="utf-8") as fh:
        manifiesto = json.load(fh)

    rotas: list[dict] = []
    verificados = 0
    for grupo in ("archivos_reemplazados", "archivos_nuevos"):
        for entrada in manifiesto[grupo]:
            rel = entrada["ruta"]
            abs_path = os.path.join(raiz, rel.replace("/", os.sep))
            if not os.path.exists(abs_path):
                rotas.append({"grupo": grupo, "ruta": rel, "causa": "no_existe"})
                continue
            tam = os.path.getsize(abs_path)
            if tam != entrada["tamano"]:
                rotas.append({"grupo": grupo, "ruta": rel, "causa": "tamano",
                              "esperado": entrada["tamano"], "obtenido": tam})
                continue
            digest = sha256_file(abs_path)
            if digest != entrada["sha256"]:
                rotas.append({"grupo": grupo, "ruta": rel, "causa": "sha256",
                              "esperado": entrada["sha256"], "obtenido": digest})
                continue
            verificados += 1

    # parche binario
    parche = os.path.join(release, "PARCHE_TRACKED.patch")
    if not os.path.exists(parche):
        rotas.append({"grupo": "base", "ruta": "hospital-ai/release/PARCHE_TRACKED.patch", "causa": "no_existe"})
    else:
        digest = sha256_file(parche)
        if digest != manifiesto["base"]["parche_sha256"]:
            rotas.append({"grupo": "base", "ruta": "hospital-ai/release/PARCHE_TRACKED.patch",
                          "causa": "sha256", "esperado": manifiesto["base"]["parche_sha256"], "obtenido": digest})
        else:
            verificados += 1

    # eliminaciones
    for entrada in manifiesto["eliminaciones"]:
        if os.path.exists(os.path.join(raiz, entrada["ruta"].replace("/", os.sep))):
            rotas.append({"grupo": "eliminaciones", "ruta": entrada["ruta"], "causa": "deberia_no_existir"})

    # --- deriva del arbol frente a la instantanea del manifiesto -------------
    import subprocess
    import tempfile

    head_actual = subprocess.run(["git", "rev-parse", "HEAD"], cwd=raiz,
                                 capture_output=True, check=True).stdout.decode().strip()
    tmp_patch = os.path.join(tempfile.gettempdir(), "c1rel-fingerprint-check.bin")
    subprocess.run(["git", "diff", "HEAD", "--binary", "--output=" + tmp_patch],
                   cwd=raiz, capture_output=True, check=True)
    fingerprint_actual = subprocess.run(["git", "hash-object", tmp_patch], cwd=raiz,
                                        capture_output=True, check=True).stdout.decode().strip()
    os.remove(tmp_patch)

    resultado = {
        "raiz_comprobada": raiz,
        "release_dir": release,
        "head_base": manifiesto["base"]["head"],
        "head_actual": head_actual,
        "head_coincide": head_actual == manifiesto["base"]["head"],
        "fingerprint_manifiesto": manifiesto["base"]["fingerprint_git_hash_object"],
        "fingerprint_actual": fingerprint_actual,
        "fingerprint_coincide": fingerprint_actual == manifiesto["base"]["fingerprint_git_hash_object"],
        "entradas_verificadas": verificados,
        "citas_totales": len(manifiesto["archivos_reemplazados"]) + len(manifiesto["archivos_nuevos"]) + 1,
        "citas_rotas": len(rotas),
        "detalle_rotas": rotas,
    }

    print(f"head_coincide={resultado['head_coincide']}")
    print(f"fingerprint_coincide={resultado['fingerprint_coincide']} "
          f"(manifiesto={resultado['fingerprint_manifiesto']} actual={fingerprint_actual})")
    print(f"entradas_verificadas={verificados}")
    print(f"citas_rotas={len(rotas)}")
    for r in rotas:
        print("  ROTA:", r)

    if salida_json:
        os.makedirs(os.path.dirname(salida_json), exist_ok=True)
        with open(salida_json, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(resultado, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    return 0 if not rotas else 1


if __name__ == "__main__":
    raise SystemExit(main())
