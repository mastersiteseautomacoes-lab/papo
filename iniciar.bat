@echo off
rem Inicia o Papo: compila o front-end (se preciso) e sobe o servidor em http://127.0.0.1:3000
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist dist call npm run build
echo.
echo Papo iniciando. Deixe esta janela aberta enquanto os amigos estiverem usando.
echo.
call npx tsx server/index.ts
pause
