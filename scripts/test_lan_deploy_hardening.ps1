$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$projectRoot = Split-Path -Parent $scriptRoot

function Assert-Contains([string] $Path, [string] $Needle, [string] $Message) {
    $content = Get-Content -LiteralPath $Path -Raw
    if (-not $content.Contains($Needle)) {
        throw $Message
    }
}

function Assert-NotContains([string] $Path, [string] $Needle, [string] $Message) {
    $content = Get-Content -LiteralPath $Path -Raw
    if ($content.Contains($Needle)) {
        throw $Message
    }
}

$composePath = Join-Path $projectRoot "docker-compose.prod.yml"
$deployPath = Join-Path $scriptRoot "deploy_hospital_lan.ps1"
$refreshPath = Join-Path $scriptRoot "refresh_lan_ip.ps1"
$preflightPath = Join-Path $scriptRoot "production_readiness_preflight.ps1"
$lanClientValidatorPath = Join-Path $scriptRoot "validate_lan_client.ps1"
$offlineLanInstallPath = Join-Path $projectRoot "docs\OFFLINE_LAN_INSTALL.md"
$finalHandoffPath = Join-Path $scriptRoot "final_production_handoff.ps1"
$lanClientGuidePath = Join-Path $projectRoot "docs\GUIA_LAN_CLIENTE.md"
$fieldPendingGuidePath = Join-Path $projectRoot "docs\PENDIENTES_VALIDACION_CAMPO.md"
$printGuidePath = Join-Path $projectRoot "docs\GUIA_IMPRESION_RECIBOS.md"
$phaseGGuidePath = Join-Path $projectRoot "docs\PHASE_G_LAN_OFFLINE_VALIDATION_GUIDE.md"

Assert-Contains $composePath 'APP_URL: ${APP_SCHEME:-http}://' "docker-compose.prod.yml debe derivar APP_URL de APP_SCHEME."
Assert-Contains $composePath 'SESSION_SECURE_COOKIE: ${SESSION_SECURE_COOKIE:-false}' "docker-compose.prod.yml debe exponer SESSION_SECURE_COOKIE."
Assert-Contains $composePath '${SOKETI_BIND_IP:-0.0.0.0}:${SOKETI_PORT:-6001}:6001' "Soketi debe poder publicarse en LAN de forma explicita."
Assert-NotContains $composePath '127.0.0.1:${SOKETI_PORT:-6001}:6001' "Soketi no debe quedar limitado a localhost si los clientes usan SERVER_IP."

Assert-Contains $deployPath 'profile=private remoteip=localsubnet' "deploy_hospital_lan.ps1 debe limitar firewall a red privada/subnet local."
Assert-Contains $deployPath '$currSoketiPort = if ($existingRootEnv.ContainsKey("SOKETI_PORT")' "deploy_hospital_lan.ps1 debe conservar SOKETI_PORT no-default."
Assert-Contains $deployPath '"PUSHER_CLIENT_PORT" = $currSoketiPort' "deploy_hospital_lan.ps1 debe sincronizar PUSHER_CLIENT_PORT con SOKETI_PORT."
Assert-Contains $deployPath 'delete rule name="SistemaCajaHospitalaria Soketi LAN Port 6001"' "deploy_hospital_lan.ps1 debe limpiar regla Soketi legacy 6001 antes de abrir el puerto configurado."
Assert-Contains $deployPath 'SistemaCajaHospitalaria Soketi LAN Port $soketiPort' "deploy_hospital_lan.ps1 debe abrir el puerto Soketi configurado."
Assert-Contains $deployPath '"APP_URL"           = "http://${serverIp}:${appPort}"' "deploy_hospital_lan.ps1 debe persistir APP_URL en .env raiz para que el preflight no falle falsamente."
Assert-Contains $deployPath '"DB_CONNECTION"     = "mysql"' "deploy_hospital_lan.ps1 debe persistir DB_CONNECTION en .env raiz."
Assert-Contains $deployPath '"QUEUE_CONNECTION"  = "database"' "deploy_hospital_lan.ps1 debe persistir QUEUE_CONNECTION en .env raiz."
Assert-Contains $deployPath '"SANCTUM_STATEFUL_DOMAINS" = $corsValues.SanctumStatefulDomains' "deploy_hospital_lan.ps1 debe persistir SANCTUM_STATEFUL_DOMAINS en .env raiz."
Assert-Contains $refreshPath '-RemoteAddress LocalSubnet' "refresh_lan_ip.ps1 debe limitar firewall a LocalSubnet."
Assert-Contains $refreshPath '$soketiPort = 6001' "refresh_lan_ip.ps1 debe tener default seguro para SOKETI_PORT."
Assert-Contains $refreshPath 'Update-EnvKey -Path $rootEnv -Key "PUSHER_CLIENT_PORT"' "refresh_lan_ip.ps1 debe sincronizar PUSHER_CLIENT_PORT en .env raiz."
Assert-Contains $refreshPath '$legacySoketiRuleName = "Sistema Caja Hospitalaria - Soketi LAN TCP 6001"' "refresh_lan_ip.ps1 debe limpiar la regla Soketi legacy 6001 si se cambia de puerto."
Assert-Contains $refreshPath 'Sistema Caja Hospitalaria - Soketi LAN TCP $soketiPort' "refresh_lan_ip.ps1 debe recrear regla Soketi LAN con puerto configurable."
Assert-Contains $refreshPath 'Update-EnvKey -Path $rootEnv -Key "APP_PORT"' "refresh_lan_ip.ps1 debe sincronizar APP_PORT en .env raiz porque docker-compose.prod.yml publica ese puerto."
Assert-Contains $refreshPath 'Update-EnvKey -Path $rootEnv -Key "APP_URL"' "refresh_lan_ip.ps1 debe sincronizar APP_URL en .env raiz para preflight."
Assert-Contains $refreshPath 'Update-EnvKey -Path $rootEnv -Key "SANCTUM_STATEFUL_DOMAINS"' "refresh_lan_ip.ps1 debe sincronizar Sanctum en .env raiz para clientes LAN."
Assert-Contains $refreshPath 'Update-EnvKey -Path $rootEnv -Key "CORS_ALLOWED_ORIGINS"' "refresh_lan_ip.ps1 debe sincronizar CORS en .env raiz para clientes LAN."
Assert-Contains $refreshPath '[string] $EnvFile = ""' "refresh_lan_ip.ps1 debe aceptar un EnvFile externo de produccion Docker."
Assert-Contains $refreshPath '[string] $ComposeProjectName = ""' "refresh_lan_ip.ps1 debe aceptar ComposeProjectName para stacks con -p."
Assert-Contains $refreshPath 'Update-EnvKey -Path $externalEnv -Key "APP_URL"' "refresh_lan_ip.ps1 debe sincronizar APP_URL en el EnvFile externo."
Assert-Contains $refreshPath 'Update-EnvKey -Path $externalEnv -Key "PUSHER_CLIENT_HOST"' "refresh_lan_ip.ps1 debe sincronizar realtime LAN en el EnvFile externo."
Assert-Contains $refreshPath '$composeEnv = if ($externalEnv -ne "") { $externalEnv } else { $rootEnv }' "refresh_lan_ip.ps1 debe recrear Docker con el EnvFile efectivo."
Assert-Contains $refreshPath '$composeArgs += @("-p", $ComposeProjectName)' "refresh_lan_ip.ps1 debe preservar el nombre de proyecto Compose al recrear contenedores."
Assert-Contains $refreshPath '"up", "-d", "--force-recreate", "--no-build", "backend", "queue-worker", "scheduler", "nginx"' "refresh_lan_ip.ps1 debe recrear contenedores para reinyectar .env."
Assert-Contains $refreshPath '$dockerExitCode = $LASTEXITCODE' "refresh_lan_ip.ps1 debe evaluar docker compose por exit code."
Assert-Contains $refreshPath 'docker compose up failed with exit code' "refresh_lan_ip.ps1 debe fallar explicitamente si docker compose falla."
Assert-NotContains $refreshPath 'restart backend queue-worker scheduler' "refresh_lan_ip.ps1 no debe usar docker compose restart porque no reinyecta .env."

Assert-Contains $preflightPath 'PUSHER_CLIENT_PORT must match SOKETI_PORT' "production_readiness_preflight.ps1 debe bloquear puertos WebSocket inconsistentes."
Assert-Contains $preflightPath 'PUSHER_CLIENT_HOST must match the LAN host in BaseUrl' "production_readiness_preflight.ps1 debe bloquear host WebSocket distinto al LAN host."
Assert-Contains $preflightPath 'LAN clients cannot connect to Soketi when it is bound to localhost' "production_readiness_preflight.ps1 debe bloquear SOKETI_BIND_IP localhost en produccion LAN."
Assert-Contains $preflightPath '"/api/system/echo-config"' "production_readiness_preflight.ps1 debe exigir echo-config en la evidencia LAN de segunda PC."
Assert-Contains $preflightPath '"WebSocket"' "production_readiness_preflight.ps1 debe exigir WebSocket en la evidencia LAN de segunda PC."
Assert-Contains $preflightPath '"Soketi"' "production_readiness_preflight.ps1 debe exigir Soketi en la evidencia LAN de segunda PC."
Assert-Contains $preflightPath 'LAN client proof is marked as historical or requiring repeat' "production_readiness_preflight.ps1 debe rechazar evidencia LAN historica aunque mencione la BaseUrl final."
Assert-Contains $preflightPath 'LAN client proof Server LAN URL must be exactly' "production_readiness_preflight.ps1 debe exigir que el campo Server LAN URL coincida exactamente con la BaseUrl final."
Assert-Contains $lanClientValidatorPath 'WebSocket/Soketi TCP port is reachable from the client computer' "validate_lan_client.ps1 debe exigir prueba TCP de Soketi desde la segunda PC."
Assert-Contains $lanClientValidatorPath 'Realtime is disabled; multi-PC cashier sync requires Soketi/Pusher enabled' "validate_lan_client.ps1 debe fallar si realtime esta deshabilitado en prueba LAN."
Assert-Contains $offlineLanInstallPath 'puerto de sincronizacion en tiempo real' "OFFLINE_LAN_INSTALL.md debe documentar el puerto Soketi/WebSocket para firewall LAN."
Assert-Contains $finalHandoffPath 'Test-LanProofLooksCompleted' "final_production_handoff.ps1 debe validar explicitamente que la evidencia LAN incluya WebSocket."
Assert-Contains $finalHandoffPath 'TCP connect OK' "final_production_handoff.ps1 debe requerir conexion TCP OK de Soketi en la evidencia LAN."
Assert-Contains $finalHandoffPath '$expectedBaseUrl = $BaseUrl.TrimEnd("/")' "final_production_handoff.ps1 debe exigir que la evidencia LAN coincida con la BaseUrl final."
Assert-Contains $finalHandoffPath 'VALIDADO_HISTORICO_REQUIERE_REPETIR_IP_FINAL' "final_production_handoff.ps1 debe rechazar evidencia LAN marcada como historica."
Assert-Contains $finalHandoffPath 'Get-ProofFieldValue $content "Server LAN URL"' "final_production_handoff.ps1 debe validar el campo Server LAN URL, no solo una mencion suelta de la BaseUrl."
Assert-Contains $finalHandoffPath 'Print the real institutional receipt on media carta/carta/A5 paper' "final_production_handoff.ps1 debe pedir papel institucional principal, no termico como requisito principal."
Assert-Contains $finalHandoffPath 'Validate 80mm/58mm only if the hospital configured a secondary thermal printer' "final_production_handoff.ps1 debe dejar 80mm/58mm solo como compatibilidad secundaria."
Assert-Contains $lanClientGuidePath 'WebSocket TCP' "GUIA_LAN_CLIENTE.md debe indicar al operador que verifique WebSocket TCP."
Assert-Contains $lanClientGuidePath 'LAN_CLIENT_VALIDATION_PROOF.md -Force' "GUIA_LAN_CLIENTE.md debe indicar -Force para reemplazar evidencia LAN historica contra una IP vieja."
Assert-Contains $fieldPendingGuidePath '80mm/58mm son compatibilidad secundaria y no sustituyen el recibo institucional principal' "PENDIENTES_VALIDACION_CAMPO.md debe impedir cerrar produccion con recibos termicos secundarios en lugar del recibo institucional."
Assert-Contains $printGuidePath 'Por eso no cierran el gate fisico' "GUIA_IMPRESION_RECIBOS.md debe aclarar que PDF/impresoras virtuales no cierran el gate fisico."
Assert-Contains $phaseGGuidePath '-Force' "PHASE_G_LAN_OFFLINE_VALIDATION_GUIDE.md debe documentar -Force cuando se reemplaza evidencia LAN historica."
Assert-Contains $phaseGGuidePath 'Validar el formato institucional principal configurado/aprobado' "PHASE_G_LAN_OFFLINE_VALIDATION_GUIDE.md debe priorizar el recibo institucional principal."

Write-Host "[OK] LAN deploy hardening validation passed."
