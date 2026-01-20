# Node.js Installation Script
$nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
$installer = "$env:TEMP\node-installer.msi"

Write-Host "========================================"
Write-Host "  Node.js Installer"
Write-Host "========================================"
Write-Host ""

# Download
Write-Host "[1/3] Downloading Node.js v20.11.0 LTS..."
try {
    Invoke-WebRequest -Uri $nodeUrl -OutFile $installer -UseBasicParsing
    Write-Host "      Download complete!"
} catch {
    Write-Host "      Download failed: $_"
    exit 1
}

# Install
Write-Host "[2/3] Installing Node.js..."
try {
    Start-Process msiexec.exe -ArgumentList "/i", $installer, "/qn", "/norestart" -Wait -NoNewWindow
    Write-Host "      Installation complete!"
} catch {
    Write-Host "      Installation failed: $_"
    exit 1
}

# Refresh PATH
Write-Host "[3/3] Refreshing environment variables..."
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify
Write-Host ""
Write-Host "========================================"
Write-Host "  Verification"
Write-Host "========================================"

$nodePath = "C:\Program Files\nodejs\node.exe"
if (Test-Path $nodePath) {
    $nodeVersion = & $nodePath --version 2>$null
    $npmPath = "C:\Program Files\nodejs\npm.cmd"
    $npmVersion = & $npmPath --version 2>$null
    Write-Host "Node.js version: $nodeVersion"
    Write-Host "npm version: $npmVersion"
    Write-Host ""
    Write-Host "Node.js installed successfully!"
} else {
    Write-Host "Node.js may require terminal restart to take effect"
}

# Cleanup
Remove-Item $installer -Force -ErrorAction SilentlyContinue
