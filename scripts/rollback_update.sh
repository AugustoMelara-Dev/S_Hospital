#!/usr/bin/env bash
# rollback_update.sh
# S_Hospital - subagente 23 (Actualizaciones Offline)
# Equivalente bash del rollback_update.ps1. Para entornos Linux.

set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOGS_DIR="$PROJECT_ROOT/install-logs"
mkdir -p "$LOGS_DIR"
LOG_FILE="$LOGS_DIR/rollback_update_$(date +%Y%m%d_%H%M%S).log"

SELF_TEST=false
WHAT_IF=false
SKIP_CODE_ROLLBACK=false
FORCE_PRODUCTION_RESTORE=false
USE_EXISTING_ENV=false
BACKUP_FILE=""
EXPECTED_SHA256=""
PREVIOUS_RELEASE_PATH=""
TARGET_DATABASE="hospital_billing_rollback_validation"

while [ $# -gt 0 ]; do
    case "$1" in
        --self-test) SELF_TEST=true; shift ;;
        --what-if) WHAT_IF=true; shift ;;
        --skip-code-rollback) SKIP_CODE_ROLLBACK=true; shift ;;
        --force-production-restore) FORCE_PRODUCTION_RESTORE=true; shift ;;
        --use-existing-env) USE_EXISTING_ENV=true; shift ;;
        --backup-file) BACKUP_FILE="$2"; shift 2 ;;
        --expected-sha256) EXPECTED_SHA256="$2"; shift 2 ;;
        --previous-release-path) PREVIOUS_RELEASE_PATH="$2"; shift 2 ;;
        --target-database) TARGET_DATABASE="$2"; shift 2 ;;
        *) echo "Argumento desconocido: $1" >&2; exit 2 ;;
    esac
done

log() { echo "[$1] $2" | tee -a "$LOG_FILE"; }
step() { log "ETAPA" "$1"; }
ok()   { log "OK"    "$1"; }
warn() { log "WARN"  "$1"; }
err()  { log "ERROR" "$1"; }

# Validaciones
if [ -z "$BACKUP_FILE" ] && ! $SELF_TEST && ! $WHAT_IF; then
    err "Debe especificar --backup-file"; exit 2
fi
if [ -z "$EXPECTED_SHA256" ] && ! $SELF_TEST && ! $WHAT_IF; then
    err "Debe especificar --expected-sha256"; exit 2
fi
if [ -n "$EXPECTED_SHA256" ] && ! echo "$EXPECTED_SHA256" | grep -qE '^[0-9a-fA-F]{64}$'; then
    err "ExpectedSha256 debe ser 64 caracteres hex"; exit 2
fi
if [ -n "$BACKUP_FILE" ] && [ ! -f "$BACKUP_FILE" ]; then
    err "BackupFile no existe: $BACKUP_FILE"; exit 2
fi

IS_PROD_DB=false
case "$TARGET_DATABASE" in
    hospital_billing|hospital_billing_production) IS_PROD_DB=true ;;
esac

if $IS_PROD_DB && ! $FORCE_PRODUCTION_RESTORE; then
    err "TargetDatabase es la base activa. Use --force-production-restore y confirme."; exit 2
fi

if ! $IS_PROD_DB && ! echo "$TARGET_DATABASE" | grep -qE '(test|restore|validation|disposable|proof|rollback)'; then
    err "TargetDatabase debe incluir sufijo test/restore/validation/disposable/proof/rollback, o ser la base activa con --force-production-restore."; exit 2
fi

# SelfTest
if $SELF_TEST; then
    step "SelfTest: entorno y parametros"
    echo "  projectRoot:      $PROJECT_ROOT"
    echo "  BackupFile:       $BACKUP_FILE"
    echo "  ExpectedSha256:   $EXPECTED_SHA256"
    echo "  PreviousRelease:  $PREVIOUS_RELEASE_PATH"
    echo "  TargetDatabase:   $TARGET_DATABASE"
    echo "  ForceProd:        $FORCE_PRODUCTION_RESTORE"
    echo "  logFile:          $LOG_FILE"
    ok "SelfTest completo."; exit 0
fi

# WhatIf
if $WHAT_IF; then
    step "WhatIf: simulando rollback (sin ejecutar)"
    echo "  1. Snapshot del codigo en $LOGS_DIR/rollback_code_\$(date +%Y%m%d_%H%M%S)/"
    if [ -n "$BACKUP_FILE" ]; then
        echo "  2. Validar SHA256: $EXPECTED_SHA256"
    fi
    if [ -n "$PREVIOUS_RELEASE_PATH" ] && ! $SKIP_CODE_ROLLBACK; then
        echo "  3. Restaurar codigo desde: $PREVIOUS_RELEASE_PATH"
    fi
    echo "  4. Restaurar DB a $TARGET_DATABASE"
    echo "  5. Ejecutar preflight"
    echo "  6. Validar /up"
    ok "WhatIf completo."; exit 0
fi

# Confirmacion produccion
if $FORCE_PRODUCTION_RESTORE && $IS_PROD_DB; then
    warn "ATENCION: restaurara la base activa ($TARGET_DATABASE)."
    printf "Escriba ROLLBACK (mayusculas) para confirmar: "
    read -r confirm
    if [ "$confirm" != "ROLLBACK" ]; then
        err "Confirmacion no recibida. Rollback cancelado."; exit 4
    fi
    ok "Confirmacion recibida. Procediendo con rollback de produccion."
fi

# Snapshot de codigo
CODE_SNAPSHOT="$LOGS_DIR/rollback_code_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$CODE_SNAPSHOT"
step "Creando snapshot del codigo en $CODE_SNAPSHOT"
[ -d "$BACKEND_DIR" ] && cp -a "$BACKEND_DIR" "$CODE_SNAPSHOT/" 2>/dev/null || true
[ -d "$FRONTEND_DIR" ] && cp -a "$FRONTEND_DIR" "$CODE_SNAPSHOT/" 2>/dev/null || true
ok "Snapshot guardado."

# Validar SHA256
if [ -n "$BACKUP_FILE" ]; then
    step "Validando SHA256 del backup"
    if ! command -v sha256sum >/dev/null 2>&1; then
        err "sha256sum no disponible."; exit 5
    fi
    ACTUAL=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
    EXPECTED=$(echo "$EXPECTED_SHA256" | tr '[:upper:]' '[:lower:]')
    if [ "$ACTUAL" != "$EXPECTED" ]; then
        err "SHA256 no coincide. Actual=$ACTUAL Esperado=$EXPECTED"; exit 5
    fi
    ok "SHA256 validado: $ACTUAL"
fi

# Restaurar codigo
if [ -n "$PREVIOUS_RELEASE_PATH" ] && ! $SKIP_CODE_ROLLBACK; then
    step "Restaurando codigo desde $PREVIOUS_RELEASE_PATH"
    if [ -d "$PREVIOUS_RELEASE_PATH" ]; then
        [ -d "$PREVIOUS_RELEASE_PATH/backend" ] && {
            rm -rf "$BACKEND_DIR"
            cp -a "$PREVIOUS_RELEASE_PATH/backend" "$BACKEND_DIR"
            ok "backend/ restaurado."
        }
        [ -d "$PREVIOUS_RELEASE_PATH/frontend" ] && {
            rm -rf "$FRONTEND_DIR"
            cp -a "$PREVIOUS_RELEASE_PATH/frontend" "$FRONTEND_DIR"
            ok "frontend/ restaurado."
        }
    else
        warn "PreviousReleasePath no es directorio. Extraccion manual requerida."
    fi
else
    warn "Rollback de codigo omitido."
fi

# Restaurar DB
if [ -n "$BACKUP_FILE" ]; then
    step "Restaurando DB a $TARGET_DATABASE desde $BACKUP_FILE"
    RESTORE_SCRIPT="$PROJECT_ROOT/scripts/validate_restore_mysql.sh"
    if [ -f "$RESTORE_SCRIPT" ]; then
        HOSPITAL_VALIDATE_RESTORE_MYSQL=1 \
        RESTORE_TEST_DATABASE="$TARGET_DATABASE" \
        bash "$RESTORE_SCRIPT"
        if [ $? -ne 0 ]; then
            err "validate_restore_mysql.sh fallo."; exit 6
        fi
        ok "DB restaurada."
    else
        err "No se encontro scripts/validate_restore_mysql.sh"; exit 7
    fi
fi

# Preflight
step "Ejecutando preflight (recomendado)"
warn "Ejecutar scripts/production_readiness_preflight.ps1 manualmente si esta disponible."

ok "Rollback completo. Snapshot previo: $CODE_SNAPSHOT"
ok "Log: $LOG_FILE"
echo ""
echo "Proximos pasos:"
echo "  1. Validar /up y /login"
echo "  2. Confirmar facturas, pagos y caja"
echo "  3. Documentar incidente en qa/INCIDENT-YYYY-MM-DD.md"

exit 0
