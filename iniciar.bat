@echo off
title SpoKiza
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando por primera vez, espera un momento...
  call npm install
)
if not exist .env.local (
  echo.
  echo FALTA el archivo .env.local con los datos de Spotify. Lee el README.
  pause
  exit /b
)
start "" http://localhost:3000
call npm run dev
