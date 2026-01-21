# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Navigate to project
Set-Location D:\bk-file-manager

# Start dev server
Write-Host "Starting 百科交互文件管理系统..." -ForegroundColor Cyan
Write-Host ""
Write-Host "前端地址: http://localhost:3000" -ForegroundColor Green
Write-Host "后端地址: http://localhost:3001" -ForegroundColor Green
Write-Host ""
npm run dev
