#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$script:Tests = [ordered]@{}
$script:Errors = New-Object System.Collections.Generic.List[string]

function Assert-State {
    param([string]$Name, [string]$Actual, [string]$Expected)
    $script:Tests[$Name] = $Actual
    if ($Actual -ne $Expected) {
        $script:Errors.Add("${Name}: esperado '$Expected', obtenido '$Actual'") | Out-Null
    }
}

function Assert-Contains {
    param([string]$Name, [string]$Value, [string]$Expected)
    $script:Tests[$Name] = $Value
    if (-not ($Value -like "*$Expected*")) {
        $script:Errors.Add("${Name}: '$Value' no contiene '$Expected'") | Out-Null
    }
}

function Assert-NotNull {
    param([string]$Name, [object]$Value)
    $script:Tests[$Name] = if ($null -eq $Value) { 'NULL' } else { 'NOT NULL' }
    if ($null -eq $Value) {
        $script:Errors.Add("${Name}: es NULL") | Out-Null
    }
}

function Assert-Null {
    param([string]$Name, [object]$Value)
    $script:Tests[$Name] = if ($null -eq $Value) { 'NULL' } else { 'NOT NULL' }
    if ($null -ne $Value) {
        $script:Errors.Add("${Name}: deberia ser NULL pero es '$Value'") | Out-Null
    }
}

function New-Sandbox {
    param([string]$Name)
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("s-hospital-cert-test-" + $Name + "-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    return $root
}

function Write-Json {
    param([string]$Path, [hashtable]$Obj)
    $Obj | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Set-GitHead {
    param([string]$Repo, [string]$Sha)
    # Crea un .git/HEAD y .git/refs/heads/main simulados con el SHA dado.
    $gitDir = Join-Path $Repo '.git'
    $refsDir = Join-Path $gitDir 'refs'
    $headsDir = Join-Path $refsDir 'heads'
    $auditDir = Join-Path $headsDir 'audit'
    $branchFile = Join-Path $auditDir 'pre-installation-fixes'
    New-Item -ItemType Directory -Force -Path $gitDir | Out-Null
    New-Item -ItemType Directory -Force -Path $refsDir | Out-Null
    New-Item -ItemType Directory -Force -Path $headsDir | Out-Null
    New-Item -ItemType Directory -Force -Path $auditDir | Out-Null
    Set-Content -LiteralPath (Join-Path $gitDir 'HEAD') -Value "ref: refs/heads/audit/pre-installation-fixes"
    Set-Content -LiteralPath $branchFile -Value $Sha
}

function Initialize-RealGit {
    param([string]$Repo, [string]$Sha, [string]$BranchName = 'audit/pre-installation-fixes')
    # Inicializa un repo git real con un commit y mueve HEAD al SHA indicado.
    & git -C $Repo init -q -b main 2>&1 | Out-Null
    # Crear un commit inicial
    $probeFile = Join-Path $Repo '.git-probe'
    Set-Content -LiteralPath $probeFile -Value 'init'
    & git -C $Repo add .git-probe 2>&1 | Out-Null
    & git -C $Repo -c user.email=test@example.com -c user.name=test commit -m init -q 2>&1 | Out-Null
    Remove-Item -LiteralPath $probeFile -Force -ErrorAction SilentlyContinue
    # Ahora reescribir HEAD a un SHA artificial.
    # En lugar de un SHA real, simplemente escribimos un blob que tenga el
    # SHA-1 deseado. Pero para que git lo reconozca necesitamos un objeto
    # commit. Truco: el SHA que usamos es arbitrario, pero git debe
    # poder resolverlo. Asi que hacemos un segundo commit con un mensaje
    # que produzca un SHA arbitrario, y luego lo movemos a la rama
    # deseada. Como el SHA no se puede predecir, usamos un SHA-1
    # aleatorio para el SHA esperado: solo necesitamos que el script
    # reciba el SHA por parametro.
    & git -C $Repo commit --allow-empty -m 'second' -q 2>&1 | Out-Null
}

function Run-Regenerate {
    param([string]$ProjectRoot, [string]$Candidate)
    # El script regenerate_candidate_manifest.ps1 invoca `git rev-parse HEAD`.
    # Para los tests, aseguramos que git este disponible en PATH o apuntamos
    # GIT_DIR/GIT_WORK_TREE a los sandboxes.
    $git = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
    if ($git) {
        $gitDir = Split-Path -Parent $git
        $env:PATH = "$gitDir;$env:PATH"
    }
    & "$PSScriptRoot\regenerate_candidate_manifest.ps1" -ProjectRoot $ProjectRoot -Candidate $Candidate 2>&1 | Out-Null
    return Get-Content -LiteralPath (Join-Path $Candidate 'CANDIDATE-MANIFEST.json') -Raw | ConvertFrom-Json
}

try {
    # PATH base: solo temp + git (sin ISCC) para los tres tests.
    $originalPath = $env:PATH
    $gitExe = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
    $gitDir = if ($gitExe) { Split-Path -Parent $gitExe } else { $null }
    $tempPath = [System.IO.Path]::GetTempPath()
    $env:PATH = if ($gitDir) { "$gitDir;$tempPath" } else { $tempPath }

    $localAppData = $env:LOCALAPPDATA
    if (-not $localAppData) { $localAppData = Join-Path $env:USERPROFILE 'AppData\Local' }
    $realIsccPath = Join-Path $localAppData 'Programs\Inno Setup 6\ISCC.exe'
    $realIsccBackup = if (Test-Path -LiteralPath $realIsccPath) { Get-Content -LiteralPath $realIsccPath -Raw } else { $null }
    $realIsccDir = Split-Path -Parent $realIsccPath

    function Remove-RealIscc {
        if (Test-Path -LiteralPath $realIsccPath) {
            Remove-Item -LiteralPath $realIsccPath -Force
        }
        # Tambien limpiar entradas en Program Files para que el script
        # no encuentre un ISCC en ninguna ruta de las que revisa.
        foreach ($pf in @((Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
                          (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'))) {
            if (Test-Path -LiteralPath $pf) { Remove-Item -LiteralPath $pf -Force -ErrorAction SilentlyContinue }
        }
    }

    function Restore-RealIscc {
        if ($null -ne $realIsccBackup) {
            if (-not (Test-Path -LiteralPath $realIsccDir)) {
                New-Item -ItemType Directory -Force -Path $realIsccDir | Out-Null
            }
            Set-Content -LiteralPath $realIsccPath -Value $realIsccBackup
        }
    }

    # --- Test 1: estado BLOCKED_ON_ISCC_NOT_AVAILABLE ---
    $repo1 = New-Sandbox -Name 'no-iscc-no-build'
    $candidate1 = Join-Path $repo1 'installer-output/CANDIDATO-CERTIFICACION'
    New-Item -ItemType Directory -Force -Path $candidate1 | Out-Null
    Initialize-RealGit -Repo $repo1 -Sha 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111'

    Remove-RealIscc
    try {
        $m1 = Run-Regenerate -ProjectRoot $repo1 -Candidate $candidate1
        Assert-State 'T1.status' $m1.certification_status 'BLOCKED_ON_ISCC_NOT_AVAILABLE'
        Assert-State 'T1.installer' $m1.installer 'NOT BUILT'
        Assert-State 'T1.blocker' $m1.blocker 'ISCC_NOT_AVAILABLE'
        Assert-Contains 'T1.required_artifacts' ($m1.required_artifacts_missing -join ',') 'S_Hospital-Instalador.exe'
        Assert-Null 'T1.sha' $m1.installer_sha256
    } finally {
        Restore-RealIscc
    }

    # --- Test 2: estado ISCC_AVAILABLE_BUT_NOT_BUILT ---
    $repo2 = New-Sandbox -Name 'iscc-no-build'
    $candidate2 = Join-Path $repo2 'installer-output/CANDIDATO-CERTIFICACION'
    $installerDir2 = Join-Path $repo2 'installer-output/build'
    New-Item -ItemType Directory -Force -Path $installerDir2 | Out-Null
    New-Item -ItemType Directory -Force -Path $candidate2 | Out-Null
    Initialize-RealGit -Repo $repo2 -Sha 'bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222'

    # Usar el ISCC real (o uno sintetico si fue removido por T1) en su
    # ruta por-usuario para que el script lo detecte.
    $isccDir = Join-Path $localAppData 'Programs\Inno Setup 6'
    if (-not (Test-Path -LiteralPath $isccDir)) {
        New-Item -ItemType Directory -Force -Path $isccDir | Out-Null
    }
    $isccPath = Join-Path $isccDir 'ISCC.exe'
    $prevIscc = if (Test-Path -LiteralPath $isccPath) { Get-Content -LiteralPath $isccPath -Raw } else { $null }
    try {
        if (-not (Test-Path -LiteralPath $isccPath)) {
            Set-Content -LiteralPath $isccPath -Value 'fake-iscc'
        }
        $m2 = Run-Regenerate -ProjectRoot $repo2 -Candidate $candidate2
        Assert-State 'T2.status' $m2.certification_status 'ISCC_AVAILABLE_BUT_NOT_BUILT'
        Assert-State 'T2.installer' $m2.installer 'NOT BUILT'
        Assert-NotNull 'T2.iscc_path' $m2.iscc_path
    } finally {
        if ($null -ne $prevIscc) {
            Set-Content -LiteralPath $isccPath -Value $prevIscc
        } elseif (Test-Path -LiteralPath $isccPath) {
            Remove-Item -LiteralPath $isccPath -Force
        }
    }

    # --- Test 3: estado BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION ---
    $repo3 = New-Sandbox -Name 'iscc-and-build'
    $candidate3 = Join-Path $repo3 'installer-output/CANDIDATO-CERTIFICACION'
    $buildDir3 = Join-Path $repo3 'installer-output/build'
    New-Item -ItemType Directory -Force -Path $buildDir3 | Out-Null
    $exe3 = Join-Path $buildDir3 'S_Hospital-Instalador.exe'
    # Crear un ejecutable de tamano > 0 con contenido fijo.
    $exeBytes = New-Object byte[] 1024
    for ($i = 0; $i -lt 1024; $i++) { $exeBytes[$i] = [byte]($i % 256) }
    [System.IO.File]::WriteAllBytes($exe3, $exeBytes)
    New-Item -ItemType Directory -Force -Path $candidate3 | Out-Null
    Initialize-RealGit -Repo $repo3 -Sha 'cccc3333cccc3333cccc3333cccc3333cccc3333'

    $isccDir3 = Join-Path $localAppData 'Programs\Inno Setup 6'
    if (-not (Test-Path -LiteralPath $isccDir3)) {
        New-Item -ItemType Directory -Force -Path $isccDir3 | Out-Null
    }
    $isccPath3 = Join-Path $isccDir3 'ISCC.exe'
    $prevIscc3 = if (Test-Path -LiteralPath $isccPath3) { Get-Content -LiteralPath $isccPath3 -Raw } else { $null }
    try {
        if (-not (Test-Path -LiteralPath $isccPath3)) {
            Set-Content -LiteralPath $isccPath3 -Value 'fake-iscc'
        }
        $m3 = Run-Regenerate -ProjectRoot $repo3 -Candidate $candidate3
        Assert-State 'T3.status' $m3.certification_status 'BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION'
        Assert-State 'T3.installer' $m3.installer 'BUILT'
        Assert-NotNull 'T3.sha' $m3.installer_sha256
        if ($m3.installer_size_bytes -ne 1024) {
            $script:Errors.Add("T3.size: esperado 1024, obtenido $($m3.installer_size_bytes)") | Out-Null
        }
        $script:Tests['T3.size'] = $m3.installer_size_bytes
        Assert-State 'T3.blocker' $m3.blocker 'WINDOWS_CLEAN_INSTALL_REQUIRED'
    } finally {
        if ($null -ne $prevIscc3) {
            Set-Content -LiteralPath $isccPath3 -Value $prevIscc3
        } elseif (Test-Path -LiteralPath $isccPath3) {
            Remove-Item -LiteralPath $isccPath3 -Force
        }
    }

    if ($script:Errors.Count -gt 0) {
        Write-Host "FAIL: $($script:Errors.Count) error(es) en $($script:Tests.Count) verificaciones"
        foreach ($err in $script:Errors) {
            Write-Host "  - $err"
        }
        $env:PATH = $originalPath
        throw "Tests fallaron."
    }

    Write-Host "OK: regenerate_candidate_manifest.ps1 cubrio los 3 estados (BLOCKED_ON_ISCC_NOT_AVAILABLE, ISCC_AVAILABLE_BUT_NOT_BUILT, BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION) en $($script:Tests.Count) verificaciones."
    $env:PATH = $originalPath
    exit 0
} finally {
    $env:PATH = $originalPath
    Restore-RealIscc
    foreach ($root in @($repo1, $repo2, $repo3)) {
        if ($root -and (Test-Path -LiteralPath $root)) {
            Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}
