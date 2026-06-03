@echo off
REM ======================================================================
REM      [SISTEMA DE CAJA HOSPITALARIA - LAN DEPLOYMENT MASTER LAUNCHER]
REM ======================================================================
REM Disenado para Windows. Inicia la instalacion segura e inteligente.
REM Reclama permisos de Administrador para abrir puertos y programar tareas.

cd /d "%~dp0"
title "Sistema de Caja Hospitalaria - Lanzador de Despliegue LAN"
cls

echo ======================================================================
echo          [SISTEMA DE CAJA HOSPITALARIA - INICIALIZADOR DE PRODUCCION]
echo ======================================================================
echo.

REM 1. Validar Permisos de Administrador (UAC)
echo [*] Verificando privilegios administrativos...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR CRITICO] Este script requiere permisos de Administrador.
    echo.
    echo Para continuar:
    echo   1. Cierra esta ventana.
    echo   2. Haz clic derecho sobre "setup.bat".
    echo   3. Selecciona "Ejecutar como administrador".
    echo.
    pause
    exit /b 1
)
echo [OK] Privilegios de Administrador confirmados.
echo.

REM 2. Verificar disponibilidad de PowerShell
echo [*] Buscando interprete de PowerShell...
where powershell >nul 2>nul
if %errorLevel% neq 0 (
    echo [ERROR] No se encontro PowerShell en el sistema.
    echo Este instalador requiere PowerShell para ejecutar diagnosticos de red y firewall.
    echo.
    pause
    exit /b 1
)
echo [OK] PowerShell esta disponible.
echo.

REM 3. Invocar al Asistente de Despliegue Bulletproof LAN en PowerShell
echo ======================================================================
echo    INICIANDO ASISTENTE DE INSTALACION EN RED LOCAL (LAN)...
echo ======================================================================
echo.
timeout /t 2 /nobreak >nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_hospital_lan.ps1" %*
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] La instalacion o configuracion ha devuelto un codigo de error (%errorlevel%).
    echo La instalacion fallo. Revise la carpeta install-logs.
    echo Revisa los mensajes superiores para diagnosticar y corregir el problema.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo ======================================================================
echo    ASISTENTE DE INSTALACION LAN COMPLETADO
echo ======================================================================
echo.
pause
exit /b 0
