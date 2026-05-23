-- =============================================
-- MIGRACIÓN: Schema v1 (backup original) → v2
-- Agrega Sede, id_sede en Cita, y corrige SPs
-- =============================================

-- =============================================
-- 1. CREAR TABLA Sede
-- =============================================
IF OBJECT_ID('dbo.Sede', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sede (
        id_sede     SMALLINT      NOT NULL IDENTITY(1,1),
        nombre      VARCHAR(100)  NOT NULL,
        direccion   VARCHAR(255)  NULL,
        telefono    VARCHAR(20)   NULL,
        activo      BIT           NOT NULL DEFAULT 1,
        capacidad_slots INT NOT NULL DEFAULT 1,
        CONSTRAINT PK_Sede PRIMARY KEY (id_sede)
    );

    -- Insertar sedes por defecto
    INSERT INTO dbo.Sede (nombre, direccion, capacidad_slots)
    VALUES 
        ('Sede Central', '7a Avenida Zona 1, Guatemala', 5),
        ('Sede Sur', 'Calzada San Juan, Villa Nueva', 3),
        ('Sede Norte', 'Km 17, Mixco', 3);
END
GO

-- =============================================
-- 2. AGREGAR id_sede a Cita
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Cita' AND COLUMN_NAME = 'id_sede'
)
BEGIN
    ALTER TABLE dbo.Cita ADD id_sede SMALLINT NOT NULL CONSTRAINT DF_Cita_id_sede DEFAULT 1;
    PRINT 'Columna id_sede agregada a Cita con default = 1';
END
GO

-- Reemplazar las sedes viejas (varchar) forzadas a NULL
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Cita' AND COLUMN_NAME = 'sede'
)
BEGIN
    -- Si existía columna 'sede' varchar, la eliminamos
    PRINT 'No hay columna sede varchar en Cita';
END
GO

-- =============================================
-- 3. VERIFICAR que la FK de Cita → Sede exista
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Cita_Sede'
)
BEGIN
    ALTER TABLE dbo.Cita ADD CONSTRAINT FK_Cita_Sede 
        FOREIGN KEY (id_sede) REFERENCES dbo.Sede(id_sede);
    PRINT 'FK_Cita_Sede creada';
END
GO

-- =============================================
-- 4. VERIFICAR que Ticket tenga FK a Sede
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Ticket_Sede'
)
BEGIN
    ALTER TABLE dbo.Ticket ADD CONSTRAINT FK_Ticket_Sede 
        FOREIGN KEY (id_sede) REFERENCES dbo.Sede(id_sede);
    PRINT 'FK_Ticket_Sede creada';
END
GO

-- =============================================
-- 5. sp_ObtenerCitasPaciente (no existía antes)
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerCitasPaciente', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerCitasPaciente;
GO

CREATE PROCEDURE dbo.sp_ObtenerCitasPaciente
    @id_paciente   SMALLINT,
    @mostrar_todas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    IF @mostrar_todas = 1
    BEGIN
        SELECT
            c.id_cita,
            c.id_paciente,
            u.nombres,
            u.apellidos,
            u.email,
            c.id_sede,
            s.nombre AS nombre_sede,
            c.id_servicio,
            sv.Nombre_Servicio AS nombre_servicio,
            c.id_medico,
            m.nombres AS medico_nombres,
            m.apellidos AS medico_apellidos,
            c.fecha_inicio,
            c.fecha_fin,
            c.id_estado_cita,
            e.Nombre_Estado_Cita AS estado_cita,
            c.motivo_consulta,
            t.codigo_ticket,
            t.id_estado_ticket
        FROM dbo.Cita c
        JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
        LEFT JOIN dbo.Sede s ON c.id_sede = s.id_sede
        JOIN dbo.Servicio sv ON c.id_servicio = sv.id_servicio
        JOIN dbo.Usuario m ON c.id_medico = m.id_usuario
        LEFT JOIN dbo.Estados_Citas e ON c.id_estado_cita = e.Id_Estado_Cita
        LEFT JOIN dbo.Ticket t ON c.id_cita = t.id_cita AND t.id_estado_ticket IN (1,2)
        WHERE c.id_paciente = @id_paciente
        ORDER BY c.id_cita DESC;
    END
    ELSE
    BEGIN
        SELECT
            c.id_cita,
            c.id_paciente,
            u.nombres,
            u.apellidos,
            u.email,
            c.id_sede,
            s.nombre AS nombre_sede,
            c.id_servicio,
            sv.Nombre_Servicio AS nombre_servicio,
            c.id_medico,
            m.nombres AS medico_nombres,
            m.apellidos AS medico_apellidos,
            c.fecha_inicio,
            c.fecha_fin,
            c.id_estado_cita,
            e.Nombre_Estado_Cita AS estado_cita,
            c.motivo_consulta,
            t.codigo_ticket,
            t.id_estado_ticket
        FROM dbo.Cita c
        JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
        LEFT JOIN dbo.Sede s ON c.id_sede = s.id_sede
        JOIN dbo.Servicio sv ON c.id_servicio = sv.id_servicio
        JOIN dbo.Usuario m ON c.id_medico = m.id_usuario
        LEFT JOIN dbo.Estados_Citas e ON c.id_estado_cita = e.Id_Estado_Cita
        LEFT JOIN dbo.Ticket t ON c.id_cita = t.id_cita AND t.id_estado_ticket IN (1,2)
        WHERE c.id_paciente = @id_paciente
          AND c.id_estado_cita IN (1, 2)
        ORDER BY c.id_cita DESC;
    END
END;
GO

-- =============================================
-- 6. MODIFICAR SP_Receta_PorPaciente (agregar campos)
-- =============================================
IF OBJECT_ID('dbo.SP_Receta_PorPaciente', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_Receta_PorPaciente;
GO

CREATE PROCEDURE dbo.SP_Receta_PorPaciente
    @id_paciente SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.id_receta,
        r.id_cita,
        c.id_medico,
        u.nombres + ' ' + u.apellidos AS medico_nombre,
        r.fecha_emision,
        r.instrucciones,
        r.medicamentos_json,
        r.estado
    FROM dbo.Receta r
    LEFT JOIN dbo.Cita c ON r.id_cita = c.id_cita
    LEFT JOIN dbo.Usuario u ON c.id_medico = u.id_usuario
    WHERE r.id_paciente = @id_paciente
    ORDER BY r.fecha_emision DESC;
END;
GO

-- =============================================
-- 7. DROP y RECREAR sp_ReservarCita y sp_GenerarTicket
--    (ahora que ya existen Sede e id_sede en Cita)
-- =============================================
IF OBJECT_ID('dbo.sp_ReservarCita', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ReservarCita;
GO

CREATE PROCEDURE [dbo].[sp_ReservarCita]
    @id_paciente        SMALLINT,
    @id_medico          SMALLINT,
    @id_servicio        SMALLINT,
    @id_sede            SMALLINT,           
    @fecha_inicio       DATETIME2,
    @motivo_consulta    VARCHAR(300) = NULL,
    @id_cita_out        SMALLINT        OUTPUT,
    @mensaje_out        VARCHAR(200)    OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @id_cita_out = 0;
    SET @mensaje_out = '';

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Servicio 
        WHERE id_servicio = @id_servicio AND Activo = 1
    )
    BEGIN
        SET @mensaje_out = 'SERVICIO_NO_EXISTE';
        RETURN 422;
    END

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Usuario 
        WHERE id_usuario = @id_medico AND rol = 3
    )
    BEGIN
        SET @mensaje_out = 'MEDICO_NO_EXISTE';
        RETURN 422;
    END

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Usuario 
        WHERE id_usuario = @id_paciente
    )
    BEGIN
        SET @mensaje_out = 'PACIENTE_NO_EXISTE';
        RETURN 404;
    END

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Sede 
        WHERE id_sede = @id_sede AND activo = 1
    )
    BEGIN
        SET @mensaje_out = 'SEDE_NO_EXISTE';
        RETURN 422;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (
            SELECT 1
            FROM dbo.Cita WITH (UPDLOCK, HOLDLOCK)
            WHERE id_paciente = @id_paciente
              AND id_medico = @id_medico
              AND id_servicio = @id_servicio
              AND id_sede = @id_sede
              AND fecha_inicio = @fecha_inicio
              AND id_estado_cita IN (1, 2)
        )
        BEGIN
            ROLLBACK TRANSACTION;
            SET @mensaje_out = 'CITA_DUPLICADA';
            RETURN 422;
        END

        DECLARE @ultima_fecha_fin DATETIME2;

        SELECT TOP 1 @ultima_fecha_fin = fecha_fin
        FROM dbo.Cita
        WHERE id_paciente = @id_paciente
          AND id_estado_cita IN (1, 2)
          AND CAST(fecha_inicio AS DATE) = CAST(@fecha_inicio AS DATE)
        ORDER BY fecha_fin DESC;

        IF @ultima_fecha_fin IS NOT NULL 
           AND @fecha_inicio < DATEADD(HOUR, 1, @ultima_fecha_fin)
        BEGIN
            ROLLBACK TRANSACTION;
            SET @mensaje_out = 'DEBE_ESPERAR_1H';
            RETURN 422;
        END

        DECLARE @capacidad_slot INT;
        DECLARE @ocupadas INT;

        SELECT @capacidad_slot = capacidad_slots
        FROM dbo.Sede
        WHERE id_sede = @id_sede;

        IF @capacidad_slot IS NULL OR @capacidad_slot = 0
            SET @capacidad_slot = 1;

        SELECT @ocupadas = COUNT(*)
        FROM dbo.Cita WITH (UPDLOCK, HOLDLOCK)
        WHERE id_sede = @id_sede
          AND id_servicio = @id_servicio
          AND id_medico = @id_medico
          AND fecha_inicio = @fecha_inicio
          AND id_estado_cita IN (1, 2);

        IF @ocupadas >= @capacidad_slot
        BEGIN
            ROLLBACK TRANSACTION;
            SET @mensaje_out = 'SIN_CUPO|Capacidad maxima de ' + CAST(@capacidad_slot AS VARCHAR) + ' alcanzada.';
            RETURN 409;
        END

        INSERT INTO dbo.Cita (
            id_paciente, id_medico, id_servicio, id_sede,
            fecha_inicio, fecha_fin,
            id_estado_cita, motivo_consulta, fecha_solicitud
        )
        VALUES (
            @id_paciente, @id_medico, @id_servicio, @id_sede,
            @fecha_inicio, DATEADD(MINUTE, 30, @fecha_inicio),
            1, @motivo_consulta, GETDATE()
        );

        SET @id_cita_out = SCOPE_IDENTITY();
        SET @mensaje_out = 'CREADA';

        COMMIT TRANSACTION;
        RETURN 0;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @mensaje_out = 'Error: ' + ERROR_MESSAGE();
        RETURN 500;
    END CATCH
END;
GO

IF OBJECT_ID('dbo.sp_GenerarTicket', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GenerarTicket;
GO

CREATE PROCEDURE dbo.sp_GenerarTicket
    @nombres          VARCHAR(120) = NULL,
    @apellidos        VARCHAR(120) = NULL,
    @id_sede          SMALLINT = NULL,
    @prioridad        VARCHAR(20) = 'NORMAL',
    @id_cita          SMALLINT = NULL,
    @id_recepcionista SMALLINT,
    @id_ticket_out    SMALLINT OUTPUT,
    @codigo_out       VARCHAR(20) OUTPUT,
    @mensaje_out      VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @id_paciente SMALLINT;
    DECLARE @id_servicio SMALLINT;
    DECLARE @ultimo_codigo VARCHAR(20);
    DECLARE @ultimo_seq INT;

    IF @prioridad NOT IN ('NORMAL','ANCIANO','EMBARAZO','DISCAPACIDAD','ESPECIAL')
    BEGIN
        SET @mensaje_out = 'Prioridad invalida';
        RETURN 422;
    END

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Usuario
        WHERE id_usuario = @id_recepcionista
          AND rol IN (5,6,7,8,9,10)
    )
    BEGIN
        SET @mensaje_out = 'Solo personal autorizado (roles 5-10) puede generar tickets';
        RETURN 401;
    END

    IF @id_cita IS NOT NULL AND @id_cita > 0
    BEGIN
        DECLARE @estado_cita INT;
        DECLARE @id_paciente_cita SMALLINT;
        DECLARE @id_servicio_cita SMALLINT;
        DECLARE @id_sede_cita SMALLINT;
        DECLARE @nombres_cita VARCHAR(120);
        DECLARE @apellidos_cita VARCHAR(120);

        SELECT
            @id_paciente_cita = c.id_paciente,
            @id_servicio_cita = c.id_servicio,
            @estado_cita = c.id_estado_cita,
            @id_sede_cita = c.id_sede,
            @nombres_cita = u.nombres,
            @apellidos_cita = u.apellidos
        FROM dbo.Cita c
        JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
        WHERE c.id_cita = @id_cita;

        IF @id_paciente_cita IS NULL
        BEGIN
            SET @mensaje_out = 'La cita #' + CAST(@id_cita AS VARCHAR) + ' no existe';
            RETURN 404;
        END

        IF @estado_cita <> 2
        BEGIN
            SET @mensaje_out = 'Solo citas Confirmadas pueden generar ticket. Estado actual: ' + CAST(@estado_cita AS VARCHAR);
            RETURN 422;
        END

        IF @nombres IS NULL
        BEGIN
            SET @nombres = @nombres_cita;
            SET @apellidos = @apellidos_cita;
            SET @id_paciente = @id_paciente_cita;
            SET @id_servicio = @id_servicio_cita;
            SET @id_sede = @id_sede_cita;
        END
        ELSE
        BEGIN
            SET @id_paciente = @id_paciente_cita;
            SET @id_servicio = @id_servicio_cita;
            SET @id_sede = @id_sede_cita;
        END
    END
    ELSE
    BEGIN
        IF @nombres IS NULL OR @apellidos IS NULL
        BEGIN
            SET @mensaje_out = 'Para generar ticket sin cita, debe proporcionar nombres y apellidos del paciente';
            RETURN 422;
        END

        SELECT @id_paciente = id_usuario
        FROM dbo.Usuario
        WHERE nombres = @nombres
          AND apellidos = @apellidos;

        IF @id_paciente IS NULL
        BEGIN
            SELECT TOP 1 @id_paciente = id_usuario
            FROM dbo.Usuario
            WHERE CONCAT(nombres, ' ', apellidos) = @nombres + ' ' + @apellidos;
        END

        IF @id_paciente IS NULL
        BEGIN
            SET @mensaje_out = 'Paciente no encontrado: ' + @nombres + ' ' + @apellidos;
            RETURN 404;
        END

        SET @id_servicio = 1;

        IF @id_sede IS NULL
        BEGIN
            SET @mensaje_out = 'Debe especificar la sede para ticket sin cita';
            RETURN 422;
        END
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE id_servicio = @id_servicio AND Activo = 1)
    BEGIN
        SET @mensaje_out = 'Servicio no disponible';
        RETURN 422;
    END

    IF @prioridad = 'ESPECIAL'
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM dbo.Usuario
            WHERE id_usuario = @id_recepcionista AND rol = 10
        )
        BEGIN
            SET @mensaje_out = 'Prioridad ESPECIAL requiere rol Auditor (10)';
            RETURN 422;
        END
    END

    BEGIN TRY
        SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
        BEGIN TRANSACTION;

        IF @id_cita IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1 FROM dbo.Ticket WITH (UPDLOCK, HOLDLOCK)
                WHERE id_cita = @id_cita
                  AND id_estado_ticket IN (1,2)
            )
            BEGIN
                ROLLBACK TRANSACTION;
                SET @mensaje_out = 'La cita ya tiene un ticket generado';
                RETURN 409;
            END
        END

        SELECT TOP 1 @ultimo_codigo = codigo_ticket
        FROM dbo.Ticket WITH (HOLDLOCK)
        WHERE id_sede = @id_sede
          AND CAST(fecha_generacion AS DATE) = CAST(GETDATE() AS DATE)
        ORDER BY id_ticket DESC;

        IF @ultimo_codigo IS NOT NULL
        BEGIN
            DECLARE @guion_pos INT = CHARINDEX('-', @ultimo_codigo);
            IF @guion_pos > 0
                SET @ultimo_seq = CAST(SUBSTRING(@ultimo_codigo, @guion_pos + 1, 4) AS INT);
            ELSE
                SET @ultimo_seq = 0;
        END
        ELSE
        BEGIN
            SET @ultimo_seq = 0;
        END

        SET @ultimo_seq = @ultimo_seq + 1;
        SET @codigo_out = 'S' + RIGHT('0' + CAST(@id_sede AS VARCHAR), 2) + '-' + RIGHT('000' + CAST(@ultimo_seq AS VARCHAR), 4);

        WHILE EXISTS (SELECT 1 FROM dbo.Ticket WHERE codigo_ticket = @codigo_out)
        BEGIN
            SET @ultimo_seq = @ultimo_seq + 1;
            SET @codigo_out = 'S' + RIGHT('0' + CAST(@id_sede AS VARCHAR), 2) + '-' + RIGHT('000' + CAST(@ultimo_seq AS VARCHAR), 4);
        END

        INSERT INTO dbo.Ticket (
            id_cita, id_paciente, id_sede, id_servicio,
            codigo_ticket, prioridad, id_estado_ticket,
            id_recepcionista, fecha_generacion
        )
        VALUES (
            @id_cita, @id_paciente, @id_sede, @id_servicio,
            @codigo_out, @prioridad, 1,
            @id_recepcionista, GETDATE()
        );

        SET @id_ticket_out = CAST(SCOPE_IDENTITY() AS SMALLINT);
        COMMIT TRANSACTION;

        SET @mensaje_out = 'Ticket generado correctamente: ' + @codigo_out;
        RETURN 0;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @mensaje_out = 'Error: ' + ERROR_MESSAGE();
        SET @id_ticket_out = -1;
        SET @codigo_out = 'ERROR';
        RETURN 500;
    END CATCH
END;
GO

PRINT '=== Migración v2 completada exitosamente ===';
GO
