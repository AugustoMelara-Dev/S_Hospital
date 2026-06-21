# install_hospital_os.ps1
# DEPRECATED in v1.0.0. Use deploy_hospital_lan.ps1 instead.
# This WPF-based wizard is kept for backwards compatibility with
# operators who already have a saved shortcut to it, but no new
# code paths reference it. The recommended installer is:
#
#   powershell -ExecutionPolicy Bypass -File scripts\deploy_hospital_lan.ps1
#
# See docs/OFFLINE_LAN_INSTALL.md and scripts/deploy_hospital_lan.ps1
# for the supported flow.

[CmdletBinding()]
param (
    [switch]$CliOnly,
    [switch]$LegacyUnsupported
)

# Force TLS 1.2/1.3 for any system calls if they occur, though we operate strictly offline
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# v1.0.0 deprecation notice. The supported installer is
# deploy_hospital_lan.ps1; this script is kept only for operators
# who already have a shortcut to it. We print a clear warning to
# the console so the operator is not surprised.
Write-Host ""
Write-Host "========================================================================" -ForegroundColor Yellow
Write-Host "  DEPRECATION NOTICE" -ForegroundColor Yellow
Write-Host "  install_hospital_os.ps1 is deprecated as of v1.0.0." -ForegroundColor Yellow
Write-Host "  The supported installer is deploy_hospital_lan.ps1." -ForegroundColor Yellow
Write-Host "  This legacy wizard is blocked by default for hospital deployments." -ForegroundColor Yellow
Write-Host "  See scripts/deploy_hospital_lan.ps1 for the new flow." -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Yellow
Write-Host ""

if (-not $LegacyUnsupported) {
    Write-Error "Instalador legacy bloqueado. Use scripts\deploy_hospital_lan.ps1 o agregue -LegacyUnsupported solo bajo instruccion tecnica documentada."
    exit 1
}

# Determine workspace root
$scriptPath = $MyInvocation.MyCommand.Path
$scriptsDir = Split-Path $scriptPath -Parent
$workspaceRoot = Split-Path $scriptsDir -Parent
$backendRoot = Join-Path $workspaceRoot "backend"
$ProductName = "Sistema de Caja Hospitalaria"
$InstitutionName = "Hospital San Isidro"
$BackupTaskName = "SistemaCajaHospitalaria-DailyBackup"
$LegacyBackupTaskName = ("S" + "_Hospital_Daily_Backup")
$FirewallRuleName = "Hospital San Isidro Caja LAN Port 8000"
$LegacyFirewallRuleName = ("S" + "_Hospital Server LAN Port 8000")

function Get-InstallerVersion {
    try {
        $git = Get-Command git -ErrorAction SilentlyContinue
        if ($git) {
            $shortHash = & git -C $workspaceRoot rev-parse --short HEAD 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($shortHash)) {
                return "git-$($shortHash.Trim())"
            }
        }
    } catch {
        # Version is diagnostic metadata only; installation must continue.
    }

    return "manual-$(Get-Date -Format 'yyyyMMdd')"
}

$installedVersion = Get-InstallerVersion
$runSetupCliAfterDefinition = $false

# 1. Detect active LAN IP
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*"
} | Select-Object -ExpandProperty IPAddress

# Use an empty placeholder so the operator MUST select a real IP
# from the candidates or enter one manually. A 192.168.1.100
# placeholder used to leak here and would silently become the
# install target if no candidate was found.
$detectedIp = ""
if ($ips.Count -gt 0) {
    $detectedIp = $ips[0]
}

# 2. Detect PHP
$phpPath = "C:\xampp\php\php.exe"
$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if ($phpCmd) {
    $phpPath = $phpCmd.Source
} elseif (Test-Path "C:\xampp\php\php.exe") {
    $phpPath = "C:\xampp\php\php.exe"
}

# Determine GUI support
$useGui = $true
if ($CliOnly -or [System.Environment]::UserInteractive -eq $false) {
    $useGui = $false
} else {
    try {
        Add-Type -AssemblyName PresentationFramework
        Add-Type -AssemblyName PresentationCore
        Add-Type -AssemblyName WindowsBase
    } catch {
        $useGui = $false
    }
}

# Helper: Update env variables in .env file
function Update-DotEnv {
    param (
        [string]$Path,
        [hashtable]$Variables
    )
    if (-not (Test-Path $Path)) {
        if (Test-Path "$Path.example") {
            Copy-Item "$Path.example" $Path
        } else {
            New-Item $Path -ItemType File | Out-Null
        }
    }
    
    $lines = Get-Content $Path
    $newLines = @()
    $processedKeys = @()

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
            $newLines += $line
            continue
        }

        $parts = $trimmed.Split("=", 2)
        $key = $parts[0].Trim()
        
        if ($Variables.ContainsKey($key)) {
            $val = $Variables[$key]
            # Handle quotes if needed
            if ($val -match "\s" -and -not $val.StartsWith('"')) {
                $val = """$val"""
            }
            $newLines += "$key=$val"
            $processedKeys += $key
        } else {
            $newLines += $line
        }
    }

    # Append any variables that were not in the template
    foreach ($key in $Variables.Keys) {
        if ($processedKeys -notcontains $key) {
            $val = $Variables[$key]
            if ($val -match "\s" -and -not $val.StartsWith('"')) {
                $val = """$val"""
            }
            $newLines += "$key=$val"
        }
    }

    # PowerShell 5.1 defaults Set-Content to UTF-16 LE with BOM, which
    # breaks 'docker compose --env-file' and Laravel's env() parser.
    # Always write ASCII so the file is portable across PS 5.1, PS 7,
    # docker compose, and Laravel's Dotenv parser.
    Set-Content -LiteralPath $Path -Value $newLines -Encoding ASCII
}

function Test-DatabaseName {
    param([string]$Name)

    return -not [string]::IsNullOrWhiteSpace($Name) -and $Name -match '^[A-Za-z][A-Za-z0-9_]{0,63}$'
}

function Invoke-CreateMysqlDatabase {
    param (
        [string]$Php,
        [string]$Host,
        [string]$Port,
        [string]$Database,
        [string]$Username,
        [string]$Password
    )

    if (-not (Test-DatabaseName $Database)) {
        return "INVALID_DATABASE_NAME"
    }

    $env:HOSPITAL_INSTALL_DB_HOST = $Host
    $env:HOSPITAL_INSTALL_DB_PORT = $Port
    $env:HOSPITAL_INSTALL_DB_NAME = $Database
    $env:HOSPITAL_INSTALL_DB_USER = $Username
    $env:HOSPITAL_INSTALL_DB_PASS = $Password

    $createDbCode = @'
$host = getenv("HOSPITAL_INSTALL_DB_HOST");
$port = getenv("HOSPITAL_INSTALL_DB_PORT");
$db = getenv("HOSPITAL_INSTALL_DB_NAME");
$user = getenv("HOSPITAL_INSTALL_DB_USER");
$pass = getenv("HOSPITAL_INSTALL_DB_PASS");
try {
    if (!preg_match('/^[A-Za-z][A-Za-z0-9_]{0,63}$/', $db)) {
        echo "INVALID_DATABASE_NAME";
        exit;
    }

    $p = new PDO("mysql:host=$host;port=$port", $user, $pass);
    $p->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "CREATED";
} catch(Exception $e) {
    echo $e->getMessage();
}
'@

    try {
        return & $Php -r $createDbCode
    }
    finally {
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_HOST -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_PORT -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_NAME -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_USER -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_PASS -ErrorAction SilentlyContinue } catch { }
    }
}

function Invoke-TestMysqlConnection {
    param (
        [string]$Php,
        [string]$Host,
        [string]$Port,
        [string]$Username,
        [string]$Password
    )

    $env:HOSPITAL_INSTALL_DB_HOST = $Host
    $env:HOSPITAL_INSTALL_DB_PORT = $Port
    $env:HOSPITAL_INSTALL_DB_USER = $Username
    $env:HOSPITAL_INSTALL_DB_PASS = $Password

    $testDbCode = @'
$host = getenv("HOSPITAL_INSTALL_DB_HOST");
$port = getenv("HOSPITAL_INSTALL_DB_PORT");
$user = getenv("HOSPITAL_INSTALL_DB_USER");
$pass = getenv("HOSPITAL_INSTALL_DB_PASS");
try {
    new PDO("mysql:host=$host;port=$port", $user, $pass);
    echo "OK";
} catch (Exception $e) {
    echo $e->getMessage();
}
'@

    try {
        return & $Php -r $testDbCode
    }
    finally {
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_HOST -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_PORT -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_USER -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item Env:\HOSPITAL_INSTALL_DB_PASS -ErrorAction SilentlyContinue } catch { }
    }
}

function Install-BackupAutomation {
    param (
        [string]$PhpPath,
        [string]$DailyBackupTime
    )

    $backupTasksScript = Join-Path $scriptsDir "install_backup_tasks_windows.ps1"
    if (-not (Test-Path -LiteralPath $backupTasksScript)) {
        throw "No se encontro el instalador de tareas de respaldo en scripts\install_backup_tasks_windows.ps1."
    }

    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupTasksScript `
        -ProjectRoot $workspaceRoot `
        -PhpPath $PhpPath `
        -DailyBackupTime $DailyBackupTime `
        -UpdateExisting 2>&1 | ForEach-Object { $_.ToString() }

    if ($LASTEXITCODE -ne 0) {
        throw "No se pudieron registrar las tareas de respaldo. Ejecute PowerShell como Administrador y vuelva a intentar. Detalle: $($output -join ' ')"
    }

    return $output
}

function Invoke-ProductionDatabaseSetup {
    param (
        [string]$PhpPath,
        [string]$BackendRoot
    )

    $currentDir = Get-Location
    try {
        Set-Location $BackendRoot

        & $PhpPath artisan config:clear | Out-Null

        $commands = @(
            @("migrate", "--force", "--no-interaction"),
            @("db:seed", "--class=RolesAndPermissionsSeeder", "--force", "--no-interaction"),
            @("db:seed", "--class=ServiceCatalogSeeder", "--force", "--no-interaction")
        )

        $allOutput = @()
        foreach ($artisanArgs in $commands) {
            $output = & $PhpPath artisan @artisanArgs 2>&1
            $allOutput += $output
            if ($LASTEXITCODE -ne 0) {
                throw "Fallo comando: php artisan $($artisanArgs -join ' '). $($output -join [Environment]::NewLine)"
            }
        }

        return ($allOutput -join [Environment]::NewLine)
    } finally {
        Set-Location $currentDir
    }
}

if ($useGui) {
    # ----------------------------------------------------
    # WPF GUI Wizard Implementation
    # ----------------------------------------------------
    [xml]$xaml = @"
    <Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
            xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
            Title="Sistema de Caja Hospitalaria - Instalador del Servidor LAN (Offline)" Height="520" Width="620"
            WindowStartupLocation="CenterScreen" Background="#F8FAFC" ResizeMode="NoResize">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="70"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="60"/>
            </Grid.RowDefinitions>
            
            <!-- Header bar -->
            <Border Grid.Row="0" Background="#0F172A" Padding="20,10">
                <Grid>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="*"/>
                        <ColumnDefinition Width="Auto"/>
                    </Grid.ColumnDefinitions>
                    <StackPanel Grid.Column="0">
                        <TextBlock Text="Sistema de Caja Hospitalaria" Foreground="#0D9488" FontSize="18" FontWeight="Bold"/>
                        <TextBlock Text="Asistente de Configuracion para Red Local Offline" Foreground="#94A3B8" FontSize="12"/>
                    </StackPanel>
                    <TextBlock Grid.Column="1" Text="$installedVersion" Foreground="#475569" VerticalAlignment="Center" FontSize="14" FontWeight="Bold"/>
                </Grid>
            </Border>
            <Border Grid.Row="0" Height="4" Background="#0D9488" VerticalAlignment="Bottom"/>

            <!-- Main Content Area -->
            <Grid Grid.Row="1" Margin="25,20">
                <!-- STEP 1: Welcome & LAN -->
                <StackPanel Name="PanelStep1" Visibility="Visible">
                    <TextBlock Text="Paso 1: Detectar y Confirmar IP LAN de Red Local" FontSize="14" FontWeight="Bold" Foreground="#0F172A" Margin="0,0,0,10"/>
                    <TextBlock Text="Este script configura el servidor web y la base de datos MySQL local para ejecutarse sin internet en su red de area local (LAN)." TextWrapping="Wrap" Margin="0,0,0,15" Foreground="#475569"/>
                    
                    <Label Content="IP Activa Detectada en la Computadora Servidor:" FontWeight="SemiBold" Foreground="#334155" Margin="0,0,0,5"/>
                    <TextBox Name="TxtLanIp" Text="$detectedIp" Padding="8" FontSize="14" BorderBrush="#CBD5E1" BorderThickness="1" Margin="0,0,0,15"/>
                    
                    <Border Background="#F0FDFA" BorderBrush="#CCFBF1" BorderThickness="1" Padding="12" CornerRadius="6">
                        <TextBlock Text="Nota: Las computadoras cliente (recepcion, consultorios, caja) accederan al sistema usando esta direccion IP. Asegurese de que este servidor tenga configurada una direccion IP estatica en su router LAN para evitar que cambie al reiniciar." FontSize="11" Foreground="#0F766E" TextWrapping="Wrap"/>
                    </Border>
                </StackPanel>

                <!-- STEP 2: PHP Environment -->
                <StackPanel Name="PanelStep2" Visibility="Collapsed">
                    <TextBlock Text="Paso 2: Localizar Entorno PHP de Servidor" FontSize="14" FontWeight="Bold" Foreground="#0F172A" Margin="0,0,0,10"/>
                    <TextBlock Text="El sistema requiere un motor de PHP 8.2+ para procesar caja, facturacion y reportes." TextWrapping="Wrap" Margin="0,0,0,15" Foreground="#475569"/>
                    
                    <Label Content="Ruta al Ejecutable de PHP (php.exe):" FontWeight="SemiBold" Foreground="#334155" Margin="0,0,0,5"/>
                    <TextBox Name="TxtPhpPath" Text="$phpPath" Padding="8" FontSize="13" BorderBrush="#CBD5E1" BorderThickness="1" Margin="0,0,0,10"/>
                    
                    <Button Name="BtnTestPhp" Content="Validar php.exe local" Padding="10,6" Background="#E2E8F0" Foreground="#0F172A" FontWeight="Bold" BorderThickness="0" HorizontalAlignment="Left" Margin="0,0,0,10"/>
                    <TextBlock Name="TxtPhpResult" Text="Pendiente de verificacion" FontSize="11" FontWeight="Bold" Foreground="#64748B" TextWrapping="Wrap"/>
                </StackPanel>

                <!-- STEP 3: MySQL Setup -->
                <StackPanel Name="PanelStep3" Visibility="Collapsed">
                    <TextBlock Text="Paso 3: Configurar Credenciales de Base de Datos MySQL/MariaDB" FontSize="14" FontWeight="Bold" Foreground="#0F172A" Margin="0,0,0,10"/>
                    
                    <Grid Margin="0,0,0,15">
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="150"/>
                            <ColumnDefinition Width="*"/>
                        </Grid.ColumnDefinitions>
                        <Grid.RowDefinitions>
                            <RowDefinition Height="34"/>
                            <RowDefinition Height="34"/>
                            <RowDefinition Height="34"/>
                            <RowDefinition Height="34"/>
                            <RowDefinition Height="34"/>
                        </Grid.RowDefinitions>
                        
                        <Label Grid.Row="0" Grid.Column="0" Content="Host MySQL/MariaDB:" VerticalAlignment="Center" Foreground="#334155"/>
                        <TextBox Grid.Row="0" Grid.Column="1" Name="TxtDbHost" Text="127.0.0.1" Padding="4" VerticalAlignment="Center"/>

                        <Label Grid.Row="1" Grid.Column="0" Content="Puerto:" VerticalAlignment="Center" Foreground="#334155"/>
                        <TextBox Grid.Row="1" Grid.Column="1" Name="TxtDbPort" Text="3306" Padding="4" VerticalAlignment="Center"/>

                        <Label Grid.Row="2" Grid.Column="0" Content="Base de Datos:" VerticalAlignment="Center" Foreground="#334155"/>
                        <TextBox Grid.Row="2" Grid.Column="1" Name="TxtDbName" Text="hospital_billing" Padding="4" VerticalAlignment="Center"/>

                        <Label Grid.Row="3" Grid.Column="0" Content="Usuario MySQL:" VerticalAlignment="Center" Foreground="#334155"/>
                        <TextBox Grid.Row="3" Grid.Column="1" Name="TxtDbUser" Text="root" Padding="4" VerticalAlignment="Center"/>

                        <Label Grid.Row="4" Grid.Column="0" Content="Contrasena:" VerticalAlignment="Center" Foreground="#334155"/>
                        <PasswordBox Grid.Row="4" Grid.Column="1" Name="TxtDbPass" Padding="4" VerticalAlignment="Center"/>
                    </Grid>
                    
                    <StackPanel Orientation="Horizontal" Margin="0,0,0,10">
                        <Button Name="BtnTestDb" Content="Probar Conexion" Padding="10,5" Background="#E2E8F0" Foreground="#0F172A" FontWeight="Bold" BorderThickness="0" Margin="0,0,10,0"/>
                        <Button Name="BtnMigrateDb" Content="Ejecutar migraciones seguras" Padding="12,5" Background="#0D9488" Foreground="White" FontWeight="Bold" BorderThickness="0"/>
                    </StackPanel>
                    <TextBlock Name="TxtDbResult" Text="Pendiente de conexion" FontSize="11" FontWeight="Bold" Foreground="#64748B" TextWrapping="Wrap"/>
                </StackPanel>

                <!-- STEP 4: Scheduler Backups -->
                <StackPanel Name="PanelStep4" Visibility="Collapsed">
                    <TextBlock Text="Paso 4: Respaldos Locales y Cola de Trabajos" FontSize="14" FontWeight="Bold" Foreground="#0F172A" Margin="0,0,0,10"/>
                    <TextBlock Text="El sistema necesita un worker continuo para procesar respaldos solicitados desde la pantalla Respaldos, y una tarea diaria para crear copia local automatica." TextWrapping="Wrap" Margin="0,0,0,15" Foreground="#475569"/>
                    
                    <CheckBox Name="ChkEnableBackup" Content="Registrar worker continuo y respaldo diario automatico" IsChecked="True" FontSize="13" FontWeight="SemiBold" Foreground="#0F172A" Margin="0,0,0,15"/>
                    
                    <Label Content="Hora de Ejecucion Diaria (Ejemplo: 23:00):" Foreground="#334155" Margin="0,0,0,5"/>
                    <TextBox Name="TxtBackupTime" Text="23:00" Padding="8" Width="120" HorizontalAlignment="Left" FontSize="14" BorderBrush="#CBD5E1" BorderThickness="1" Margin="0,0,0,10"/>
                    <TextBlock Text="Nota: Las tareas se ejecutan en segundo plano sin interrumpir a los cajeros. Requieren PowerShell como Administrador para registrarse." FontSize="11" Foreground="#0D9488"/>
                </StackPanel>

                <!-- STEP 5: Firewall & LAN URLs -->
                <StackPanel Name="PanelStep5" Visibility="Collapsed">
                    <TextBlock Text="Paso 5: Completar Instalacion de Red LAN" FontSize="14" FontWeight="Bold" Foreground="#0F172A" Margin="0,0,0,10"/>
                    <TextBlock Text="El Sistema de Caja Hospitalaria esta configurado. Se puede habilitar la apertura de puerto en el Firewall de Windows para admitir conexiones entrantes en su LAN." TextWrapping="Wrap" Margin="0,0,0,15" Foreground="#475569"/>
                    
                    <CheckBox Name="ChkOpenFirewall" Content="Abrir Puerto 8000 en el Firewall de Windows para clientes LAN" IsChecked="True" FontSize="13" FontWeight="SemiBold" Foreground="#0F172A" Margin="0,0,0,15"/>
                    
                    <Border Background="#F1F5F9" BorderBrush="#E2E8F0" BorderThickness="1" Padding="15" CornerRadius="8">
                        <StackPanel>
                            <TextBlock Text="Direccion Web LAN para Clientes:" FontWeight="Bold" Foreground="#0F172A" FontSize="12"/>
                            <TextBlock Name="TxtLanUrl" Text="http://192.168.1.15:8000" FontSize="16" FontWeight="Bold" Foreground="#0D9488" Margin="0,6,0,0"/>
                            <TextBlock Text="Copie y guarde este enlace. Desde cualquier tablet, PC o laptop en la misma red local LAN, ingrese esta URL en Chrome/Edge para facturar." FontSize="11" Foreground="#64748B" TextWrapping="Wrap" Margin="0,8,0,0"/>
                        </StackPanel>
                    </Border>
                </StackPanel>
            </Grid>

            <!-- Bottom Navigation Bar -->
            <Border Grid.Row="2" Background="#F1F5F9" BorderBrush="#E2E8F0" BorderThickness="0,1,0,0" Padding="20,10">
                <Grid>
                    <Button Name="BtnBack" Content="&lt; Atras" HorizontalAlignment="Left" Width="100" IsEnabled="False" Padding="6" Background="#E2E8F0" BorderThickness="0" FontWeight="Bold"/>
                    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
                        <Button Name="BtnNext" Content="Siguiente &gt;" Width="110" Padding="6" Margin="0,0,10,0" Background="#0F172A" Foreground="White" BorderThickness="0" FontWeight="Bold"/>
                        <Button Name="BtnCancel" Content="Cancelar" Width="100" Padding="6" Background="#E2E8F0" BorderThickness="0" FontWeight="Bold"/>
                    </StackPanel>
                </Grid>
            </Border>
        </Grid>
    </Window>
"@

    # Load WPF controls
    $reader = New-Object System.Xml.XmlNodeReader $xaml
    $window = [Windows.Markup.XamlReader]::Load($reader)

    # Map buttons and panels
    $BtnBack = $window.FindName("BtnBack")
    $BtnNext = $window.FindName("BtnNext")
    $BtnCancel = $window.FindName("BtnCancel")
    
    $PanelStep1 = $window.FindName("PanelStep1")
    $PanelStep2 = $window.FindName("PanelStep2")
    $PanelStep3 = $window.FindName("PanelStep3")
    $PanelStep4 = $window.FindName("PanelStep4")
    $PanelStep5 = $window.FindName("PanelStep5")

    $TxtLanIp = $window.FindName("TxtLanIp")
    $TxtPhpPath = $window.FindName("TxtPhpPath")
    $BtnTestPhp = $window.FindName("BtnTestPhp")
    $TxtPhpResult = $window.FindName("TxtPhpResult")

    $TxtDbHost = $window.FindName("TxtDbHost")
    $TxtDbPort = $window.FindName("TxtDbPort")
    $TxtDbName = $window.FindName("TxtDbName")
    $TxtDbUser = $window.FindName("TxtDbUser")
    $TxtDbPass = $window.FindName("TxtDbPass")
    $BtnTestDb = $window.FindName("BtnTestDb")
    $BtnMigrateDb = $window.FindName("BtnMigrateDb")
    $TxtDbResult = $window.FindName("TxtDbResult")

    $ChkEnableBackup = $window.FindName("ChkEnableBackup")
    $TxtBackupTime = $window.FindName("TxtBackupTime")

    $ChkOpenFirewall = $window.FindName("ChkOpenFirewall")
    $TxtLanUrl = $window.FindName("TxtLanUrl")

    $currentStep = 1

    # Navigation logic
    $updateUI = {
        $PanelStep1.Visibility = [System.Windows.Visibility]::Collapsed
        $PanelStep2.Visibility = [System.Windows.Visibility]::Collapsed
        $PanelStep3.Visibility = [System.Windows.Visibility]::Collapsed
        $PanelStep4.Visibility = [System.Windows.Visibility]::Collapsed
        $PanelStep5.Visibility = [System.Windows.Visibility]::Collapsed

        if ($currentStep -eq 1) {
            $PanelStep1.Visibility = [System.Windows.Visibility]::Visible
            $BtnBack.IsEnabled = $false
            $BtnNext.Content = "Siguiente >"
        } elseif ($currentStep -eq 2) {
            $PanelStep2.Visibility = [System.Windows.Visibility]::Visible
            $BtnBack.IsEnabled = $true
            $BtnNext.Content = "Siguiente >"
        } elseif ($currentStep -eq 3) {
            $PanelStep3.Visibility = [System.Windows.Visibility]::Visible
            $BtnBack.IsEnabled = $true
            $BtnNext.Content = "Siguiente >"
        } elseif ($currentStep -eq 4) {
            $PanelStep4.Visibility = [System.Windows.Visibility]::Visible
            $BtnBack.IsEnabled = $true
            $BtnNext.Content = "Siguiente >"
        } elseif ($currentStep -eq 5) {
            $PanelStep5.Visibility = [System.Windows.Visibility]::Visible
            $BtnBack.IsEnabled = $true
            $BtnNext.Content = "Terminar"
            $TxtLanUrl.Text = "http://$($TxtLanIp.Text):8000"
        }
    }

    $BtnBack.Add_Click({
        if ($currentStep -gt 1) {
            $currentStep--
            & $updateUI
        }
    })

    $BtnNext.Add_Click({
        if ($currentStep -lt 5) {
            # Basic validation
            if ($currentStep -eq 1 -and [string]::IsNullOrWhiteSpace($TxtLanIp.Text)) {
                [System.Windows.MessageBox]::Show("Ingrese una direccion IP LAN valida.", "Error", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
                return
            }
            if ($currentStep -eq 2 -and [string]::IsNullOrWhiteSpace($TxtPhpPath.Text)) {
                [System.Windows.MessageBox]::Show("Ingrese la ruta del ejecutable de PHP.", "Error", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
                return
            }
            $currentStep++
            & $updateUI
        } else {
            # Finalize setup
            try {
                $dbPassVal = $TxtDbPass.Password
                # Update backend/.env file
                $vars = @{
                    "APP_VERSION" = $installedVersion
                    "APP_URL" = "http://$($TxtLanIp.Text):8000"
                    "SANCTUM_STATEFUL_DOMAINS" = "localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,127.0.0.1:5173,$($TxtLanIp.Text),$($TxtLanIp.Text):8000,$($TxtLanIp.Text):5173,::1"
                    "CORS_ALLOWED_ORIGINS" = "http://localhost:5173,http://127.0.0.1:5173,http://$($TxtLanIp.Text):5173,http://$($TxtLanIp.Text):8000"
                    "DB_HOST" = $TxtDbHost.Text
                    "DB_PORT" = $TxtDbPort.Text
                    "DB_DATABASE" = $TxtDbName.Text
                    "DB_USERNAME" = $TxtDbUser.Text
                    "DB_PASSWORD" = $dbPassVal
                }
                
                $envFile = Join-Path $backendRoot ".env"
                Update-DotEnv -Path $envFile -Variables $vars

                # Task Scheduler Backup setup
                if ($ChkEnableBackup.IsChecked) {
                    $bTime = $TxtBackupTime.Text
                    Install-BackupAutomation -PhpPath $TxtPhpPath.Text -DailyBackupTime $bTime | Out-Null
                }

                # Firewall port configuration
                if ($ChkOpenFirewall.IsChecked) {
                    netsh advfirewall firewall delete rule name="Sistema de Caja Hospitalaria LAN Port 8000" 2>$null
                    netsh advfirewall firewall add rule name="Sistema de Caja Hospitalaria LAN Port 8000" dir=in action=allow protocol=TCP localport=8000 | Out-Null
                }

                [System.Windows.MessageBox]::Show("Instalacion del Sistema de Caja Hospitalaria finalizada.`n`nEl servidor local LAN esta activo en: http://$($TxtLanIp.Text):8000", "Exito", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Information)
                $window.Close()
            } catch {
                [System.Windows.MessageBox]::Show("Ocurrio un error al guardar la configuracion: $_", "Error", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
            }
        }
    })

    # Validate php.exe
    $BtnTestPhp.Add_Click({
        $path = $TxtPhpPath.Text
        if (-not (Test-Path $path)) {
            $TxtPhpResult.Text = "Error: El archivo php.exe no existe en esa ruta."
            $TxtPhpResult.Foreground = [System.Windows.Media.Brushes]::Red
            return
        }
        
        try {
            $ver = & $path -v
            $firstLine = ($ver -split "`n")[0]
            $TxtPhpResult.Text = "Exito: $firstLine"
            $TxtPhpResult.Foreground = [System.Windows.Media.Brushes]::Green
        } catch {
            $TxtPhpResult.Text = "Error al intentar ejecutar: $_"
            $TxtPhpResult.Foreground = [System.Windows.Media.Brushes]::Red
        }
    })

    # Test Database connection
    $BtnTestDb.Add_Click({
        $host = $TxtDbHost.Text
        $port = $TxtDbPort.Text
        $db = $TxtDbName.Text
        $user = $TxtDbUser.Text
        $pass = $TxtDbPass.Password
        $php = $TxtPhpPath.Text

        if (-not (Test-Path $php)) {
            $TxtDbResult.Text = "Error: Primero debe configurar una ruta PHP valida en el Paso 2."
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
            return
        }

        $TxtDbResult.Text = "Probando conexion a MySQL..."
        $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::DarkGoldenrod
        $window.UpdateLayout()

        try {
            $res = Invoke-TestMysqlConnection -Php $php -Host $host -Port $port -Username $user -Password $pass
            if ($res -eq "OK") {
                $TxtDbResult.Text = "Conexion exitosa al servidor MySQL!"
                $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Green
            } else {
                $TxtDbResult.Text = "Fallo de conexion: $res"
                $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
            }
        } catch {
            $TxtDbResult.Text = "Error al probar conexion: $_"
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
        }
    })

    # Run safe migrations only. Never reset data from the installer.
    $BtnMigrateDb.Add_Click({
        $host = $TxtDbHost.Text
        $port = $TxtDbPort.Text
        $db = $TxtDbName.Text
        $user = $TxtDbUser.Text
        $pass = $TxtDbPass.Password
        $php = $TxtPhpPath.Text

        if (-not (Test-Path $php)) {
            $TxtDbResult.Text = "Error: Primero debe configurar una ruta PHP valida en el Paso 2."
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
            return
        }

        if (-not (Test-DatabaseName $db)) {
            $TxtDbResult.Text = "Error: El nombre de la base debe iniciar con letra y usar solo letras, numeros o guion bajo."
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
            return
        }

        $TxtDbResult.Text = "Guardando configuracion temporal y corriendo migraciones seguras..."
        $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::DarkGoldenrod
        
        # Guardar en .env para que artisan use los datos reales
        $vars = @{
            "APP_VERSION" = $installedVersion
            "DB_HOST" = $host
            "DB_PORT" = $port
            "DB_DATABASE" = $db
            "DB_USERNAME" = $user
            "DB_PASSWORD" = $pass
        }
        $envFile = Join-Path $backendRoot ".env"
        Update-DotEnv -Path $envFile -Variables $vars

        # Crear base de datos si no existe
        $dbStatus = Invoke-CreateMysqlDatabase -Php $php -Host $host -Port $port -Database $db -Username $user -Password $pass

        if ($dbStatus -ne "CREATED") {
            $TxtDbResult.Text = "Error al asegurar existencia de la base de datos: $dbStatus"
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
            return
        }

        # Ejecutar migraciones sin borrar datos ni correr seeders de demostracion
        try {
            $currentDir = Get-Location
            Set-Location $backendRoot
            
            # Limpiar cache de configuracion anterior
            & $php artisan config:clear | Out-Null
            
            # Ejecutar migracion
            $migrateOutput = & $php artisan migrate --force 2>&1
            Set-Location $currentDir

            $TxtDbResult.Text = "Migraciones aplicadas sin borrar datos. Cree usuarios y catalogos iniciales con el procedimiento aprobado."
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Green
        } catch {
            $TxtDbResult.Text = "Error al ejecutar migraciones: $_"
            $TxtDbResult.Foreground = [System.Windows.Media.Brushes]::Red
        }
    })

    $BtnCancel.Add_Click({
        $window.Close()
    })

    # Run GUI
    $window.ShowDialog() | Out-Null

} else {
    # ----------------------------------------------------
    # Fail-safe CLI wizard implementation
    # ----------------------------------------------------
    $runSetupCliAfterDefinition = $true
}

function Run-SetupCli {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Teal
    Write-Host "  Sistema de Caja Hospitalaria - Instalador LAN (Modo Consola) " -ForegroundColor White -BackgroundColor Teal
    Write-Host "==========================================================" -ForegroundColor Teal
    Write-Host ""
    
    $lanIp = Read-Host "Direccion IP LAN del Servidor (por defecto $detectedIp)"
    if ([string]::IsNullOrWhiteSpace($lanIp)) { $lanIp = $detectedIp }

    $php = Read-Host "Ruta al ejecutable php.exe (por defecto $phpPath)"
    if ([string]::IsNullOrWhiteSpace($php)) { $php = $phpPath }

    # Test PHP
    if (Test-Path $php) {
        Write-Host "PHP detectado correctamente." -ForegroundColor Green
    } else {
        Write-Host "Advertencia: php.exe no encontrado en $php" -ForegroundColor Yellow
    }

    Write-Host "`n--- Configuracion de Base de Datos MySQL ---"
    $dbHost = Read-Host "Host MySQL (por defecto 127.0.0.1)"
    if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "127.0.0.1" }

    $dbPort = Read-Host "Puerto MySQL (por defecto 3306)"
    if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "3306" }

    $dbName = Read-Host "Nombre Base de Datos (por defecto hospital_billing)"
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "hospital_billing" }

    $dbUser = Read-Host "Usuario MySQL (por defecto root)"
    if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "root" }

    $dbPass = Read-Host "Contrasena MySQL"

    if (-not (Test-DatabaseName $dbName)) {
        Write-Host "Nombre de base invalido. Use una letra inicial y solo letras, numeros o guion bajo." -ForegroundColor Red
        return
    }

    # Save to env
    Write-Host "`nGuardando variables en archivo de configuracion .env..." -ForegroundColor DarkCyan
    $vars = @{
        "APP_VERSION" = $installedVersion
        "APP_URL" = "http://$lanIp:8000"
        "SANCTUM_STATEFUL_DOMAINS" = "localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,127.0.0.1:5173,$lanIp,$lanIp:8000,$lanIp:5173,::1"
        "CORS_ALLOWED_ORIGINS" = "http://localhost:5173,http://127.0.0.1:5173,http://$lanIp:5173,http://$lanIp:8000"
        "DB_HOST" = $dbHost
        "DB_PORT" = $dbPort
        "DB_DATABASE" = $dbName
        "DB_USERNAME" = $dbUser
        "DB_PASSWORD" = $dbPass
    }
    
    $envFile = Join-Path $backendRoot ".env"
    Update-DotEnv -Path $envFile -Variables $vars

    # Ensure Database Exists and Migrate
    Write-Host "Asegurando base de datos y aplicando migraciones seguras..." -ForegroundColor DarkCyan
    $dbStatus = Invoke-CreateMysqlDatabase -Php $php -Host $dbHost -Port $dbPort -Database $dbName -Username $dbUser -Password $dbPass

    if ($dbStatus -eq "CREATED") {
        $currentDir = Get-Location
        Set-Location $backendRoot
        & $php artisan config:clear | Out-Null
        $migrateRes = & $php artisan migrate --force 2>&1
        Set-Location $currentDir
        Write-Host "Migraciones aplicadas sin borrar datos. Cree usuarios y catalogos iniciales con el procedimiento aprobado." -ForegroundColor Green
    } else {
        Write-Host "No se pudo crear base de datos: $dbStatus" -ForegroundColor Red
    }

    # Backup Task Scheduler
    $enableBackup = Read-Host "Habilitar worker continuo y respaldo diario programado? (S/N)"
    if ($enableBackup -eq "S" -or $enableBackup -eq "s") {
        $bTime = Read-Host "Hora del respaldo (por defecto 23:00)"
        if ([string]::IsNullOrWhiteSpace($bTime)) { $bTime = "23:00" }

        try {
            Install-BackupAutomation -PhpPath $php -DailyBackupTime $bTime | Out-Host
            Write-Host "Worker de respaldos y respaldo diario registrados exitosamente." -ForegroundColor Green
        } catch {
            Write-Host "No se pudieron registrar las tareas de respaldo: $_" -ForegroundColor Red
            Write-Host "Ejecute PowerShell como Administrador o use scripts\install_backup_tasks_windows.ps1 cuando el tecnico lo autorice." -ForegroundColor Yellow
        }
    }

    # Open Firewall
    $openFirewall = Read-Host "Desea abrir el puerto 8000 en el Firewall de Windows para clientes LAN? (S/N)"
    if ($openFirewall -eq "S" -or $openFirewall -eq "s") {
        netsh advfirewall firewall delete rule name="Sistema de Caja Hospitalaria LAN Port 8000" 2>$null
        netsh advfirewall firewall add rule name="Sistema de Caja Hospitalaria LAN Port 8000" dir=in action=allow protocol=TCP localport=8000 | Out-Null
        Write-Host "Firewall de Windows configurado." -ForegroundColor Green
    }

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host " Instalacion de servidor del Sistema de Caja Hospitalaria finalizada " -ForegroundColor White -BackgroundColor Green
    Write-Host " Servidor Web LAN disponible en: http://$lanIp:8000" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}

if ($runSetupCliAfterDefinition) {
    Run-SetupCli
}
