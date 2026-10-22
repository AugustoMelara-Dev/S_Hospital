[Setup]
AppId={{97EC5906-BEFF-4F6D-A32F-63803C4205F2}
AppName=S_Hospital installer failure probe
AppVersion=1
DefaultDirName={tmp}\S_Hospital-Inno-Failure-Probe
PrivilegesRequired=lowest
Uninstallable=no
CreateAppDir=no
OutputDir=output
OutputBaseFilename=S_Hospital-Inno-Failure-Probe
DisableFinishedPage=no

[Run]
Filename: "{cmd}"; Parameters: "/c echo launched>""{tmp}\s-hospital-inno-launch-marker.txt"""; Flags: runhidden; Check: CanLaunch

[Code]
var
  BootstrapSucceeded: Boolean;
  BootstrapFailed: Boolean;

function InitializeSetup(): Boolean;
begin
  BootstrapSucceeded := False;
  BootstrapFailed := False;
  Result := True;
end;

function GetCustomSetupExitCode(): Integer;
begin
  if BootstrapFailed then Result := 1 else Result := 0;
end;

function CanLaunch(): Boolean;
begin
  Result := BootstrapSucceeded;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep <> ssPostInstall then exit;
  if (not Exec(ExpandConstant('{cmd}'), '/c exit 1', '', SW_HIDE, ewWaitUntilTerminated, ResultCode)) or
     (ResultCode <> 0) then
  begin
    BootstrapFailed := True;
    SuppressibleMsgBox('Expected bootstrap failure.', mbError, MB_OK, IDOK);
  end
  else BootstrapSucceeded := True;
end;

