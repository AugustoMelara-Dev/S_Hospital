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
Uninstallable=no
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
SetupIconFile={#SourceRoot}\offline-release\frontend\public\icons\hospital-app.ico
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
