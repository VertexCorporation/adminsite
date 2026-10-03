@echo off
REM ============================================================
REM  Vertex Konsol - GitHub Yukleyici
REM  Kullanim:  github-yukle.bat "commit mesaji" [-f]
REM  -f: zorla (force) push — yalnizca remote gecmisi bozukken
REM ============================================================
cd /d "%~dp0"

if not exist .git (
    echo [git] Yeni repo baslatiliyor...
    git init
    git branch -M main
    git remote add origin https://github.com/VertexCorporation/adminsite.git
)

git add -A

set MSG=%~1
if "%MSG%"=="" set MSG=Guncelleme %date% %time%

git commit -m "%MSG%"
if errorlevel 1 echo [git] Degisiklik yok ya da commit atlamadi.

echo [git] Push ediliyor (origin/main)...
if /i "%~2"=="-f" (
    git push -u origin main --force
) else (
    git push -u origin main
)

if errorlevel 1 (
    echo.
    echo [!] Push basarisiz. Uzak depo doluysa force deneyin:
    echo     github-yukle.bat "%MSG%" -f
) else (
    echo [OK] https://github.com/VertexCorporation/adminsite guncellendi.
)
pause
