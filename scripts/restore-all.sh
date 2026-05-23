#!/bin/bash
# =============================================
# restore-all.sh — Restaura todos los .bak de sql/backup/
# Uso: docker exec clinica_sqlserver bash /tmp/restore-all.sh
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

    if [ -z "$data_file" ] || [ -z "$log_file" ]; then
        echo "ERROR: No se pudo leer estructura del backup $filename"
        continue
    fi

    echo "  Data: $data_file  |  Log: $log_file"

    # Matar conexiones activas y restaurar
    $SQLCMD -Q "
        IF EXISTS (SELECT 1 FROM sys.databases WHERE name='$dbname')
        BEGIN
            ALTER DATABASE [$dbname] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        END
        RESTORE DATABASE [$dbname]
        FROM DISK = N'$bak'
        WITH
            MOVE '$data_file' TO '/var/opt/mssql/data/${dbname}.mdf',
            MOVE '$log_file' TO '/var/opt/mssql/data/${dbname}_log.ldf',
            REPLACE, RECOVERY;
        ALTER DATABASE [$dbname] SET MULTI_USER;
    " 2>&1 | grep -iv "rows affected\|Processed\|The database has been set to SINGLE_USER\|The database has been set to MULTI_USER\|Commands completed successfully" || true

    echo "  $dbname restaurada!"
done

# Aplicar migraciones solo a ClinicaF
echo ""
echo "--- Aplicando migraciones ---"
$SQLCMD -h-1 -W -Q "SET NOCOUNT ON; SELECT name FROM sys.databases WHERE name='ClinicaF'" 2>/dev/null | tr -d ' ' | while read -r db; do
    if [ -n "$db" ]; then
        for sql in /sql/migrate/*.sql; do
            [ -f "$sql" ] || continue
            echo "  $db ← $(basename "$sql")"
            $SQLCMD -d "$db" -i "$sql" 2>&1 | grep -iv "rows affected\|already exists\|changed database context\|Commands completed successfully\|agregada a Cita\|No hay columna\|no existe" || true
        done
    fi
done

echo ""
echo "=== RESTAURACION COMPLETADA ==="
