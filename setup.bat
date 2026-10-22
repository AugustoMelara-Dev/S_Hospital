@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title "S_Hospital - Instalacion"

net session >nul 2>nul
if not errorlevel 1 goto :elevated

powershell.exe -NoProfile -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs -ErrorAction Stop } catch { Write-Host ('ERROR: ' + $_.Exception.Message); exit 1 }; exit 0"
if errorlevel 1 goto :elevation_cancelled
exit /b 0

:elevation_cancelled
echo.
echo ERROR: No se pudo iniciar la instalacion con permisos de Administrador.
echo Si cancelo el aviso de UAC, la instalacion no comenzo.
echo Vuelva a ejecutar setup.bat y acepte el aviso de Administrador.
pause
exit /b 1

:elevated

if not exist "%~dp0scripts\deploy_hospital_lan.ps1" (
    echo ERROR: El paquete esta incompleto.
    echo No se encontro scripts\deploy_hospital_lan.ps1.
    echo Vuelva a copiar o generar el paquete offline completo.
    pause
    exit /b 1
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo ERROR: Windows PowerShell no esta disponible.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_hospital_lan.ps1" -UnattendedSinglePc
set "INSTALL_EXIT=%ERRORLEVEL%"

if not "%INSTALL_EXIT%"=="0" (
    echo.
    echo La instalacion requiere atencion. Revise las comprobaciones mostradas arriba.
    echo Puede ejecutar: scripts\deploy_hospital_lan.ps1 -DiagnosticsOnly
    pause
)

exit /b %INSTALL_EXIT%
