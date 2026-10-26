@echo off
title Building WaMaX-IDE.exe Single Executable
echo ========================================================
echo  WaMaX IDE — Native Windows Executable Compiler
echo ========================================================
echo.

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

if not exist "%CSC%" (
    echo [ERROR] C# Compiler not found at %CSC%
    pause
    exit /b 1
)

echo [1/3] Building frontend bundle...
call npm run build

echo [2/3] Compiling WaMaX-IDE.exe native Windows executable...
"%CSC%" /nologo /target:winexe /out:"WaMaX-IDE.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll launcher\Program.cs

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCESS: WaMaX-IDE.exe created successfully!
    echo  Location: %~dp0WaMaX-IDE.exe
    echo ========================================================
) else (
    echo [ERROR] Compilation failed.
)

pause
