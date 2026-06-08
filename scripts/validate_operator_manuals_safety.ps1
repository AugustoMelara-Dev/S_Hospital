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

function Read-Manual([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "No se encontro $relativePath."
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Test-NotContains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

function Test-ManualChecklistAndWarnings([string] $role, [string] $content) {
    Test-Contains $content "(?im)^##\s+Checklist Diario" "$role has daily checklist section"
    Test-Contains $content "(?im)^##\s+Advertencias Antes De Acciones Delicadas" "$role has delicate-action warning section"
    Test-Contains $content "(?im)^\s*-\s+\[ \]\s+.+" "$role checklist has actionable checkboxes"
    Test-Contains $content "(?i)no\s+(repita|repetir)|antes de repetir|revise Historial" "$role warns before duplicate invoice/payment attempts"
}

$cashier = Read-Manual "docs\manuales\MANUAL_CAJERO.md"
$areaUser = Read-Manual "docs\manuales\MANUAL_USUARIO_AREA.md"
$supervisor = Read-Manual "docs\manuales\MANUAL_SUPERVISOR.md"
$administrator = Read-Manual "docs\manuales\MANUAL_ADMINISTRADOR.md"
$operatorIndex = Read-Manual "docs\manuales\INDICE_OPERADOR.md"
$docsIndex = Read-Manual "docs\00_README.md"
$support = Read-Manual "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"
$training = Read-Manual "docs\manuales\GUIA_CAPACITACION_SEGURA.md"
$commonIncidents = Read-Manual "docs\manuales\RUNBOOK_INCIDENTES_COMUNES.md"
$generalUserManual = Read-Manual "docs\Manual_Usuario.md"
$generalUserManualHtml = Read-Manual "docs\Manual_Usuario.html"

if ($cashier -ne "") {
    Test-ManualChecklistAndWarnings "Cashier manual" $cashier
    foreach ($pattern in @("Abrir El Sistema", "Iniciar Sesion", "Abrir Caja", "Crear Factura", "Cobrar", "Imprimir Recibo", "Cerrar Caja", "Si Algo Falla")) {
        Test-Contains $cashier ([regex]::Escape($pattern)) "Cashier manual includes $pattern"
    }
    Test-Contains $cashier "(?i)no\s+se\s+debe\s+facturar\s+ni\s+cobrar\s+sin\s+caja\s+abierta" "Cashier manual blocks charging without open cashbox"
    Test-Contains $cashier "(?i)motivo\s+de\s+la\s+reimpresion" "Cashier manual requires reprint reason"
    Test-NotContains $cashier "(?i)motivo\s+si\s+el\s+sistema\s+lo\s+solicita|si\s+el\s+sistema\s+lo\s+solicita" "Cashier manual avoids optional audit-action wording"
}

if ($areaUser -ne "") {
    Test-ManualChecklistAndWarnings "Area-user manual" $areaUser
    foreach ($pattern in @("Abrir El Sistema", "Consultar Servicios Pagados", "Que Hacer Si No Aparece Un Servicio", "Que No Debe Hacer Este Rol")) {
        Test-Contains $areaUser ([regex]::Escape($pattern)) "Area-user manual includes $pattern"
    }
    Test-Contains $areaUser "(?i)no\s+abre\s+caja|no\s+crea\s+facturas|no\s+registra\s+pagos|no\s+ve\s+reportes\s+administrativos" "Area-user manual limits operational scope"
    Test-Contains $areaUser "(?i)no\s+pida\s+repetir\s+la\s+factura|no\s+pida\s+repetir\s+facturas" "Area-user manual prevents duplicate invoice requests"
    Test-Contains $areaUser "(?i)no\s+use\s+esta\s+pantalla\s+como\s+expediente\s+clinico" "Area-user manual avoids clinical-record scope creep"
}

if ($supervisor -ne "") {
    Test-ManualChecklistAndWarnings "Supervisor manual" $supervisor
    foreach ($pattern in @("Servidor No Disponible", "Red Local Caida", "Impresora No Responde", "Caja Quedo Abierta", "Respaldo Fallido", "Sesion Vencida O Sin Permiso")) {
        Test-Contains $supervisor ([regex]::Escape($pattern)) "Supervisor manual includes incident: $pattern"
    }
    Test-Contains $supervisor "(?i)no\s+borre\s+facturas|No borre facturas" "Supervisor manual forbids deleting invoices"
    Test-Contains $supervisor "(?i)Protegido[\s\S]{0,80}Pendiente[\s\S]{0,80}Error" "Supervisor manual uses current backup status labels"
    Test-NotContains $supervisor "(?i)Todo bien|Requiere revision" "Supervisor manual avoids obsolete backup status labels"
}

if ($administrator -ne "") {
    Test-ManualChecklistAndWarnings "Administrator manual" $administrator
    foreach ($pattern in @("Usuarios Y Permisos", "Respaldos", "Cambios Criticos", "Capacitacion Segura")) {
        Test-Contains $administrator ([regex]::Escape($pattern)) "Administrator manual includes $pattern"
    }
    Test-Contains $administrator "(?i)No invente CAI|No invente cumplimiento fiscal" "Administrator manual forbids invented fiscal compliance"
    Test-Contains $administrator "(?i)migrate:fresh|seeders de prueba|borrado de volumenes" "Administrator manual forbids destructive production commands"
    Test-Contains $administrator "(?i)automatizacion\s+de\s+respaldos" "Administrator manual uses operator-friendly backup automation wording"
    Test-Contains $administrator "(?i)respaldos\s+con\s+error,\s+respaldos\s+pendientes" "Administrator manual uses operator-friendly backup status wording"
}

if ($operatorIndex -ne "") {
    Test-Contains $operatorIndex "(?i)Soporte Local de Primer Nivel" "Operator index uses local support wording"
    Test-Contains $operatorIndex "(?i)Avisar a soporte local" "Operator index routes LAN errors to local support"
    Test-Contains $operatorIndex "MANUAL_USUARIO_AREA\.md" "Operator index links area-user manual"
    Test-Contains $operatorIndex "(?i)consulta de servicios pagados" "Operator index documents area-user workflow"
}

if ($docsIndex -ne "") {
    Test-Contains $docsIndex "manuales/MANUAL_USUARIO_AREA\.md" "Docs index links area-user manual"
    Test-Contains $docsIndex "(?i)Area-user manual|usuario de area|paid-service consultation" "Docs index explains area-user manual purpose"
    Test-Contains $docsIndex "PRODUCTION_CANDIDATE" "Docs index preserves candidate handoff status"
    Test-NotContains $docsIndex "PRODUCTION_READY=YES" "Docs index does not claim production ready before field evidence"
}

if ($support -ne "") {
    Test-Contains $support "(?i)Protegido[\s\S]{0,80}Pendiente[\s\S]{0,80}Error" "First-level support guide uses current backup status labels"
    Test-NotContains $support "(?i)Todo bien|Requiere revision" "First-level support guide avoids obsolete backup status labels"
}

if ($generalUserManual -ne "") {
    Test-Contains $generalUserManual "(?i)reimpresion\s+debe\s+registrar\s+motivo\s+y\s+quedar\s+auditada" "General user manual requires audited reprint reason"
    Test-Contains $generalUserManual "(?i)Protegido[\s\S]{0,80}Pendiente[\s\S]{0,80}Error" "General user manual uses current backup status labels"
    Test-NotContains $generalUserManual "(?i)Todo bien|Requiere revision|si\s+el\s+sistema\s+lo\s+solicita" "General user manual avoids obsolete or optional audit wording"
}

if ($generalUserManualHtml -ne "") {
    Test-Contains $generalUserManualHtml "(?i)reimpresion\s+debe\s+registrar\s+motivo\s+y\s+quedar\s+auditada" "General user manual HTML requires audited reprint reason"
    Test-Contains $generalUserManualHtml "(?i)Protegido[\s\S]{0,80}Pendiente[\s\S]{0,80}Error" "General user manual HTML uses current backup status labels"
    Test-NotContains $generalUserManualHtml "(?i)Todo bien|Requiere revision|si\s+el\s+sistema\s+lo\s+solicita" "General user manual HTML avoids obsolete or optional audit wording"
}

$backupIncident = ""
if ($commonIncidents -match "(?is)##\s+5\.\s+Respaldo queda en Pendiente(?<section>.*?)(?:\r?\n---|\z)") {
    $backupIncident = $Matches.section
}

$blankScreenIncident = ""
if ($commonIncidents -match "(?is)##\s+1\.\s+Pantalla blanca(?<section>.*?)(?:\r?\n---|\z)") {
    $blankScreenIncident = $Matches.section
}

$loginIncident = ""
if ($commonIncidents -match "(?is)##\s+2\.\s+Login no acepta contrasena(?<section>.*?)(?:\r?\n---|\z)") {
    $loginIncident = $Matches.section
}

$cashboxIncident = ""
if ($commonIncidents -match "(?is)##\s+4\.\s+Caja no abre(?<section>.*?)(?:\r?\n---|\z)") {
    $cashboxIncident = $Matches.section
}

$offlineUrlIncident = ""
if ($commonIncidents -match "(?is)##\s+6\.\s+Internet requerido o direccion incorrecta(?<section>.*?)(?:\r?\n---|\z)") {
    $offlineUrlIncident = $Matches.section
}

$lanClientIncident = ""
if ($commonIncidents -match "(?is)##\s+7\.\s+PC cliente no carga la app(?<section>.*?)(?:\r?\n---|\z)") {
    $lanClientIncident = $Matches.section
}

$finalChecklist = ""
if ($commonIncidents -match "(?is)##\s+Cuando todo falla: lista de verificacion de 60 segundos(?<section>.*)\z") {
    $finalChecklist = $Matches.section
}

$backupToolIncident = ""
if ($commonIncidents -match "(?is)##\s+9\.\s+Respaldo muestra Error por herramienta local(?<section>.*?)(?:\r?\n---|\z)") {
    $backupToolIncident = $Matches.section
}

$duplicateNoticeIncident = ""
if ($commonIncidents -match "(?is)##\s+8\.\s+Cajero ve doble aviso de su propia accion(?<section>.*?)(?:\r?\n---|\z)") {
    $duplicateNoticeIncident = $Matches.section
}

$sessionIncident = ""
if ($commonIncidents -match "(?is)##\s+10\.\s+Sesion cerrada inesperadamente(?<section>.*?)(?:\r?\n---|\z)") {
    $sessionIncident = $Matches.section
}

if ($commonIncidents -ne "") {
    Test-Contains $commonIncidents "(?i)Respaldo queda en Pendiente" "Common incidents runbook uses operator backup incident title"
    Test-Contains $backupIncident "(?i)Protegido" "Common incidents runbook names protected backup state"
    Test-Contains $backupIncident "(?i)Pendiente" "Common incidents runbook names pending backup state"
    Test-Contains $backupIncident "(?i)Error" "Common incidents runbook names error backup state"
    Test-NotContains $backupIncident "(?i)\b(pending|success|failed|worker_recently_active|HOSPITAL_DUMP_BINARY|/usr/bin/mariadb-dump)\b" "Common incidents backup section avoids raw backup internals"
    Test-Contains $blankScreenIncident "(?i)direccion LAN oficial" "Common incidents blank screen section uses LAN wording"
    Test-Contains $blankScreenIncident "(?i)Ayuda\s*>\s*Preparar resumen para soporte|resumen seguro" "Common incidents blank screen section routes to safe support summary"
    Test-NotContains $blankScreenIncident "(?i)http://IP_SERVIDOR|/up|/api|docker\s+ps|frontend/dist|nginx|F12|consola del navegador" "Common incidents blank screen section avoids raw runtime checks"
    Test-Contains $loginIncident "(?i)cuenta aparece bloqueada|supervisor" "Common incidents login section uses supervisor-safe lockout wording"
    Test-Contains $loginIncident "(?i)contrasena temporal" "Common incidents login section uses temporary-password wording"
    Test-NotContains $loginIncident "(?i)\b423\b|lockout|must_change_password|base de datos" "Common incidents login section avoids auth internals"
    Test-Contains $cashboxIncident "(?i)supervisor autorizado" "Common incidents cashbox section routes to authorized supervisor"
    Test-Contains $cashboxIncident "(?i)backup previo|auditoria" "Common incidents cashbox section requires backup/audit wording"
    Test-NotContains $cashboxIncident "(?i)cash\.close_any|\bBD\b|opened_at|closed_at|null|script que" "Common incidents cashbox section avoids permission/database internals"
    Test-Contains $commonIncidents "(?i)Internet requerido o direccion incorrecta" "Common incidents runbook uses operator offline/LAN incident title"
    Test-Contains $offlineUrlIncident "(?i)direccion LAN oficial" "Common incidents offline/LAN section uses LAN wording"
    Test-Contains $offlineUrlIncident "(?i)no use[\s\S]{0,80}localhost|localhost[\s\S]{0,80}computadora cliente" "Common incidents offline/LAN section warns clients about localhost"
    Test-Contains $offlineUrlIncident "(?i)Ayuda\s*>\s*Preparar resumen para soporte|resumen seguro" "Common incidents offline/LAN section routes to safe support summary"
    Test-NotContains $offlineUrlIncident "(?i)localhost:5173|runtime\.environment|frontend/dist|npm\s+run\s+build|bundle|vite|CORS|Failed to fetch|index\.html" "Common incidents offline/LAN section avoids dev/build internals"
    Test-Contains $lanClientIncident "(?i)direccion LAN oficial" "Common incidents LAN client section uses LAN wording"
    Test-Contains $lanClientIncident "(?i)soporte local" "Common incidents LAN client section routes to local support"
    Test-Contains $lanClientIncident "(?i)no\s+en\s+la\s+caja\s+cliente|caja cliente|computadora cliente" "Common incidents LAN client section distinguishes client computer"
    Test-NotContains $lanClientIncident "(?i)ping\s+IP_SERVIDOR|/up|tracert|IP_CHANGE_NOTICE|refresh_lan_ip|puerto\s+8000|Firewall de Windows|http://IP_SERVIDOR" "Common incidents LAN client section avoids raw network probes"
    Test-Contains $finalChecklist "(?i)direccion LAN oficial" "Common incidents final checklist uses LAN wording"
    Test-Contains $finalChecklist "(?i)no\s+repita|no\s+repetir" "Common incidents final checklist warns against repeating financial actions"
    Test-NotContains $finalChecklist "(?i)curl\s+http|/api|docker\s+ps|localhost:8000|smoke_test_post_install|database\.connected|JSON" "Common incidents final checklist avoids command/API checks"
    Test-Contains $commonIncidents "(?i)Respaldo muestra Error por herramienta local" "Common incidents runbook uses operator backup-tool incident title"
    Test-Contains $backupToolIncident "(?i)Ayuda\s*>\s*Preparar resumen para soporte|resumen seguro" "Common incidents backup-tool section routes to safe support summary"
    Test-Contains $backupToolIncident "(?i)Protegido|Protegida" "Common incidents backup-tool section names protected backup state"
    Test-Contains $backupToolIncident "(?i)Pendiente" "Common incidents backup-tool section names pending backup state"
    Test-Contains $backupToolIncident "(?i)Error" "Common incidents backup-tool section names error backup state"
    Test-NotContains $backupToolIncident "(?i)docker\s+exec|HOSPITAL_DUMP_BINARY|mariadb-dump|mysqldump|\.env|/usr/bin|contenedor backend|which\s+" "Common incidents backup-tool section avoids raw server internals"
    Test-Contains $commonIncidents "(?i)Cajero ve doble aviso de su propia accion" "Common incidents runbook uses operator duplicate-notice title"
    Test-Contains $duplicateNoticeIncident "(?i)no\s+repetir\s+la\s+factura|Historial" "Common incidents duplicate-notice section protects against duplicate financial actions"
    Test-NotContains $duplicateNoticeIncident "(?i)toast|useBroadcastSync|actor_id|proxy inverso|hook|evento a nivel" "Common incidents duplicate-notice section avoids frontend internals"
    Test-Contains $sessionIncident "(?i)Ayuda\s*>\s*Preparar resumen para soporte|resumen seguro" "Common incidents session section routes to safe support summary"
    Test-Contains $sessionIncident "(?i)configuracion local de sesiones" "Common incidents session section uses operator-safe session wording"
    Test-NotContains $sessionIncident "(?i)SESSION_DRIVER|SESSION_ENCRYPT|SANCTUM_STATEFUL_DOMAINS|php\s+artisan|session:clear|\.env|session_driver|runtime|backend|file\s+a\s+database" "Common incidents session section avoids raw session internals"
}

$combined = "$cashier`n$areaUser`n$supervisor`n$administrator`n$support`n$training`n$commonIncidents"
$operatorFacing = "$cashier`n$areaUser`n$supervisor`n$administrator`n$operatorIndex`n$generalUserManual`n$generalUserManualHtml"
$operatorFacingForTechnicalScan = $operatorFacing `
    -replace [regex]::Escape('php artisan hospital:maintenance on'), '[maintenance-on]' `
    -replace [regex]::Escape('php artisan hospital:maintenance off'), '[maintenance-off]'
foreach ($pattern in @("base real", "produccion", "base descartable", "no use la base real", "No restaure", "No borre")) {
    Test-Contains $combined ([regex]::Escape($pattern)) "Operator docs include safe training/support term: $pattern"
}

if ($operatorFacingForTechnicalScan -match "(?i)\bworker\b|cola\s+de\s+trabajos|trabajos\s+pendientes|soporte\s+tecnico|responsable\s+tecnico|comandos\s+tecnicos|documentos\s+tecnicos|duda\s+tecnica|curl\s+http|/api/|php\s+artisan") {
    Add-Failure "Normal operator manuals expose internal or technical support wording."
} else {
    Add-Pass "Normal operator manuals avoid internal backup/support wording"
}

if ($combined -match "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*=") {
    Add-Failure "Operator manuals expose secret-like assignments."
} else {
    Add-Pass "Operator manuals do not expose secret-like assignments"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OPERATOR_MANUALS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OPERATOR_MANUALS_SAFETY: YES" -ForegroundColor Green
