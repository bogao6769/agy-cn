@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "WB=C:\Users\%USERNAME%\.workbuddy\binaries\python\versions\3.13.12\python.exe"

if exist "%WB%" (
  "%WB%" "%~dp0install.py" --restore
  goto end
)
where python >nul 2>nul
if not errorlevel 1 (
  python "%~dp0install.py" --restore
  goto end
)
py "%~dp0install.py" --restore

:end
echo.
pause
