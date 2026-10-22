#Requires -Version 5.1
# Contrato del guard de migracion / cancelacion coherente.
# Verifica el call site real del deploy, entrypoint, setup.bat y el comando artisan.

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$deployContent = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deploy_hospital_lan.ps1') -Raw
$setupContent = Get-Content -LiteralPath (Join-Path $projectRoot 'setup.bat') -Raw
$entrypointContent = Get-Content -LiteralPath (Join-Path $projectRoot 'backend\docker\entrypoint.sh') -Raw
$envExampleContent = Get-Content -LiteralPath (Join-Path $projectRoot '.env.example') -Raw
$commandPath = Join-Path $projectRoot 'backend\app\Console\Commands\VerifyMigrationBackupCommand.php'

$script:Checks = 0
$script:Errors = @()

function Assert-GuardContract {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

# 1. Deploy Docker: el guard corre antes de migrate
$dockerGuardIndex = $deployContent.IndexOf('hospital:verify-migration-backup')
$dockerMigrateIndex = $deployContent.IndexOf('exec -T backend php artisan migrate --force')
Assert-GuardContract ($dockerGuardIndex -ge 0) 'El deploy Docker debe invocar hospital:verify-migration-backup.'
Assert-GuardContract ($dockerMigrateIndex -ge 0) 'El deploy Docker debe invocar migrate.'
Assert-GuardContract ($dockerGuardIndex -lt $dockerMigrateIndex) 'En Docker el guard debe ejecutarse antes de migrate.'
Assert-GuardContract ($deployContent -match '\$verifyBackupArgs') 'El deploy Docker debe construir los argumentos del guard.'
Assert-GuardContract ($deployContent -match "'backend', 'php', 'artisan', 'hospital:verify-migration-backup'") 'El deploy Docker debe ejecutar el guard en el servicio backend.'
Assert-GuardContract ($deployContent -match '--max-age-hours=') 'El deploy debe traducir la ventana a --max-age-hours.'

# 2. Deploy bare-metal: el guard corre antes de migrate
$bareGuardIndex = $deployContent.IndexOf("@('artisan', 'hospital:verify-migration-backup'")
$bareMigrateIndex = $deployContent.IndexOf('& $phpPath artisan migrate --force --seed')
Assert-GuardContract ($bareGuardIndex -ge 0) 'El deploy bare-metal debe invocar hospital:verify-migration-backup.'
Assert-GuardContract ($bareMigrateIndex -ge 0) 'El deploy bare-metal debe invocar migrate.'
Assert-GuardContract ($bareGuardIndex -lt $bareMigrateIndex) 'En bare-metal el guard debe ejecutarse antes de migrate.'

# 2b. La ventana documentada en .env se propaga en ambos modos
Assert-GuardContract ((([regex]::Matches($deployContent, 'HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS')).Count -ge 2)) 'El deploy debe leer HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS en Docker y bare-metal.'
Assert-GuardContract ((([regex]::Matches($deployContent, '--max-age-hours=')).Count -ge 2)) 'El deploy debe construir --max-age-hours en ambos modos.'

# 3. El deploy falla con mensaje accionable y sin migrar el esquema
Assert-GuardContract ($deployContent -match '\[FAIL\] Actualizacion bloqueada') 'El deploy debe mostrar el bloqueo del guard.'
Assert-GuardContract ($deployContent -match 'No se modifico el esquema') 'El deploy debe declarar que el esquema no fue modificado.'

# 4. Entrypoint: guard antes de migrate y salida no silenciosa
$entryGuardIndex = $entrypointContent.IndexOf('php artisan hospital:verify-migration-backup')
$entryMigrateIndex = $entrypointContent.IndexOf('php artisan migrate --force --no-interaction')
Assert-GuardContract ($entryGuardIndex -ge 0) 'El entrypoint debe invocar hospital:verify-migration-backup.'
Assert-GuardContract ($entryMigrateIndex -ge 0) 'El entrypoint debe invocar migrate.'
Assert-GuardContract ($entryGuardIndex -lt $entryMigrateIndex) 'En el entrypoint el guard debe ejecutarse antes de migrate.'
Assert-GuardContract ($entrypointContent -match 'migraciones bloqueadas') 'El entrypoint debe explicar el bloqueo del guard.'
Assert-GuardContract ($entrypointContent -match '(?m)^\s*exit 1\s*$') 'El entrypoint debe salir con codigo distinto de cero al bloquear migraciones.'
Assert-GuardContract ($entrypointContent -match 'max-age-hours=\$\{HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS') 'El entrypoint debe traducir HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS a --max-age-hours.'

# 5. El comando artisan existe y verifica el respaldo real
Assert-GuardContract (Test-Path -LiteralPath $commandPath -PathType Leaf) 'Debe existir backend\app\Console\Commands\VerifyMigrationBackupCommand.php.'
$commandContent = if (Test-Path -LiteralPath $commandPath -PathType Leaf) { Get-Content -LiteralPath $commandPath -Raw } else { '' }
Assert-GuardContract ($commandContent -match 'hospital:verify-migration-backup') 'El comando debe declarar la firma hospital:verify-migration-backup.'
Assert-GuardContract ($commandContent -match 'STATUS_SUCCESS') 'El comando debe exigir estado success en backup_logs.'
Assert-GuardContract ($commandContent -match '->encrypted') 'El comando debe exigir respaldo cifrado.'
Assert-GuardContract ($commandContent -match 'checksum_sha256') 'El comando debe verificar el checksum registrado.'
Assert-GuardContract ($commandContent -match 'hash_equals') 'El comando debe comparar el hash en tiempo constante.'
Assert-GuardContract ($commandContent -match 'CHUNK_MARKER') 'El comando debe verificar el formato cifrado recuperable.'
Assert-GuardContract ($commandContent -notmatch 'HOSPITAL_MIGRATION_BACKUP_CONFIRMED') 'El comando no debe aceptar la variable booleana muerta.'
Assert-GuardContract ($commandContent -match "unlink|file_put_contents|rename\(" -eq $false) 'El comando no debe escribir ni borrar la copia de recuperacion.'
Assert-GuardContract ($commandContent -match '--max-age-hours') 'El comando debe aceptar la opcion --max-age-hours.'
Assert-GuardContract ($commandContent -match 'HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS') 'La ayuda del comando debe documentar HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS.'
Assert-GuardContract ($commandContent -match 'DEFAULT_BACKUP_MAX_AGE_HOURS = 72') 'El default de la ventana debe ser 72 horas.'
Assert-GuardContract ($commandContent -match 'max_age_hours') 'El resultado debe exponer max_age_hours.'
Assert-GuardContract ($commandContent -match 'completed_at') 'El resultado debe exponer la fecha del respaldo.'
Assert-GuardContract ($commandContent -match 'fuera de la ventana') 'El comando debe rechazar respaldos fuera de la ventana.'
Assert-GuardContract ($commandContent -match 'diffInHours') 'El comando debe calcular la antiguedad del respaldo.'
Assert-GuardContract ($commandContent -match 'findDomainData') 'El comando debe comprobar datos de dominio antes de tratar la instalacion como nueva.'
Assert-GuardContract ($commandContent -match 'property_exists') 'El comando debe extraer nombres de tablas sin acceder a propiedades indefinidas (phpstan nivel 9).'

# 6. La plantilla de entorno documenta la ventana y no expone un bypass manual
Assert-GuardContract ($envExampleContent -notmatch 'HOSPITAL_MIGRATION_BACKUP_CONFIRMED') '.env.example no debe exponer HOSPITAL_MIGRATION_BACKUP_CONFIRMED como confirmacion manual.'
Assert-GuardContract ($envExampleContent -match 'HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS=72') '.env.example debe documentar el default 72 de la ventana.'

# 7. setup.bat: cancelacion de UAC no silenciosa y con exit code coherente
Assert-GuardContract ($setupContent -match 'goto :elevation_cancelled') 'setup.bat debe desviar la cancelacion de UAC a un manejador explicito.'
Assert-GuardContract ($setupContent -match 'la instalacion no comenzo') 'setup.bat debe explicar que la cancelacion de UAC no inicio la instalacion.'
Assert-GuardContract ($setupContent -match '(?s):elevation_cancelled.*?exit /b 1') 'setup.bat debe salir con codigo 1 cuando la elevacion se cancela.'
Assert-GuardContract ($setupContent -match 'exit /b 0') 'setup.bat debe salir con codigo 0 solo cuando delego la elevacion.'
Assert-GuardContract ($setupContent -notmatch 'ELEVATION_EXIT') 'setup.bat no debe usar expansion de variables dentro de bloques IF.'
Assert-GuardContract ($setupContent -match 'exit /b %INSTALL_EXIT%') 'setup.bat debe propagar el exit code del instalador.'
Assert-GuardContract ($setupContent -match 'try \{ Start-Process') 'setup.bat debe elevar con try/catch explicito.'
Assert-GuardContract ($setupContent -match '-Verb RunAs -ErrorAction Stop') 'setup.bat debe forzar ErrorAction Stop en Start-Process -Verb RunAs.'
Assert-GuardContract ($setupContent -match 'catch \{ Write-Host') 'setup.bat debe reportar el error de elevacion.'
Assert-GuardContract ($setupContent -match 'exit 1 \}; exit 0') 'El one-liner de elevacion debe devolver 1 al fallar y 0 al delegar.'

# 8. Cancelacion del deploy no silenciosa y exit code consolidado
Assert-GuardContract ($deployContent -match '\[INFO\] Operacion cancelada\.') 'El deploy debe avisar cuando se cancela una operacion.'
Assert-GuardContract ($deployContent -match '\$finalInstallExitCode = 1') 'El deploy debe partir de un exit code no exitoso.'
Assert-GuardContract ($deployContent -match 'exit \$finalInstallExitCode') 'El deploy debe devolver el exit code consolidado.'

# 9. Prueba funcional del one-liner de elevacion: propaga exit 1 sin UAC real.
# PS 5.1 no expone el codigo del proceso elevado (es un proceso separado); el
# contrato verificable en el padre es mensaje + exit 1 cuando Start-Process falla.
$elevationMatch = [regex]::Match($setupContent, 'powershell\.exe -NoProfile -Command "(?<command>try \{ Start-Process[^"]*)"')
Assert-GuardContract ($elevationMatch.Success) 'setup.bat debe contener el one-liner de elevacion.'
if ($elevationMatch.Success) {
    $missingTarget = Join-Path $env:TEMP ('s-hospital-elevation-missing-' + [guid]::NewGuid().ToString('N') + '.exe')
    $elevationCommand = $elevationMatch.Groups['command'].Value.Replace('%~f0', $missingTarget)
    $elevationOutput = & powershell.exe -NoProfile -Command $elevationCommand 2>&1 | ForEach-Object { [string] $_ }
    $elevationExit = [int] $LASTEXITCODE
    Assert-GuardContract ($elevationExit -ne 0) "El one-liner de elevacion debe propagar exit distinto de cero; obtuvo $elevationExit."
    Assert-GuardContract (($elevationOutput -join ' ') -match 'ERROR:') 'El one-liner de elevacion debe imprimir el error de Start-Process cuando no puede elevar.'
}

if ($script:Errors.Count -gt 0) {
    Write-Host ("Upgrade guard contract found {0} failing assertions:" -f $script:Errors.Count) -ForegroundColor Red
    foreach ($err in $script:Errors) {
        Write-Host ("  - {0}" -f $err) -ForegroundColor Red
    }
    throw 'Upgrade guard contract test failed.'
}

Write-Host "Upgrade guard contract test passed: $script:Checks checks."
