[CmdletBinding()]
param(
    [string]$InstallRoot = '',
    [switch]$Elevated,
    [switch]$Initial
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-SafeAbsolutePath([string]$Path, [string]$Label) {
    $isDriveRooted = [IO.Path]::IsPathRooted($Path) -and $Path -match '^[A-Za-z]:\\'
    if ((-not $isDriveRooted) -or $Path.IndexOfAny([char[]]@('"', "`r", "`n")) -ge 0) {
        throw "$Label no es válida."
    }

    $null = [IO.Path]::GetFullPath($Path)
}

function Test-HospitalAccessRuleGrantsWrite([Security.AccessControl.FileSystemAccessRule]$Rule) {
    if ($Rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { return $false }
    # Do not use Modify or FullControl as masks: both include read/execute bits,
    # so an ordinary RX rule would intersect them and be rejected as writable.
    $writeMask = [Security.AccessControl.FileSystemRights]::Write -bor
        [Security.AccessControl.FileSystemRights]::Delete -bor
        [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
        [Security.AccessControl.FileSystemRights]::ChangePermissions -bor
        [Security.AccessControl.FileSystemRights]::TakeOwnership
    return ($Rule.FileSystemRights -band $writeMask) -ne 0
}

function Assert-NoUnprivilegedWriteAcl([string]$Path) {
    $unprivilegedSids = @('S-1-1-0', 'S-1-5-11', 'S-1-5-19', 'S-1-5-32-545')
    foreach ($rule in (Get-Acl -LiteralPath $Path).Access) {
        try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { continue }
        if ($sid -in $unprivilegedSids -and (Test-HospitalAccessRuleGrantsWrite -Rule $rule)) {
            throw 'La instalación de S_Hospital no tiene permisos de archivo seguros.'
        }
    }
}

if ($InstallRoot) {
    Assert-SafeAbsolutePath -Path $InstallRoot -Label 'La ruta de instalación'
}

$windowsPowerShell = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::System)) 'WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $windowsPowerShell -PathType Leaf)) {
    throw 'No se encontró el componente protegido de Windows para autorizar la operación.'
}

if (-not (Test-IsAdministrator)) {
    if ($Elevated) {
        throw 'Windows no concedió autorización de administrador.'
    }

    $arguments = @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ('"{0}"' -f $PSCommandPath), '-Elevated')
    if ($InstallRoot) {
        $arguments += @('-InstallRoot', ('"{0}"' -f $InstallRoot))
    }
    if ($Initial) { $arguments += '-Initial' }

    $process = Start-Process -FilePath $windowsPowerShell -Verb RunAs -WindowStyle Hidden -ArgumentList ($arguments -join ' ') -Wait -PassThru
    exit $process.ExitCode
}

$programFilesRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)
$canonicalInstallRoot = [IO.Path]::GetFullPath((Join-Path $programFilesRoot 'S_Hospital')).TrimEnd('\')
$installedRoot = if ($InstallRoot) { [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') } else { $canonicalInstallRoot }
if (-not $installedRoot.Equals($canonicalInstallRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La recuperación solo puede ejecutarse desde la instalación protegida de S_Hospital.'
}

$currentPath = Join-Path $installedRoot 'current'
if (-not (Test-Path -LiteralPath $currentPath -PathType Container)) {
    throw 'La instalación protegida de S_Hospital está incompleta.'
}
$currentItem = Get-Item -LiteralPath $currentPath -Force
if (($currentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or -not $currentItem.Target) {
    throw 'La versión activa de S_Hospital no es un enlace protegido válido.'
}
$currentTarget = [string]@($currentItem.Target)[0]
if (-not [IO.Path]::IsPathRooted($currentTarget)) {
    $currentTarget = Join-Path $installedRoot $currentTarget
}
$resolvedCurrent = [IO.Path]::GetFullPath($currentTarget).TrimEnd('\')
$releasesPrefix = [IO.Path]::GetFullPath((Join-Path $installedRoot 'releases')).TrimEnd('\') + '\'
if (-not $resolvedCurrent.StartsWith($releasesPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'La versión activa de S_Hospital apunta fuera de sus versiones protegidas.'
}

$installedBackend = Join-Path $resolvedCurrent 'app\backend'
$installedPhp = Join-Path $resolvedCurrent 'runtime\php\php.exe'

if (-not (Test-Path -LiteralPath $installedBackend -PathType Container) -or -not (Test-Path -LiteralPath $installedPhp -PathType Leaf)) {
    throw 'La instalación protegida de S_Hospital está incompleta.'
}

$backendPath = (Resolve-Path -LiteralPath $installedBackend).Path
$phpPath = (Resolve-Path -LiteralPath $installedPhp).Path
$programDataRoot = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
$hospitalConfigRoot = Join-Path $programDataRoot 'S_Hospital\config'
$administratorConfigRoot = Join-Path $hospitalConfigRoot 'administrator-only'
$elevatedCacheRoot = Join-Path $administratorConfigRoot 'access-recovery-cache'
$disabledPhpScanRoot = Join-Path $administratorConfigRoot 'php-scan-disabled'
$phpIniPath = Join-Path $hospitalConfigRoot 'php.ini'
$hospitalEnvPath = Join-Path $hospitalConfigRoot 'hospital.env'
$dotenvHelperPath = Join-Path $resolvedCurrent 'scripts\native\lib\native_dotenv.ps1'
if (-not (Test-Path -LiteralPath $phpIniPath -PathType Leaf)) {
    throw 'La instalación de S_Hospital está incompleta. No se encontró la configuración local de PHP.'
}
if (-not (Test-Path -LiteralPath $hospitalEnvPath -PathType Leaf) -or -not (Test-Path -LiteralPath $dotenvHelperPath -PathType Leaf)) {
    throw 'La instalación de S_Hospital está incompleta. No se encontró la configuración local de la aplicación.'
}
if (-not (Test-Path -LiteralPath $administratorConfigRoot -PathType Container)) { New-Item -ItemType Directory -Path $administratorConfigRoot | Out-Null }
if (-not (Test-Path -LiteralPath $elevatedCacheRoot -PathType Container)) { New-Item -ItemType Directory -Path $elevatedCacheRoot | Out-Null }
if (-not (Test-Path -LiteralPath (Join-Path $elevatedCacheRoot 'views') -PathType Container)) { New-Item -ItemType Directory -Path (Join-Path $elevatedCacheRoot 'views') | Out-Null }
if (-not (Test-Path -LiteralPath $disabledPhpScanRoot -PathType Container)) { New-Item -ItemType Directory -Path $disabledPhpScanRoot | Out-Null }
if (@(Get-ChildItem -LiteralPath $disabledPhpScanRoot -Force).Count -ne 0) { throw 'La configuración local de PHP no es segura.' }

$artisanPath = Join-Path $backendPath 'artisan'
if (-not (Test-Path -LiteralPath $artisanPath)) {
    throw 'La instalación de S_Hospital está incompleta. No se encontró el componente de acceso.'
}

Assert-SafeAbsolutePath -Path $phpPath -Label 'La ruta del componente local'
Assert-SafeAbsolutePath -Path $artisanPath -Label 'La ruta de la aplicación'
Assert-SafeAbsolutePath -Path $phpIniPath -Label 'La ruta de configuración local'
Assert-SafeAbsolutePath -Path $hospitalEnvPath -Label 'La ruta de variables locales'
Assert-SafeAbsolutePath -Path $dotenvHelperPath -Label 'La ruta del lector de configuración'

$canonicalConfigRoot = [IO.Path]::GetFullPath($hospitalConfigRoot).TrimEnd('\')
$configPrefix = $canonicalConfigRoot + '\'
foreach ($configPath in @($phpIniPath, $hospitalEnvPath)) {
    $resolvedConfigPath = (Resolve-Path -LiteralPath $configPath).Path
    if (-not $resolvedConfigPath.StartsWith($configPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'La configuración de S_Hospital apunta fuera de su ubicación autorizada.'
    }
}

$protectedPrefix = $canonicalInstallRoot + '\'
foreach ($trustedPath in @($backendPath, $phpPath, $artisanPath, $dotenvHelperPath)) {
    $resolvedTrustedPath = if (Test-Path -LiteralPath $trustedPath) { (Resolve-Path -LiteralPath $trustedPath).Path } else { $trustedPath }
    if (-not $resolvedTrustedPath.StartsWith($protectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'La instalación protegida de S_Hospital apunta fuera de su ubicación autorizada.'
    }
}
foreach ($aclPath in @($installedRoot, $currentPath, $resolvedCurrent, $hospitalConfigRoot, $administratorConfigRoot, $elevatedCacheRoot, $disabledPhpScanRoot, $phpIniPath, $hospitalEnvPath)) {
    Assert-NoUnprivilegedWriteAcl -Path $aclPath
}

. $dotenvHelperPath
$nativeEnvironment = @{}
foreach ($line in Get-Content -LiteralPath $hospitalEnvPath -Encoding UTF8) {
    $trimmedLine = $line.Trim()
    if ($trimmedLine -eq '' -or $trimmedLine.StartsWith('#')) { continue }
    $separator = $trimmedLine.IndexOf('=')
    if ($separator -le 0) { throw 'La configuración local de S_Hospital no es válida.' }
    $name = $trimmedLine.Substring(0, $separator).Trim()
    if ($name -notmatch '^[A-Z][A-Z0-9_]*$') { throw 'La configuración local de S_Hospital no es válida.' }
    $encodedValue = $trimmedLine.Substring($separator + 1)
    $value = ConvertFrom-NativeDotEnvValue -Value $encodedValue
    $nativeEnvironment[$name] = $value
}
$allowedEnvironmentNames = @('APP_NAME','APP_ENV','APP_KEY','APP_DEBUG','APP_URL','LOG_CHANNEL','LOG_LEVEL','DB_CONNECTION','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_APP_ACCOUNT_HOST','DB_PASSWORD','SESSION_DRIVER','SESSION_SECURE_COOKIE','SANCTUM_STATEFUL_DOMAINS','CACHE_STORE','QUEUE_CONNECTION','BROADCAST_CONNECTION','FILESYSTEM_DISK','HOSPITAL_BACKUP_ENCRYPTION_KEY','HOSPITAL_ALLOW_INSECURE_HTTP','HOSPITAL_NATIVE_DATA_ROOT','LARAVEL_STORAGE_PATH','APP_CONFIG_CACHE','APP_EVENTS_CACHE','APP_PACKAGES_CACHE','APP_ROUTES_CACHE','APP_SERVICES_CACHE','VIEW_COMPILED_PATH','HOSPITAL_DUMP_BINARY')
foreach ($name in $allowedEnvironmentNames) { [Environment]::SetEnvironmentVariable($name, $null, [EnvironmentVariableTarget]::Process) }
foreach ($name in $allowedEnvironmentNames) {
    if ($nativeEnvironment.ContainsKey($name)) { [Environment]::SetEnvironmentVariable($name, [string]$nativeEnvironment[$name], [EnvironmentVariableTarget]::Process) }
}
$safeCachePaths = @{
    APP_CONFIG_CACHE = (Join-Path $elevatedCacheRoot 'config.php')
    APP_EVENTS_CACHE = (Join-Path $elevatedCacheRoot 'events.php')
    APP_PACKAGES_CACHE = (Join-Path $elevatedCacheRoot 'packages.php')
    APP_ROUTES_CACHE = (Join-Path $elevatedCacheRoot 'routes.php')
    APP_SERVICES_CACHE = (Join-Path $elevatedCacheRoot 'services.php')
    VIEW_COMPILED_PATH = (Join-Path $elevatedCacheRoot 'views')
}
foreach ($name in $safeCachePaths.Keys) { [Environment]::SetEnvironmentVariable($name, [string]$safeCachePaths[$name], [EnvironmentVariableTarget]::Process) }
[Environment]::SetEnvironmentVariable('PHPRC', $null, [EnvironmentVariableTarget]::Process)
[Environment]::SetEnvironmentVariable('PHP_INI_SCAN_DIR', $disabledPhpScanRoot, [EnvironmentVariableTarget]::Process)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

$form = [Windows.Forms.Form]::new()
$form.Text = if ($Initial) { 'Configurar S_Hospital' } else { 'Recuperar acceso a S_Hospital' }
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(500, $(if ($Initial) { 525 } else { 470 }))
$form.FormBorderStyle = 'FixedDialog'
$form.AutoScaleMode = 'Font'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.Font = [Drawing.Font]::new('Segoe UI', 10)

$title = [Windows.Forms.Label]::new()
$title.Text = if ($Initial) { 'Crear administrador inicial' } else { 'Recuperar acceso' }
$title.Font = [Drawing.Font]::new('Segoe UI Semibold', 18)
$title.Location = [Drawing.Point]::new(28, 22)
$title.AutoSize = $true
$form.Controls.Add($title)

$description = [Windows.Forms.Label]::new()
$description.Text = if ($Initial) {
    'Cree la cuenta responsable de administrar el sistema. Al ingresar deberá cambiar la contraseña temporal.'
} else {
    'Use este procedimiento únicamente si no hay otro administrador que pueda restablecer la contraseña desde la aplicación.'
}
$description.Location = [Drawing.Point]::new(30, 64)
$description.Size = [Drawing.Size]::new(440, 48)
$form.Controls.Add($description)

function Add-Field([string]$Label, [int]$Top, [bool]$Password = $false, [bool]$Multiline = $false) {
    $fieldLabel = [Windows.Forms.Label]::new()
    $fieldLabel.Text = $Label
    $fieldLabel.Location = [Drawing.Point]::new(30, $Top)
    $fieldLabel.AutoSize = $true
    $form.Controls.Add($fieldLabel)

    $field = [Windows.Forms.TextBox]::new()
    $field.Location = [Drawing.Point]::new(30, ($Top + 24))
    $field.Size = [Drawing.Size]::new(440, $(if ($Multiline) { 54 } else { 28 }))
    $field.UseSystemPasswordChar = $Password
    $field.Multiline = $Multiline
    if ($Multiline) { $field.ScrollBars = 'Vertical' }
    $form.Controls.Add($field)
    return $field
}

$nameField = $null
$emailField = $null
$reasonField = $null
if ($Initial) {
    $nameField = Add-Field -Label 'Nombre del administrador' -Top 116
    $identityField = Add-Field -Label 'Usuario' -Top 174
    $emailField = Add-Field -Label 'Correo' -Top 232
    $passwordField = Add-Field -Label 'Contraseña temporal' -Top 290 -Password $true
    $confirmationField = Add-Field -Label 'Repita la contraseña temporal' -Top 348 -Password $true
    $nameField.MaxLength = 120
    $emailField.MaxLength = 255
    $resultTop = 406
    $buttonTop = 482
} else {
    $identityField = Add-Field -Label 'Usuario o correo del administrador' -Top 116
    $reasonField = Add-Field -Label 'Motivo de la recuperación' -Top 174 -Multiline $true
    $passwordField = Add-Field -Label 'Nueva contraseña temporal' -Top 258 -Password $true
    $confirmationField = Add-Field -Label 'Repita la contraseña temporal' -Top 316 -Password $true
    $reasonField.MaxLength = 500
    $resultTop = 374
    $buttonTop = 427
}
$identityField.MaxLength = 255
$passwordField.MaxLength = 255
$confirmationField.MaxLength = 255

$resultLabel = [Windows.Forms.Label]::new()
$resultLabel.Location = [Drawing.Point]::new(30, $resultTop)
$resultLabel.Size = [Drawing.Size]::new(440, 46)
$resultLabel.ForeColor = [Drawing.Color]::FromArgb(176, 38, 38)
$form.Controls.Add($resultLabel)

$cancelButton = [Windows.Forms.Button]::new()
$cancelButton.Text = 'Cerrar'
$cancelButton.Location = [Drawing.Point]::new(227, $buttonTop)
$cancelButton.Size = [Drawing.Size]::new(95, 32)
$cancelButton.DialogResult = [Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.CancelButton = $cancelButton

$recoverButton = [Windows.Forms.Button]::new()
$recoverButton.Text = if ($Initial) { 'Crear administrador' } else { 'Recuperar acceso' }
$recoverButton.Location = [Drawing.Point]::new(335, $buttonTop)
$recoverButton.Size = [Drawing.Size]::new(135, 32)
$form.Controls.Add($recoverButton)
$form.AcceptButton = $recoverButton
$script:HospitalAccessExitCode = 20

$recoverButton.Add_Click({
    $resultLabel.Text = ''
    $missingInitial = $Initial -and ([string]::IsNullOrWhiteSpace($nameField.Text) -or [string]::IsNullOrWhiteSpace($emailField.Text))
    $missingRecovery = (-not $Initial) -and [string]::IsNullOrWhiteSpace($reasonField.Text)
    if ([string]::IsNullOrWhiteSpace($identityField.Text) -or $missingInitial -or $missingRecovery -or [string]::IsNullOrEmpty($passwordField.Text)) {
        $resultLabel.Text = 'Complete todos los campos.'
        return
    }
    if ($passwordField.Text -cne $confirmationField.Text) {
        $resultLabel.Text = 'Las contraseñas no coinciden.'
        return
    }

    $recoverButton.Enabled = $false
    $form.UseWaitCursor = $true
    $process = $null
    $payload = $null
    $payloadValues = $null
    try {
        $startInfo = [Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $phpPath
        $commandName = if ($Initial) { 'auth:create-initial-admin-secure' } else { 'auth:recover-local-admin' }
        $phpConfiguration = '-c "{0}" ' -f $phpIniPath
        $startInfo.Arguments = ('{0}"{1}" {2} --stdin-json --json' -f $phpConfiguration, $artisanPath, $commandName)
        $startInfo.WorkingDirectory = $backendPath
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardInput = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $startInfo.StandardOutputEncoding = [Text.Encoding]::UTF8
        $startInfo.StandardErrorEncoding = [Text.Encoding]::UTF8
        $startInfo.EnvironmentVariables['PHPRC'] = ''
        $startInfo.EnvironmentVariables['PHP_INI_SCAN_DIR'] = $disabledPhpScanRoot

        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $startInfo
        if (-not $process.Start()) { throw 'No se pudo iniciar la recuperación.' }
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()

        $payloadValues = if ($Initial) {
            @{
                name = $nameField.Text
                username = $identityField.Text
                email = $emailField.Text
                password = $passwordField.Text
                password_confirmation = $confirmationField.Text
            }
        } else {
            @{
                identity = $identityField.Text
                reason = $reasonField.Text
                password = $passwordField.Text
                password_confirmation = $confirmationField.Text
            }
        }
        $payload = $payloadValues | ConvertTo-Json -Compress

        $payloadBytes = [Text.Encoding]::UTF8.GetBytes($payload)
        $process.StandardInput.BaseStream.Write($payloadBytes, 0, $payloadBytes.Length)
        $process.StandardInput.Close()

        $deadline = [DateTime]::UtcNow.AddSeconds(30)
        while (-not $process.WaitForExit(100)) {
            [Windows.Forms.Application]::DoEvents()
            if ([DateTime]::UtcNow -ge $deadline) {
                $process.Kill()
                throw 'La recuperación excedió el tiempo permitido.'
            }
        }
        $process.WaitForExit()
        if (-not $outputTask.Wait(5000) -or -not $errorTask.Wait(5000)) {
            throw 'No se recibió una respuesta válida.'
        }
        $output = $outputTask.Result

        $response = $output.Trim() | ConvertFrom-Json
        $resultLabel.Text = [string]$response.message
        if ($response.ok) {
            $script:HospitalAccessExitCode = 0
            $resultLabel.ForeColor = [Drawing.Color]::FromArgb(21, 128, 61)
            $passwordField.Clear()
            $confirmationField.Clear()
            foreach ($control in @($nameField, $identityField, $emailField, $reasonField, $passwordField, $confirmationField)) {
                if ($null -ne $control) { $control.Enabled = $false }
            }
            $cancelButton.Text = 'Cerrar'
        } else {
            $script:HospitalAccessExitCode = [int]$response.code
            $resultLabel.ForeColor = [Drawing.Color]::FromArgb(176, 38, 38)
        }
    } catch {
        $script:HospitalAccessExitCode = 13
        $resultLabel.ForeColor = [Drawing.Color]::FromArgb(176, 38, 38)
        $resultLabel.Text = 'No se pudo completar la recuperación. Intente nuevamente.'
    } finally {
        if ($null -ne $payloadValues) {
            if ($payloadValues.ContainsKey('password')) { $payloadValues.password = '' }
            if ($payloadValues.ContainsKey('password_confirmation')) { $payloadValues.password_confirmation = '' }
        }
        $payload = $null
        $payloadValues = $null
        $passwordField.Clear()
        $confirmationField.Clear()
        if ($null -ne $process) { $process.Dispose() }
        $recoverButton.Enabled = $script:HospitalAccessExitCode -ne 0
        $form.UseWaitCursor = $false
    }
})

$form.Add_Shown({ $identityField.Focus() })
$null = $form.ShowDialog()
exit $script:HospitalAccessExitCode
