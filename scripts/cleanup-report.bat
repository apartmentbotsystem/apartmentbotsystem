@echo off
REM cleanup-report.bat — Quick cleanup for Windows users
REM Usage: cleanup-report.bat [--packages]

setlocal enabledelayedexpansion

echo Cleaning up report...

if exist report (
  rmdir /s /q report
  echo [OK] Removed report folder
) else (
  echo [SKIP] report folder not found
)

if "%1"=="--packages" (
  echo.
  echo Uninstalling dev packages...
  call npm uninstall @mermaid-js/mermaid-cli docx marked
  echo [OK] Packages uninstalled
) else (
  echo.
  echo To also uninstall dev packages, run:
  echo   cleanup-report.bat --packages
)

echo.
echo [DONE] Cleanup complete
pause
