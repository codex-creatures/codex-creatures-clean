@echo off
rem Start Game.bat: double-click to play Codex Creatures at http://localhost:3000.
rem Runs the dev server (npm run dev) in this window and opens your browser.
rem Needs no internet. Keep this window open while you play; close it to stop.
rem   "Start Game.bat" nobrowser   starts it without opening the browser.
setlocal
title Codex Creatures
cd /d "%~dp0"
set PORT=3000
set URL=http://localhost:%PORT%
set OPEN=yes
if /i "%~1"=="nobrowser" set OPEN=no

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js isn't installed ^(or isn't on the PATH^), so the game can't start.
  echo   Install Node.js 24 LTS from https://nodejs.org ^(needs internet once^),
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)
if not exist "node_modules\next\package.json" (
  echo.
  echo   The game's packages aren't installed yet.
  echo   While online, double-click Update.bat ^(or run: npm ci^), then try again.
  echo.
  pause
  exit /b 1
)

rem Already running? Then just open it.
node scripts\game-status.mjs %PORT%
if errorlevel 2 (
  echo.
  echo   Port %PORT% is being used by another program, so the game can't start.
  echo   Close that program ^(Task Manager can show it^), then try again.
  echo.
  pause
  exit /b 1
)
if not errorlevel 1 (
  echo.
  echo   The game is already running at %URL%
  if "%OPEN%"=="yes" start "" %URL%
  echo   ^(It's running in another window or terminal: stop it there.^)
  echo.
  timeout /t 5 >nul 2>nul
  exit /b 0
)

:run
echo.
echo   Starting Codex Creatures at %URL% ...
echo   Keep this window open while you play. To stop: close it, or press Ctrl+C.
echo.
if "%OPEN%"=="yes" start "" /b node scripts\open-when-ready.mjs %PORT%
call npm.cmd run dev
echo.
echo   The game server has stopped.
choice /c RQ /n /m "  Press R to restart it, or Q to quit: "
if errorlevel 2 exit /b 0
set OPEN=no
goto run
