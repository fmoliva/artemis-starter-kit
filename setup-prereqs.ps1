# Installs Node.js, Python 3, and Git if not already present.
# Run this once before anything else.
# Usage: powershell -ExecutionPolicy RemoteSigned -File setup-prereqs.ps1
#
# Requires: Windows 10 1709+ or Windows 11 (winget is built in)

function Test-Command($cmd) {
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

function Install-WithWinget($id, $label) {
    $reply = Read-Host "Install $label via winget? [y/N]"
    if ($reply -notmatch '^[Yy]') { Write-Host "Skipped $label" -ForegroundColor Yellow; return }
    Write-Host "→  Installing $label..." -ForegroundColor Yellow
    winget install --id $id --accept-source-agreements --accept-package-agreements -e
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $label installed" -ForegroundColor Green
    } else {
        Write-Host "⚠  $label install may have failed — check winget output above" -ForegroundColor Yellow
    }
}

# Check winget is available
if (-not (Test-Command "winget")) {
    Write-Host "⚠  winget not found. Install the App Installer from the Microsoft Store," -ForegroundColor Yellow
    Write-Host "   or install Node.js, Python 3, and Git manually:" -ForegroundColor Yellow
    Write-Host "   Node.js: https://nodejs.org" -ForegroundColor Cyan
    Write-Host "   Python:  https://python.org" -ForegroundColor Cyan
    Write-Host "   Git:     https://git-scm.com" -ForegroundColor Cyan
    exit 1
}

# Node.js
if (Test-Command "node") {
    $v = node --version
    Write-Host "✅ Node.js already installed ($v)" -ForegroundColor Green
} else {
    Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
}

# Python 3
if ((Test-Command "python3") -or (Test-Command "python")) {
    try { $v = python3 --version 2>&1 } catch { $v = python --version 2>&1 }
    Write-Host "✅ Python already installed ($v)" -ForegroundColor Green
} else {
    Install-WithWinget "Python.Python.3" "Python 3"
}

# Git
if (Test-Command "git") {
    $v = git --version
    Write-Host "✅ Git already installed ($v)" -ForegroundColor Green
} else {
    Install-WithWinget "Git.Git" "Git"
}

Write-Host ""
Write-Host "Prerequisites installed. You may need to restart your terminal for PATH changes to take effect." -ForegroundColor Cyan
Write-Host "Next step: cd [repo-folder]; cd [app-folder]; npm install; npx playwright install" -ForegroundColor Cyan
