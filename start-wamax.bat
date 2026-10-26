@echo off
title WaMaX IDE — Local-First AI Development Environment
echo ============================================================
echo   Starting WaMaX IDE (Local-First AI Development Environment)
echo   Local AI Engine: Ollama
echo   Zero Cloud Costs - 100% Offline Capable
echo ============================================================

cd /d "%~dp0"

echo [1/2] Starting WaMaX Backend API Server on Port 3001...
start "WaMaX Backend" /min node server/index.js

echo [2/2] Starting WaMaX Desktop IDE Interface on Port 5173...
start "WaMaX Frontend" /min npm run dev

timeout /t 3 /nobreak >nul
echo Opening WaMaX IDE in default browser...
start http://localhost:5173

echo WaMaX IDE is running! Press any key to stop.
pause
