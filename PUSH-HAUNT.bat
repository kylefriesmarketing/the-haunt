@echo off
rem ============================================================
rem  THE HAUNT - push to GitHub + go live on Pages
rem  First run: creates kylefriesmarketing/the-haunt, pushes,
rem  enables Pages. Every run after: commit + push whatever
rem  changed. Live at:
rem    https://kylefriesmarketing.github.io/the-haunt/
rem  Pure .bat on purpose (PowerShell is blocked on this machine).
rem ============================================================
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo [!] git not found on PATH. install git for windows, then rerun.
  pause & exit /b 1
)

if exist .git goto :update

echo [*] first push - creating the repo...
git init -b main
git add -A
git commit -m "THE HAUNT v0.9 - the barn's lights come back on"

where gh >nul 2>nul
if errorlevel 1 (
  echo [!] gh CLI not found. two options:
  echo     a) install github cli, run: gh auth login   then rerun this bat
  echo     b) create an empty repo named the-haunt at github.com/new, then run:
  echo        git remote add origin https://github.com/kylefriesmarketing/the-haunt.git
  echo        git push -u origin main
  pause & exit /b 1
)

gh repo create kylefriesmarketing/the-haunt --public --source . --push
if errorlevel 1 (
  echo [!] repo create failed - if it already exists, wiring the remote instead...
  git remote add origin https://github.com/kylefriesmarketing/the-haunt.git 2>nul
  git fetch origin main 2>nul
  git pull origin main --allow-unrelated-histories -X ours --no-edit 2>nul
  git push -u origin main
)

echo [*] turning on GitHub Pages (main branch, root)...
gh api -X POST repos/kylefriesmarketing/the-haunt/pages -f "source[branch]=main" -f "source[path]=/" >nul 2>nul
if errorlevel 1 gh api -X PUT repos/kylefriesmarketing/the-haunt/pages -f "source[branch]=main" -f "source[path]=/" >nul 2>nul
goto :done

:update
echo [*] pushing the latest barn...
git add -A
git commit -m "THE HAUNT update"
git pull origin main --allow-unrelated-histories -X ours --no-edit 2>nul
git push

:done
echo.
echo  ============================================================
echo   live (give Pages ~a minute on first run):
echo   https://kylefriesmarketing.github.io/the-haunt/
echo  ============================================================
echo.
pause
