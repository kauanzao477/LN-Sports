@echo off
chcp 65001 > nul
echo ========================================================
echo   INICIALIZADOR DO SCRAPER YUPOO - LN-SPORTS
echo ========================================================
echo.

cd /d "%~dp0"

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set PY_CMD=py
) else (
    set PY_CMD=python
)

if exist "venv\Scripts\activate.bat" (
    echo [INFO] Ativando ambiente virtual venv...
    call "venv\Scripts\activate.bat"
    set PY_CMD=python
)

echo [INFO] Executando scraper.py...
%PY_CMD% scraper/scraper.py %*

echo.
pause
