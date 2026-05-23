#!/bin/bash
# =============================================
# INIT DATABASE - Se ejecuta al iniciar SQL Server
# Restaura backup, aplica migraciones y SPs
# =============================================
set -e

DB_NAME="ClinicaF"
BACKUP_FILE="/var/opt/mssql/backup/ClinicaF_backup_2026050910-05-2026.bak"
MIGRATIONS="/sql/migrate"
SP_SCRIPTS="/sql/scripts"

# Escribir password a un archivo temporal para evitar problemas con caracteres especiales
echo -n "$MSSQL_SA_PASSWORD" > /tmp/sa_password
SQLCMD_BASE="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $(cat /tmp/sa_password) -C"

echo "[INIT-DB] Esperando a que SQL Server esté listo..."

for i in $(seq 1 60); do
  if $SQLCMD_BASE -Q "SELECT 1" > /dev/null 2>&1; then
    echo "[INIT-DB] SQL Server listo!"
    break
  fi
  echo "[INIT-DB] Intento $i/60..."
  sleep 2
done

# Verificar si la base de datos existe
DB_EXISTS=$($SQLCMD_BASE -h-1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name='$DB_NAME'" 2>/dev/null | tr -d ' ')

if [ "$DB_EXISTS" = "0" ] || [ -z "$DB_EXISTS" ]; then
  echo "[INIT-DB] Restaurando base de datos desde backup..."
  
  LOGICAL_NAMES=$($SQLCMD_BASE -h-1 -W -Q "RESTORE FILELISTONLY FROM DISK = N'$BACKUP_FILE'" 2>/dev/null | tail -n +3 | head -n -2 | awk '{print $1}')
  DATA_FILE=$(echo "$LOGICAL_NAMES" | head -1)
  LOG_FILE=$(echo "$LOGICAL_NAMES" | tail -1)
  
  if [ -z "$DATA_FILE" ]; then
    echo "[INIT-DB] Error: No se pudo leer el backup"
    exit 1
  fi
  
  $SQLCMD_BASE -Q "
RESTORE DATABASE $DB_NAME
FROM DISK = N'$BACKUP_FILE'
WITH
  MOVE '$DATA_FILE' TO '/var/opt/mssql/data/${DB_NAME}.mdf',
  MOVE '$LOG_FILE' TO '/var/opt/mssql/data/${DB_NAME}_log.ldf',
  REPLACE;
" 2>&1 | grep -v "RESTORE DATABASE successfully\|rows affected\|Processed" || true
  
  echo "[INIT-DB] Backup restaurado exitosamente!"
else
  echo "[INIT-DB] Base de datos $DB_NAME ya existe."
fi

# Aplicar migraciones
for f in "$MIGRATIONS"/*.sql; do
  if [ -f "$f" ]; then
    echo "[INIT-DB] Aplicando migración: $(basename "$f")"
    $SQLCMD_BASE -d "$DB_NAME" -i "$f" 2>&1 | grep -v "changed database context\|rows affected\)\|modelo de recuperacion\|DBCC execution\|already exists\|agregada a Cita" || true
  fi
done

# Aplicar SPs
for f in "$SP_SCRIPTS"/*.sql; do
  if [ -f "$f" ]; then
    echo "[INIT-DB] Aplicando SP script: $(basename "$f")"
    $SQLCMD_BASE -d "$DB_NAME" -i "$f" 2>&1 | grep -v "changed database context\|rows affected\)\|modelo de recuperacion\|DBCC execution\|already exists\|created exitosamente" || true
  fi
done

rm -f /tmp/sa_password
echo "[INIT-DB] Inicialización completada!"
