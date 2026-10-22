#!/usr/bin/env python3
"""Exporta una copia reconstruible de FUENTES del arbol de trabajo (R2-REL-01).

Reutiliza el mecanismo ya verificado en C1-REL-01:
  - `inventario_no_rastreados.clasificar` (misma clasificacion fail-closed);
  - `inventario_no_rastreados.sha256_file`;
  - el alcance "todos los rastreados + nuevos necesarios (necesaria=True)".

Diferencia deliberada respecto al manifiesto C1: esta copia EXCLUYE ademas la
evidencia de campana RASTREADA (qa/, reports/, frontend/artifacts/,
docs/**/evidence/, .opencode, .agents, .superpowers, hospital-ai/) y los binarios
no necesarios (documentos .docx, capturas). Todo eso se registra como exclusion
sin exponer valores.

Salida:
  <dest>/fuentes/**                      copia byte a byte
  <dest>/MANIFIESTO_COPIA_FUENTES.json   rutas relativas + tamano + sha256 + eol
  <dest>/MANIFIESTO_COPIA_FUENTES.sha256.txt  lista plana sha256  ruta
  <dest>/LEEME_COPIA_FUENTES.md          notas de la copia
  <zip>                                  (opcional) paquete determinista

El manifiesto de la copia NO se incluye a si mismo ni al ZIP: vive fuera de
`fuentes/`, y el script comprueba que ninguna ruta incluida cae bajo <dest>.

Uso:
  python exportar_fuentes.py <raiz> <release_dir> <dest_dir> [--zip <archivo>] \
      [--json-inclusion <f>] [--json-exclusion <f>] [--json-secretos <f>] \
      [--json-verificacion <f>] [--json-paquete <f>]
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import re
import subprocess
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inventario_no_rastreados import clasificar, sha256_file  # noqa: E402

# Prefijos rastreados que son evidencia/gobernanza de campana: NO van a la copia.
EXCLUSIONES_RASTREADAS = [
    ("qa/", "evidencia_campana_qa",
     "QA y capturas de campana: historial de verificacion, no fuente del producto."),
    ("reports/", "artefacto_campana_estado",
     "Reportes de estado de campana."),
    ("frontend/artifacts/", "evidencia_campana_capturas",
     "Capturas y volcados de accesibilidad de campana."),
    ("docs/refactor-migration/evidence/", "evidencia_campana_capturas",
     "Evidencia grafica de la migracion (capturas)."),
    (".opencode/", "tooling_agentes",
     "Definiciones de agentes del harness; no se ejecuta en produccion."),
    (".agents/", "tooling_agentes",
     "Artefactos de skills del harness de agentes."),
    (".superpowers/", "tooling_agentes",
     "Cache/artefactos del harness de agentes."),
    ("hospital-ai/", "gobernanza_campana",
     "Gobernanza, evidencia y release de campana; fuera del producto."),
]

# Archivos rastreados concretos excluidos por sensibilidad o por ser binario inutil.
EXCLUSIONES_RASTREADAS_EXACTAS = [
    ("frontend/.env.production", "configuracion_env_real",
     "Entorno real de build (aunque sin valores): se entrega solo .env.example."),
    ("docs/contratos/Contrato_S_Hospital_borrador.docx", "binario_documento",
     "Documento contractual binario; no necesario para revisar el codigo."),
]

SUFIJOS_RASTREADOS_EXCLUIDOS = {
    ".log": ("log", "Log del repositorio: se excluye por politica (puede contener datos)."),
    ".docx": ("binario_documento", "Documento binario no necesario."),
    ".pdf": ("binario_documento", "Documento binario no necesario."),
    ".xls": ("binario_documento", "Hoja de calculo binaria no necesaria."),
    ".xlsx": ("binario_documento", "Hoja de calculo binaria no necesaria."),
    ".zip": ("binario_comprimido", "Paquete comprimido no necesario."),
    ".rar": ("binario_comprimido", "Paquete comprimido no necesario."),
    ".7z": ("binario_comprimido", "Paquete comprimido no necesario."),
    ".exe": ("binario_ejecutable", "Ejecutable no necesario para revisar el codigo."),
    ".dll": ("binario_ejecutable", "Biblioteca binaria no necesaria."),
    ".iso": ("binario_imagen", "Imagen de disco no necesaria."),
}

# Rutas con pinta de secreto: fail-closed, nunca se copian aunque esten rastreadas.
PATRONES_SECRETO_RUTA = [
    re.compile(r"(^|/)\.env$", re.I),
    re.compile(r"(^|/)\.env\.[^/]+\.local$", re.I),
    re.compile(r"(^|/)\.env\.local$", re.I),
    re.compile(r"\.pem$|\.key$|\.pfx$|\.p12$|\.jks$|\.keystore$", re.I),
    re.compile(r"(^|/)id_(rsa|dsa|ecdsa|ed25519)($|\.)", re.I),
    re.compile(r"(^|/)\.npmrc$|(^|/)\.netrc$|(^|/)credentials(\.json)?$", re.I),
    re.compile(r"(^|/)secrets?\.(json|ya?ml|txt|env)$", re.I),
    re.compile(r"(^|/)\.htpasswd$", re.I),
]

# Patrones de contenido de alta senal. Solo se reporta ruta+linea+patron: NUNCA el valor.
PATRONES_SECRETO_CONTENIDO = [
    ("private_key_pem", re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("certificado_pem", re.compile(rb"-----BEGIN CERTIFICATE-----")),
    ("aws_access_key", re.compile(rb"AKIA[0-9A-Z]{16}")),
    ("github_token", re.compile(rb"gh[pousr]_[A-Za-z0-9]{36,}")),
    ("slack_token", re.compile(rb"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("google_api_key", re.compile(rb"AIza[0-9A-Za-z_\-]{35}")),
    ("stripe_secret", re.compile(rb"sk_live_[0-9A-Za-z]{24,}")),
    ("openai_key", re.compile(rb"sk-[A-Za-z0-9]{32,}")),
    ("jwt_largo", re.compile(rb"eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}")),
    ("password_con_valor", re.compile(rb"(?i)(password|passwd|pwd)\s*[:=]\s*[\"']?[^\s\"'#]{8,}")),
    ("db_password_no_vacio", re.compile(rb"(?im)^\s*DB_PASSWORD\s*=\s*[^\s#]")),
    ("app_key_no_vacio", re.compile(rb"(?im)^\s*APP_KEY\s*=\s*base64:")),
    ("backup_key_no_vacio", re.compile(rb"(?im)^\s*HOSPITAL_BACKUP_ENCRYPTION_KEY\s*=\s*[^\s#]")),
    ("license_salt_no_vacio", re.compile(rb"(?im)^\s*HOSPITAL_LICENSE_SALT\s*=\s*[^\s#]")),
    ("pusher_secret_no_vacio", re.compile(rb"(?im)^\s*PUSHER_APP_SECRET\s*=\s*[^\s#]")),
    ("mail_password_no_vacio", re.compile(rb"(?im)^\s*MAIL_PASSWORD\s*=\s*[^\s#]")),
    ("redis_password_no_vacio", re.compile(rb"(?im)^\s*REDIS_PASSWORD\s*=\s*[^\s#]")),
]

# Valores de ejemplo aceptados en .env.example: se inspeccionan pero no bloquean.
ARCHIVOS_PLANTILLA_ENV = re.compile(r"(^|/)\.env(\.docker)?\.example$", re.I)

# Plantillas .env que SI se incluyen. Cualquier otro basename que empiece por
# `.env` (p. ej. `.env.local`, `.env.production`, `.env.rcp01`, `.env.bak`) es
# un entorno real y NUNCA se copia, aunque git no lo ignore. Fail-closed.
PLANTILLAS_ENV_PERMITIDAS = re.compile(r"^\.env(\.docker)?\.example$", re.I)


def git(root: str, *args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=root, capture_output=True, check=True).stdout


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def detectar_eol(path: str) -> str:
    with open(path, "rb") as fh:
        data = fh.read()
    if b"\n" not in data:
        return "sin_salto_de_linea"
    crlf = data.count(b"\r\n")
    lf_total = data.count(b"\n")
    if crlf == 0:
        return "lf"
    if crlf == lf_total:
        return "crlf"
    return "mixto"


def es_binario(path: str) -> bool:
    with open(path, "rb") as fh:
        return b"\0" in fh.read(8192)


def excluir_rastreado(rel: str):
    """Devuelve (categoria, motivo) si la ruta rastreada NO va a la copia."""
    for p, c, m in EXCLUSIONES_RASTREADAS_EXACTAS:
        if rel == p:
            return c, m
    for prefijo, cat, motivo in EXCLUSIONES_RASTREADAS:
        if rel.startswith(prefijo):
            return cat, motivo
    base = os.path.basename(rel)
    if base.startswith(".env") and not PLANTILLAS_ENV_PERMITIDAS.match(base):
        return "secreto_ruta", (
            "Entorno real (.env*): fail-closed, se excluye siempre y no se lee. "
            "Solo se incluyen plantillas *.example.")
    suf = os.path.splitext(rel)[1].lower()
    if suf in SUFIJOS_RASTREADOS_EXCLUIDOS:
        return SUFIJOS_RASTREADOS_EXCLUIDOS[suf]
    for rx in PATRONES_SECRETO_RUTA:
        if rx.search(rel):
            return "secreto_ruta", "Ruta con pinta de credencial: fail-closed, nunca se copia."
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("raiz")
    ap.add_argument("release_dir")
    ap.add_argument("dest_dir")
    ap.add_argument("--zip", dest="zip_path", default=None)
    ap.add_argument("--json-inclusion", default=None)
    ap.add_argument("--json-exclusion", default=None)
    ap.add_argument("--json-secretos", default=None)
    ap.add_argument("--json-verificacion", default=None)
    ap.add_argument("--json-paquete", default=None)
    ap.add_argument("--marca", default="instantanea_de_trabajo")
    args = ap.parse_args()

    root = os.path.abspath(args.raiz)
    dest = os.path.abspath(args.dest_dir)
    fuentes = os.path.join(dest, "fuentes")
    os.makedirs(fuentes, exist_ok=True)

    if os.path.commonpath([os.path.abspath(dest), root]) == root:
        print("ERROR: el destino de entrega no puede estar dentro del arbol (auto-inclusion).")
        return 3

    # --- huellas del arbol de origen ----------------------------------------
    head = git(root, "rev-parse", "HEAD").decode().strip()
    status_blob = git(root, "status", "--porcelain=v1", "-z")
    diff_bin = git(root, "diff", "HEAD", "--binary")
    diff_txt = git(root, "diff", "HEAD")
    fingerprint = subprocess.run(
        ["git", "hash-object", "--stdin"], cwd=root, input=diff_bin, capture_output=True, check=True
    ).stdout.decode().strip()

    tracked = [p for p in git(root, "ls-files", "-z").decode("utf-8", "surrogateescape").split("\0") if p]
    untracked = [p for p in git(root, "ls-files", "--others", "--exclude-standard", "-z").decode(
        "utf-8", "surrogateescape").split("\0") if p]

    # --- seleccion -----------------------------------------------------------
    incluidas: list[dict] = []
    excluidas: list[dict] = []
    origen: dict[str, str] = {}

    def acumular_exclusion(cat: str, motivo: str, rel: str, tamano: int):
        excluidas.append({"ruta": rel, "categoria": cat, "motivo": motivo, "tamano": tamano})

    for rel in tracked:
        motivo_excl = excluir_rastreado(rel)
        if motivo_excl:
            cat, motivo = motivo_excl
            acumular_exclusion(cat, motivo, rel, os.path.getsize(os.path.join(root, rel.replace("/", os.sep))))
            continue
        origen[rel] = "rastreado"
        incluidas.append(rel)

    for rel in sorted(untracked):
        categoria, necesaria, motivo = clasificar(rel)
        if not necesaria:
            tam = os.path.getsize(os.path.join(root, rel.replace("/", os.sep)))
            acumular_exclusion(categoria, motivo, rel, tam)
            continue
        # fail-closed extra: aunque clasifique como producto, si la ruta huele a
        # secreto o el sufijo no es de producto, no se copia.
        motivo_excl = excluir_rastreado(rel)
        if motivo_excl:
            cat, motivo = motivo_excl
            acumular_exclusion(cat, motivo, rel, os.path.getsize(os.path.join(root, rel.replace("/", os.sep))))
            continue
        origen[rel] = "nuevo_necesario"
        incluidas.append(rel)

    incluidas = sorted(set(incluidas))

    # Red de seguridad final: jamas empaquetar un entorno real ni una credencial.
    for rel in incluidas:
        base = os.path.basename(rel)
        if base.startswith(".env") and not PLANTILLAS_ENV_PERMITIDAS.match(base):
            print(f"ERROR: ruta de entorno real en el conjunto incluido: {rel}")
            return 5
        for rx in PATRONES_SECRETO_RUTA:
            if rx.search(rel):
                print(f"ERROR: ruta con pinta de credencial en el conjunto incluido: {rel}")
                return 5

    # --- copia byte a byte + hashing ----------------------------------------
    entradas = []
    for rel in incluidas:
        src = os.path.join(root, rel.replace("/", os.sep))
        dst = os.path.join(fuentes, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(src, "rb") as fh_src, open(dst, "wb") as fh_dst:
            data = fh_src.read()
            fh_dst.write(data)
        entradas.append({
            "ruta": rel,
            "origen": origen[rel],
            "tamano": len(data),
            "sha256": sha256_bytes(data),
            "eol_en_disco": detectar_eol(dst),
            "categoria": "nuevo_necesario" if origen[rel] == "nuevo_necesario" else "rastreado",
        })

    # --- verificacion byte a byte -------------------------------------------
    discrepancias = []
    for e in entradas:
        dst = os.path.join(fuentes, e["ruta"].replace("/", os.sep))
        if not os.path.exists(dst):
            discrepancias.append({"ruta": e["ruta"], "causa": "falta_en_destino"})
            continue
        if sha256_file(dst) != e["sha256"]:
            discrepancias.append({"ruta": e["ruta"], "causa": "sha256_destino"})
    # Comprobacion explicita de auto-inclusion: el manifiesto de la copia no
    # puede aparecer como archivo incluido, ningun incluido puede ser el ZIP ni
    # residir bajo el directorio de entrega.
    manifiesto_nombre = "MANIFIESTO_COPIA_FUENTES.json"
    auto_inclusion = []
    dest_norm = os.path.normcase(dest) + os.sep
    for e in entradas:
        abs_dst = os.path.normcase(os.path.abspath(os.path.join(fuentes, e["ruta"].replace("/", os.sep))))
        if abs_dst.startswith(dest_norm) and not abs_dst.startswith(
                os.path.normcase(fuentes) + os.sep):
            auto_inclusion.append(e["ruta"])
        elif e["ruta"].startswith("fuentes/") or e["ruta"].endswith(".zip") \
                or os.path.basename(e["ruta"]).startswith("MANIFIESTO_COPIA_FUENTES") \
                or os.path.basename(e["ruta"]) == "LEEME_COPIA_FUENTES.md":
            auto_inclusion.append(e["ruta"])

    # --- escaneo de secretos en la COPIA ------------------------------------
    hallazgos = []
    archivos_escaneados = 0
    for e in entradas:
        dst = os.path.join(fuentes, e["ruta"].replace("/", os.sep))
        if es_binario(dst):
            continue
        archivos_escaneados += 1
        with open(dst, "rb") as fh:
            lineas = fh.read().splitlines()
        plantilla = bool(ARCHIVOS_PLANTILLA_ENV.search(e["ruta"]))
        for i, linea in enumerate(lineas, 1):
            for nombre, rx in PATRONES_SECRETO_CONTENIDO:
                if rx.search(linea):
                    # En plantillas .env.example los valores vacios no casan;
                    # si casan, se reportan igual pero marcados como plantilla.
                    hallazgos.append({
                        "ruta": e["ruta"], "linea": i, "patron": nombre,
                        "es_plantilla_env": plantilla, "valor_expuesto": False,
                    })

    # --- manifiesto ----------------------------------------------------------
    total_bytes = sum(e["tamano"] for e in entradas)
    manifiesto = {
        "esquema": "hospital-ai/release/COCIA_FUENTES_R2-REL-01",
        "version": 1,
        "tipo": args.marca,
        "generado_utc": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "generado_por": "hospital-ai/release/tools/exportar_fuentes.py",
        "raiz_origen": root,
        "huella_del_arbol_origen": {
            "head": head,
            "fingerprint_git_hash_object": fingerprint,
            "fingerprint_git_hash_object_comando": "git diff HEAD --binary > f; git hash-object f",
            "diff_binario_sha256": sha256_bytes(diff_bin),
            "diff_texto_sha256": sha256_bytes(diff_txt),
            "status_porcelain_v1_z_sha256": sha256_bytes(status_blob),
            "valida_para": ("Este conjunto de fuentes corresponde al estado del worktree cuyo "
                            "`git diff HEAD --binary` hashea al fingerprint indicado. Si el arbol "
                            "cambia, la copia deja de representar el estado actual y debe regenerarse."),
        },
        "resumen": {
            "archivos_incluidos": len(entradas),
            "bytes_incluidos": total_bytes,
            "archivos_excluidos": len(excluidas),
            "bytes_excluidos": sum(x["tamano"] for x in excluidas),
        },
        "archivos": entradas,
        "exclusiones": [],
        "no_incluido_en_su_propio_hash": [
            "MANIFIESTO_COPIA_FUENTES.json",
            "MANIFIESTO_COPIA_FUENTES.sha256.txt",
            "LEEME_COPIA_FUENTES.md",
            "<zip de entrega>",
        ],
        "nota": ("Copia de trabajo, NO definitiva: el arbol sigue en refactor R2; regenerar al cierre."),
    }

    # exclusiones agregadas por categoria (sin exponer valores)
    agg: dict[str, dict] = {}
    for x in excluidas:
        a = agg.setdefault(x["categoria"], {"patron_ejemplo": x["ruta"], "archivos": 0, "bytes": 0,
                                            "motivo": x["motivo"], "valores_incluidos": False})
        a["archivos"] += 1
        a["bytes"] += x["tamano"]
    manifiesto["exclusiones"] = [
        {"categoria": k, **v} for k, v in sorted(agg.items())
    ]

    os.makedirs(dest, exist_ok=True)
    json_path = os.path.join(dest, manifiesto_nombre)
    with open(json_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifiesto, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    flat_path = os.path.join(dest, "MANIFIESTO_COPIA_FUENTES.sha256.txt")
    with open(flat_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("# COPIA DE FUENTES R2-REL-01 (instantanea de trabajo)\n")
        fh.write(f"# head={head}\n")
        fh.write(f"# fingerprint_git_hash_object={fingerprint}\n")
        fh.write(f"# diff_binario_sha256={manifiesto['huella_del_arbol_origen']['diff_binario_sha256']}\n")
        fh.write(f"# archivos={len(entradas)}\n")
        for e in entradas:
            fh.write(f"{e['sha256']}  fuentes/{e['ruta']}\n")

    leeme = os.path.join(dest, "LEEME_COPIA_FUENTES.md")
    with open(leeme, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(
            "# Copia de fuentes S_Hospital — R2-REL-01\n\n"
            "**Instantanea de trabajo, no definitiva.** Corresponde al worktree en el estado\n"
            f"`head={head}` con fingerprint `git diff HEAD --binary` =\n"
            f"`{fingerprint}`.\n\n"
            f"Contiene {len(entradas)} archivos de fuente ({total_bytes} bytes) bajo `fuentes/`.\n\n"
            "Excluye: `.env` reales y `frontend/.env.production`, claves/credenciales, bases y\n"
            "dumps, `node_modules`, `vendor`, `dist`, logs, evidencia de campana (capturas y\n"
            "QA) y binarios no necesarios (documentos .docx). Las plantillas de configuracion\n"
            "(`.env.example`, `backend/.env.example`, `backend/.env.docker.example`,\n"
            "`frontend/.env.example`) SI estan incluidas, con valores ficticios.\n\n"
            "Verificacion: `MANIFIESTO_COPIA_FUENTES.sha256.txt` lista el SHA-256 de cada\n"
            "archivo bajo `fuentes/`. El manifiesto y el ZIP no se incluyen en ese hash.\n\n"
            "Regenerar cuando cierre el refactor R2: el arbol se esta moviendo.\n"
        )

    # --- ZIP determinista ----------------------------------------------------
    paquete = None
    if args.zip_path:
        zip_abs = os.path.abspath(args.zip_path)
        os.makedirs(os.path.dirname(zip_abs), exist_ok=True)
        fecha = (2026, 9, 17, 0, 0, 0)
        with zipfile.ZipFile(zip_abs, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for e in entradas:
                rel = "fuentes/" + e["ruta"]
                info = zipfile.ZipInfo(rel, date_time=fecha)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(os.path.join(fuentes, e["ruta"].replace("/", os.sep)), "rb") as fh:
                    zf.writestr(info, fh.read())
            for extra in (manifiesto_nombre, "MANIFIESTO_COPIA_FUENTES.sha256.txt",
                          "LEEME_COPIA_FUENTES.md"):
                rel = extra
                info = zipfile.ZipInfo(rel, date_time=fecha)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                with open(os.path.join(dest, extra), "rb") as fh:
                    zf.writestr(info, fh.read())
        paquete = {
            "ruta_zip": zip_abs,
            "bytes_zip": os.path.getsize(zip_abs),
            "sha256_zip": sha256_file(zip_abs),
            "entradas_zip": len(entradas) + 3,
            "timestamp_zip_fijo": "2026-09-17T00:00:00",
        }

    # --- evidencia -----------------------------------------------------------
    def dump(path, obj):
        if not path:
            return
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    dump(args.json_inclusion, {
        "tipo": "inclusion",
        "head": head,
        "fingerprint_git_hash_object": fingerprint,
        "archivos": entradas,
    })
    dump(args.json_exclusion, {
        "tipo": "exclusion",
        "nota": ("Exclusiones agregadas por categoria. No se incluye ningun valor: solo recuentos, "
                 "bytes y un patron de ejemplo. Los .env reales, claves y dumps jamas se abrieron."),
        "exclusiones_por_categoria": manifiesto["exclusiones"],
        "exclusiones_por_gitignore": {
            "mecanismo": "git ls-files --others --exclude-standard",
            "patrones_no_leidos": [".env*", "backend/.env", "backend/.env.local", "install-logs/",
                                   "offline-release/", "installer-output/", "backup-external/",
                                   "node_modules/", "frontend/node_modules/", "backend/vendor/",
                                   "frontend/dist/", "nginx/ssl/", "backend/storage/logs/",
                                   "backend/storage/app/private/backups/"],
        },
        "total_archivos_excluidos": len(excluidas),
        "total_bytes_excluidos": sum(x["tamano"] for x in excluidas),
    })
    dump(args.json_secretos, {
        "tipo": "escaneo_secretos",
        "nota": ("Solo se reportan ruta, linea y nombre de patron. Ningun valor es expuesto. "
                 "Las coincidencias en .env.example se marcan con es_plantilla_env=true."),
        "archivos_texto_escaneados": archivos_escaneados,
        "hallazgos": hallazgos,
        "total_hallazgos": len(hallazgos),
        "hallazgos_en_no_plantilla": [h for h in hallazgos if not h["es_plantilla_env"]],
    })
    dump(args.json_verificacion, {
        "tipo": "verificacion_copia",
        "archivos_incluidos": len(entradas),
        "discrepancias_byte_a_byte": discrepancias,
        "auto_inclusion_detectada": auto_inclusion,
        "manifiesto_fuera_de_fuentes": not json_path.startswith(fuentes + os.sep),
        "zip_fuera_de_fuentes": paquete is None or not paquete["ruta_zip"].startswith(fuentes + os.sep),
        "ok": not discrepancias and not auto_inclusion,
    })
    dump(args.json_paquete, {
        "tipo": "paquete",
        "marca": args.marca,
        "destino": dest,
        "fuentes": fuentes,
        "paquete": paquete,
    })

    print(json.dumps({
        "incluidos": len(entradas),
        "bytes_incluidos": total_bytes,
        "excluidos": len(excluidas),
        "bytes_excluidos": sum(x["tamano"] for x in excluidas),
        "discrepancias": len(discrepancias),
        "auto_inclusion": auto_inclusion,
        "hallazgos_secretos": len(hallazgos),
        "hallazgos_no_plantilla": len([h for h in hallazgos if not h["es_plantilla_env"]]),
        "head": head,
        "fingerprint_git_hash_object": fingerprint,
        "destino": dest,
        "zip": paquete,
    }, ensure_ascii=False, indent=2))
    return 0 if not discrepancias and not auto_inclusion else 4


if __name__ == "__main__":
    raise SystemExit(main())
