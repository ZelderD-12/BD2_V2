#!/bin/bash
# =============================================
# restore-all.sh — Restaura todos los .bak de sql/backup/
# =============================================

SQLCMD="/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $MSSQL_SA_PASSWORD -C"
BACKUP_DIR="/var/opt/mssql/backup"

echo "=== RESTAURANDO BASES DE DATOS ==="

for bak in "$BACKUP_DIR"/*.bak; do
    [ -f "$bak" ] || continue
    filename=$(basename "$bak")
    dbname=$(echo "$filename" | sed -E 's/_[0-9]{4}-[0-9]{2}-[0-9]{2}(_[0-9]{6})?\.bak$//' | sed 's/\.bak$//')
    echo "--- Restaurando $dbname desde $filename ---"

    logical_names=$($SQLCMD -h-1 -W -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$bak'" 2>/dev/null | awk '{print $1, $3}')
    data_file=$(echo "$logical_names" | awk '{if ($2 == "D") print $1}' | head -1)
    log_file=$(echo "$logical_names" | awk '{if ($2 == "L") print $1}' | head -1)

    [ -z "$data_file" ] && echo "ERROR: backup $filename invalido" && continue

    echo "  Data: $data_file  |  Log: $log_file"
    $SQLCMD -Q "
        IF EXISTS (SELECT 1 FROM sys.databases WHERE name='$dbname')
            ALTER DATABASE [$dbname] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        RESTORE DATABASE [$dbname] FROM DISK = N'$bak'
        WITH MOVE '$data_file' TO '/var/opt/mssql/data/${dbname}.mdf',
             MOVE '$log_file' TO '/var/opt/mssql/data/${dbname}_log.ldf',
             REPLACE, RECOVERY;
        ALTER DATABASE [$dbname] SET MULTI_USER;
    " 2>&1 | grep -iv "rows affected\|Processed\|SINGLE_USER\|MULTI_USER\|Commands completed" || true
    echo "  $dbname restaurada!"
done

echo ""
echo "--- Aplicando migraciones ---"
for sql in /sql/migrate/*.sql; do
    [ -f "$sql" ] || continue
    echo "  ClinicaF <- $(basename "$sql")"
    $SQLCMD -d ClinicaF -i "$sql" 2>&1 | grep -iv "rows affected\|already exists\|changed database context\|Commands completed" || true
done

echo ""
echo "=== RESTAURACION COMPLETADA ==="
