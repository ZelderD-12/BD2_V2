#!/bin/bash
# =============================================
# SQL Server entrypoint wrapper
# Arranca SQL Server, ejecuta init, mantiene vivo
# =============================================
set -e

# Iniciar SQL Server en background
/opt/mssql/bin/sqlservr &

# Esperar un momento para que arranque
sleep 5

# Ejecutar inicialización
if [ -f /usr/local/bin/init-db.sh ]; then
  echo "[ENTRYPOINT] Ejecutando init-db.sh..."
  /usr/local/bin/init-db.sh 2>&1 | while IFS= read -r line; do echo "[INIT] $line"; done
  echo "[ENTRYPOINT] Init completado."
fi

# Esperar por el proceso de SQL Server para mantener el contenedor vivo
wait
