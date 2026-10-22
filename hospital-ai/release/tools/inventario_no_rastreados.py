#!/usr/bin/env python3
"""Inventario y clasificacion de entradas NO rastreadas (C1-REL-01).

Produce dos vistas:

  1) Vista "entradas": las N entradas que `git status --porcelain` reporta como
     `??` (git colapsa directorios completamente no rastreados en una entrada).
     Columnas: ruta | tipo | tamano_agregado | archivos | necesaria | motivo

  2) Vista "archivos": expansion recursiva de cada entrada a archivos concretos.
     Columnas: ruta | tipo | categoria | tamano | sha256 | necesaria | motivo

No lee datos operativos ni secretos: la lista de entrada se obtiene con
`git ls-files --others --exclude-standard`, por lo que todo lo ignorado por
.gitignore (.env*, storage, backups, vendor, node_modules, dist, ...) queda
fuera y nunca se abre ni se hashea.

Uso:
  python inventario_no_rastreados.py <raiz> <salida.json> <salida_archivos.tsv> <salida_entradas.tsv>
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys

# --- Clasificacion -----------------------------------------------------------
# (prefijo, categoria, necesaria_para_reconstruir, motivo)
# Orden: gana la primera coincidencia.
REGLAS_PRODUCTO = [
    ("backend/database/migrations/", "migracion", True,
     "Migracion nueva: obligatoria para reproducir el esquema."),
    ("backend/database/", "codigo_producto", True,
     "Esquema/seeders reproducibles del backend."),
    ("backend/tests/", "prueba", True,
     "Suite de pruebas nueva: parte del conjunto verificable del producto."),
    ("backend/", "codigo_producto", True,
     "Codigo de producto backend nuevo."),
    ("frontend/", "codigo_producto", True,
     "Codigo de producto frontend (fuentes, hooks y pruebas)."),
    ("scripts/", "tooling_producto", True,
     "Scripts de instalacion, operacion, recuperacion y certificacion del paquete."),
    ("docs/", "documentacion_producto", True,
     "Documentacion canonica del producto."),
    ("nginx/", "configuracion", True,
     "Configuracion TLS del servidor LAN."),
    ("installer/", "codigo_producto", True,
     "Componentes del instalador offline."),
    ("database/", "codigo_producto", True,
     "Recursos de base de datos a nivel raiz."),
    ("docker-compose.tls.yml", "configuracion", True,
     "Variante TLS del compose; forma parte del paquete desplegable."),
]

REGLAS_EXCLUIDAS = [
    ("hospital-ai/release/", "manifiesto_release", False,
     "Salida de este propio manifiesto: no puede incluirse en su propio hash."),
    ("hospital-ai/evidencia/", "artefacto_campana_evidencia", False,
     "Evidencia de QA por tarea: historial de verificacion, no artefacto de producto."),
    ("hospital-ai/progreso/", "artefacto_campana_progreso", False,
     "Tablero/estado de campana mantenido por el coordinador."),
    ("hospital-ai/diseno/", "artefacto_campana_diseno", False,
     "Material de diseno de campana."),
    ("hospital-ai/", "artefacto_campana_gobernanza", False,
     "Gobernanza de campana (mandato, workspace, contratos)."),
    (".opencode/", "tooling_agentes", False,
     "Definiciones de agentes/permisos del harness; no se ejecuta en produccion."),
    (".agents/", "tooling_agentes", False,
     "Artefactos de skills del harness de agentes; no forma parte del producto."),
    (".superpowers/", "tooling_agentes", False,
     "Cache/artefactos del harness de agentes."),
    ("skills-lock.json", "tooling_agentes", False,
     "Lockfile de skills del harness de agentes; no es dependencia del producto."),
    ("HANDOFF_ACTUAL_CHATGPT.md", "artefacto_campana_gobernanza", False,
     "Documento de traspaso de campana; no es codigo del producto."),
    ("reports/", "artefacto_campana_estado", False,
     "Reportes de estado de campana."),
    ("qa/", "artefacto_campana_qa", False,
     "Evidencia/QA de campana."),
]

# Archivos sueltos en la raiz que no aportan al producto.
REGLAS_PRESCINDIBLE = [
    ("stat-", "prescindible", False, "Volcado temporal de consola en la raiz del repo."),
    ("scratch", "prescindible", False, "Archivo temporal de trabajo."),
    ("nul", "prescindible", False, "Artefacto vacio de redireccion en Windows."),
]

PATRONES_PRESCINDIBLE_EXACTOS = {
    "stat-final.txt": "Volcado temporal de consola en la raiz del repo.",
}

PRESCINDIBLE_SUFIJOS = (".log", ".tmp", ".bak", ".orig", ".rej", ".stackdump")

# Configuracion/producto en la raiz del repositorio.
REGLAS_RAIZ_PRODUCTO = [
    ("docker-compose", "configuracion", True,
     "Variante de docker compose del paquete/entorno."),
    ("docker-", "configuracion", True, "Recursos Docker del paquete."),
    ("Makefile", "tooling_producto", True, "Automatizacion del repositorio."),
    ("setup.bat", "codigo_producto", True, "Punto de entrada de instalacion en Windows."),
    (".env.example", "configuracion", True, "Plantilla publica de configuracion (sin valores reales)."),
]

SECRETO_HINTS = (".env", "secret", "credential", "id_rsa", ".pfx", ".p12", ".key", ".pem")


def sha256_file(path: str, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def clasificar(rel: str):
    """Devuelve (categoria, necesaria, motivo).

    Fail-closed: lo que no casa con ninguna regla se clasifica como
    `por_clasificar` con `necesaria=True`, para que jamas se caiga del
    manifiesto un archivo de producto no previsto. El generador avisa.
    """
    if rel in PATRONES_PRESCINDIBLE_EXACTOS:
        return "prescindible", False, PATRONES_PRESCINDIBLE_EXACTOS[rel]
    for prefijo, categoria, necesaria, motivo in REGLAS_EXCLUIDAS:
        if rel.startswith(prefijo):
            return categoria, necesaria, motivo
    for prefijo, categoria, necesaria, motivo in REGLAS_PRODUCTO:
        if rel.startswith(prefijo):
            if "/tests/" in rel or rel.endswith(".test.ts") or rel.endswith(".test.tsx"):
                return "prueba", True, "Prueba automatizada del producto."
            return categoria, necesaria, motivo
    base = os.path.basename(rel)
    if rel.count("/") == 0 or rel.startswith(("docker-", "Makefile", "setup")):
        for prefijo, categoria, necesaria, motivo in REGLAS_RAIZ_PRODUCTO:
            if base.startswith(prefijo):
                return categoria, necesaria, motivo
    if base.endswith(PRESCINDIBLE_SUFIJOS):
        return "prescindible", False, "Volcado temporal/log no versionable."
    for prefijo, categoria, necesaria, motivo in REGLAS_PRESCINDIBLE:
        if base.startswith(prefijo):
            return categoria, necesaria, motivo
    return "por_clasificar", True, (
        "Sin regla de clasificacion: se INCLUYE por defecto (fail-closed). "
        "Anadir una regla explicita en inventario_no_rastreados.py.")


def git(root: str, *args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, check=True).stdout


def git_z(root: str, *args: str) -> list[str]:
    return [x for x in git(root, *args).decode("utf-8", "surrogateescape").split("\0") if x]


def main() -> int:
    root = os.path.abspath(sys.argv[1])
    out_json = os.path.abspath(sys.argv[2])
    out_archivos = os.path.abspath(sys.argv[3])
    out_entradas = os.path.abspath(sys.argv[4])

    entradas_porcelain = [e for e in git_z(root, "status", "--porcelain=v1", "-z") if e.startswith("?? ")]
    entradas_porcelain = [e[3:] for e in entradas_porcelain]
    archivos = git_z(root, "ls-files", "--others", "--exclude-standard", "-z")

    # --- expansion por entrada -----------------------------------------------
    por_entrada: dict[str, list[str]] = {}
    for rel in archivos:
        for entrada in entradas_porcelain:
            prefijo = entrada.rstrip("/")
            if rel == entrada or rel.startswith(prefijo + "/"):
                por_entrada.setdefault(entrada, []).append(rel)
                break

    filas_archivo = []
    for rel in sorted(archivos):
        abs_path = os.path.join(root, rel.replace("/", os.sep))
        tam = os.path.getsize(abs_path)
        categoria, necesaria, motivo = clasificar(rel)
        filas_archivo.append({
            "ruta": rel,
            "tipo": "archivo",
            "categoria": categoria,
            "tamano": tam,
            "sha256": sha256_file(abs_path),
            "necesaria_para_reconstruir": necesaria,
            "motivo": motivo,
        })

    hash_por_ruta = {f["ruta"]: f for f in filas_archivo}

    filas_entrada = []
    for entrada in sorted(entradas_porcelain):
        miembros = por_entrada.get(entrada, [])
        es_directorio = entrada.endswith("/") or len(miembros) > 1 or (miembros and miembros[0] != entrada)
        categorias = {}
        bytes_total = 0
        necesaria = None
        motivo = ""
        for rel in miembros:
            f = hash_por_ruta[rel]
            categorias[f["categoria"]] = categorias.get(f["categoria"], 0) + 1
            bytes_total += f["tamano"]
            if f["necesaria_para_reconstruir"] is not None:
                necesaria = f["necesaria_para_reconstruir"] if necesaria is None else (necesaria or f["necesaria_para_reconstruir"])
            if not motivo:
                motivo = f["motivo"]
        filas_entrada.append({
            "ruta": entrada,
            "tipo": "directorio" if es_directorio else "archivo",
            "archivos_que_contiene": len(miembros),
            "tamano_agregado": bytes_total,
            "categorias": categorias,
            "necesaria_para_reconstruir": necesaria,
            "motivo": motivo,
        })

    resumen: dict[str, dict] = {}
    for fila in filas_archivo:
        acc = resumen.setdefault(fila["categoria"], {"archivos": 0, "bytes": 0,
                                                     "necesaria_para_reconstruir": fila["necesaria_para_reconstruir"]})
        acc["archivos"] += 1
        acc["bytes"] += fila["tamano"]

    documento = {
        "generado_por": "hospital-ai/release/tools/inventario_no_rastreados.py",
        "raiz": root,
        "entradas_porcelain_no_rastreadas": len(filas_entrada),
        "archivos_no_rastreados_expandidos": len(filas_archivo),
        "nota_secretos": (
            "La lista se obtuvo con `git ls-files --others --exclude-standard`: los patrones "
            "ignorados por .gitignore (.env*, storage, backups, vendor, node_modules, dist, "
            "installer-output, offline-release) quedan fuera y no se leen ni se hashean. "
            "No se incluyo ningun valor de secreto ni dato operativo."
        ),
        "resumen_por_categoria": resumen,
        "entradas": filas_entrada,
        "archivos": filas_archivo,
    }

    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as fh:
        json.dump(documento, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    with open(out_archivos, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("ruta\ttipo\tcategoria\ttamano\tsha256\tnecesaria_para_reconstruir\tmotivo\n")
        for f in filas_archivo:
            fh.write(f"{f['ruta']}\t{f['tipo']}\t{f['categoria']}\t{f['tamano']}\t{f['sha256']}\t"
                     f"{f['necesaria_para_reconstruir']}\t{f['motivo']}\n")

    with open(out_entradas, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("ruta\ttipo\tarchivos_que_contiene\ttamano_agregado\tcategorias\t"
                 "necesaria_para_reconstruir\tmotivo\n")
        for f in filas_entrada:
            cats = ";".join(f"{k}={v}" for k, v in sorted(f["categorias"].items()))
            fh.write(f"{f['ruta']}\t{f['tipo']}\t{f['archivos_que_contiene']}\t{f['tamano_agregado']}\t"
                     f"{cats}\t{f['necesaria_para_reconstruir']}\t{f['motivo']}\n")

    desconocidos = [f["ruta"] for f in filas_archivo if f["categoria"] == "por_clasificar"]
    print(f"entradas_no_rastreadas={len(filas_entrada)} archivos_expandidos={len(filas_archivo)}")
    for key, acc in sorted(resumen.items()):
        print(f"  {key}: archivos={acc['archivos']} bytes={acc['bytes']} necesaria={acc['necesaria_para_reconstruir']}")
    if desconocidos:
        print("ADVERTENCIA: archivos incluidos por fail-closed (anadir regla explicita):")
        for rel in desconocidos:
            print("   ", rel)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
