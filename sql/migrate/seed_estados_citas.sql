-- =============================================
-- SEED: Estados_Citas — asegura todos los estados
-- Se ejecuta después de restaurar el backup
-- y antes de que inicie el backend.
-- =============================================
IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 1)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (1, 'Pendiente');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 2)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (2, 'Confirmada');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 3)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (3, 'Cancelada');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 4)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (4, 'Reprogramada');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 5)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (5, 'Atendida');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 6)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (6, 'No_Show');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 7)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (7, 'Expirada');

IF NOT EXISTS (SELECT 1 FROM dbo.Estados_Citas WHERE Id_Estado_Cita = 8)
    INSERT INTO dbo.Estados_Citas (Id_Estado_Cita, Nombre_Estado_Cita) VALUES (8, 'Solicitada');
GO
