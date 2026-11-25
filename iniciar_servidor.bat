@echo off
chcp 65001 > nul
title Servidor de Gestión de Comunicación e Información (GyC)

echo ====================================================================
echo  DIVISIÓN GESTIÓN DE LA INFORMACIÓN Y COMUNICACIÓN INSTITUCIONAL
echo  Tablero de Carga Laboral y Proyectos (Trello Sync)
echo ====================================================================
echo.

set PHP_EXE=C:\xampp\php\php.exe

if not exist "%PHP_EXE%" (
    where php >nul 2>nul
    if %errorlevel% equ 0 (
        set PHP_EXE=php
    ) else (
        echo [ERROR] No se encontró PHP instalado ni en C:\xampp\php\php.exe ni en el PATH.
        echo Por favor instale o inicie XAMPP.
        pause
        exit /b 1
    )
)

echo [OK] PHP detectado: %PHP_EXE%
echo [INFO] Iniciando servidor web local en http://localhost:8080 ...
echo [INFO] Presione Ctrl + C para detener el servidor en cualquier momento.
echo.

start "" "http://localhost:8080"
"%PHP_EXE%" -S localhost:8080

pause
