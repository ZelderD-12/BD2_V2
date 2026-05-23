param(
    [string]$Container = "clinica_sqlserver",
    [string]$BackupDir = "sql/backup",
    [string]$SqlUser = "sa",
    [string]$SqlPass = "ClinicaDBgrupo3#"
)

$ErrorActionPreference = "Stop"
$sqlcmd = "/opt/mssql-tools18/bin/sqlcmd -S localhost -U $SqlUser -P $SqlPass -C"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESTAURANDO BASES DE DATOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$bakFiles = Get-ChildItem -Path $BackupDir -Filter "*.bak" | Sort-Object Name

if ($bakFiles.Count -eq 0) {
    Write-Host "No se encontraron archivos .bak en $BackupDir" -ForegroundColor Yellow
    exit 0
}

foreach ($file in $bakFiles) {
    $fileName = $file.Name
    $containerPath = "/var/opt/mssql/backup/$fileName"

    # Determinar nombre de BD: quitar sufijo _YYYY-MM-DD o _YYYYMMDD antes de .bak
    $dbName = $fileName -replace '_[0-9]{4}-[0-9]{2}-[0-9]{2}(_[0-9]{6})?\.bak$', ''
    $dbName = $dbName -replace '_[0-9]{8}(_[0-9]{6})?\.bak$', ''
    $dbName = $dbName -replace '\.bak$', ''

    Write-Host "`n--- Restaurando $dbName desde $fileName ---" -ForegroundColor Green

    # Obtener nombres lógicos de archivos desde el backup
    $fileListQuery = @"
SET NOCOUNT ON;
DECLARE @t TABLE (
    LogicalName NVARCHAR(128),
    PhysicalName NVARCHAR(260),
    Type CHAR(1),
    FileGroupName NVARCHAR(128),
    Size NUMERIC(20,0),
    MaxSize NUMERIC(20,0),
    FileId INT,
    CreateLSN NUMERIC(25,0),
    DropLSN NUMERIC(25,0),
    UniqueId UNIQUEIDENTIFIER,
    ReadOnlyLSN NUMERIC(25,0),
    ReadWriteLSN NUMERIC(25,0),
    BackupSizeInBytes BIGINT,
    SourceBlockSize INT,
    FileGroupId INT,
    LogGroupGUID UNIQUEIDENTIFIER,
    DifferentialBaseLSN NUMERIC(25,0),
    DifferentialBaseGUID UNIQUEIDENTIFIER,
    IsReadOnly BIT,
    IsPresent BIT,
    TDEThumbprint VARBINARY(32)
);
INSERT INTO @t EXEC('RESTORE FILELISTONLY FROM DISK = N''$containerPath''');
SELECT LogicalName, Type FROM @t ORDER BY FileId;
"@

    $scriptBlock = [scriptblock]::Create($fileListQuery)
    
    $result = docker compose exec $Container $sqlcmd.Split(' ') -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$containerPath'" 2>&1

    $dataFile = ""
    $logFile = ""

    $lines = $result | Where-Object { $_ -match '^\S' }
    $parsing = $false
    foreach ($line in $lines) {
        if ($line -match '^[\s-]+$') {
            $parsing = !$parsing
            continue
        }
        if ($parsing) {
            $parts = $line -split '\s+'
            if ($parts.Length -ge 2) {
                $logicalName = $parts[0]
                $type = $parts[2]
                if ($type -eq 'D' -and -not $dataFile) {
                    $dataFile = $logicalName
                }
                elseif ($type -eq 'L' -and -not $logFile) {
                    $logFile = $logicalName
                }
            }
        }
    }

    if (-not $dataFile -or -not $logFile) {
        Write-Host "ERROR: No se pudo leer la estructura del backup $fileName" -ForegroundColor Red
        Write-Host "Datos recibidos:" -ForegroundColor Yellow
        $result | ForEach-Object { Write-Host "  $_" }
        continue
    }

    Write-Host "  Data file: $dataFile" -ForegroundColor Gray
    Write-Host "  Log file:  $logFile" -ForegroundColor Gray

    $restoreQuery = @"
RESTORE DATABASE [$dbName]
FROM DISK = N'$containerPath'
WITH
    MOVE '$dataFile' TO '/var/opt/mssql/data/${dbName}.mdf',
    MOVE '$logFile' TO '/var/opt/mssql/data/${dbName}_log.ldf',
    REPLACE, RECOVERY;
"@

    docker compose exec $Container $sqlcmd.Split(' ') -Q $restoreQuery 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  $dbName restaurada exitosamente!" -ForegroundColor Green
    } else {
        Write-Host "  ERROR restaurando $dbName" -ForegroundColor Red
    }
}

# Aplicar migraciones a ClinicaF si existe
Write-Host "`n--- Aplicando migraciones a ClinicaF ---" -ForegroundColor Cyan
$clinicaExists = docker compose exec $Container $sqlcmd.Split(' ') -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.databases WHERE name='ClinicaF'" 2>&1 | Out-String
if ($clinicaExists -match '1') {
    docker compose exec $Container $sqlcmd.Split(' ') -d ClinicaF -i /sql/migrate/seed_estados_citas.sql 2>&1
    Write-Host "Migraciones aplicadas a ClinicaF" -ForegroundColor Green
} else {
    Write-Host "ClinicaF no existe, saltando migraciones" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESTAURACION COMPLETADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
