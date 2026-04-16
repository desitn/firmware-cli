# Dove Uninstallation Script
# Usage: Run this script in PowerShell: .\uninstall.ps1
# This script removes dove.exe from the user PATH environment variable

param(
    [string]$InstallPath = ""
)

# Determine installation directory
if ($InstallPath -eq "") {
    $InstallPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}

Write-Host "Dove Firmware CLI Tool Uninstallation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation directory: $InstallPath"

# Remove from PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($currentPath -like "*$InstallPath*") {
    # Remove the path entry
    $pathArray = $currentPath -split ';' | Where-Object { $_ -ne $InstallPath }
    $newPath = $pathArray -join ';'
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Removed from user PATH: $InstallPath" -ForegroundColor Green
    Write-Host "Note: You may need to restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
} else {
    Write-Host "Not found in PATH: $InstallPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Uninstallation completed!" -ForegroundColor Green
Write-Host "Note: The dove.exe and tools files are not deleted. You can manually delete the directory if needed."