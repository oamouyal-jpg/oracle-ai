# Start Oracle AI (API + web). Run from project root in PowerShell:
#   .\start-oracle.ps1
Set-Location $PSScriptRoot
Write-Host "Starting Oracle API (port 4000) and Web (port 3000)..." -ForegroundColor Cyan
npm.cmd run dev
