@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title "S_Hospital - Instalacion"

net session >nul 2>nul
if errorlevel 1 (
    powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b %ERRORLEVEL%
)

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
