#define ProductName "S_Hospital"
#ifndef ProductVersion
  #define ProductVersion "0.0.0-dev"
#endif
#ifndef PayloadRoot
  #error "Compile with /DPayloadRoot=<absolute native payload path>."
#endif

[Setup]
AppId={{D304D4C4-8B5D-4E18-BC28-551C0CF3CDB0}
AppName={#ProductName}
AppVersion={#ProductVersion}
AppPublisher=Hospital San Isidro
DefaultDirName={autopf}\S_Hospital
DefaultGroupName=S_Hospital
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
Compression=lzma2/ultra64
SolidCompression=yes
OutputBaseFilename=S_Hospital-{#ProductVersion}-Windows-x64
OutputDir=output
SetupLogging=yes
Uninstallable=no
DisableProgramGroupPage=yes
DisableDirPage=yes
WizardStyle=modern
SetupMutex=Global\S_Hospital.Native.Setup

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "{#PayloadRoot}\*"; DestDir: "{tmp}\S_Hospital-payload"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autodesktop}\S_Hospital"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\current\scripts\native\start_native_app.ps1"" -InstallRoot ""{app}"""; WorkingDir: "{app}"
Name: "{commonstartup}\S_Hospital"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\current\scripts\native\start_native_app.ps1"" -InstallRoot ""{app}"""; WorkingDir: "{app}"
Name: "{group}\Abrir S_Hospital"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\current\scripts\native\start_native_app.ps1"" -InstallRoot ""{app}"""; WorkingDir: "{app}"
Name: "{group}\Recuperar acceso a S_Hospital"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\current\scripts\recover_hospital_access.ps1"" -InstallRoot ""{app}"""; WorkingDir: "{app}"
Name: "{group}\Respaldos y recuperación de S_Hospital"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\current\scripts\native\recovery_wizard.ps1"""; WorkingDir: "{app}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\current\scripts\native\start_native_app.ps1"" -InstallRoot ""{app}"" -AppUrl ""http://127.0.0.1:8000/administracion/ajustes"""; Description: "Completar datos institucionales de S_Hospital"; Flags: postinstall nowait skipifsilent runasoriginaluser; Check: IsFreshInstallAndBootstrapSucceeded

[Code]
var
  ExistingInstallAtStartup: Boolean;
  BootstrapSucceeded: Boolean;
  BootstrapAttempted: Boolean;
  BootstrapFailed: Boolean;

function InitializeSetup(): Boolean;
begin
  ExistingInstallAtStartup := DirExists(ExpandConstant('{commonappdata}\S_Hospital\database\mysql'));
  BootstrapSucceeded := False;
  BootstrapAttempted := False;
  BootstrapFailed := False;
  Result := True;
end;

procedure InitializeWizard();
begin
  if ExistingInstallAtStartup then
  begin
    WizardForm.WelcomeLabel1.Caption := 'Actualizar S_Hospital';
    WizardForm.WelcomeLabel2.Caption :=
      'El instalador conservará la base de datos y la configuración local. ' +
      'Antes de migrar detendrá las operaciones, verificará un respaldo cifrado y, si la aplicación nueva no inicia, restaurará el código anterior. ' +
      'Los cambios de base de datos sólo se aceptan cuando el paquete declara compatibilidad con esa versión.';
  end
  else
  begin
    WizardForm.WelcomeLabel1.Caption := 'Instalar S_Hospital';
    WizardForm.WelcomeLabel2.Caption :=
      'Se instalarán la aplicación, la base de datos y los servicios locales necesarios para trabajar sin internet.';
  end;
end;

function IsFreshInstall(): Boolean;
begin
  Result := not ExistingInstallAtStartup;
end;

function IsFreshInstallAndBootstrapSucceeded(): Boolean;
begin
  Result := IsFreshInstall() and BootstrapSucceeded;
end;

function NeedRestart(): Boolean;
begin
  Result := BootstrapSucceeded and
    FileExists(ExpandConstant('{commonappdata}\S_Hospital\state\restart-required-after-install'));
end;

function GetCustomSetupExitCode(): Integer;
begin
  if BootstrapFailed then
    Result := 1
  else
    Result := 0;
end;

procedure RemoveFreshInstallShortcutsAfterFailure();
begin
  if ExistingInstallAtStartup then
    exit;
  DeleteFile(ExpandConstant('{autodesktop}\S_Hospital.lnk'));
  DeleteFile(ExpandConstant('{commonstartup}\S_Hospital.lnk'));
  DeleteFile(ExpandConstant('{group}\Abrir S_Hospital.lnk'));
  DeleteFile(ExpandConstant('{group}\Recuperar acceso a S_Hospital.lnk'));
  DeleteFile(ExpandConstant('{group}\Respaldos y recuperación de S_Hospital.lnk'));
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and BootstrapAttempted and (not BootstrapSucceeded) then
  begin
    WizardForm.FinishedHeadingLabel.Caption := 'La instalación no se completó';
    WizardForm.FinishedLabel.Caption :=
      'S_Hospital no se abrió ni quedó listo para usarse. El estado parcial se conservó de forma segura para poder repararlo con un instalador corregido.';
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  PowerShell: String;
  InstallerScript: String;
  Parameters: String;
begin
  if CurStep <> ssPostInstall then
    exit;
  BootstrapAttempted := True;
  WizardForm.StatusLabel.Caption := 'Preparando la aplicación y los servicios locales…';
  PowerShell := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  InstallerScript := ExpandConstant('{tmp}\S_Hospital-payload\scripts\native\install_native_runtime.ps1');
  Parameters := '-NoProfile -ExecutionPolicy Bypass -File "' + InstallerScript +
    '" -PayloadRoot "' + ExpandConstant('{tmp}\S_Hospital-payload') +
    '" -InstallRoot "' + ExpandConstant('{app}') +
    '" -DataRoot "' + ExpandConstant('{commonappdata}\S_Hospital') +
    '" -OperationalLogPath "' + ExpandConstant('{localappdata}\S_Hospital\logs\native-install.json') + '"';
  if not Exec(PowerShell, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    BootstrapFailed := True;
    RemoveFreshInstallShortcutsAfterFailure();
    SuppressibleMsgBox('No se pudo iniciar la configuración local de S_Hospital. La aplicación no se abrirá. El estado quedó conservado para revisión.', mbError, MB_OK, IDOK);
  end
  else if ResultCode <> 0 then
  begin
    BootstrapFailed := True;
    RemoveFreshInstallShortcutsAfterFailure();
    SuppressibleMsgBox('No se pudo completar la instalación de S_Hospital. No se abrió la aplicación. El diagnóstico quedó guardado para revisión.', mbError, MB_OK, IDOK);
  end
  else
    BootstrapSucceeded := True;
end;
