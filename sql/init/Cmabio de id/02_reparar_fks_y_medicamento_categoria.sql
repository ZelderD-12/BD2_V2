-- ============================================================
-- REPARAR Medicamento_Categoria + RECREAR TODAS las FK
-- Ejecutar DESPUES de 01_migrar_smallint_a_int.sql
-- ============================================================

-- ============================================================
-- 1. Verificar estado actual de Medicamento_Categoria
-- ============================================================
PRINT 'Estado actual de Medicamento_Categoria:';
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Medicamento_Categoria' AND TABLE_SCHEMA = 'dbo';

-- ============================================================
-- 2. ALTER columnas + recrear PK compuesta
-- ============================================================
DECLARE @pkName NVARCHAR(128), @sql NVARCHAR(MAX);

SELECT @pkName = kc.name FROM sys.key_constraints kc
JOIN sys.objects o ON o.object_id = kc.parent_object_id
WHERE kc.type = 'PK' AND o.name = 'Medicamento_Categoria' AND o.schema_id = SCHEMA_ID('dbo');

IF @pkName IS NOT NULL
BEGIN
    SET @sql = 'ALTER TABLE dbo.Medicamento_Categoria DROP CONSTRAINT [' + @pkName + ']';
    EXEC sp_executesql @sql;
    PRINT 'DROP PK: ' + @pkName;
END

-- ALTER ambas columnas
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.objects o ON o.object_id = c.object_id WHERE o.name = 'Medicamento_Categoria' AND c.name = 'id_medicamento' AND o.schema_id = SCHEMA_ID('dbo'))
BEGIN
    SET @sql = 'ALTER TABLE dbo.Medicamento_Categoria ALTER COLUMN id_medicamento INT NOT NULL';
    EXEC sp_executesql @sql;
    PRINT 'ALTER Medicamento_Categoria.id_medicamento -> INT';
END

IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.objects o ON o.object_id = c.object_id WHERE o.name = 'Medicamento_Categoria' AND c.name = 'id_categoria' AND o.schema_id = SCHEMA_ID('dbo'))
BEGIN
    SET @sql = 'ALTER TABLE dbo.Medicamento_Categoria ALTER COLUMN id_categoria INT NOT NULL';
    EXEC sp_executesql @sql;
    PRINT 'ALTER Medicamento_Categoria.id_categoria -> INT';
END

IF @pkName IS NOT NULL
BEGIN
    SET @sql = 'ALTER TABLE dbo.Medicamento_Categoria ADD CONSTRAINT [' + @pkName + '] PRIMARY KEY (id_medicamento, id_categoria)';
    EXEC sp_executesql @sql;
    PRINT 'RECREAR PK: ' + @pkName;
END
ELSE
BEGIN
    -- Crear PK con nombre generado (si la original no se encontro)
    SET @sql = 'ALTER TABLE dbo.Medicamento_Categoria ADD CONSTRAINT PK_Medicamento_Categoria PRIMARY KEY (id_medicamento, id_categoria)';
    EXEC sp_executesql @sql;
    PRINT 'CREAR PK: PK_Medicamento_Categoria';
END

-- ============================================================
-- 3. RECREAR TODAS las FK
-- ============================================================
PRINT 'Recreando FKs...';

-- Caso_Especial -> Ticket
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'Ticket_Caso_Especial_FK')
BEGIN
    ALTER TABLE dbo.Ticket ADD CONSTRAINT [Ticket_Caso_Especial_FK] FOREIGN KEY (id_caso_especial_ticekt) REFERENCES dbo.Caso_Especial(id_caso_especial) ON DELETE CASCADE ON UPDATE CASCADE;
    PRINT 'FK: Ticket_Caso_Especial_FK';
END

-- Cita FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cita_Estado_Cita')
BEGIN
    ALTER TABLE dbo.Cita ADD CONSTRAINT [FK_Cita_Estado_Cita] FOREIGN KEY (id_estado_cita) REFERENCES dbo.Estados_Citas(Id_Estado_Cita);
    PRINT 'FK: FK_Cita_Estado_Cita';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cita_Sede')
BEGIN
    ALTER TABLE dbo.Cita ADD CONSTRAINT [FK_Cita_Sede] FOREIGN KEY (id_sede) REFERENCES dbo.Sede(id_sede);
    PRINT 'FK: FK_Cita_Sede';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cita_Servicio')
BEGIN
    ALTER TABLE dbo.Cita ADD CONSTRAINT [FK_Cita_Servicio] FOREIGN KEY (id_servicio) REFERENCES dbo.Servicio(id_servicio);
    PRINT 'FK: FK_Cita_Servicio';
END

-- Estados_Tickets -> Ticket
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'Ticket_Estados_Tickets_FK')
BEGIN
    ALTER TABLE dbo.Ticket ADD CONSTRAINT [Ticket_Estados_Tickets_FK] FOREIGN KEY (id_estado_ticket) REFERENCES dbo.Estados_Tickets(Id_Estado_Ticket) ON DELETE CASCADE ON UPDATE CASCADE;
    PRINT 'FK: Ticket_Estados_Tickets_FK';
END

-- HistorialClinico FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Historial_Cita')
BEGIN
    ALTER TABLE dbo.HistorialClinico ADD CONSTRAINT [FK_Historial_Cita] FOREIGN KEY (id_cita) REFERENCES dbo.Cita(id_cita);
    PRINT 'FK: FK_Historial_Cita';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Historial_Medico')
BEGIN
    ALTER TABLE dbo.HistorialClinico ADD CONSTRAINT [FK_Historial_Medico] FOREIGN KEY (id_medico) REFERENCES dbo.Usuario(id_usuario);
    PRINT 'FK: FK_Historial_Medico';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Historial_Paciente')
BEGIN
    ALTER TABLE dbo.HistorialClinico ADD CONSTRAINT [FK_Historial_Paciente] FOREIGN KEY (id_paciente) REFERENCES dbo.Usuario(id_usuario);
    PRINT 'FK: FK_Historial_Paciente';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Historial_Receta')
BEGIN
    ALTER TABLE dbo.HistorialClinico ADD CONSTRAINT [FK_Historial_Receta] FOREIGN KEY (orden_receta) REFERENCES dbo.Receta(Orden_Receta);
    PRINT 'FK: FK_Historial_Receta';
END

-- Inventario_Sede FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventario_Medicamento')
BEGIN
    ALTER TABLE dbo.Inventario_Sede ADD CONSTRAINT [FK_Inventario_Medicamento] FOREIGN KEY (id_medicamento) REFERENCES dbo.Medicamento(id_medicamento);
    PRINT 'FK: FK_Inventario_Medicamento';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventario_Sede')
BEGIN
    ALTER TABLE dbo.Inventario_Sede ADD CONSTRAINT [FK_Inventario_Sede] FOREIGN KEY (id_sede) REFERENCES dbo.Sede(id_sede);
    PRINT 'FK: FK_Inventario_Sede';
END

-- LogTicket FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'LogTicket_Ticket_FK')
BEGIN
    ALTER TABLE dbo.LogTicket ADD CONSTRAINT [LogTicket_Ticket_FK] FOREIGN KEY (id_ticket) REFERENCES dbo.Ticket(id_ticket) ON DELETE CASCADE ON UPDATE CASCADE;
    PRINT 'FK: LogTicket_Ticket_FK';
END

-- LogUsuario FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'LogUsuario_Usuario_FK')
BEGIN
    ALTER TABLE dbo.LogUsuario ADD CONSTRAINT [LogUsuario_Usuario_FK] FOREIGN KEY (usuario_afectado_id) REFERENCES dbo.Usuario(id_usuario);
    PRINT 'FK: LogUsuario_Usuario_FK';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'LogUsuario_Usuario_FK_1')
BEGIN
    ALTER TABLE dbo.LogUsuario ADD CONSTRAINT [LogUsuario_Usuario_FK_1] FOREIGN KEY (usuario_ejecutor) REFERENCES dbo.Usuario(id_usuario);
    PRINT 'FK: LogUsuario_Usuario_FK_1';
END

-- Medicamento_Categoria FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK__Medicamen__id_ca__2B5F6B28')
BEGIN
    ALTER TABLE dbo.Medicamento_Categoria ADD CONSTRAINT [FK__Medicamen__id_ca__2B5F6B28] FOREIGN KEY (id_categoria) REFERENCES dbo.Categoria_Medicamento(id_categoria);
    PRINT 'FK: FK__Medicamen__id_ca__2B5F6B28';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK__Medicamen__id_me__2A6B46EF')
BEGIN
    ALTER TABLE dbo.Medicamento_Categoria ADD CONSTRAINT [FK__Medicamen__id_me__2A6B46EF] FOREIGN KEY (id_medicamento) REFERENCES dbo.Medicamento(id_medicamento);
    PRINT 'FK: FK__Medicamen__id_me__2A6B46EF';
END

-- Receta FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Receta_Cita')
BEGIN
    ALTER TABLE dbo.Receta ADD CONSTRAINT [FK_Receta_Cita] FOREIGN KEY (id_cita) REFERENCES dbo.Cita(id_cita);
    PRINT 'FK: FK_Receta_Cita';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Receta_Medico')
BEGIN
    ALTER TABLE dbo.Receta ADD CONSTRAINT [FK_Receta_Medico] FOREIGN KEY (id_medico) REFERENCES dbo.Empleado(id_medico);
    PRINT 'FK: FK_Receta_Medico';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Receta_Paciente')
BEGIN
    ALTER TABLE dbo.Receta ADD CONSTRAINT [FK_Receta_Paciente] FOREIGN KEY (id_paciente) REFERENCES dbo.Usuario(id_usuario);
    PRINT 'FK: FK_Receta_Paciente';
END

-- Receta_Detalle FKs
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK__Receta_De__id_me__22CA2527')
BEGIN
    ALTER TABLE dbo.Receta_Detalle ADD CONSTRAINT [FK__Receta_De__id_me__22CA2527] FOREIGN KEY (id_medicamento) REFERENCES dbo.Medicamento(id_medicamento);
    PRINT 'FK: FK__Receta_De__id_me__22CA2527';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK__Receta_De__id_re__21D600EE')
BEGIN
    ALTER TABLE dbo.Receta_Detalle ADD CONSTRAINT [FK__Receta_De__id_re__21D600EE] FOREIGN KEY (id_receta) REFERENCES dbo.Receta(id_receta);
    PRINT 'FK: FK__Receta_De__id_re__21D600EE';
END

-- Servicio FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'servicios_especialidad_fk')
BEGIN
    ALTER TABLE dbo.Servicio ADD CONSTRAINT [servicios_especialidad_fk] FOREIGN KEY (id_especialidad) REFERENCES dbo.Especialidad(id_especialidad);
    PRINT 'FK: servicios_especialidad_fk';
END

-- Sesion FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Sesion_Usuario')
BEGIN
    ALTER TABLE dbo.Sesion ADD CONSTRAINT [FK_Sesion_Usuario] FOREIGN KEY (id_usuario) REFERENCES dbo.Usuario(id_usuario);
    PRINT 'FK: FK_Sesion_Usuario';
END

-- Ticket FKs (restantes)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ticket_Sede')
BEGIN
    ALTER TABLE dbo.Ticket ADD CONSTRAINT [FK_Ticket_Sede] FOREIGN KEY (id_sede) REFERENCES dbo.Sede(id_sede);
    PRINT 'FK: FK_Ticket_Sede';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'Ticket_Cita_FK')
BEGIN
    ALTER TABLE dbo.Ticket ADD CONSTRAINT [Ticket_Cita_FK] FOREIGN KEY (id_cita) REFERENCES dbo.Cita(id_cita) ON DELETE CASCADE ON UPDATE CASCADE;
    PRINT 'FK: Ticket_Cita_FK';
END

-- Usuario FK
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'Usuario_Rol_FK')
BEGIN
    ALTER TABLE dbo.Usuario ADD CONSTRAINT [Usuario_Rol_FK] FOREIGN KEY (rol) REFERENCES dbo.Rol(id_rol) ON DELETE CASCADE ON UPDATE CASCADE;
    PRINT 'FK: Usuario_Rol_FK';
END

PRINT 'Todas las FK recreadas.';
PRINT 'FIN';
