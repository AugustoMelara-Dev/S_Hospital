param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$failures = New-Object System.Collections.Generic.List[string]

function Read-RepoFile {
    param([string]$RelativePath)

    $path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        $failures.Add("Missing file: $RelativePath")
        return ''
    }

    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [string]$Description
    )

    $content = Read-RepoFile $RelativePath
    if ($content -notmatch $Pattern) {
        $failures.Add("${RelativePath}: missing $Description")
    }
}

function Assert-NotContains {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [string]$Description
    )

    $content = Read-RepoFile $RelativePath
    if ($content -match $Pattern) {
        $failures.Add("${RelativePath}: contains $Description")
    }
}

Assert-NotContains 'docker-compose.lan-emulation.yml' 'docker\.sock|1\.1\.1\.1|8\.8\.8\.8|:-cajero\d*|:-Cambio1234|APP_HTTPS_PORT:-8443' 'unsafe LAN emulation defaults or host mounts'
Assert-Contains 'docker-compose.lan-emulation.yml' 'profiles:\s*\["lan5"\]' 'lan5 profile for emulation services'
Assert-Contains 'docker-compose.lan-emulation.yml' 'command:\s*\["node",\s*"/work/cashier\.js"\]' 'explicit cashier command'
Assert-Contains 'docker-compose.lan-emulation.yml' 'command:\s*\["node",\s*"/work/orchestrator\.js"\]' 'explicit orchestrator command'
Assert-Contains 'docker-compose.lan-emulation.yml' 'CASHIER_USER_1:\?' 'required cashier users'
Assert-Contains 'docker-compose.lan-emulation.yml' 'CASHIER_PASSWORD_1:\?' 'required cashier passwords'
Assert-Contains 'docker-compose.lan-emulation.yml' 'LAN_EMULATION_RUN_ID:\s*\$\{LAN_EMULATION_RUN_ID:\?' 'required LAN emulation run id'
Assert-Contains 'docker-compose.lan-emulation.yml' 'no reemplazar la prueba fisica' 'physical proof disclaimer'

Assert-NotContains 'qa/lan-emulation/cashier.js' "BASE_URL\s*\|\|\s*'https://127\.0\.0\.1:8443'|CASHIER_USER\s*\|\|\s*'cajero1'" 'implicit local or demo cashier defaults'
Assert-Contains 'qa/lan-emulation/cashier.js' 'BLOCKED_PASSWORDS' 'blocked demo/default password check'
Assert-Contains 'qa/lan-emulation/cashier.js' 'LAN_EMULATION_RUN_ID is required' 'required cashier run id'
Assert-Contains 'qa/lan-emulation/cashier.js' 'page\.on\(''websocket''' 'Playwright websocket observation'
Assert-Contains 'qa/lan-emulation/orchestrator.js' 'EXPECTED_CASHIERS' 'fixed expected cashier count'
Assert-Contains 'qa/lan-emulation/orchestrator.js' 'waitForFreshResults' 'fresh-result polling before report aggregation'
Assert-Contains 'qa/lan-emulation/orchestrator.js' 'cashier\.run_id === RUN_ID' 'stale-result protection'
Assert-NotContains 'qa/lan-emulation/orchestrator.js' 'user:\s*c\.user' 'cashier username in consolidated report'

Assert-NotContains 'qa/loadtest/fiscal-race.js' "BASE_URL\s*\|\|\s*'https://127\.0\.0\.1:8443'|CASHIER_USER\s*\|\|\s*'cajero1'" 'implicit fiscal-race target or demo cashier'
Assert-Contains 'qa/loadtest/fiscal-race.js' 'BLOCKED_PASSWORDS' 'blocked fiscal-race demo/default password check'
Assert-NotContains 'qa/loadtest/multi-cashier.js' "\|\|\s*'cajero\d+'" 'implicit k6 cashier users'
Assert-Contains 'qa/loadtest/multi-cashier.js' 'requiredValue\(''CASHIER_USER_1''\)' 'required k6 cashier users'
Assert-Contains 'qa/loadtest/README.md' 'never against\s*# the real production database|do not run this against the real production database' 'production database warning'
Assert-Contains 'qa/loadtest/README.md' 'not field evidence|do not replace' 'physical proof disclaimer'
Assert-NotContains 'qa/loadtest/package.json' '"dependencies"\s*:' 'runtime npm dependencies for loadtest'
Assert-NotContains 'qa/loadtest/package.json' '"devDependencies"\s*:' 'dev npm dependencies for loadtest'
Assert-NotContains 'qa/lan-emulation/package.json' '"dependencies"\s*:' 'runtime npm dependencies for LAN emulation'
Assert-NotContains 'qa/lan-emulation/package.json' '"devDependencies"\s*:' 'dev npm dependencies for LAN emulation'

Assert-NotContains 'scripts/loadtest_smoke.sh' 'BASE_URL="\$\{BASE_URL:-https://127\.0\.0\.1:8443\}"|CASHIER_USER="\$\{CASHIER_USER:-cajero1\}"' 'implicit smoke target or demo cashier'
Assert-Contains 'scripts/loadtest_smoke.sh' 'JSON\.parse' 'strict JSON parsing of fiscal-race output'
Assert-Contains 'scripts/loadtest_smoke.sh' 'ALLOW_LOADTEST_SKIP' 'explicit opt-in skip when node is missing'

if ($failures.Count -gt 0) {
    Write-Host '[FAIL] LAN/loadtest safety gate failed:'
    foreach ($failure in $failures) {
        Write-Host " - $failure"
    }
    Write-Host 'LAN_LOADTEST_SAFETY: NO'
    exit 1
}

Write-Host 'LAN_LOADTEST_SAFETY: YES'
Write-Host 'LAN emulation and loadtest runners require disposable/validation targets and explicit credentials.'
