@echo off
title BanglaRx AI - Live Stall Launcher
color 0A
echo ==============================================================================
echo           BANGLARX AI - AMBIENT CLINICAL & PRESCRIPTION GUARDIAN
echo                   DCCI AI Innovation Fair Showcase Launcher
echo ==============================================================================
echo.
echo [1/3] Starting ASP.NET Core Backend API on http://localhost:5000 ...
rem Showcase: patient sign-in code is shown on screen (no real SMS)
set Sms__Provider=demo
rem Every internal screen and API route needs a staff sign-in (first run: create the manager account)
set Auth__Enforce=true
start "BanglaRx Backend API" cmd /k "cd /d "%~dp0BanglaRx.Api" && dotnet run"

echo [2/3] Starting React/Vite Frontend on http://localhost:5173 ...
start "BanglaRx Frontend UI" cmd /k "cd /d "%~dp0frontend" && node "node_modules/vite/bin/vite.js" --port 5173"

echo [3/3] Waiting 4 seconds for servers to warm up...
timeout /t 4 /nobreak >nul

echo.
echo Launching Google Chrome / Default Browser to http://localhost:5173 ...
start http://localhost:5173

echo.
echo ==============================================================================
echo System is LIVE!
echo - Backend:  http://localhost:5000/api/status
echo - Frontend: http://localhost:5173
echo ==============================================================================
pause
