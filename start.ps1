# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Navigate to project
Set-Location D:\cursor\web

# Start dev server
Write-Host "Starting Eagle File Manager..." -ForegroundColor Cyan
Write-Host ""
npm run dev
