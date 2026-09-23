@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Push-AppScript.ps1"
if errorlevel 1 (
  echo.
  echo Upload failed.
  pause
  exit /b %errorlevel%
)
echo.
echo Upload complete.
pause
