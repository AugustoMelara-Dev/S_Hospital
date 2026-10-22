#Requires -Version 5.1
<#
.SYNOPSIS
    Levanta un laboratorio local NO-Docker (backend Laravel + frontend Vite +
    MariaDB real de XAMPP) sobre una base de datos DESECHABLE.

.DESCRIPTION
    Este laboratorio existe porque el runtime Docker esta estructuralmente roto
    en esta maquina (distro WSL2 docker-desktop inutilizable + com.docker.service
    sin elevacion, ver hospital-ai/evidencia/C1-INST-01).

    NO es paridad del despliegue Docker. Sirve para validaciones acotadas:
    render visual, contratos HTTP y flujos funcionales contra una base real.

    Aislamiento (tres capas):
      1. Base propia y desechable: sh_ai_lab_local (se dropea y recrea).
      2. Usuario MariaDB acotado (sh_ai_lab_*) con GRANT solo sobre esa base:
         el proceso no PUEDE escribir en las ~354 bases ajenas que comparten
         esta instancia de XAMPP.
      3. Entorno propio: backend/.env.local (ignorado por git, NO pisa backend/.env)
         y puertos propios (backend 18080, frontend 15173).

    No administra el servicio mysqld de XAMPP (solo lo consume).

.PARAMETER SkipFrontend
    Levanta solo el backend y la base de datos.

.PARAMETER NoStart
    Prepara base + entorno + migraciones y termina sin levantar servidores.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\lab_local_up.ps1
#>
param(
    [string] $ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string] $DatabaseName = 'sh_ai_lab_local',
    [string] $DatabaseUser = '',
    [int] $BackendPort = 18080,
    [int] $FrontendPort = 15173,
    [string] $MySqlExe = 'C:\xampp\mysql\bin\mysql.exe',
    [int] $StartupTimeoutSeconds = 180,
    [switch] $SkipFrontend,
    [switch] $NoStart
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'lib\lab_local.ps1')

$projectRoot = Assert-LabLocalRoot -ProjectRoot $ProjectRoot
$paths = Get-LabLocalPaths -ProjectRoot $projectRoot

Assert-LabLocalDatabaseName -DatabaseName $DatabaseName
Assert-LabLocalPort -Port $BackendPort -Label 'BackendPort'
Assert-LabLocalPort -Port $FrontendPort -Label 'FrontendPort'
if ($BackendPort -eq $FrontendPort) {
    throw 'BackendPort and FrontendPort must differ.'
}

if ([string]::IsNullOrWhiteSpace($DatabaseUser)) {
    # Determinista a proposito: 'down' debe poder limpiar el usuario aunque el
    # archivo de estado se haya perdido.
    $DatabaseUser = $DatabaseName
}

$mySqlExe = Assert-LabLocalMySqlClient -MySqlExe $MySqlExe

foreach ($directory in @($paths.LogRoot, $paths.EvidenceRoot)) {
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
}

$runLog = Join-Path $paths.LogRoot 'lab_local_up.log'
$transcriptStarted = $false
try {
    Start-Transcript -LiteralPath $runLog -Force | Out-Null
    $transcriptStarted = $true
} catch {
    Write-Warning "Could not start transcript: $($_.Exception.Message)"
}

# Variables de entorno que este script establece y debe restaurar al salir.
# Se usan como red de seguridad: si el archivo .env.local no llegara a cargarse,
# la conexion seguiria apuntando a la base desechable y nunca a una base ajena.
$envNames = @(
    'APP_ENV', 'APP_VERSION', 'DB_CONNECTION', 'DB_HOST', 'DB_PORT',
    'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_TIMEZONE',
    'VITE_DEV_API_PROXY_TARGET'
)
$previousEnv = @{}
foreach ($name in $envNames) {
    $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$php = 'php'
$state = $null

try {
    Write-Host ''
    Write-Host '=== S_Hospital - LAB LOCAL NO-DOCKER ===' -ForegroundColor Cyan
    Write-Host "Raiz        : $projectRoot"
    Write-Host "Base        : $DatabaseName (DESECHABLE)"
    Write-Host "Usuario BD  : $DatabaseUser (solo $DatabaseName)"
    Write-Host "Entorno     : $($paths.EnvFile)"
    Write-Host "Backend     : http://127.0.0.1:$BackendPort"
    Write-Host "Frontend    : http://127.0.0.1:$FrontendPort"
    Write-Host ''

    # ------------------------------------------------------------------
    # 1. Base de datos desechable + usuario acotado
    # ------------------------------------------------------------------
    $serverVersion = Test-LabLocalMySqlServer -MySqlExe $mySqlExe
    Write-Host "[1/7] MariaDB local OK: $serverVersion" -ForegroundColor Green

    $foreignBefore = Get-LabLocalForeignDatabaseFingerprint -MySqlExe $mySqlExe -DatabaseName $DatabaseName
    Write-Host "      Bases ajenas preexistentes (solo lectura): $($foreignBefore.Count)"

    New-LabLocalDatabase -MySqlExe $mySqlExe -DatabaseName $DatabaseName | Out-Null
    Write-Host "      Base '$DatabaseName' dropeada y recreada." -ForegroundColor Green

    $dbPassword = New-LabLocalHexToken -ByteCount 24
    New-LabLocalDatabaseUser `
        -MySqlExe $mySqlExe `
        -DatabaseName $DatabaseName `
        -Username $DatabaseUser `
        -Password $dbPassword | Out-Null
    Write-Host "      Usuario '$DatabaseUser' creado con GRANT solo sobre '$DatabaseName'." -ForegroundColor Green

    # ------------------------------------------------------------------
    # 2. Entorno de laboratorio (ignorado por git; nunca backend/.env)
    # ------------------------------------------------------------------
    Write-LabLocalEnvFile `
        -EnvFile $paths.EnvFile `
        -DatabaseName $DatabaseName `
        -BackendPort $BackendPort `
        -FrontendPort $FrontendPort `
        -DbUsername $DatabaseUser `
        -DbPassword $dbPassword | Out-Null
    Write-Host "[2/7] Entorno de laboratorio escrito: $($paths.EnvFile)" -ForegroundColor Green

    $env:APP_ENV = 'local'
    $env:DB_CONNECTION = 'mysql'
    $env:DB_HOST = '127.0.0.1'
    $env:DB_PORT = '3306'
    $env:DB_DATABASE = $DatabaseName
    $env:DB_USERNAME = $DatabaseUser
    $env:DB_PASSWORD = $dbPassword
    $env:DB_TIMEZONE = '-06:00'

    # ------------------------------------------------------------------
    # 3. Aserciones previas a migrar (nunca migrar una base ajena)
    # ------------------------------------------------------------------
    Push-Location $paths.BackendRoot
    try {
        $envProbe = (& $php artisan env --env=local --no-interaction 2>&1 | Out-String)
        if ($envProbe -notmatch 'local') {
            throw "Could not confirm the local environment. artisan env said: $envProbe"
        }

        $versionProbe = (& $php artisan config:show app.version --env=local --no-interaction 2>&1 | Out-String)
        if ($versionProbe -notmatch 'lab-local') {
            throw "backend/.env.local was not loaded by artisan (APP_VERSION=lab-local missing). Refusing to migrate. Output: $versionProbe"
        }

        $dbProbe = (& $php artisan config:show database.connections.mysql.database --env=local --no-interaction 2>&1 | Out-String)
        if ($dbProbe -notmatch [regex]::Escape($DatabaseName)) {
            throw "Resolved database is not the disposable lab database. Refusing to migrate. Output: $dbProbe"
        }

        $userProbe = (& $php artisan config:show database.connections.mysql.username --env=local --no-interaction 2>&1 | Out-String)
        if ($userProbe -notmatch [regex]::Escape($DatabaseUser)) {
            throw "Resolved database user is not the scoped lab user ($DatabaseUser). Refusing to migrate. Output: $userProbe"
        }
    } finally {
        Pop-Location
    }
    Write-Host "[3/7] Asercion de entorno OK (APP_VERSION=lab-local, DB=$DatabaseName, USER=$DatabaseUser)." -ForegroundColor Green

    # ------------------------------------------------------------------
    # 4. Migraciones + seed sobre la base desechable
    # ------------------------------------------------------------------
    Push-Location $paths.BackendRoot
    try {
        $migrationOutput = (& $php artisan migrate --seed --force --no-interaction --env=local 2>&1 | Out-String)
        if ($LASTEXITCODE -ne 0) {
            throw "migrate --seed failed (exit $LASTEXITCODE):`n$migrationOutput"
        }
    } finally {
        Pop-Location
    }
    Write-Host '[4/7] Migraciones y seed aplicados.' -ForegroundColor Green

    # ------------------------------------------------------------------
    # 5. Verificacion de la base sembrada
    # ------------------------------------------------------------------
    $tableCount = (Invoke-LabLocalMySqlQuery -MySqlExe $mySqlExe `
        -Sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$DatabaseName';" |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Last 1).Trim()
    if ([int] $tableCount -lt 30) {
        throw "Only $tableCount tables were created in '$DatabaseName'; migrations did not land as expected."
    }

    # Asercion por tablas criticas: mas significativa que un umbral arbitrario
    # (varias de las 100 migraciones son ALTER, no CREATE).
    $requiredTables = @(
        'users', 'roles', 'permissions', 'categories', 'services', 'invoices',
        'invoice_items', 'payments', 'cash_register_sessions', 'cash_movements',
        'audit_logs', 'sessions', 'jobs', 'cache', 'migrations'
    )
    $foundTables = @(Invoke-LabLocalMySqlQuery -MySqlExe $mySqlExe `
        -Sql "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$DatabaseName';" |
        ForEach-Object { ([string] $_).Trim() })
    $missingTables = @($requiredTables | Where-Object { $foundTables -notcontains $_ })
    if ($missingTables.Count -gt 0) {
        throw "Missing critical tables in '$DatabaseName': $($missingTables -join ', ')"
    }

    # Semilla sintetica: los usuarios del seeder deben existir.
    $seededUsers = @(Invoke-LabLocalMySqlQuery -MySqlExe $mySqlExe -Database $DatabaseName `
        -Sql "SELECT username FROM users WHERE username IN ('admin.validacion','supervisor.validacion','cajero.validacion') ORDER BY username;" |
        ForEach-Object { ([string] $_).Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($seededUsers.Count -lt 3) {
        throw "Synthetic seeder users are missing in '$DatabaseName' (found: $($seededUsers -join ', ')); the smoke test needs them."
    }

    $serviceCount = (Invoke-LabLocalMySqlQuery -MySqlExe $mySqlExe -Database $DatabaseName `
        -Sql 'SELECT COUNT(*) FROM services;' |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Last 1).Trim()

    Write-Host "      Tablas: $tableCount | servicios sembrados: $serviceCount | usuarios sinteticos: $($seededUsers -join ', ')" -ForegroundColor Green

    # ------------------------------------------------------------------
    # 6. Prueba real de aislamiento por privilegios
    # ------------------------------------------------------------------
    $isolation = Test-LabLocalUserIsolation `
        -MySqlExe $mySqlExe `
        -DatabaseName $DatabaseName `
        -Username $DatabaseUser `
        -Password $dbPassword
    if (-not $isolation.Passed) {
        throw "Privilege isolation check failed: $($isolation.Detail)"
    }
    Write-Host "[5/7] Aislamiento por privilegios OK: $($isolation.Detail)" -ForegroundColor Green

    $foreignAfter = Get-LabLocalForeignDatabaseFingerprint -MySqlExe $mySqlExe -DatabaseName $DatabaseName
    $drift = Compare-LabLocalForeignDatabases -Before $foreignBefore -After $foreignAfter
    if (-not $drift.Unchanged) {
        Write-Warning "Otra actividad modifico bases ajenas durante la ventana (esperado: la MariaDB de XAMPP es compartida). El proceso del laboratorio no puede ser el autor: su usuario solo tiene GRANT sobre '$DatabaseName'. Cambios: $($drift.Changed -join ' | ')"
    }
    if (@($drift.Added + $drift.Removed).Count -gt 0) {
        Write-Warning "Bases ajenas creadas/eliminadas por terceros durante la corrida: $((@($drift.Added + $drift.Removed)) -join ' | ')"
    }
    Write-Host "      $($drift.ComparedSchemas) bases ajenas preexistentes cotejadas." -ForegroundColor DarkGray

    # ------------------------------------------------------------------
    # 7. Servidores
    # ------------------------------------------------------------------
    $backendLog = Join-Path $paths.LogRoot 'backend.out.log'
    $backendErrLog = Join-Path $paths.LogRoot 'backend.err.log'
    $frontendLog = Join-Path $paths.LogRoot 'frontend.out.log'
    $frontendErrLog = Join-Path $paths.LogRoot 'frontend.err.log'

    $state = [ordered]@{
        created_at_utc  = (Get-Date).ToUniversalTime().ToString('o')
        task_id         = 'C1-INST-02'
        project_root    = $projectRoot
        database        = $DatabaseName
        database_user   = $DatabaseUser
        env_file        = $paths.EnvFile
        backend_port    = $BackendPort
        frontend_port   = $FrontendPort
        backend_url     = "http://127.0.0.1:$BackendPort"
        frontend_url    = "http://127.0.0.1:$FrontendPort"
        mysql_exe       = $mySqlExe
        mariadb_version = $serverVersion
        table_count     = [int] $tableCount
        service_count   = [int] $serviceCount
        seed_users      = $seededUsers
        isolation_probe = $isolation.Detail
        backend_pid     = 0
        frontend_pid    = 0
        backend_log     = $backendLog
        frontend_log    = $frontendLog
        docker_parity   = $false
    }

    if ($NoStart) {
        Write-Host '[6/7] -NoStart: base y entorno listos; no se levantan servidores.' -ForegroundColor Yellow
        Write-LabLocalState -StateFile $paths.StateFile -State $state
        Write-Host "[7/7] Estado escrito en $($paths.StateFile)"
        Write-Host ''
        Write-Host 'LAB LOCAL PREPARADO (sin servidores).' -ForegroundColor Green
        return
    }

    # Pre-flight: liberar los puertos del laboratorio de huerfanos de corridas
    # anteriores. Si el llamador murio por timeout, el lanzador pudo morir y
    # dejar vivo el servidor, impidiendo que este `up` bindee el puerto.
    # El matcher exige puerto + rol, para no tocar procesos ajenos.
    $orphans = Stop-LabLocalOrphanProcesses -BackendPort $BackendPort -FrontendPort $FrontendPort
    foreach ($orphan in $orphans) {
        Write-Host "      Huerfano $($orphan.Role) PID $($orphan.ProcessId) detenido." -ForegroundColor Yellow
    }

    foreach ($port in @($BackendPort, $FrontendPort)) {
        if (Test-LabLocalPortInUse -Port $port) {
            throw "Port $port is still in use after the orphan sweep. Free it manually; refusing to start the lab on an occupied port."
        }
    }

    # El backend arranca mediante un lanzador .cmd creado por WMI: el hijo NO
    # hereda los handles de salida del llamador, asi que `up` retorna de
    # inmediato incluso con la salida redirigida (CI / pipe).
    # APP_ENV=local es lo unico imprescindible en el entorno del proceso: hace
    # que Laravel cargue backend/.env.local (que aporta credenciales y el resto).
    $phpExe = (Get-Command $php -ErrorAction Stop).Source
    Write-LabLocalLauncher -Path $paths.BackendLauncher -Lines @(
        '@echo off',
        'set "APP_ENV=local"',
        ('cd /d "' + $paths.BackendRoot + '"'),
        ('1>"' + $backendLog + '" 2>"' + $backendErrLog + '" "' + $phpExe + '" artisan serve --env=local --host=127.0.0.1 --port ' + $BackendPort)
    ) | Out-Null

    $state.backend_pid = Start-LabLocalDetachedCommand -LauncherPath $paths.BackendLauncher -WorkingDirectory $paths.BackendRoot
    Write-LabLocalState -StateFile $paths.StateFile -State $state
    Write-Host "[6/7] Backend PID $($state.backend_pid) (desacoplado) -> $($state.backend_url)"

    $healthStatus = Wait-LabLocalUrl -Url "$($state.backend_url)/api/health" -TimeoutSeconds $StartupTimeoutSeconds
    if ($null -eq $healthStatus) {
        $tail = Get-Content -LiteralPath $backendErrLog -Tail 40 -ErrorAction SilentlyContinue
        throw "Backend did not answer /api/health within $StartupTimeoutSeconds s.${([Environment]::NewLine)}$($tail -join [Environment]::NewLine)"
    }
    Write-Host "      GET /api/health -> $healthStatus" -ForegroundColor Green

    if (-not $SkipFrontend) {
        if (-not (Test-Path -LiteralPath (Join-Path $paths.FrontendRoot 'node_modules'))) {
            throw "frontend\node_modules is missing. Run 'corepack pnpm install' in frontend\ first."
        }

        Write-LabLocalLauncher -Path $paths.FrontendLauncher -Lines @(
            '@echo off',
            ('set "VITE_DEV_API_PROXY_TARGET=' + $state.backend_url + '"'),
            ('cd /d "' + $paths.FrontendRoot + '"'),
            ('1>"' + $frontendLog + '" 2>"' + $frontendErrLog + '" call corepack pnpm exec vite --host 127.0.0.1 --port ' + $FrontendPort + ' --strictPort')
        ) | Out-Null

        $state.frontend_pid = Start-LabLocalDetachedCommand -LauncherPath $paths.FrontendLauncher -WorkingDirectory $paths.FrontendRoot
        Write-LabLocalState -StateFile $paths.StateFile -State $state
        Write-Host "      Frontend PID $($state.frontend_pid) (desacoplado) -> $($state.frontend_url)"

        $frontendStatus = Wait-LabLocalUrl -Url "$($state.frontend_url)/" -TimeoutSeconds $StartupTimeoutSeconds
        if ($null -eq $frontendStatus) {
            $tail = Get-Content -LiteralPath $frontendErrLog -Tail 40 -ErrorAction SilentlyContinue
            Write-Warning "Frontend did not answer within $StartupTimeoutSeconds s. El backend sigue arriba.${([Environment]::NewLine)}$($tail -join [Environment]::NewLine)"
        } else {
            Write-Host "      GET / -> $frontendStatus" -ForegroundColor Green
        }
    }

    Write-LabLocalState -StateFile $paths.StateFile -State $state

    Write-Host "[7/7] Estado escrito en $($paths.StateFile)"
    Write-Host ''
    Write-Host 'LAB LOCAL NO-DOCKER ARRIBA' -ForegroundColor Green
    Write-Host "  Backend  : $($state.backend_url)  (PID $($state.backend_pid))"
    if ($state.frontend_pid -gt 0) {
        Write-Host "  Frontend : $($state.frontend_url)  (PID $($state.frontend_pid))"
    }
    Write-Host "  Base     : $DatabaseName (DESECHABLE, usuario $DatabaseUser)"
    Write-Host ''
    Write-Host '  Verificacion end-to-end:' -ForegroundColor Cyan
    Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\lab_local_smoke.ps1"
    Write-Host '  Apagado:' -ForegroundColor Cyan
    Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\lab_local_down.ps1"
    Write-Host ''
    Write-Host 'NOTA: no es paridad del despliegue Docker (ver C1-INST-01).' -ForegroundColor DarkGray
} finally {
    foreach ($name in $envNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], 'Process')
    }

    if ($transcriptStarted) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}
