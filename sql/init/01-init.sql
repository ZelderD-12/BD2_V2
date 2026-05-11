RESTORE FILELISTONLY 
FROM DISK = N'/var/opt/mssql/backups/ClinicaF_backup_2026050910-05-2026.bak';


RESTORE DATABASE ClinicaF
FROM DISK = N'/var/opt/mssql/backups/ClinicaF_backup_2026050910-05-2026.bak'
WITH 
    MOVE 'ClinicaF' TO '/var/opt/mssql/data/ClinicaF.mdf',
    MOVE 'ClinicaF_log' TO '/var/opt/mssql/data/ClinicaF_log.ldf',
    REPLACE;



