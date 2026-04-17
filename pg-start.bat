@echo off
setlocal

set "COMPOSE_DIR=C:\Users\jobro\PI-Garden-Data"
set "LOG_DIR=%COMPOSE_DIR%\logs"
set "LOG_FILE=%LOG_DIR%\startup.log"
set "DOCKER_DESKTOP_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo [%date% %time%] Task-triggered batch file launched.>> "%LOG_FILE%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

(
  echo [%date% %time%] Script execution started.
  echo [%date% %time%] SCRIPT VERSION: 2026-03-29-D
  echo [%date% %time%] Compose directory: %COMPOSE_DIR%
) > "%LOG_FILE%"

if not exist "%COMPOSE_DIR%" (
  echo [%date% %time%] ERROR: Compose directory does not exist.>> "%LOG_FILE%"
  exit /b 1
)

cd /d "%COMPOSE_DIR%"

tasklist /FI "IMAGENAME eq Docker Desktop.exe" | find /I "Docker Desktop.exe" >nul
if errorlevel 1 (
  echo [%date% %time%] Docker Desktop is not running. Starting it.>> "%LOG_FILE%"
  start "" "%DOCKER_DESKTOP_EXE%"
  timeout /t 10 /nobreak >nul
) else (
  echo [%date% %time%] Docker Desktop process already running.>> "%LOG_FILE%"
)

set DOCKER_READY=0

for /L %%i in (1,1,90) do (
  docker info >nul 2>nul
  if not errorlevel 1 (
    set DOCKER_READY=1
    echo [%date% %time%] Docker is ready on attempt %%i.>> "%LOG_FILE%"
    goto :docker_ready
  )

  echo [%date% %time%] Docker not ready yet. Attempt %%i of 90.>> "%LOG_FILE%"
  timeout /t 5 /nobreak >nul
)

:docker_ready
if "%DOCKER_READY%"=="0" (
  echo [%date% %time%] ERROR: Docker did not become ready after 90 attempts.>> "%LOG_FILE%"
  exit /b 1
)

echo [%date% %time%] Running: docker compose up -d>> "%LOG_FILE%"
docker compose up -d >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] ERROR: docker compose up failed.>> "%LOG_FILE%"
  exit /b 1
)

echo [%date% %time%] docker compose up completed successfully.>> "%LOG_FILE%"
echo [%date% %time%] Running: docker ps>> "%LOG_FILE%"
docker ps >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] ERROR: docker ps failed.>> "%LOG_FILE%"
  exit /b 1
)

echo [%date% %time%] Script execution completed.>> "%LOG_FILE%"
exit /b 0