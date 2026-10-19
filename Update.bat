@echo off
rem Update.bat: double-click to get the latest code from GitHub.
rem Safe: it stops if you have uncommitted work, if you're offline, or if
rem this computer and GitHub have split. It never pushes, resets, merges or
rem discards anything, and never touches your save. See scripts\update.mjs.
setlocal
title Codex Creatures - update
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Git isn't installed. Get Git for Windows: https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js isn't installed. Get Node.js 24 LTS: https://nodejs.org
  echo.
  pause
  exit /b 1
)

node scripts\update.mjs
set RESULT=%errorlevel%
pause
exit /b %RESULT%
