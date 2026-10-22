#Requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-Administrator {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# CommandLineToArgvW-compatible quoting for Windows PowerShell 5.1.
function ConvertTo-NativeArgument([string]$Value) {
    if ($null -eq $Value -or $Value.Length -eq 0) { return '""' }
    if ($Value -notmatch '[\s"]') { return $Value }
    $result = New-Object Text.StringBuilder
    [void]$result.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$result.Append(('\' * (($slashes * 2) + 1)))
            [void]$result.Append('"')
        } else {
            if ($slashes) { [void]$result.Append(('\' * $slashes)) }
            [void]$result.Append($character)
        }
        $slashes = 0
    }
    if ($slashes) { [void]$result.Append(('\' * ($slashes * 2))) }
    [void]$result.Append('"')
    $result.ToString()
}

$systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
$windowsPowerShell = Join-Path $systemDirectory 'WindowsPowerShell\v1.0\powershell.exe'
$taskkill = Join-Path $systemDirectory 'taskkill.exe'
if (-not (Test-Path -LiteralPath $windowsPowerShell -PathType Leaf) -or -not (Test-Path -LiteralPath $taskkill -PathType Leaf)) { exit 21 }
if (-not (Test-Administrator)) {
    try {
        $argsLine = (@('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath) | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' '
        $child = Start-Process -FilePath $windowsPowerShell -Verb RunAs -WindowStyle Hidden -ArgumentList $argsLine -Wait -PassThru
        exit $child.ExitCode
    } catch { exit 20 }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

function Assert-NoUnprivilegedWriteAcl([string]$Path) {
    $unsafe = @('S-1-1-0','S-1-5-11','S-1-5-19','S-1-5-32-545')
    $write = [Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Modify -bor [Security.AccessControl.FileSystemRights]::FullControl -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
    foreach ($rule in (Get-Acl -LiteralPath $Path).Access) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
        try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { continue }
        if ($sid -in $unsafe -and (($rule.FileSystemRights -band $write) -ne 0)) { throw 'unsafe_acl' }
    }
}

function Assert-Within([string]$Path,[string]$Root) {
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'unsafe_path' }
    $resolved
}

try {
    $InstallRoot = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)) 'S_Hospital')).TrimEnd('\')
    $DataRoot = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)) 'S_Hospital')).TrimEnd('\')
    $currentPath = Join-Path $InstallRoot 'current'
    $scriptCurrent = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')
    if (-not $scriptCurrent.Equals($currentPath,[StringComparison]::OrdinalIgnoreCase)) { throw 'wrong_location' }
    $currentItem = Get-Item -LiteralPath $currentPath -Force
    if (($currentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or -not $currentItem.Target) { throw 'invalid_current' }
    $target = [string]@($currentItem.Target)[0]
    if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path $InstallRoot $target }
    $resolvedCurrent = [IO.Path]::GetFullPath($target).TrimEnd('\')
    $releases = [IO.Path]::GetFullPath((Join-Path $InstallRoot 'releases')).TrimEnd('\') + '\'
    if (-not $resolvedCurrent.StartsWith($releases,[StringComparison]::OrdinalIgnoreCase)) { throw 'outside_releases' }

    $configRoot = Join-Path $DataRoot 'config'
    $administratorRoot = Join-Path $configRoot 'administrator-only'
    $attentionMarker = Join-Path $administratorRoot 'recovery-attention.required'
    $disabledPhpScanRoot = Join-Path $administratorRoot 'php-scan-disabled'
    $elevatedCacheRoot = Join-Path $administratorRoot 'recovery-cache'
    $php = Join-Path $resolvedCurrent 'runtime\php\php.exe'
    $phpIni = Join-Path $configRoot 'php.ini'
    $hospitalEnv = Join-Path $configRoot 'hospital.env'
    $backendRoot = Join-Path $resolvedCurrent 'app\backend'
    $artisan = Join-Path $backendRoot 'artisan'
    $restoreScript = Join-Path $resolvedCurrent 'scripts\native\restore_native.ps1'
    $dotenvHelper = Join-Path $resolvedCurrent 'scripts\native\lib\native_dotenv.ps1'
    foreach ($path in @($php,$phpIni,$hospitalEnv,$artisan,$restoreScript,$dotenvHelper)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'missing_component' }
    }
    if (-not (Test-Path -LiteralPath $administratorRoot -PathType Container)) { throw 'missing_component' }
    if (-not (Test-Path -LiteralPath $disabledPhpScanRoot -PathType Container)) { New-Item -ItemType Directory -Path $disabledPhpScanRoot | Out-Null }
    if (-not (Test-Path -LiteralPath $elevatedCacheRoot -PathType Container)) { New-Item -ItemType Directory -Path $elevatedCacheRoot | Out-Null }
    if (-not (Test-Path -LiteralPath (Join-Path $elevatedCacheRoot 'views') -PathType Container)) { New-Item -ItemType Directory -Path (Join-Path $elevatedCacheRoot 'views') | Out-Null }
    if (@(Get-ChildItem -LiteralPath $disabledPhpScanRoot -Force).Count -ne 0) { throw 'unsafe_php_scan' }
    foreach ($path in @($php,$artisan,$restoreScript,$dotenvHelper)) { $null = Assert-Within $path $resolvedCurrent }
    foreach ($path in @($phpIni,$hospitalEnv)) { $null = Assert-Within $path $configRoot }
    foreach ($path in @($InstallRoot,$currentPath,$resolvedCurrent,$configRoot,$administratorRoot,$disabledPhpScanRoot,$elevatedCacheRoot,$phpIni,$hospitalEnv)) { Assert-NoUnprivilegedWriteAcl $path }
    if (Test-Path -LiteralPath $attentionMarker) { throw 'previous_tree_unconfirmed' }

    . $dotenvHelper
    $nativeEnvironment = @{}
    foreach ($line in Get-Content -LiteralPath $hospitalEnv -Encoding UTF8) {
        $line = $line.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -le 0) { throw 'invalid_env' }
        $name = $line.Substring(0,$separator).Trim()
        if ($name -notmatch '^[A-Z][A-Z0-9_]*$') { throw 'invalid_env' }
        $value = ConvertFrom-NativeDotEnvValue -Value $line.Substring($separator + 1)
        $nativeEnvironment[$name] = $value
    }
    $allowedNames = @('APP_NAME','APP_ENV','APP_KEY','APP_DEBUG','APP_URL','LOG_CHANNEL','LOG_LEVEL','DB_CONNECTION','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_APP_ACCOUNT_HOST','DB_PASSWORD','SESSION_DRIVER','SESSION_SECURE_COOKIE','SANCTUM_STATEFUL_DOMAINS','CACHE_STORE','QUEUE_CONNECTION','BROADCAST_CONNECTION','FILESYSTEM_DISK','HOSPITAL_BACKUP_ENCRYPTION_KEY','HOSPITAL_ALLOW_INSECURE_HTTP','HOSPITAL_NATIVE_DATA_ROOT','LARAVEL_STORAGE_PATH','APP_CONFIG_CACHE','APP_EVENTS_CACHE','APP_PACKAGES_CACHE','APP_ROUTES_CACHE','APP_SERVICES_CACHE','VIEW_COMPILED_PATH','HOSPITAL_DUMP_BINARY')
    $pathNames = @('HOSPITAL_NATIVE_DATA_ROOT','LARAVEL_STORAGE_PATH','APP_CONFIG_CACHE','APP_EVENTS_CACHE','APP_PACKAGES_CACHE','APP_ROUTES_CACHE','APP_SERVICES_CACHE','VIEW_COMPILED_PATH','HOSPITAL_DUMP_BINARY')
    foreach ($requiredName in @('APP_URL','DB_HOST','DB_PORT','DB_APP_ACCOUNT_HOST','DB_CONNECTION') + $pathNames) { if (-not $nativeEnvironment.ContainsKey($requiredName)) { throw 'invalid_env' } }
    if ([string]$nativeEnvironment.DB_HOST -cne '127.0.0.1') { throw 'invalid_db_host' }
    if ([string]$nativeEnvironment.DB_APP_ACCOUNT_HOST -cne '127.0.0.1' -or [string]$nativeEnvironment.DB_CONNECTION -cne 'mysql') { throw 'invalid_db_identity' }
    $databasePort = 0
    if (-not [int]::TryParse([string]$nativeEnvironment.DB_PORT,[ref]$databasePort) -or $databasePort -lt 1 -or $databasePort -gt 65535) { throw 'invalid_db_port' }
    $appUri = $null
    if (-not [Uri]::TryCreate([string]$nativeEnvironment.APP_URL,[UriKind]::Absolute,[ref]$appUri) -or $appUri.Scheme -cne 'http' -or $appUri.Host -cne '127.0.0.1' -or $appUri.Port -lt 1 -or $appUri.Port -gt 65535 -or $appUri.AbsolutePath -ne '/' -or $appUri.Query -or $appUri.Fragment -or $appUri.UserInfo) { throw 'invalid_app_url' }
    $expectedDump = (Resolve-Path -LiteralPath (Join-Path $resolvedCurrent 'runtime\mariadb\bin\mariadb-dump.exe')).Path
    $configuredDump = (Resolve-Path -LiteralPath ([string]$nativeEnvironment.HOSPITAL_DUMP_BINARY)).Path
    if (-not $configuredDump.Equals($expectedDump,[StringComparison]::OrdinalIgnoreCase)) { throw 'invalid_dump_binary' }
    $expectedPaths = @{
        HOSPITAL_NATIVE_DATA_ROOT = $DataRoot
        LARAVEL_STORAGE_PATH = (Join-Path $DataRoot 'storage')
        APP_CONFIG_CACHE = (Join-Path $DataRoot 'cache\config.php')
        APP_EVENTS_CACHE = (Join-Path $DataRoot 'cache\events.php')
        APP_PACKAGES_CACHE = (Join-Path $DataRoot 'cache\packages.php')
        APP_ROUTES_CACHE = (Join-Path $DataRoot 'cache\routes.php')
        APP_SERVICES_CACHE = (Join-Path $DataRoot 'cache\services.php')
        VIEW_COMPILED_PATH = (Join-Path $DataRoot 'cache\views')
    }
    foreach ($name in $expectedPaths.Keys) {
        $configuredPath = [IO.Path]::GetFullPath([string]$nativeEnvironment[$name]).TrimEnd('\')
        $expectedPath = [IO.Path]::GetFullPath([string]$expectedPaths[$name]).TrimEnd('\')
        if (-not $configuredPath.Equals($expectedPath,[StringComparison]::OrdinalIgnoreCase)) { throw 'invalid_runtime_path' }
    }
    foreach ($name in $allowedNames) { [Environment]::SetEnvironmentVariable($name,$null,[EnvironmentVariableTarget]::Process) }
    foreach ($name in $allowedNames) {
        if ($nativeEnvironment.ContainsKey($name)) { [Environment]::SetEnvironmentVariable($name,[string]$nativeEnvironment[$name],[EnvironmentVariableTarget]::Process) }
    }
    $safeCachePaths = @{
        APP_CONFIG_CACHE = (Join-Path $elevatedCacheRoot 'config.php')
        APP_EVENTS_CACHE = (Join-Path $elevatedCacheRoot 'events.php')
        APP_PACKAGES_CACHE = (Join-Path $elevatedCacheRoot 'packages.php')
        APP_ROUTES_CACHE = (Join-Path $elevatedCacheRoot 'routes.php')
        APP_SERVICES_CACHE = (Join-Path $elevatedCacheRoot 'services.php')
        VIEW_COMPILED_PATH = (Join-Path $elevatedCacheRoot 'views')
    }
    foreach ($name in $safeCachePaths.Keys) { [Environment]::SetEnvironmentVariable($name,[string]$safeCachePaths[$name],[EnvironmentVariableTarget]::Process) }
    [Environment]::SetEnvironmentVariable('PHPRC',$null,[EnvironmentVariableTarget]::Process)
    [Environment]::SetEnvironmentVariable('PHP_INI_SCAN_DIR',$disabledPhpScanRoot,[EnvironmentVariableTarget]::Process)
} catch {
    [Windows.Forms.MessageBox]::Show('No se puede abrir el asistente porque la instalación local necesita revisión. Solicite apoyo técnico.','S_Hospital',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    exit 21
}

$recoveryMutex = [Threading.Mutex]::new($false,'Global\S_Hospital_Recovery')
try { $mutexHeld = $recoveryMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $mutexHeld = $true }
if (-not $mutexHeld) {
    [Windows.Forms.MessageBox]::Show('Ya hay una operación de respaldo o recuperación abierta. Termine esa operación antes de continuar.','S_Hospital',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    $recoveryMutex.Dispose()
    exit 22
}
$script:UnsafeChildState = $false

function Invoke-ProtectedProcess {
    param(
        [string]$FilePath,[string[]]$Arguments,
        [AllowNull()][Security.SecureString]$Passphrase = $null,
        [hashtable]$Control = @{},[string]$ExpectedStatus,
        [switch]$RequireRestoreTested,[int]$TimeoutSeconds = 1800,
        [string]$WorkingDirectory = ''
    )
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $FilePath
    $info.Arguments = ($Arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = [Text.Encoding]::UTF8
    $info.StandardErrorEncoding = [Text.Encoding]::UTF8
    $info.EnvironmentVariables['PHPRC'] = ''
    $info.EnvironmentVariables['PHP_INI_SCAN_DIR'] = $disabledPhpScanRoot
    if ($WorkingDirectory) { $info.WorkingDirectory = $WorkingDirectory }
    $pointer = [IntPtr]::Zero; $plain = $null; $json = $null; $bytes = $null; $process = $null
    try {
        $payload = @{} + $Control
        if ($null -ne $Passphrase) {
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Passphrase)
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            $payload.passphrase = $plain
        }
        if ($payload.Count) {
            $json = $payload | ConvertTo-Json -Compress
            $bytes = [Text.Encoding]::UTF8.GetBytes($json)
            if ($bytes.Length -gt 8192) { throw 'oversize' }
        }
        $process = New-Object Diagnostics.Process
        $process.StartInfo = $info
        if (-not $process.Start()) { throw 'start_failed' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if ($null -ne $bytes) { $process.StandardInput.BaseStream.Write($bytes,0,$bytes.Length) }
        $process.StandardInput.Close()
        $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
        while (-not $process.WaitForExit(100)) {
            [Windows.Forms.Application]::DoEvents()
            if ([DateTime]::UtcNow -ge $deadline) {
                $killer = New-Object Diagnostics.ProcessStartInfo
                $killer.FileName = $taskkill
                $killer.Arguments = '/PID {0} /T /F' -f $process.Id
                $killer.UseShellExecute = $false
                $killer.CreateNoWindow = $true
                $killProcess = $null
                $treeStopped = $false
                try {
                    $killProcess = [Diagnostics.Process]::Start($killer)
                    $killProcess.WaitForExit(15000)
                    $treeStopped = $killProcess.HasExited -and $killProcess.ExitCode -eq 0 -and $process.WaitForExit(10000)
                } catch { $treeStopped = $false } finally { if ($null -ne $killProcess) { $killProcess.Dispose() } }
                if (-not $treeStopped) {
                    $script:UnsafeChildState = $true
                    [IO.File]::WriteAllText($attentionMarker,([DateTime]::UtcNow.ToString('O')),[Text.Encoding]::ASCII)
                }
                throw 'timeout'
            }
        }
        $process.WaitForExit()
        if (-not $stdout.Wait(5000) -or -not $stderr.Wait(5000) -or $process.ExitCode -ne 0) { throw 'child_failed' }
        try { $response = $stdout.Result.Trim() | ConvertFrom-Json } catch { throw 'invalid_json' }
        if ([string]$response.status -cne $ExpectedStatus) { throw 'unexpected_status' }
        if ($RequireRestoreTested -and $response.restore_tested -ne $true) { throw 'restore_not_tested' }
        $response
    } finally {
        if ($null -ne $bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
        if ($null -ne $process) { $process.Dispose() }
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        $plain = $null; $json = $null
    }
}

function Test-ExternalRecoveryPath([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    if ($full.StartsWith('\\')) { return $true }
    $root = [IO.Path]::GetPathRoot($full)
    if (-not $root) { return $false }
    (New-Object IO.DriveInfo($root)).DriveType -eq [IO.DriveType]::Removable
}

function Read-Phrase([string]$Title,[bool]$Confirm) {
    $dialog = New-Object Windows.Forms.Form; $first = $null; $second = $null
    try {
        $dialog.Text = $Title; $dialog.ClientSize = New-Object Drawing.Size(450,210); $dialog.StartPosition = 'CenterParent'; $dialog.FormBorderStyle = 'FixedDialog'; $dialog.Font = New-Object Drawing.Font('Segoe UI',10)
        $label = New-Object Windows.Forms.Label; $label.Location = New-Object Drawing.Point(20,18); $label.Size = New-Object Drawing.Size(410,40); $label.Text = 'Escriba la frase institucional. No se guarda ni se muestra.'
        $first = New-Object Windows.Forms.TextBox; $first.Location = New-Object Drawing.Point(20,64); $first.Size = New-Object Drawing.Size(410,28); $first.UseSystemPasswordChar = $true; $first.MaxLength = 512
        $dialog.Controls.AddRange(@($label,$first))
        if ($Confirm) { $second = New-Object Windows.Forms.TextBox; $second.Location = New-Object Drawing.Point(20,104); $second.Size = New-Object Drawing.Size(410,28); $second.UseSystemPasswordChar = $true; $second.MaxLength = 512; $dialog.Controls.Add($second) }
        $ok = New-Object Windows.Forms.Button; $ok.Text = 'Continuar'; $ok.Location = New-Object Drawing.Point(236,158); $ok.DialogResult = [Windows.Forms.DialogResult]::OK
        $cancel = New-Object Windows.Forms.Button; $cancel.Text = 'Cancelar'; $cancel.Location = New-Object Drawing.Point(338,158); $cancel.DialogResult = [Windows.Forms.DialogResult]::Cancel
        $dialog.Controls.AddRange(@($ok,$cancel)); $dialog.AcceptButton = $ok; $dialog.CancelButton = $cancel
        if ($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { return $null }
        if ($first.Text.Length -lt 16 -or ($Confirm -and $first.Text -cne $second.Text)) { [Windows.Forms.MessageBox]::Show('La frase debe tener al menos 16 caracteres y ambas entradas deben coincidir.','S_Hospital') | Out-Null; return $null }
        $secure = New-Object Security.SecureString
        foreach ($char in $first.Text.ToCharArray()) { $secure.AppendChar($char) }
        $secure.MakeReadOnly(); $secure
    } finally { if ($null -ne $first) { $first.Clear() }; if ($null -ne $second) { $second.Clear() }; $dialog.Dispose() }
}

function Select-File([string]$Title,[string]$Filter) {
    $picker = New-Object Windows.Forms.OpenFileDialog
    try { $picker.Title = $Title; $picker.Filter = $Filter; if ($picker.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) { $picker.FileName } else { '' } } finally { $picker.Dispose() }
}

function Read-Reason {
    $dialog = New-Object Windows.Forms.Form
    try {
        $dialog.Text = 'Confirmar recuperación'; $dialog.ClientSize = New-Object Drawing.Size(470,210); $dialog.StartPosition = 'CenterParent'; $dialog.FormBorderStyle = 'FixedDialog'; $dialog.Font = New-Object Drawing.Font('Segoe UI',10)
        $label = New-Object Windows.Forms.Label; $label.Text = 'Explique brevemente por qué necesita recuperar este respaldo.'; $label.Location = New-Object Drawing.Point(20,20); $label.Size = New-Object Drawing.Size(430,38)
        $reason = New-Object Windows.Forms.TextBox; $reason.Location = New-Object Drawing.Point(20,62); $reason.Size = New-Object Drawing.Size(430,65); $reason.Multiline = $true; $reason.MaxLength = 240
        $ok = New-Object Windows.Forms.Button; $ok.Text = 'Recuperar ahora'; $ok.Location = New-Object Drawing.Point(235,154); $ok.DialogResult = [Windows.Forms.DialogResult]::OK
        $cancel = New-Object Windows.Forms.Button; $cancel.Text = 'Cancelar'; $cancel.Location = New-Object Drawing.Point(357,154); $cancel.DialogResult = [Windows.Forms.DialogResult]::Cancel
        $dialog.Controls.AddRange(@($label,$reason,$ok,$cancel)); $dialog.AcceptButton = $ok; $dialog.CancelButton = $cancel
        if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) { $reason.Text.Trim() } else { '' }
    } finally { $dialog.Dispose() }
}

function Set-Busy([bool]$Busy,[string]$Message = '') {
    $script:WizardBusy = $Busy
    $canOperate = (-not $Busy) -and (-not $script:UnsafeChildState)
    $exportButton.Enabled = $canOperate; $restoreButton.Enabled = $canOperate; $close.Enabled = -not $Busy; $form.UseWaitCursor = $Busy; $statusLabel.Text = $Message
    [Windows.Forms.Application]::DoEvents()
}

function Export-Kit {
    $save = New-Object Windows.Forms.SaveFileDialog
    try {
        $save.Title = 'Guardar kit institucional en USB o ubicación de red'; $save.Filter = 'Kit de recuperación S_Hospital (*.shrk)|*.shrk'; $save.FileName = 'S_Hospital-kit-recuperacion.shrk'
        if ($save.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { return }
        if (-not (Test-ExternalRecoveryPath $save.FileName) -or (Test-Path -LiteralPath $save.FileName)) { throw 'invalid_destination' }
        $phrase = Read-Phrase 'Crear kit institucional' $true
        if ($null -eq $phrase) { return }
        try {
            Set-Busy $true 'Creando el kit protegido…'
            $answer = Invoke-ProtectedProcess $php @('-c',$phpIni,$artisan,'hospital:export-backup-recovery-kit',$save.FileName,'--json') $phrase @{} 'success' -TimeoutSeconds 300 -WorkingDirectory $backendRoot
            if (-not $answer.key_identifier) { throw 'invalid_result' }
        } finally { $phrase.Dispose() }
        $statusLabel.Text = 'El kit quedó guardado correctamente.'
        [Windows.Forms.MessageBox]::Show('Kit guardado. Conserve la frase institucional en un lugar distinto del archivo.','S_Hospital') | Out-Null
    } finally { $save.Dispose(); Set-Busy $false $statusLabel.Text }
}

function Restore-Hospital {
    $phrase = $null
    try {
        $backup = Select-File 'Seleccionar respaldo cifrado' 'Respaldo S_Hospital (*.sql.gz.enc)|*.sql.gz.enc'
        if (-not $backup) { return }
        $choice = [Windows.Forms.MessageBox]::Show('¿El respaldo proviene de otra computadora o necesita usar un kit institucional? Seleccione Sí para elegir el kit. Seleccione No para usar la protección de esta computadora.','Protección del respaldo',[Windows.Forms.MessageBoxButtons]::YesNoCancel,[Windows.Forms.MessageBoxIcon]::Question)
        if ($choice -eq [Windows.Forms.DialogResult]::Cancel) { return }
        $kit = ''
        if ($choice -eq [Windows.Forms.DialogResult]::Yes) { $kit = Select-File 'Seleccionar kit institucional' 'Kit de recuperación S_Hospital (*.shrk)|*.shrk'; if (-not $kit) { return }; $phrase = Read-Phrase 'Abrir kit institucional' $false; if ($null -eq $phrase) { return } }
        $runId = (Get-Date -Format 'yyyyMMddHHmmss') + '_' + [guid]::NewGuid().ToString('N').Substring(0,8)
        $sha = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant()
        $common = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$restoreScript,'-Package',$backup,'-ExpectedSha256',$sha,'-InstallRoot',$InstallRoot,'-DataRoot',$DataRoot,'-Json')
        if ($kit) { $common += @('-RecoveryKit',$kit) }
        Set-Busy $true 'Comprobando el respaldo de forma segura…'
        $null = Invoke-ProtectedProcess $windowsPowerShell (@($common)+@('-ValidationDatabase',('s_hospital_validation_'+$runId),'-Mode','Validate')) $phrase @{} 'validated' -RequireRestoreTested -WorkingDirectory $resolvedCurrent
        Set-Busy $false 'El respaldo fue comprobado y se puede recuperar.'
        $decision = [Windows.Forms.MessageBox]::Show('El respaldo está completo y funciona. ¿Desea usarlo ahora? Antes de cambiar los datos, S_Hospital guardará una copia de seguridad y conservará la base actual. La aplicación no estará disponible durante unos minutos.','Confirmar recuperación',[Windows.Forms.MessageBoxButtons]::YesNo,[Windows.Forms.MessageBoxIcon]::Warning)
        if ($decision -ne [Windows.Forms.DialogResult]::Yes) { return }
        $reason = Read-Reason; if (-not $reason) { return }
        Set-Busy $true 'Recuperando los datos. No cierre esta ventana…'
        $control = @{ confirmation='RESTAURAR'; reason=$reason }
        $answer = Invoke-ProtectedProcess $windowsPowerShell (@($common)+@('-ValidationDatabase',('s_hospital_restore_'+$runId),'-Mode','Replace')) $phrase $control 'restored' -RequireRestoreTested -WorkingDirectory $resolvedCurrent
        if ($answer.previous_database_preserved -ne $true -or $answer.preventive_backup_verified -ne $true) { throw 'invalid_result' }
        $statusLabel.Text = 'La recuperación terminó correctamente.'
        [Windows.Forms.MessageBox]::Show('Los datos fueron recuperados y S_Hospital está listo para usarse. La base anterior y el respaldo preventivo quedaron conservados.','S_Hospital') | Out-Null
    } finally { if ($null -ne $phrase) { $phrase.Dispose() }; Set-Busy $false $statusLabel.Text }
}

$form = New-Object Windows.Forms.Form; $form.Text = 'Respaldos y recuperación de S_Hospital'; $form.ClientSize = New-Object Drawing.Size(590,330); $form.StartPosition = 'CenterScreen'; $form.FormBorderStyle = 'FixedDialog'; $form.Font = New-Object Drawing.Font('Segoe UI',10); $form.MaximizeBox = $false
$script:WizardBusy = $false
$heading = New-Object Windows.Forms.Label; $heading.Location = New-Object Drawing.Point(30,24); $heading.AutoSize = $true; $heading.Font = New-Object Drawing.Font('Segoe UI Semibold',16); $heading.Text = 'Respaldos y recuperación'
$description = New-Object Windows.Forms.Label; $description.Location = New-Object Drawing.Point(32,66); $description.Size = New-Object Drawing.Size(526,58); $description.Text = 'Guarde un kit fuera de esta computadora para poder abrir respaldos en caso de pérdida o daño. La frase debe conservarse por separado.'
$exportButton = New-Object Windows.Forms.Button; $exportButton.Location = New-Object Drawing.Point(32,145); $exportButton.Size = New-Object Drawing.Size(250,58); $exportButton.Text = 'Guardar kit en USB o red'
$restoreButton = New-Object Windows.Forms.Button; $restoreButton.Location = New-Object Drawing.Point(308,145); $restoreButton.Size = New-Object Drawing.Size(250,58); $restoreButton.Text = 'Comprobar y recuperar respaldo'
$statusLabel = New-Object Windows.Forms.Label; $statusLabel.Location = New-Object Drawing.Point(32,225); $statusLabel.Size = New-Object Drawing.Size(526,52); $statusLabel.ForeColor = [Drawing.Color]::FromArgb(31,78,121); $statusLabel.Text = 'Seleccione una opción para comenzar.'
$close = New-Object Windows.Forms.Button; $close.Location = New-Object Drawing.Point(458,280); $close.Size = New-Object Drawing.Size(100,32); $close.Text = 'Cerrar'; $close.DialogResult = [Windows.Forms.DialogResult]::Cancel; $form.CancelButton = $close
$form.Add_FormClosing({ param($sender,$eventArgs) if ($script:WizardBusy) { $eventArgs.Cancel = $true } })
$exportButton.Add_Click({ if (-not $exportButton.Enabled) { return }; try { Export-Kit } catch { $statusLabel.Text='No se pudo guardar el kit.'; [Windows.Forms.MessageBox]::Show('No se pudo guardar el kit. Revise que la unidad esté conectada, elija un nombre nuevo e intente otra vez.','S_Hospital',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error)|Out-Null } })
$restoreButton.Add_Click({ if (-not $restoreButton.Enabled) { return }; try { Restore-Hospital } catch { $statusLabel.Text='No se pudo completar la recuperación.'; [Windows.Forms.MessageBox]::Show('No se pudo completar la recuperación. Cierre esta ventana y solicite apoyo técnico antes de volver a intentarlo.','S_Hospital',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error)|Out-Null } })
$form.Controls.AddRange(@($heading,$description,$exportButton,$restoreButton,$statusLabel,$close))
try { [void]$form.ShowDialog() } finally { $form.Dispose(); if ($mutexHeld) { $recoveryMutex.ReleaseMutex() }; $recoveryMutex.Dispose() }
exit $(if ($script:UnsafeChildState) { 23 } else { 0 })
