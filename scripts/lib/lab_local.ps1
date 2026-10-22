#Requires -Version 5.1
# =============================================================================
# Laboratorio local NO-Docker (hs-install / C1-INST-02).
#
# Utilidades compartidas por:
#   scripts/lab_local_up.ps1
#   scripts/lab_local_down.ps1
#   scripts/lab_local_smoke.ps1
#   scripts/lab_local.test.ps1
#
# Este modulo NO arranca ni detiene servicios por si mismo: solo valida,
# escribe el entorno de laboratorio y administra la base DESECHABLE.
#
# Aislamiento (reglas duras):
#   - La base de datos solo puede llamarse sh_ai_lab_local[_sufijo].
#   - Nunca se usa migrate:fresh / db:wipe fuera de esa base.
#   - Nunca se escribe backend/.env (se usa backend/.env.local, ignorado por git).
#   - Nunca se detiene el mysqld de XAMPP ni se tocan bases ajenas.
# =============================================================================

$script:LabLocalEnvMarker = '# SH-AI LAB LOCAL'
$script:LabLocalDefaultDbName = 'sh_ai_lab_local'
$script:LabLocalDefaultBackendPort = 18080
$script:LabLocalDefaultFrontendPort = 15173
$script:LabLocalDefaultMySqlExe = 'C:\xampp\mysql\bin\mysql.exe'
$script:LabLocalProtectedRoot = 'C:\Projects\S_Hospital'

function Get-LabLocalDbNamePattern {
    # Allowlist estricta: prefijo inequivoco + sufijo opcional alfanumerico.
    return '^sh_ai_lab_local(?:_[A-Za-z0-9]{1,32})?$'
}

function Assert-LabLocalDatabaseName {
    # [AllowEmptyString] para que la guarda propia (mensaje claro) sea la que
    # rechaza, en vez del error de binding de PowerShell.
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string] $DatabaseName)

    if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
        throw 'Lab database name must not be empty.'
    }
    if ($DatabaseName -cnotmatch (Get-LabLocalDbNamePattern)) {
        throw "Refusing to operate on database '$DatabaseName'. Only names matching $((Get-LabLocalDbNamePattern)) are allowed (disposable lab database)."
    }
}

function Assert-LabLocalPort {
    param(
        [Parameter(Mandatory = $true)][int] $Port,
        [Parameter(Mandatory = $true)][string] $Label
    )

    if ($Port -lt 1024 -or $Port -gt 65535) {
        throw "$Label must be an unprivileged port between 1024 and 65535 (got $Port)."
    }
}

function Assert-LabLocalRoot {
    <#
        Verifica que la raiz de trabajo es el worktree aislado y NUNCA el arbol
        original. Tambien exige la forma minima de un checkout Laravel+frontend.
    #>
    param([Parameter(Mandatory = $true)][string] $ProjectRoot)

    if (-not (Test-Path -LiteralPath $ProjectRoot)) {
        throw "Project root does not exist: $ProjectRoot"
    }

    $resolved = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd('\')

    if ($resolved -ieq $script:LabLocalProtectedRoot.TrimEnd('\')) {
        throw "Refusing to run the lab inside the protected original tree: $resolved"
    }

    $workspaceFile = Join-Path $resolved 'hospital-ai\WORKSPACE.json'
    if (Test-Path -LiteralPath $workspaceFile) {
        $workspace = Get-Content -LiteralPath $workspaceFile -Raw | ConvertFrom-Json
        $writableRoot = ([string] $workspace.writable_root).TrimEnd('\')
        if ($writableRoot -and ($writableRoot -ine $resolved)) {
            throw "Project root '$resolved' does not match WORKSPACE.json writable_root '$writableRoot'."
        }
        $sourceRepo = ([string] $workspace.source_repo).TrimEnd('\')
        if ($sourceRepo -and ($sourceRepo -ieq $resolved)) {
            throw "Refusing to run the lab inside the source repository declared in WORKSPACE.json: $resolved"
        }
    }

    foreach ($required in @('backend\artisan', 'frontend\package.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $resolved $required))) {
            throw "Project root '$resolved' is missing $required."
        }
    }

    return $resolved
}

function Get-LabLocalPaths {
    param([Parameter(Mandatory = $true)][string] $ProjectRoot)

    $root = $ProjectRoot.TrimEnd('\')
    return @{
        ProjectRoot   = $root
        BackendRoot   = Join-Path $root 'backend'
        FrontendRoot  = Join-Path $root 'frontend'
        EnvFile       = Join-Path $root 'backend\.env.local'
        LogRoot       = Join-Path $root 'hospital-ai\evidencia\C1-INST-02\logs'
        EvidenceRoot  = Join-Path $root 'hospital-ai\evidencia\C1-INST-02'
        StateFile     = Join-Path $root 'hospital-ai\evidencia\C1-INST-02\lab_local_state.json'
        BackendLauncher  = Join-Path $root 'hospital-ai\evidencia\C1-INST-02\logs\run_backend.cmd'
        FrontendLauncher = Join-Path $root 'hospital-ai\evidencia\C1-INST-02\logs\run_frontend.cmd'
    }
}

function New-LabLocalRandomSecret {
    param([int] $ByteCount = 32)

    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }

    return [Convert]::ToBase64String($bytes)
}

function Set-LabLocalFileText {
    <#
        Escribe texto SIN BOM.

        Importante: `Set-Content -Encoding UTF8` en PowerShell 5.1 agrega un BOM
        (EF BB BF). Un BOM rompe el cuerpo JSON (Laravel responde 422
        validation.required) y ensucia la primera linea de .env.local.

        Nota: usa `Set-Location`-seguro: no depende del directorio actual.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][allowEmptyString()][string] $Content
    )

    $directory = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function New-LabLocalAppKey {
    # Formato esperado por Laravel: 'base64:' + 32 bytes en base64.
    return 'base64:' + (New-LabLocalRandomSecret -ByteCount 32)
}

function Assert-LabLocalEnvFileIsOurs {
    <#
        Idempotencia segura: el laboratorio reescribe su propio archivo, pero
        nunca pisa un .env.local escrito a mano por una persona.
    #>
    param([Parameter(Mandatory = $true)][string] $EnvFile)

    if (-not (Test-Path -LiteralPath $EnvFile)) {
        return
    }

    $head = Get-Content -LiteralPath $EnvFile -TotalCount 5 -ErrorAction SilentlyContinue
    $joined = ($head -join "`n")
    if ($joined -notmatch [regex]::Escape($script:LabLocalEnvMarker)) {
        throw "Refusing to overwrite '$EnvFile': it exists but was not generated by the lab (missing marker '$($script:LabLocalEnvMarker)'). Move it away manually."
    }
}

function Write-LabLocalEnvFile {
    <#
        Escribe backend/.env.local (ignorado por .gitignore, APP_ENV=local).
        NO toca backend/.env. No contiene credenciales reales: la base es
        desechable, el usuario MySQL es root local sin contrasena y APP_KEY /
        HOSPITAL_BACKUP_ENCRYPTION_KEY se generan aleatoriamente por corrida.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $EnvFile,
        [Parameter(Mandatory = $true)][string] $DatabaseName,
        [Parameter(Mandatory = $true)][int] $BackendPort,
        [Parameter(Mandatory = $true)][int] $FrontendPort,
        [string] $DbHost = '127.0.0.1',
        [int] $DbPort = 3306,
        [string] $DbUsername = 'root',
        [string] $DbPassword = ''
    )

    Assert-LabLocalEnvFileIsOurs -EnvFile $EnvFile
    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName

    $statefulDomains = @(
        'localhost',
        "localhost:$FrontendPort",
        '127.0.0.1',
        "127.0.0.1:$FrontendPort",
        "127.0.0.1:$BackendPort",
        '::1'
    ) -join ','

    $corsOrigins = @(
        "http://localhost:$FrontendPort",
        "http://127.0.0.1:$FrontendPort"
    ) -join ','

    $appKey = New-LabLocalAppKey
    $backupKey = New-LabLocalRandomSecret -ByteCount 32

    $lines = @(
        "$($script:LabLocalEnvMarker) - DESECHABLE, generado por scripts/lab_local_up.ps1",
        '# No reutilizar para produccion. No contiene datos ni credenciales del hospital.',
        '# Base de datos desechable: ' + $DatabaseName,
        '',
        'APP_NAME="Sistema de Caja Hospitalaria (LAB LOCAL)"',
        'APP_ENV=local',
        "APP_KEY=$appKey",
        'APP_DEBUG=false',
        "APP_URL=http://127.0.0.1:$BackendPort",
        'APP_VERSION=lab-local',
        '',
        'APP_LOCALE=es',
        'APP_FALLBACK_LOCALE=es',
        'APP_FAKER_LOCALE=es_HN',
        'APP_TIMEZONE=America/Tegucigalpa',
        '',
        'APP_MAINTENANCE_DRIVER=file',
        'BCRYPT_ROUNDS=12',
        '',
        'LOG_CHANNEL=stack',
        'LOG_STACK=single',
        'LOG_DEPRECATIONS_CHANNEL=null',
        'LOG_LEVEL=debug',
        'LOG_DAILY_DAYS=90',
        '',
        'DB_CONNECTION=mysql',
        "DB_HOST=$DbHost",
        "DB_PORT=$DbPort",
        "DB_DATABASE=$DatabaseName",
        "DB_USERNAME=$DbUsername",
        "DB_PASSWORD=$DbPassword",
        'DB_TIMEZONE=-06:00',
        '',
        'SESSION_DRIVER=database',
        'SESSION_LIFETIME=120',
        'SESSION_ENCRYPT=false',
        'SESSION_PATH=/',
        'SESSION_DOMAIN=null',
        '',
        "SANCTUM_STATEFUL_DOMAINS=$statefulDomains",
        'SANCTUM_AUTHENTICATE_SESSION=false',
        '',
        "CORS_ALLOWED_ORIGINS=$corsOrigins",
        'CORS_ALLOWED_ORIGIN_PATTERNS=',
        '',
        'BROADCAST_CONNECTION=log',
        'FILESYSTEM_DISK=local',
        'QUEUE_CONNECTION=database',
        'CACHE_STORE=database',
        '',
        'MAIL_MAILER=log',
        'MAIL_FROM_ADDRESS="no-reply@hospital-billing.local"',
        '',
        'HOSPITAL_LICENSE_SALT=',
        'HOSPITAL_DUMP_BINARY=',
        'HOSPITAL_DAILY_BACKUP_TIME=02:00',
        'HOSPITAL_OPERATION_START=06:00',
        'HOSPITAL_OPERATION_END=18:00',
        'HOSPITAL_AUDIT_RETENTION_DAYS=365',
        'HOSPITAL_FAILED_JOBS_RETENTION_DAYS=30',
        'HOSPITAL_IDEMPOTENCY_RETENTION_DAYS=30',
        'HOSPITAL_SCHEDULER_TICK_RETENTION_DAYS=7',
        'HOSPITAL_LOGIN_ATTEMPT_RETENTION_DAYS=30',
        'HOSPITAL_CLIENT_ERROR_RETENTION_DAYS=90',
        "HOSPITAL_BACKUP_ENCRYPTION_KEY=$backupKey",
        'HOSPITAL_BACKUP_EXTERNAL_ENABLED=false',
        'HOSPITAL_BACKUP_EXTERNAL_DISK=backup_external',
        'HOSPITAL_BACKUP_EXTERNAL_DRIVER=local',
        'HOSPITAL_BACKUP_EXTERNAL_ROOT=',
        'HOSPITAL_BACKUP_EXTERNAL_PATH=hospital-backups',
        'HOSPITAL_BACKUP_EXTERNAL_LABEL=externo',
        'HOSPITAL_BACKUP_EXTERNAL_VERIFY=true',
        'HOSPITAL_BACKUP_ALERT_STALE_HOURS=12',
        'HOSPITAL_BACKUP_ALERT_CONSECUTIVE_FAILURES=3',
        'HOSPITAL_BACKUP_ALERT_EXTERNAL_STALE_HOURS=26',
        'HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS=72',
        ''
    )

    $directory = Split-Path -Parent $EnvFile
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    Set-LabLocalFileText -Path $EnvFile -Content (($lines -join "`r`n") + "`r`n")
    return $EnvFile
}

function Assert-LabLocalMySqlClient {
    param([string] $MySqlExe = $script:LabLocalDefaultMySqlExe)

    if ([string]::IsNullOrWhiteSpace($MySqlExe)) {
        $MySqlExe = $script:LabLocalDefaultMySqlExe
    }
    if (-not (Test-Path -LiteralPath $MySqlExe)) {
        throw "MySQL client not found at '$MySqlExe'. Pass -MySqlExe with the XAMPP mysql.exe path."
    }

    return $MySqlExe
}

function Invoke-LabLocalMySqlQuery {
    <#
        Ejecuta SQL con el cliente de XAMPP. Por defecto apunta al servidor local
        como root sin contrasena (solo para administrar la base desechable y
        leer el fingerprint de bases ajenas). NO detiene ni modifica el servicio
        mysqld.

        La contrasena (cuando se usa el usuario acotado del laboratorio) se pasa
        por MYSQL_PWD y nunca como argumento, para no exponerla en la lista de
        procesos.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $Sql,
        [string] $Database = '',
        [string[]] $ExtraArguments = @(),
        [string] $Username = '',
        [string] $Password = ''
    )

    $arguments = @()
    if ([string]::IsNullOrWhiteSpace($Username)) {
        $arguments += @('-u', 'root')
    } else {
        $arguments += @('-u', $Username)
    }

    $arguments += @('--batch', '--skip-column-names')
    if (-not [string]::IsNullOrWhiteSpace($Database)) {
        $arguments += @('--database=' + $Database)
    }
    $arguments += $ExtraArguments
    $arguments += @('-e', $Sql)

    $previousPassword = [Environment]::GetEnvironmentVariable('MYSQL_PWD', 'Process')
    if (-not [string]::IsNullOrWhiteSpace($Password)) {
        [Environment]::SetEnvironmentVariable('MYSQL_PWD', $Password, 'Process')
    }

    try {
        $output = & $MySqlExe @arguments 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "MySQL command failed (exit $LASTEXITCODE): $($output -join ' ')"
        }
    } finally {
        [Environment]::SetEnvironmentVariable('MYSQL_PWD', $previousPassword, 'Process')
    }

    return $output
}

function Test-LabLocalMySqlServer {
    <#
        Comprueba que el servidor MariaDB local responde. Falla con un mensaje
        claro en lugar de intentar arrancar/detener el servicio de XAMPP.
    #>
    param([Parameter(Mandatory = $true)][string] $MySqlExe)

    try {
        $version = Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql 'SELECT VERSION();'
    } catch {
        throw "Local MariaDB (XAMPP) is not reachable: $($_.Exception.Message). Start XAMPP MySQL manually; this lab never controls the mysqld service."
    }

    $versionText = ($version | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($versionText)) {
        throw 'Local MariaDB did not report a version.'
    }

    return $versionText.Trim()
}

function New-LabLocalDatabase {
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $DatabaseName
    )

    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName

    $sql = 'DROP DATABASE IF EXISTS `' + $DatabaseName + '`; ' +
           'CREATE DATABASE `' + $DatabaseName + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'

    Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql $sql | Out-Null
    return $DatabaseName
}

function Remove-LabLocalDatabase {
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $DatabaseName
    )

    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName
    Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql ('DROP DATABASE IF EXISTS `' + $DatabaseName + '`;') | Out-Null
}

function Test-LabLocalDatabaseExists {
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $DatabaseName
    )

    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName
    $sql = "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '$DatabaseName';"
    $result = Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql $sql
    $value = ($result | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1)
    return ([string] $value).Trim() -eq '1'
}

function Read-LabLocalState {
    param([Parameter(Mandatory = $true)][string] $StateFile)

    if (-not (Test-Path -LiteralPath $StateFile)) {
        return $null
    }

    return (Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json)
}

function Write-LabLocalState {
    param(
        [Parameter(Mandatory = $true)][string] $StateFile,
        [Parameter(Mandatory = $true)] $State
    )

    $directory = Split-Path -Parent $StateFile
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    Set-LabLocalFileText -Path $StateFile -Content ($State | ConvertTo-Json -Depth 6)
}

function Start-LabLocalDetachedCommand {
    <#
        Arranca un proceso REALMENTE desacoplado del llamador.

        Motivo: en Windows, un proceso hijo hereda los handles de stdout/stderr
        del padre. Si el llamador tiene la salida redirigida (CI, pipe, tarea
        programada), espera hasta que el hijo termine -- y un servidor de
        desarrollo nunca termina. Medido: `Start-Process -NoNewWindow` y
        `-WindowStyle Hidden` bloquean al llamador exactamente lo que dure el
        servidor (45 s con un hijo de prueba de 45 s).

        `Win32_Process.Create` via WMI crea el proceso fuera del arbol del
        llamador, por lo que este retorna de inmediato (~650 ms medidos). El
        precio es que el hijo NO hereda las variables de entorno del llamador:
        por eso se arranca un lanzador .cmd que fija su propio entorno.

        Devuelve el PID del lanzador (la raiz del arbol a matar en `down`).
    #>
    param(
        [Parameter(Mandatory = $true)][string] $LauncherPath,
        [string] $WorkingDirectory = ''
    )

    if (-not (Test-Path -LiteralPath $LauncherPath)) {
        throw "Launcher not found: $LauncherPath"
    }

    # cmd necesita comillas dobles anidadas para rutas con espacios.
    $commandLine = 'cmd.exe /c ""' + $LauncherPath + '""'

    $arguments = @{ CommandLine = $commandLine }
    if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        $arguments['CurrentDirectory'] = $WorkingDirectory
    }

    $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments $arguments
    if ($null -eq $result -or $result.ReturnValue -ne 0) {
        $code = 'unknown'
        if ($null -ne $result) { $code = $result.ReturnValue }
        throw "Win32_Process.Create failed for '$LauncherPath' (ReturnValue=$code)."
    }

    return [int] $result.ProcessId
}

function Write-LabLocalLauncher {
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [Parameter(Mandatory = $true)][string[]] $Lines
    )

    # ASCII sin BOM y con CRLF: cmd.exe es sensible al BOM.
    Set-LabLocalFileText -Path $Path -Content (($Lines -join "`r`n") + "`r`n")
    return $Path
}

function Get-LabLocalOrphanProcesses {
    <#
        Busca procesos del laboratorio por PUERTO + ROL, no por PID.

        Motivo (fallo real observado): si el llamador muere por timeout, el
        proceso `cmd.exe` lanzador puede morir y dejar huerfanos vivos al
        `php -S`/`vite` que sostenian los puertos 18080/15173. Un `down` basado
        solo en PIDs registrados no los ve y el siguiente `up` no puede bindear.

        El matcher exige SIEMPRE el puerto concreto del laboratorio Y una palabra
        clave del rol, para no matar procesos ajenos.
    #>
    param(
        [Parameter(Mandatory = $true)][int] $BackendPort,
        [Parameter(Mandatory = $true)][int] $FrontendPort
    )

    $backendPort = [string] $BackendPort
    $frontendPort = [string] $FrontendPort

    $found = @()
    foreach ($process in (Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) {
        $commandLine = [string] $process.CommandLine
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            continue
        }

        $role = ''
        if (($commandLine -match 'artisan\s+serve' -and $commandLine -match $backendPort) -or
            ($commandLine -match ('-S\s+127\.0\.0\.1:' + $backendPort))) {
            $role = 'backend'
        } elseif ($commandLine -match 'vite' -and $commandLine -match $frontendPort) {
            $role = 'frontend'
        }

        if ($role -ne '') {
            $found += [pscustomobject]@{
                ProcessId   = [int] $process.ProcessId
                Name        = [string] $process.Name
                Role        = $role
                CommandLine = $commandLine
            }
        }
    }

    return @($found)
}

function Stop-LabLocalOrphanProcesses {
    param(
        [Parameter(Mandatory = $true)][int] $BackendPort,
        [Parameter(Mandatory = $true)][int] $FrontendPort
    )

    $orphans = Get-LabLocalOrphanProcesses -BackendPort $BackendPort -FrontendPort $FrontendPort
    $stopped = @()

    foreach ($orphan in $orphans) {
        $result = Stop-LabLocalProcessTree -ProcessId $orphan.ProcessId -ExpectedMarker ''
        if ($result -eq 'stopped') {
            $stopped += [pscustomobject]@{ ProcessId = $orphan.ProcessId; Role = $orphan.Role; Name = $orphan.Name }
        }
    }

    return @($stopped)
}

function Test-LabLocalPortInUse {
    param([Parameter(Mandatory = $true)][int] $Port)

    $pattern = ':' + $Port + '\s+.*LISTENING'
    $lines = & netstat.exe -ano 2>$null | Select-String -Pattern $pattern
    return (@($lines).Count -gt 0)
}

function Get-LabLocalHttpStatus {
    <#
        Codigo HTTP via curl.exe. Devuelve 0 cuando no hay respuesta.
        '-w' evita depender de excepciones de Invoke-WebRequest en PS 5.1.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $Url,
        [int] $TimeoutSeconds = 5,
        [string] $CurlExe = 'curl.exe'
    )

    $output = & $CurlExe -s -o NUL -w '%{http_code}' --noproxy '127.0.0.1,localhost' --max-time $TimeoutSeconds $Url 2>$null
    $text = ([string] ($output -join '')).Trim()
    $code = 0
    if ([int]::TryParse($text, [ref] $code)) {
        return $code
    }

    return 0
}

function Wait-LabLocalUrl {
    param(
        [Parameter(Mandatory = $true)][string] $Url,
        [int] $TimeoutSeconds = 90,
        [int[]] $AcceptStatus = @(200),
        [string] $CurlExe = 'curl.exe'
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastStatus = 0
    while ((Get-Date) -lt $deadline) {
        $lastStatus = Get-LabLocalHttpStatus -Url $Url -CurlExe $CurlExe
        if ($AcceptStatus -contains $lastStatus) {
            return $lastStatus
        }
        Start-Sleep -Milliseconds 750
    }

    return $null
}

function Get-LabLocalProcessInfo {
    param([Parameter(Mandatory = $true)][int] $ProcessId)

    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Stop-LabLocalProcessTree {
    <#
        Detiene solo procesos que este laboratorio registro. Antes de matar
        verifica que la linea de comandos siga conteniendo la marca esperada,
        para no tocar un PID reciclado por un proceso ajeno.
    #>
    param(
        [Parameter(Mandatory = $true)][int] $ProcessId,
        [string] $ExpectedMarker = ''
    )

    if ($ProcessId -le 0) {
        return 'absent'
    }

    $process = Get-LabLocalProcessInfo -ProcessId $ProcessId
    if ($null -eq $process) {
        return 'absent'
    }

    $commandLine = [string] $process.CommandLine
    if (-not [string]::IsNullOrWhiteSpace($ExpectedMarker) -and $commandLine -notlike ('*' + $ExpectedMarker + '*')) {
        return 'skipped-foreign'
    }

    & taskkill.exe /PID $ProcessId /T /F 2>&1 | Out-Null
    Start-Sleep -Milliseconds 800

    if ($null -eq (Get-LabLocalProcessInfo -ProcessId $ProcessId)) {
        return 'stopped'
    }

    return 'failed'
}

function New-LabLocalHexToken {
    param([int] $ByteCount = 24)

    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }

    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

function New-LabLocalDatabaseUser {
    <#
        Crea un usuario MariaDB ACOTADO exclusivamente a la base desechable.

        Motivo: la MariaDB de XAMPP de esta maquina es compartida con otros
        proyectos y agentes (cientos de bases ajenas). Conceder solo
        `sh_ai_lab_local`.* convierte el aislamiento en una garantia de
        privilegios: aunque el .env apuntara mal, el proceso NO PUEDE escribir
        en una base ajena.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $DatabaseName,
        [Parameter(Mandatory = $true)][string] $Username,
        [Parameter(Mandatory = $true)][string] $Password
    )

    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName

    if ($Username -cnotmatch '^sh_ai_lab_[A-Za-z0-9_]{1,24}$') {
        throw "Lab database username '$Username' is not allowed (expected sh_ai_lab_*)."
    }
    if ($Password -cnotmatch '^[0-9a-f]{32,}$') {
        throw 'Lab database password must be a hex token of at least 32 characters.'
    }

    $hosts = @('127.0.0.1', 'localhost', '::1')
    foreach ($hostName in $hosts) {
        Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql (
            "CREATE USER IF NOT EXISTS '$Username'@'$hostName' IDENTIFIED BY '$Password'; " +
            "ALTER USER '$Username'@'$hostName' IDENTIFIED BY '$Password';"
        ) | Out-Null

        # Solo la base del laboratorio. Sin privilegios globales.
        Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql (
            "GRANT ALL PRIVILEGES ON ``$DatabaseName``.* TO '$Username'@'$hostName';"
        ) | Out-Null
    }

    Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql 'FLUSH PRIVILEGES;' | Out-Null

    return $Username
}

function Remove-LabLocalDatabaseUser {
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $Username
    )

    if ($Username -cnotmatch '^sh_ai_lab_[A-Za-z0-9_]{1,24}$') {
        throw "Refusing to drop MariaDB user '$Username' (expected sh_ai_lab_*)."
    }

    foreach ($hostName in @('127.0.0.1', 'localhost', '::1')) {
        Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql "DROP USER IF EXISTS '$Username'@'$hostName';" | Out-Null
    }

    Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql 'FLUSH PRIVILEGES;' | Out-Null
}

function Test-LabLocalUserIsolation {
    <#
        Prueba REAL de aislamiento por privilegios sobre la MariaDB compartida.

        Comprueba:
          1. CONTROL POSITIVO: el usuario del laboratorio SI puede escribir en su
             propia base (si no, los "denegado" no probarian nada);
          2. el usuario solo ve su base (+ information_schema) y, como maximo, la
             base legacy 'test' de MariaDB (artefacto del motor, 0 tablas);
          3. la lectura de una base ajena REAL es denegada por el motor;
          4. CREATE DATABASE es denegado (no puede crear nada nuevo fuera).

        Nota: la base 'test' aparece por un GRANT anonimo historico
        (''@'%' sobre test.*) que ya existia en esta instancia XAMPP compartida.
        No se modifica ese grant ajeno; en su lugar se verifica que 'test' sigue
        vacia antes y despues.

        No lanza: devuelve un objeto con el detalle para poder reportarlo.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $DatabaseName,
        [Parameter(Mandatory = $true)][string] $Username,
        [Parameter(Mandatory = $true)][string] $Password,
        [string[]] $ForeignProbeDatabases = @('hospital_billing', 'conecta_hn', 's_hospital_test_c1qa01_schema'),
        [string] $StockSchema = 'test'
    )

    $result = [ordered]@{
        Passed                = $false
        VisibleSchemas        = @()
        OwnWriteOk            = $false
        ForeignReadDenied     = $false
        ForeignProbeTable     = ''
        CreateDatabaseDenied  = $false
        StockSchema           = $StockSchema
        StockSchemaTables     = -1
        UnexpectedSchemas     = @()
        Detail                = ''
    }

    # -- 1. CONTROL POSITIVO: escritura en la base propia -------------------
    $probeTable = '__sh_ai_lab_probe'
    try {
        Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Database $DatabaseName `
            -Sql "CREATE TABLE ``$probeTable`` (id INT PRIMARY KEY); DROP TABLE ``$probeTable``;" `
            -Username $Username -Password $Password | Out-Null
        $result.OwnWriteOk = $true
    } catch {
        $result.Detail = "El usuario del laboratorio no puede escribir en su propia base: $($_.Exception.Message)"
        return $result
    }

    # -- 2. Esquemas visibles ----------------------------------------------
    try {
        $result.VisibleSchemas = @(Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe `
            -Sql 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME;' `
            -Username $Username -Password $Password |
            ForEach-Object { ([string] $_).Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    } catch {
        $result.Detail = "No se pudo listar esquemas con el usuario del laboratorio: $($_.Exception.Message)"
        return $result
    }

    # -- 3. Lectura de una base ajena real: debe ser denegada ---------------
    foreach ($foreignDb in $ForeignProbeDatabases) {
        $table = (Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe `
            -Sql "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$foreignDb' LIMIT 1;" |
            ForEach-Object { ([string] $_).Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -First 1)

        if ([string]::IsNullOrWhiteSpace($table)) {
            continue
        }

        $result.ForeignProbeTable = "$foreignDb.$table"
        try {
            Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe `
                -Sql ("SELECT COUNT(*) FROM ``$foreignDb``.``$table``;") `
                -Username $Username -Password $Password | Out-Null
            $result.ForeignReadDenied = $false
        } catch {
            $message = [string] $_.Exception.Message
            $result.ForeignReadDenied = ($message -match 'denied' -or $message -match 'command denied')
            if (-not $result.ForeignReadDenied) {
                $result.Detail = "La sonda contra '$foreignDb.$table' fallo por una razon inesperada (no por permisos): $message"
                return $result
            }
        }
        break
    }

    # -- 4. CREATE DATABASE: debe ser denegado ------------------------------
    try {
        Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe `
            -Sql 'CREATE DATABASE __sh_ai_lab_probe_db;' `
            -Username $Username -Password $Password | Out-Null
        $result.CreateDatabaseDenied = $false
    } catch {
        $message = [string] $_.Exception.Message
        $result.CreateDatabaseDenied = ($message -match 'denied')
    }

    # -- 5. La base legacy compartida debe seguir vacia --------------------
    $stockCount = (Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe `
        -Sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$StockSchema';" |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Last 1).Trim()
    if ($stockCount -match '^\d+$') {
        $result.StockSchemaTables = [int] $stockCount
    }

    $allowed = @('information_schema', $DatabaseName, $StockSchema)
    $result.UnexpectedSchemas = @($result.VisibleSchemas | Where-Object { $allowed -notcontains $_ })

    $result.Passed = $result.OwnWriteOk -and
                     $result.ForeignReadDenied -and
                     $result.CreateDatabaseDenied -and
                     ($result.UnexpectedSchemas.Count -eq 0) -and
                     ($result.StockSchemaTables -eq 0)

    $result.Detail = "escritura en base propia: OK; lectura de '$($result.ForeignProbeTable)' denegada: $($result.ForeignReadDenied); CREATE DATABASE denegado: $($result.CreateDatabaseDenied); esquemas visibles: $($result.VisibleSchemas -join ', '); '$StockSchema' con $($result.StockSchemaTables) tablas"

    return $result
}

function Get-LabLocalForeignDatabaseFingerprint {
    <#
        Huella de las bases ajenas (nombre + cantidad de tablas), excluyendo las
        bases internas del motor y la base desechable del laboratorio.

        Se toma antes y despues de migrar/sembrar: si la huella cambia, algo
        toco una base que no era la del laboratorio y la corrida debe fallar.
    #>
    param(
        [Parameter(Mandatory = $true)][string] $MySqlExe,
        [Parameter(Mandatory = $true)][string] $DatabaseName
    )

    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName

    $sql = "SELECT CONCAT(t.TABLE_SCHEMA, ':', COUNT(*)) FROM information_schema.TABLES t " +
           "WHERE t.TABLE_SCHEMA NOT IN ('mysql','information_schema','performance_schema','sys','$DatabaseName') " +
           'GROUP BY t.TABLE_SCHEMA ORDER BY t.TABLE_SCHEMA;'

    $rows = @(Invoke-LabLocalMySqlQuery -MySqlExe $MySqlExe -Sql $sql |
        ForEach-Object { ([string] $_).Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

    return $rows
}

function Compare-LabLocalForeignDatabases {
    <#
        Compara dos huellas de bases ajenas.

        La MariaDB de XAMPP en esta maquina es COMPARTIDA con otros agentes y
        proyectos, que crean/dropean sus propias bases de prueba en paralelo.
        Por eso:
          - Changed = una base ajena preexistente cambio de cantidad de tablas.
            Es la firma real de "las migraciones cayeron en una base ajena" y
            hace fallar la corrida.
          - Removed / Added = bases ajenas que aparecieron o desaparecieron
            durante la ventana. Se reportan como advertencia, no como fallo:
            este laboratorio nunca dropea ni crea fuera de su base desechable.
    #>
    param(
        [string[]] $Before,
        [string[]] $After
    )

    $beforeMap = @{}
    foreach ($entry in @($Before)) {
        if ($entry -match '^(.+):(\d+)$') { $beforeMap[$Matches[1]] = [int] $Matches[2] }
    }

    $afterMap = @{}
    foreach ($entry in @($After)) {
        if ($entry -match '^(.+):(\d+)$') { $afterMap[$Matches[1]] = [int] $Matches[2] }
    }

    $changed = @()
    $removed = @()
    $added = @()

    foreach ($key in @($beforeMap.Keys)) {
        if (-not $afterMap.ContainsKey($key)) {
            $removed += "$key (tenia $($beforeMap[$key]) tablas)"
        } elseif ($afterMap[$key] -ne $beforeMap[$key]) {
            $changed += "$key ($($beforeMap[$key]) -> $($afterMap[$key]) tablas)"
        }
    }

    foreach ($key in @($afterMap.Keys)) {
        if (-not $beforeMap.ContainsKey($key)) {
            $added += "$key ($($afterMap[$key]) tablas)"
        }
    }

    return @{
        Unchanged        = ($changed.Count -eq 0)
        Changed          = $changed
        Removed          = $removed
        Added            = $added
        ComparedSchemas  = $beforeMap.Count
    }
}

function Get-LabLocalStatefulDomains {
    param([int] $FrontendPort, [int] $BackendPort)

    return @(
        'localhost',
        "localhost:$FrontendPort",
        '127.0.0.1',
        "127.0.0.1:$FrontendPort",
        "127.0.0.1:$BackendPort",
        '::1'
    ) -join ','
}
