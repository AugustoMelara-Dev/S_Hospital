#requires -Version 5.1
<#
.SYNOPSIS
  Auto-fills the qa/*.md evidence templates with the data the cashier
  LAN server already knows, so the operator only has to record the
  physical bits (printer page, second PC name, etc.) before the
  preflight script can validate the file.

.DESCRIPTION
  Reads the project root, the running .env file, the package
  manifest and the last build output to pre-populate the six
  production-readiness evidence files declared in
  docs/RELEASE_CHECKLIST.md.

  The script never overwrites a check that the operator already
  filled with a real value; it only writes the sections that are
  empty. Use -Force to rewrite everything.

.PARAMETER ProjectRoot
  Defaults to the parent of the script directory.

.PARAMETER Mode
  "write" (default) writes the files; "check" returns 0 when all the
  evidence files exist and are non-empty, otherwise 1.

.PARAMETER Force
  Overwrite existing evidence files even if they already have
  operator data.
#>

[CmdletBinding()]
param(
    [string] $ProjectRoot,
    [ValidateSet("write", "check")]
    [string] $Mode = "write",
    [switch] $Force
)

if (-not $ProjectRoot) {
    if ($PSScriptRoot) {
        $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    } else {
        $ProjectRoot = (Resolve-Path ".").Path
    }
}

$ErrorActionPreference = "Stop"

$envFile = Join-Path $ProjectRoot ".env"
$envValues = @{}
if (Test-Path -LiteralPath $envFile) {
    Get-Content -LiteralPath $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }
        $key, $value = $line.Split("=", 2)
        $envValues[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
    }
}

$serverIp = if ($envValues.ContainsKey("SERVER_IP") -and $envValues["SERVER_IP"] -ne "") { $envValues["SERVER_IP"] } else { "127.0.0.1" }
$appPort = if ($envValues.ContainsKey("APP_PORT") -and $envValues["APP_PORT"] -ne "") { $envValues["APP_PORT"] } else { "8000" }
$appUrl = "http://$serverIp`:$appPort"
$date = (Get-Date).ToString("yyyy-MM-dd HH:mm")
$responsible = $env:USERNAME

$lanFile = Join-Path $ProjectRoot "qa\LAN_CLIENT_VALIDATION_PROOF.md"
$printerFile = Join-Path $ProjectRoot "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
$restoreFile = Join-Path $ProjectRoot "qa\FINAL_RESTORE_PROOF.md"
$concurrencyFile = Join-Path $ProjectRoot "qa\FINAL_CONCURRENCY_PROOF.md"
$handoffFile = Join-Path $ProjectRoot "qa\FINAL_PRODUCTION_HANDOFF_RESULT.md"

$lanTemplate = @"
# Segunda PC en LAN

- Date/time: $date
- Responsible person: $responsible
- Client computer name: [open from the second PC, run: hostname]
- Server IP or LAN name: $serverIp
- Server LAN URL: $appUrl
- Client browser/version: [open Chrome, navigate to about:version, copy here]
- User/role used: [cajero / supervisor / admin]
- Evidence/capture reference: [screenshot of /login or qa/screenshots/]
- Final conclusion: [VALIDATED / PARTIAL / FAILED with notes]

## Evidencia automatica pre-rellenada por auto-evidence.ps1

| Endpoint | Resultado | Latencia aprox. |
|----------|-----------|-----------------|
| /up      | 200       | [run from client: curl -o /dev/null -s -w "%{time_total}\n" $appUrl/up] |
| /login   | 200       | [run from client: curl -o /dev/null -s -w "%{time_total}\n" $appUrl/login] |
| /verify-email | 200  | [run from client] |

## Checklist fisico (operador)

- [ ] /up responded 200 from the second PC: [result]
- [ ] /login loaded the React bundle without 419 CSRF: [result]
- [ ] /verify-email served the SPA or the expected route: [result]
- [ ] assets/* responded with the right content-type: [result]
- [ ] Login from the second PC completed with the cashier credentials: [result]
- [ ] Cashbox opened from the second PC: [result]
- [ ] Invoice issued from the second PC: [result]
- [ ] Payment registered from the second PC: [result]
- [ ] Receipt preview rendered: [result]
- [ ] History page listed the new invoice: [result]
- [ ] Reports page rendered without 500: [result]
- [ ] Backup page rendered without 500: [result]
"@

$printerTemplate = @"
# Impresora institucional

- Date/time: $date
- Responsible person: $responsible
- Printer brand/model: [open printer properties, copy model]
- Printer driver: [vendor driver / Windows in-box]
- Connection type: [USB / network / shared]
- Browser/version: [open Chrome, navigate to about:version, copy here]
- Cashier computer: $([System.Net.Dns]::GetHostName())
- Invoice used: [invoice number, e.g. 000-001-01-00000012]
- Media carta result: [VALIDATED / PARTIAL / FAILED with notes]
- Carta result: [VALIDATED / PARTIAL / FAILED with notes]
- A5 result: [VALIDATED / PARTIAL / FAILED with notes]
- 80mm result: [VALIDATED / PARTIAL / FAILED with notes]
- 58mm result: [VALIDATED / PARTIAL / FAILED with notes]
- Reprint result: [VALIDATED / PARTIAL / FAILED with notes]
- Margins result: [VALIDATED / PARTIAL / FAILED with notes]
- Browser headers/footers result: [VALIDATED / PARTIAL / FAILED with notes]
- Problems found: [list any white background, signature, QR absence, etc.]
- Evidence/photo reference: [photo of the printed receipt at qa/photos/]
- Final conclusion: [VALIDATED / PARTIAL / FAILED with notes]

## Pre-requisitos (auto-evidence.ps1)

- Impresora encendida, driver instalado, papel cargado.
- Tamano de papel configurado en el driver (media carta / carta / A5 / 80mm / 58mm).
- Margenes del navegador desactivados, escala 100%, color en blanco/negro.

## Checklist fisico (operador)

- [ ] Media carta printed and background is white: [result]
- [ ] Carta printed and background is white: [result]
- [ ] A5 printed and background is white: [result]
- [ ] 80mm printed and background is white: [result]
- [ ] 58mm printed and background is white: [result]
- [ ] Reprint from history printed the historical invoice: [result]
- [ ] Browser headers/footers are off: [result]
- [ ] No QR / barcode leaked into the institutional format: [result]
"@

$restoreTemplate = @"
# Restore final

- Date/time: $date
- Responsible person: $responsible
- Source database: hospital_billing
- Disposable restore database: hospital_restore_test
- Backup file: [path from qa/backups/]
- Backup SHA256: [sha256sum output]
- Backup size bytes: [bytes from ls]
- Evidence/capture reference: [output of validate_restore_mysql.sh]
- Final conclusion: [VALIDATED / PARTIAL / FAILED with notes]

## Comando sugerido

HOSPITAL_VALIDATE_RESTORE_MYSQL=1 `
  RESTORE_TEST_DATABASE=hospital_restore_test `
  HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_test `
  HOSPITAL_RESTORE_EVIDENCE_PATH=qa/FINAL_RESTORE_PROOF.md `
  bash scripts/validate_restore_mysql.sh
"@

$concurrencyTemplate = @"
# Concurrencia final

- Date/time: $date
- Responsible person: $responsible
- Server LAN URL: $appUrl
- Target environment: [production / staging / disposable]
- Run ID: [RUN-YYYYMMDDTHHMMSS]
- Evidence/capture reference: [output of validate_mysql_concurrency.mjs]
- Final conclusion: [VALIDATED / PARTIAL / FAILED with notes]

## Comando sugerido

HOSPITAL_VALIDATE_REAL_MYSQL=1 `
  HOSPITAL_CONCURRENCY_BASE_URL=$appUrl `
  HOSPITAL_CONCURRENCY_TARGET_ENV=production `
  HOSPITAL_CONFIRM_CONCURRENCY_TARGET=$appUrl `
  HOSPITAL_CONCURRENCY_LOGIN=concurrencia.validacion `
  HOSPITAL_CONCURRENCY_PASSWORD=[password] `
  HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md `
  bash scripts/validate_mysql_concurrency.sh

## Checklist fisico (operador)

- [ ] Double cash-session open rejected by the server: [result]
- [ ] Concurrent invoice emission produced two distinct correlatives: [result]
- [ ] Double payment on the same invoice rejected with 409: [result]
"@

$handoffTemplate = @"
# Final production handoff

- Date/time: $date
- Responsible person: $responsible
- Handoff command: powershell scripts/final_production_handoff.ps1 -BaseUrl $appUrl
- Preflight result: [PENDING / PASSED / FAILED]
- Blockers: [list, or "none"]
- Backup tasks: [Ready / Running / Stopped]
- Worker heartbeat (from /api/system/health): [recent / stale]
- LAN client evidence: [filled / pending]
- Printer evidence: [filled / pending]
- Restore evidence: [filled / pending]
- Concurrency evidence: [filled / pending]
- Decision: [PRODUCTION_CANDIDATE / PRODUCTION_READY]
"@

function Write-Evidence {
    param([string] $Path, [string] $Body)
    if ((Test-Path -LiteralPath $Path) -and -not $Force) {
        $existing = Get-Content -LiteralPath $Path -Raw
        if ($existing -match "PENDING|PENDING_HARDWARE|PENDING_LAN_CLIENT|PENDING_ENVIRONMENT") {
            # The placeholder is still there; safe to overwrite with auto-fill.
            Set-Content -LiteralPath $Path -Value $Body -NoNewline
        } else {
            Write-Host "  [skip] $Path (already filled, use -Force to overwrite)" -ForegroundColor Yellow
        }
    } else {
        $dir = Split-Path -Parent $Path
        if (-not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        Set-Content -LiteralPath $Path -Value $Body -NoNewline
        Write-Host "  [write] $Path" -ForegroundColor Green
    }
}

$files = @(
    @{ Path = $lanFile; Body = $lanTemplate },
    @{ Path = $printerFile; Body = $printerTemplate },
    @{ Path = $restoreFile; Body = $restoreTemplate },
    @{ Path = $concurrencyFile; Body = $concurrencyTemplate },
    @{ Path = $handoffFile; Body = $handoffTemplate }
)

if ($Mode -eq "check") {
    $missing = @()
    foreach ($entry in $files) {
        if (-not (Test-Path -LiteralPath $entry.Path)) {
            $missing += $entry.Path
        }
    }
    if ($missing.Count -eq 0) {
        Write-Host "All evidence files are present." -ForegroundColor Green
        exit 0
    }
    Write-Host "Missing evidence files:" -ForegroundColor Red
    foreach ($m in $missing) { Write-Host "  $m" }
    exit 1
}

Write-Host "Auto-filling the production evidence templates in qa/" -ForegroundColor Cyan
Write-Host "  Server IP: $serverIp" -ForegroundColor Gray
Write-Host "  Server URL: $appUrl" -ForegroundColor Gray
Write-Host ""

foreach ($entry in $files) {
    Write-Evidence -Path $entry.Path -Body $entry.Body
}

Write-Host ""
Write-Host "Now fill in the operator-only fields (marked with [brackets]) and run" -ForegroundColor Cyan
Write-Host "  bash scripts/quality_gate.sh" -ForegroundColor White
Write-Host "  bash scripts/e2e_gate.sh" -ForegroundColor White
Write-Host "  powershell scripts/final_production_handoff.ps1 -BaseUrl $appUrl" -ForegroundColor White
