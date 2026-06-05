param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
        return Get-Content -LiteralPath $path -Raw
    }

    Add-Failure "No se encontro $relativePath."
    return ""
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$helpView = Read-RequiredFile "frontend\src\features\help\HelpView.tsx"
$helpTest = Read-RequiredFile "frontend\src\features\help\HelpView.test.tsx"
$clientIssueLog = Read-RequiredFile "frontend\src\lib\support\clientIssueLog.ts"
$clientIssueLogTest = Read-RequiredFile "frontend\src\lib\support\clientIssueLog.test.ts"

if ($helpView -ne "") {
    foreach ($requiredText in @(
        'Ayuda institucional',
        'Abrir el sistema',
        'Iniciar sesion',
        'Abrir caja',
        'Nueva factura',
        'Cobrar',
        'Imprimir recibo',
        'Reimprimir',
        'Reportes',
        'Respaldos',
        'Cierre de turno',
        'Pedir soporte',
        'Evidencia local para soporte',
        'Preparar resumen',
        'Ver evidencia',
        'Atajos de teclado',
        'Responsabilidades por rol',
        'Checklist diario por rol',
        'Acciones delicadas',
        'Capacitaci'
    )) {
        Test-Contains $helpView ([regex]::Escape($requiredText)) "Help screen includes required section/text: $requiredText"
    }

    foreach ($incident in @(
        'Servidor no disponible',
        'Impresora no responde',
        'Falla la red',
        'Se fue la luz',
        'Caja qued',
        'Diferencia de caja',
        'Respaldo fallido',
        'Base de datos necesita restaurarse',
        'Sin permiso',
        'Se cerro el navegador'
    )) {
        Test-Contains $helpView ([regex]::Escape($incident)) "Help screen includes incident guidance: $incident"
    }

    Test-Contains $helpView '(?i)no\s+repita\s+la\s+factura|No repita facturas ni cobros' "Help screen warns not to duplicate invoices/payments"
    Test-Contains $helpView '(?i)revise\s+Caja\s+e\s+Historial|revise\s+Historial' "Help screen tells staff to check cashbox/history before retrying"
    Test-Contains $helpView '(?i)No use la base de producci|base descartable|base aislada' "Help screen keeps safe practice/restore database warning"
    Test-Contains $helpView '(?i)estado\s+de\s+respaldos' "Help screen uses backup-state language for failed backups"
    Test-Contains $helpView '(?i)respaldos\s+pendientes\s+o\s+con\s+error' "Help screen uses backup pending/error language"
    Test-Contains $helpView '(?i)soporte\s+local' "Help screen uses local support language"
    Test-Contains $helpView '(?i)contrase|tokens?|claves' "Help support evidence explains secrets are not included"
    Test-Contains $helpView 'buildClientIssueSupportSummary' "Help screen prepares safe support summary"
    Test-Contains $helpView 'getClientIssues' "Help screen reads local client issue evidence"
    Test-Contains $helpView 'navigator.clipboard' "Help screen can copy support summary when browser allows it"
}

if ($clientIssueLog -ne "") {
    foreach ($requiredText in @(
        'safeClientMessage',
        'hospital_client_issue_log',
        'MAX_ISSUES = 20',
        'PERMISSION_DENIED_MESSAGE',
        'buildClientIssueSupportSummary',
        'Resumen seguro para soporte',
        'Acci',
        'no repetir facturas ni cobros',
        '[redacted]',
        '[archivo-protegido]',
        '[campo-interno]',
        '[detalle-tecnico]',
        '[ruta-local]'
    )) {
        Test-Contains $clientIssueLog ([regex]::Escape($requiredText)) "Client issue log includes safety behavior: $requiredText"
    }

    foreach ($literalPattern in @(
        'DB_PASSWORD',
        'APP_KEY',
        'SQLSTATE',
        '\.env',
        'storage[\\/]+logs',
        'https?:\/\/'
    )) {
        Test-Contains $clientIssueLog ([regex]::Escape($literalPattern)) "Client issue log redacts technical pattern: $literalPattern"
    }
}

$combinedTests = "$helpTest`n$clientIssueLogTest"
foreach ($requiredText in @(
    'shows operational support guidance',
    'servidor no disponible',
    'impresora no responde',
    'se fue la luz',
    'caja qued',
    'base de datos necesita restaurarse',
    'se cerro el navegador',
    'evidencia local para soporte',
    'preparar resumen',
    'redacts sensitive words',
    'removes URL credentials',
    'without secrets or local paths'
)) {
    Test-Contains $combinedTests ([regex]::Escape($requiredText)) "Help/support tests cover: $requiredText"
}

if ($helpView -match "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*=") {
    Add-Failure "Help screen exposes secret-like assignments."
} else {
    Add-Pass "Help screen does not expose secret-like assignments"
}

if ($helpView -match "(?i)cola\s+de\s+trabajos|trabajos\s+fallidos|\bqueue\b|\bworker\b|soporte\s+tecnico") {
    Add-Failure "Help screen exposes internal queue/worker or technical-support wording."
} else {
    Add-Pass "Help screen avoids internal queue/worker and technical-support wording"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "HELP_SCREEN_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "HELP_SCREEN_SAFETY: YES" -ForegroundColor Green
