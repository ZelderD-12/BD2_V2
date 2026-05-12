RESTORE FILELISTONLY 
FROM DISK = N'/var/opt/mssql/backups/ClinicaF_backup_2026050910-05-2026.bak';


RESTORE DATABASE ClinicaF
FROM DISK = N'/var/opt/mssql/backups/ClinicaF_backup_2026050910-05-2026.bak'
WITH 
    MOVE 'ClinicaF' TO '/var/opt/mssql/data/ClinicaF.mdf',
    MOVE 'ClinicaF_log' TO '/var/opt/mssql/data/ClinicaF_log.ldf',
    REPLACE;

USE ClinicaF;

EXEC dbo.sp_login_usuario 
    @email = 'tobiasgusito@gmail.com',
    @password = '123456789',
    @ip_origen = 'localhost',
    @user_agent = 'test';

SELECT * FROM dbo.Rol;