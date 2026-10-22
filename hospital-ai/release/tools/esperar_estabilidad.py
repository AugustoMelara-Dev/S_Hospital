#!/usr/bin/env python3
"""Espera a que el arbol de trabajo deje de cambiar (C1-REL-01).

Muestrea `git status --porcelain=v1 -z` + `git diff HEAD --binary` + lista de
no rastreados. Declara estable cuando N muestras consecutivas dan la misma
huella de status/diff/no-rastreados.

Uso:
  python esperar_estabilidad.py <raiz> <muestras_estables> <intervalo_s> <plazo_s> [<log>]
"""
from __future__ import annotations

import datetime as dt
import hashlib
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def git(root: str, *args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, check=True).stdout


def huella(root: str) -> tuple[str, str, str, int, int]:
    status = git(root, "status", "--porcelain=v1", "-z")
    diff = git(root, "diff", "HEAD", "--binary")
    untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z")
    return (
        hashlib.sha256(status).hexdigest(),
        hashlib.sha256(diff).hexdigest(),
        hashlib.sha256(untracked).hexdigest(),
        len([t for t in untracked.decode("utf-8", "surrogateescape").split("\0") if t]),
        len([t for t in status.decode("utf-8", "surrogateescape").split("\0") if t]),
    )


def main() -> int:
    root = os.path.abspath(sys.argv[1])
    muestras = int(sys.argv[2])
    intervalo = float(sys.argv[3])
    plazo = float(sys.argv[4])
    log = os.path.abspath(sys.argv[5]) if len(sys.argv) > 5 else None
    fh = open(log, "w", encoding="utf-8", newline="\n") if log else None

    def emitir(texto: str) -> None:
        print(texto, flush=True)
        if fh:
            fh.write(texto + "\n")
            fh.flush()

    inicio = time.time()
    ultima = None
    consecutivas = 0
    while time.time() - inicio < plazo:
        actual = huella(root)
        marca = dt.datetime.now().strftime("%H:%M:%S")
        estado = "igual" if actual == ultima else "CAMBIO"
        emitir(f"[{marca}] {estado} status={actual[0][:16]} diff={actual[1][:16]} "
               f"untracked={actual[2][:16]} n_untracked={actual[3]} n_status={actual[4]}")
        if actual == ultima:
            consecutivas += 1
        else:
            consecutivas = 0
            ultima = actual
        if consecutivas >= muestras:
            emitir(f"ESTABLE: {muestras} muestras consecutivas ({muestras * intervalo:.0f}s)")
            emitir(f"status_porcelain_sha256={actual[0]}")
            emitir(f"diff_binario_sha256={actual[1]}")
            emitir(f"untracked_list_sha256={actual[2]}")
            if fh:
                fh.close()
            return 0
        time.sleep(intervalo)
    emitir("PLAZO_AGOTADO: el arbol siguio cambiando")
    if fh:
        fh.close()
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
