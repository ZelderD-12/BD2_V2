#!/bin/bash
# =============================================
# INIT DATABASE - Se ejecuta al iniciar SQL Server
# Restaura backup, aplica migraciones y SPs
# =============================================
set -e

DB_NAME="ClinicaF"
BACKUP_FILE="/var/opt/mssql/backup/ClinicaF_2026-05-23.bak"
DW_BACKUP_FILE="/var/opt/mssql/backup/ClinicaF_DW_2026-05-23.bak"
DW_DB_NAME="ClinicaF_DW"
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

restore_db() {
  local db_name="$1"
  local backup_file="$2"
  
  local exists=$($SQLCMD_BASE -h-1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name='$db_name'" 2>/dev/null | tr -d ' ')
  
  if [ "$exists" = "0" ] || [ -z "$exists" ]; then
    echo "[INIT-DB] Restaurando $db_name desde $(basename "$backup_file")..."
    
    local logical_names=$($SQLCMD_BASE -h-1 -W -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$backup_file'" 2>/dev/null | awk '{print $1}')
    local data_file=$(echo "$logical_names" | head -1)
    local log_file=$(echo "$logical_names" | tail -1)
    
    if [ -z "$data_file" ]; then
      echo "[INIT-DB] Error: No se pudo leer el backup $backup_file"
      return 1
    fi
    
    $SQLCMD_BASE -Q "
RESTORE DATABASE $db_name
FROM DISK = N'$backup_file'
WITH
  MOVE '$data_file' TO '/var/opt/mssql/data/${db_name}.mdf',
  MOVE '$log_file' TO '/var/opt/mssql/data/${db_name}_log.ldf',
  REPLACE;
" 2>&1 | grep -v "RESTORE DATABASE successfully\|rows affected\|Processed" || true
    
    echo "[INIT-DB] $db_name restaurada exitosamente!"
  else
    echo "[INIT-DB] $db_name ya existe."
  fi
}

restore_db "$DB_NAME" "$BACKUP_FILE"
restore_db "$DW_DB_NAME" "$DW_BACKUP_FILE"

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
