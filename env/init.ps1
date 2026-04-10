# Firmware CLI Tool - Environment Setup (PowerShell Version)
# This script adds dove to PATH for PowerShell sessions

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
# dove.exe is in the parent directory (dove/), not in env/
$FIRMWARE_CLI_DIR = Split-Path -Parent $SCRIPT_DIR
$FIRMWARE_CLI = Join-Path $FIRMWARE_CLI_DIR "dove.exe"

Write-Host "========================================"
Write-Host "   Firmware CLI Tool - Environment Setup"
Write-Host "========================================"
Write-Host ""

# Check if dove.exe exists
if (-not (Test-Path $FIRMWARE_CLI)) {
    Write-Host "[ERROR] dove.exe not found" -ForegroundColor Red
    Write-Host "Expected path: $FIRMWARE_CLI"
    exit 1
}

Write-Host "[CHECK] dove.exe exists: $FIRMWARE_CLI"
Write-Host ""

# Clean the FIRMWARE_CLI_DIR to ensure no quotes or extra spaces
$FIRMWARE_CLI_DIR = $FIRMWARE_CLI_DIR.Trim().Trim('"')

# Check if already in current session PATH
if ($env:PATH -split ';' | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ -eq $FIRMWARE_CLI_DIR }) {
    Write-Host "[INFO] dove is already in current session PATH"
} else {
    Write-Host "[INFO] dove is not in current session PATH"
}

# Get current user PATH from registry and clean it
$currPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currPath) {
    # Clean PATH: remove quotes from each path segment
    $cleanedPathParts = @($currPath -split ';' | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $currPath = $cleanedPathParts -join ';'
}

# Check if already in user PATH (using cleaned paths)
if ($currPath -split ';' | ForEach-Object { $_.Trim().Trim('"') } | Where-Object { $_ -eq $FIRMWARE_CLI_DIR }) {
    Write-Host ""
    Write-Host "[SUCCESS] dove has been added to user PATH environment variable" -ForegroundColor Green
    Write-Host "Path: $FIRMWARE_CLI_DIR"
    Write-Host ""
    Write-Host "You can now use dove command in any PowerShell window"
} else {
    # Add to user PATH (ensure no quotes)
    Write-Host ""
    Write-Host "[ACTION] Adding dove to user PATH..."

    try {
        $newPath = if ($currPath) { "$currPath;$FIRMWARE_CLI_DIR" } else { $FIRMWARE_CLI_DIR }
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")

        Write-Host ""
        Write-Host "[SUCCESS] Added $FIRMWARE_CLI_DIR to user PATH" -ForegroundColor Green
        Write-Host ""
        Write-Host "Note: New environment variables will take effect in new PowerShell windows"
        Write-Host "Current window has temporarily added PATH, ready to use"

        # Refresh current session PATH
        $env:PATH = "$FIRMWARE_CLI_DIR;$env:PATH"
    } catch {
        Write-Host ""
        Write-Host "[WARNING] Failed to modify PATH, may require administrator privileges" -ForegroundColor Yellow
        Write-Host "Please try manually adding the following path to system PATH:"
        Write-Host $FIRMWARE_CLI_DIR
    }
}

# Show help
Write-Host ""
Write-Host "========================================"
Write-Host "   dove Usage Help"
Write-Host "========================================"
Write-Host ""
Write-Host "Available commands:"
Write-Host "  dove flash            - Flash firmware (auto-detect)"
Write-Host "  dove flash <path>     - Flash specified firmware"
Write-Host "  dove list             - List available firmwares"
Write-Host "  dove devices          - List USB devices"
Write-Host "  dove build            - Build firmware"
Write-Host "  dove build-and-flash  - Build and flash"
Write-Host "  dove config           - View configuration"
Write-Host "  dove help             - Show help"
Write-Host ""
Write-Host "Examples:"
Write-Host '  dove flash'
Write-Host '  dove flash "C:\firmware\test.zip"'
Write-Host ""
Write-Host "========================================"
