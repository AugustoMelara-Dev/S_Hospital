#ifndef SourceRoot
  #error SourceRoot must be provided by build_windows_installer.ps1
#endif

#ifndef OutputDir
  #error OutputDir must be provided by build_windows_installer.ps1
#endif

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{0B88485E-E545-4B2F-9665-6178594C7725}
AppName=S_Hospital
AppVersion={#AppVersion}
AppPublisher=S_Hospital
DefaultDirName=C:\S_Hospital
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=S_Hospital-Instalador
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
; Uninstallable=no: el instalador institucional no se desinstala
; por diseno. La auditoria pre-instalacion recomienda un flujo de
; actualizacion/reparacion/desinstalacion controlada. Mientras
; esa entrega no exista, la baja se realiza manualmente:
;   1. Detener S_Hospital desde el acceso directo Mantenimiento.
;   2. Ejecutar docker compose down -v en C:\S_Hospital.
;   3. Opcional: borrar C:\S_Hospital y la tarea programada
;      HospitalBackupAutomation.
; Cualquier nueva version del instalador debe reemplazar la
; existente y volver a invocar setup.bat para regenerar los
; accesos directos y la programacion de respaldos.
Uninstallable=no
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
SetupIconFile={#SourceRoot}\offline-release\frontend\public\icons\s-hospital-installer.ico
SetupLogging=yes
CloseApplications=no
RestartIfNeededByRun=no
UsePreviousAppDir=no
UsePreviousLanguage=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "{#SourceRoot}\offline-release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{app}\setup.bat"; WorkingDir: "{app}"; StatusMsg: "Configurando S_Hospital y sus respaldos automáticos..."; Flags: waituntilterminated runascurrentuser

[Code]
function DockerDesktopInstalled: Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{localappdata}\Programs\DockerDesktop\Docker Desktop.exe')) or
    FileExists(ExpandConstant('{localappdata}\Programs\DockerDesktop\resources\bin\docker.exe')) or
    FileExists(ExpandConstant('{pf}\Docker\Docker\Docker Desktop.exe')) or
    FileExists(ExpandConstant('{pf}\Docker\Docker\resources\bin\docker.exe')) or
    FileExists(ExpandConstant('{commonpf64}\Docker\Docker\Docker Desktop.exe')) or
    FileExists(ExpandConstant('{commonpf64}\Docker\Docker\resources\bin\docker.exe'));
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not DockerDesktopInstalled then
  begin
    Result :=
      'Docker Desktop no está instalado.' + #13#10 + #13#10 +
      'Instálelo primero desde la memoria USB, reinicie Windows si se solicita ' +
      'y luego vuelva a ejecutar S_Hospital-Instalador.exe.';
  end;
end;
