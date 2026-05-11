@echo off
echo  Deteniendo todos los servicios...
taskkill /F /IM bun.exe 2>nul
taskkill /F /IM node.exe 2>nul
echo  Servicios detenidos
