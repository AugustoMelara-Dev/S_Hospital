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
    if [ "$sev" = "CRITICAL" ]; then
        critical=$((critical + 1))
    else
        info=$((info + 1))
    fi
    local safe_detail
    safe_detail=$(printf '%s' "$detail" | sed 's/|/\\|/g')
    findings="${findings}| ${sev} | ${cat} | ${loc} | ${safe_detail} |"$'\n'
}

allowed_pattern='(localhost|127\.0\.0\.1|0\.0\.0\.0|soketi|redis|mysql|mariadb|10\.[0-9]+|192\.168\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+)'
placeholder_pattern='(IP_DEL_SERVIDOR|IP-DEL-SERVIDOR|EXAMPLE\.COM|EXAMPLE\.ORG|PLACEHOLDER|<HOST>|<URL>|YOUR_|CHANGEME|hospital\.test)'

# 1. package.json
if [ -f "$REPO_ROOT/frontend/package.json" ]; then
    hits=$(grep -E '"[a-z0-9_./@-]+"\s*:\s*"https?://' "$REPO_ROOT/frontend/package.json" || true)
    if [ -n "$hits" ]; then
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            add_finding "CRITICAL" "CDN" "frontend/package.json" "$line"
        done <<EOF
$hits
EOF
    fi
fi

# 2. composer.json
if [ -f "$REPO_ROOT/backend/composer.json" ]; then
    hits=$(grep -E '"[a-z0-9_./@-]+"\s*:\s*"https?://' "$REPO_ROOT/backend/composer.json" || true)
    if [ -n "$hits" ]; then
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            add_finding "CRITICAL" "CDN" "backend/composer.json" "$line"
        done <<EOF
$hits
EOF
    fi
fi

# 3. index.html
if [ -f "$REPO_ROOT/frontend/index.html" ]; then
    hits=$(grep -E '<(script|link)[^>]+(src|href)="https?://' "$REPO_ROOT/frontend/index.html" || true)
    if [ -n "$hits" ]; then
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            add_finding "CRITICAL" "CDN" "frontend/index.html" "$line"
        done <<EOF
$hits
EOF
    fi
fi

# 4. Frontend src (excluyendo tests)
hits=$(grep -rE 'https?://[a-zA-Z0-9./:_-]+' \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --exclude-dir='node_modules' --exclude-dir='dist' --exclude-dir='build' \
    "$REPO_ROOT/frontend/src" 2>/dev/null \
    | grep -vE '\.test\.|__tests__|/tests/' || true)
if [ -n "$hits" ]; then
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        url=$(echo "$line" | grep -oE 'https?://[^ "'\'')]+' | head -1)
        [ -z "$url" ] && continue
        if ! echo "$url" | grep -qE "$allowed_pattern" && ! echo "$url" | grep -qE "$placeholder_pattern"; then
            loc=$(echo "$line" | cut -d: -f1 | sed "s|$REPO_ROOT/||")
            add_finding "CRITICAL" "EXTERNAL_HTTP" "$loc" "URL externa: $url"
        fi
    done <<EOF
$hits
EOF
fi

# 5. Backend app/
hits=$(grep -rE 'https?://[a-zA-Z0-9./:_-]+' \
    --include='*.php' \
    --exclude-dir='vendor' --exclude-dir='node_modules' \
    "$REPO_ROOT/backend/app" 2>/dev/null \
    | grep -vE 'tests/Feature|tests/Unit' || true)
if [ -n "$hits" ]; then
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        url=$(echo "$line" | grep -oE 'https?://[^ "'\'')]+' | head -1)
        [ -z "$url" ] && continue
        if ! echo "$url" | grep -qE "$allowed_pattern" && ! echo "$url" | grep -qE "$placeholder_pattern"; then
            loc=$(echo "$line" | cut -d: -f1 | sed "s|$REPO_ROOT/||")
            add_finding "CRITICAL" "EXTERNAL_HTTP" "$loc" "URL externa: $url"
        fi
    done <<EOF
$hits
EOF
fi

# 6. Fuentes externas
for pattern in 'fonts.googleapis.com' 'fonts.gstatic.com' 'use.typekit.net' 'cdn.jsdelivr.net' 'unpkg.com' 'cdnjs.cloudflare.com'; do
    hits=$(grep -rE "$pattern" --exclude-dir='node_modules' --exclude-dir='vendor' --exclude-dir='dist' --exclude-dir='build' "$REPO_ROOT/frontend" 2>/dev/null || true)
    if [ -n "$hits" ]; then
        while IFS= read -r line; do
            [ -z "$line" ] && continue
            loc=$(echo "$line" | cut -d: -f1 | sed "s|$REPO_ROOT/||")
            add_finding "CRITICAL" "FONT_CDN" "$loc" "Fuente externa: $pattern"
        done <<EOF
$hits
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
    echo "**OFFLINE_OK** - Sin dependencias externas criticas detectadas. El sistema puede operar sin internet." >> "$OUTPUT"
else
    echo "**OFFLINE_BLOCKED** - Se detectaron $critical dependencia(s) externa(s) critica(s). Deben removerse o documentarse como no obligatorias para produccion offline." >> "$OUTPUT"
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
- Backend app/ sin Http::/curl a hosts externos.
- Sin fuentes de Google, jsDelivr, unpkg, cdnjs.

## Lista de hosts permitidos

- \`localhost\`, \`127.0.0.1\`, \`0.0.0.0\`
- \`soketi\`, \`redis\`, \`mysql\`, \`mariadb\` (nombres de servicio Docker)
- IPs privadas \`10.*\`, \`192.168.*\`, \`172.16-31.*\`

TABLE

echo "Offline audit complete"
echo "  CRITICAL: $critical"
echo "  INFO:     $info"
echo "  Report:   $OUTPUT"

[ "$critical" -gt 0 ] && exit 2 || exit 0
