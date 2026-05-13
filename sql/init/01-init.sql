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


-- Asegúrate que existen las tablas necesarias
-- Insertar un ticket de prueba en EN_ESPERA (id_estado_ticket = 1)
INSERT INTO dbo.Ticket (id_paciente, id_sede, id_servicio, prioridad, id_estado_ticket, codigo_ticket, fecha_generacion)
VALUES (1, 1, 1, 'NORMAL', 1, 'A001', GETDATE());

INSERT INTO dbo.Ticket (id_paciente, id_sede, id_servicio, prioridad, id_estado_ticket, codigo_ticket, fecha_generacion)
VALUES (1, 1, 1, 'ANCIANO', 1, 'A002', GETDATE());

INSERT INTO dbo.Ticket (id_paciente, id_sede, id_servicio, prioridad, id_estado_ticket, codigo_ticket, fecha_generacion)
VALUES (1, 1, 1, 'EMBARAZO', 1, 'A003', GETDATE());