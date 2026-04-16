# Dove Installation Script
# Usage: Run this script in PowerShell: .\install.ps1
# This script adds dove.exe to the user PATH environment variable

param(
    [string]$InstallPath = "",
    [bool]$AddToPath = $true
)

# Determine installation directory
if ($InstallPath -eq "") {
    $InstallPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}

Write-Host "Dove Firmware CLI Tool Installation" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation directory: $InstallPath"

# Check if dove.exe exists
$doveExe = Join-Path $InstallPath "dove.exe"
if (-not (Test-Path $doveExe)) {
    Write-Host "Error: dove.exe not found in $InstallPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found dove.exe: $doveExe" -ForegroundColor Green

# Add to PATH
if ($AddToPath) {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

    # Check if already in PATH
    if ($currentPath -like "*$InstallPath*") {
        Write-Host "Already in PATH: $InstallPath" -ForegroundColor Yellow
    } else {
        # Add to user PATH
        $newPath = "$InstallPath;$currentPath"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Added to user PATH: $InstallPath" -ForegroundColor Green
        Write-Host "Note: You may need to restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Installation completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  dove.exe help          # Show help"
Write-Host "  dove.exe flash         # Flash firmware"
Write-Host "  dove.exe build         # Build firmware"
Write-Host "  dove.exe port list     # List serial ports"
Write-Host ""

# Claude Code skill configuration guide
Write-Host "Claude Code Integration:" -ForegroundColor Cyan
Write-Host "To use dove with Claude Code, add skill directory to your settings:"
Write-Host ""
Write-Host "  Create .claude/settings.json with:"
Write-Host '  {'
Write-Host '    "skills": {'
Write-Host '      "additionalDirectories": ["$InstallPath/skill"]'
Write-Host '    }'
Write-Host '  }'
Write-Host ""