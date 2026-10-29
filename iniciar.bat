@echo off
title SpoKiza
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Falta instalar Node.js. Se va a abrir la pagina: descarga la version LTS, instalala y vuelve a abrir este archivo.
  start "" https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo Preparando SpoKiza por primera vez, espera unos minutos...
  call npm install
)
echo.
echo SpoKiza esta abierto en el navegador. NO cierres esta ventana mientras lo usas.
start "" http://localhost:3000
call npm run dev
