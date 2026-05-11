@echo off
echo  Limpiando procesos anteriores...
taskkill /F /IM bun.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo  Iniciando servicios...
bun run dev