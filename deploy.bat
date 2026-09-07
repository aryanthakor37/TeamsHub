@echo off
echo.
echo  ==========================================
echo   TeamsHub ^| Auto Deploy to Render
echo  ==========================================
echo.

cd /d "%~dp0"

:: Check if there are any changes
git diff --quiet 2>nul
git diff --cached --quiet 2>nul

git status --short > tmp_status.txt
set /p STATUS=<tmp_status.txt
del tmp_status.txt

if "%STATUS%"=="" (
    echo  [INFO] No changes found. Already up to date!
    echo.
    pause
    exit /b 0
)

echo  [INFO] Changes detected:
echo.
git status --short
echo.

:: Ask for commit message
set /p MSG= Enter commit message (or press ENTER for auto): 

if "%MSG%"=="" (
    :: Auto-generate message with timestamp
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set CDATE=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set CTIME=%%a:%%b
    set MSG=chore: auto-deploy %CDATE% %CTIME%
)

echo.
echo  [1/3] Staging all changes...
git add -A

echo  [2/3] Committing: "%MSG%"
git commit -m "%MSG%"

echo  [3/3] Pushing to GitHub (Render will auto-deploy)...
git push origin main

echo.
echo  ==========================================
echo   Done! Check Render dashboard in 2-3 min
echo   https://dashboard.render.com
echo  ==========================================
echo.
pause
