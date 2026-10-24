@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "WB=C:\Users\%USERNAME%\.workbuddy\binaries\python\versions\3.13.12\python.exe"

if exist "%WB%" (
  "%WB%" "%~dp0install.py" %*
  goto end
)
where python >nul 2>nul
if not errorlevel 1 (
  python "%~dp0install.py" %*
  goto end
)
where py >nul 2>nul
if not errorlevel 1 (
  py "%~dp0install.py" %*
  goto end
)
echo 没有找到 Python，请手动执行: python install.py
pause
exit /b 1

:end
echo.
pause
