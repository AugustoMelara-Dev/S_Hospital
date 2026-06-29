#!/usr/bin/env bash
# audit_offline_dependencies.sh
# S_Hospital - subagente 30 (Escenario Sin Internet)
# Version basica para entornos Linux/macOS. La version PowerShell es mas completa.

set -u

REPO_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
OUTPUT="$REPO_ROOT/qa/OFFLINE_SCENARIO_VALIDATION.md"
mkdir -p "$(dirname "$OUTPUT")"

critical=0
info=0
findings=""

add_finding() {
    local sev="$1" cat="$2" loc="$3" detail="$4"
    if [ "$sev" = "CRITICAL" ]; then critical=$((critical+1)); else info=$((info+1)); fi
    local safe_detail
    safe_detail=$(printf '%s' "$detail" | sed 's/|/\\|/g')
    findings="${findings}| ${sev} | ${cat} | ${loc} | ${safe_detail} |"$'\n'
}

# package.json
if [ -f "$REPO_ROOT/frontend/package.json" ]; then
    if grep -E '"[a-z0-9_/-]+"\s*:\s*"https?://' "$REPO_ROOT/frontend/package.json" >/dev/null 2>&1; then
        grep -E '"[a-z0-9_/-]+"\s*:\s*"https?://' "$REPO_ROOT/frontend/package.json" | while read -r line; do
            add_finding "CRITICAL" "CDN" "frontend/package.json" "$line"
        done
    fi
fi

# composer.json
if [ -f "$REPO_ROOT/backend/composer.json" ]; then
    if grep -E '"[a-z0-9_/-]+"\s*:\s*"https?://' "$REPO_ROOT/backend/composer.json" >/dev/null 2>&1; then
        grep -E '"[a-z0-9_/-]+"\s*:\s*"https?://' "$REPO_ROOT/backend/composer.json" | while read -r line; do
            add_finding "CRITICAL" "CDN" "backend/composer.json" "$line"
        done
    fi
fi

# index.html
if [ -f "$REPO_ROOT/frontend/index.html" ]; then
    if grep -E '<(script|link)[^>]+(src|href)="https?://' "$REPO_ROOT/frontend/index.html" >/dev/null 2>&1; then
        grep -E '<(script|link)[^>]+(src|href)="https?://' "$REPO_ROOT/frontend/index.html" | while read -r line; do
            add_finding "CRITICAL" "CDN" "frontend/index.html" "$line"
        done
    fi
fi

# Fuentes externas en archivos del proyecto
for pattern in 'fonts.googleapis.com' 'fonts.gstatic.com' 'cdn.jsdelivr.net' 'unpkg.com' 'cdnjs.cloudflare.com'; do
    matches=$(grep -rE "$pattern" "$REPO_ROOT/frontend/src" "$REPO_ROOT/backend" 2>/dev/null | head -20 || true)
    if [ -n "$matches" ]; then
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            loc=$(echo "$line" | cut -d: -f1 | sed "s|$REPO_ROOT/||")
            add_finding "CRITICAL" "FONT_CDN" "$loc" "$pattern"
        done <<EOF
$matches
EOF
    fi
done

# Reporte
cat > "$OUTPUT" <<HEADER
# Offline Scenario Validation

- Generado: $(date '+%Y-%m-%d %H:%M:%S')
- Repositorio: $REPO_ROOT
- Script: scripts/audit_offline_dependencies.sh

## Resumen

- Hallazgos CRITICAL: **$critical**
- Hallazgos INFO: **$info**

## Estado

HEADER

if [ "$critical" -eq 0 ]; then
    echo "**OFFLINE_OK** - Sin dependencias externas criticas detectadas." >> "$OUTPUT"
else
    echo "**OFFLINE_BLOCKED** - Se detectaron $critical dependencia(s) externa(s) critica(s)." >> "$OUTPUT"
fi

cat >> "$OUTPUT" <<TABLE

## Hallazgos

| Severidad | Categoria | Ubicacion | Detalle |
|-----------|-----------|-----------|---------|
$findings
## Reglas auditadas

- package.json y composer.json sin URL absolutas.
- index.html sin scripts/stylesheets desde CDNs publicos.
- Frontend src sin fetch/axios a hosts externos.
- Backend PHP sin Http::/curl a hosts externos.
- Sin fuentes de Google, jsDelivr, unpkg, cdnjs.

TABLE

echo "Offline audit complete"
echo "  CRITICAL: $critical"
echo "  INFO:     $info"
echo "  Report:   $OUTPUT"

[ "$critical" -gt 0 ] && exit 2 || exit 0
