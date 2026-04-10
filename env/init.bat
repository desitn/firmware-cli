@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Firmware CLI Tool - Environment Setup
echo ========================================
echo.

REM Get script directory (env/)
set SCRIPT_DIR=%~dp0

REM dove.exe is in the parent directory (dove/)
set "FIRMWARE_CLI_DIR=%SCRIPT_DIR%.."

REM Check if dove.exe exists
if not exist "%FIRMWARE_CLI_DIR%\dove.exe" (
    echo [ERROR] dove.exe not found
    echo Expected path: %FIRMWARE_CLI_DIR%\dove.exe
    pause
    exit /b 1
)

echo [CHECK] dove.exe exists: %FIRMWARE_CLI_DIR%\dove.exe
echo.

REM Resolve parent directory path (remove .. and get actual path)
pushd "%FIRMWARE_CLI_DIR%"
set "FIRMWARE_CLI_DIR=%CD%"
popd

REM Clean FIRMWARE_CLI_DIR - remove quotes
set "FIRMWARE_CLI_DIR=%FIRMWARE_CLI_DIR:"=%"

REM Check if already in PATH (clean comparison)
set "CHECK_PATH=%PATH:"=%"
echo %CHECK_PATH% | find /i "%FIRMWARE_CLI_DIR%" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] dove is already in current session PATH
) else (
    echo [INFO] dove is not in current session PATH
)

REM Read current user PATH and clean it
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set CURRPATH=%%b

REM Remove quotes from current path
if defined CURRPATH (
    set "CURRPATH=%CURRPATH:"=%"
)

REM Check if already in user PATH
if defined CURRPATH (
    echo %CURRPATH% | find /i "%FIRMWARE_CLI_DIR%" >nul 2>nul
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] dove has been added to user PATH environment variable
        echo Path: %FIRMWARE_CLI_DIR%
        echo.
        echo You can now use dove command in any command line window
        goto :SHOW_HELP
    )
)

REM Add to user PATH (without quotes)
echo.
echo [ACTION] Adding dove to user PATH...
if defined CURRPATH (
    setx PATH "%CURRPATH%;%FIRMWARE_CLI_DIR%" >nul 2>&1
) else (
    setx PATH "%FIRMWARE_CLI_DIR%" >nul 2>&1
)

if %errorlevel% equ 0 (
    echo [SUCCESS] Added %FIRMWARE_CLI_DIR% to user PATH
    echo.
    echo Note: New environment variables will take effect in new command line windows
    echo Current window has temporarily added PATH, ready to use
    REM Refresh current session PATH
    set "PATH=%FIRMWARE_CLI_DIR%;%PATH%"
) else (
    echo [WARNING] setx failed, may require administrator privileges
    echo Please try manually adding the following path to system PATH:
    echo %FIRMWARE_CLI_DIR%
)

:SHOW_HELP
echo.
echo ========================================
echo   dove Usage Help
echo ========================================
echo.
echo Available commands:
echo   dove flash            - Flash firmware (auto-detect)
echo   dove flash ^<path^>    - Flash specified firmware
echo   dove list             - List available firmwares
echo   dove devices          - List USB devices
echo   dove build            - Build firmware
echo   dove build-and-flash  - Build and flash
echo   dove config           - View configuration
echo   dove help             - Show help
echo.
echo Examples:
echo   dove flash
echo   dove flash "C:\firmware\test.zip"
echo.
echo ========================================

