@echo off
chcp 65001 >nul
echo ========================================
echo   百科交互文件管理系统 - 快速启动
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js，请先安装 Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安装
node --version
echo.

echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo.
    echo 📊 初始化数据库...
    call npm run db:generate
    call npm run db:push
)

echo ✅ 依赖已就绪
echo.

echo [3/3] 启动开发服务器...
echo.
echo ════════════════════════════════════════
echo   前端地址: http://localhost:3000
echo   后端地址: http://localhost:3001
echo   默认账号: admin / bkadmin123
echo ════════════════════════════════════════
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

pause
