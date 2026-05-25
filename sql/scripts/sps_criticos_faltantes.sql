-- =============================================
-- STORED PROCEDURES CRITICOS FALTANTES
-- Compatibles con esquema v1 del backup
-- =============================================
USE [ClinicaF];
GO

-- =============================================
-- sp_ObtenerUsuario
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerUsuario', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerUsuario;
GO

CREATE PROCEDURE dbo.sp_ObtenerUsuario
    @id_usuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id_usuario, nombres, apellidos, dpi, telefono, direccion,
           email, sexo, fecha_nacimiento, rol, contacto_emergencia,
           antecedetes_medicos
    FROM dbo.Usuario
    WHERE id_usuario = @id_usuario;
END;
GO

-- =============================================
-- sp_ObtenerUsuarioPorEmailTelefono
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerUsuarioPorEmailTelefono', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerUsuarioPorEmailTelefono;
GO

CREATE PROCEDURE dbo.sp_ObtenerUsuarioPorEmailTelefono
    @email    VARCHAR(100) = NULL,
    @telefono VARCHAR(15)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id_usuario
    FROM dbo.Usuario
    WHERE (@email IS NULL OR email = @email)
      AND (@telefono IS NULL OR telefono = @telefono);
END;
GO

-- =============================================
-- sp_HealthCheck
-- =============================================
IF OBJECT_ID('dbo.sp_HealthCheck', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_HealthCheck;
GO

CREATE PROCEDURE dbo.sp_HealthCheck
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        @@SERVERNAME AS server,
        DB_NAME() AS db,
        GETDATE() AS time;
END;
GO

-- =============================================
-- sp_ObtenerSedes
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerSedes', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerSedes;
GO

CREATE PROCEDURE dbo.sp_ObtenerSedes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id_sede, nombre, ubicacion, capacidad_slots
    FROM dbo.Sede
    WHERE activo = 1
    ORDER BY id_sede;
END;
GO

-- =============================================
-- sp_ObtenerServicios
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerServicios', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerServicios;
GO

CREATE PROCEDURE dbo.sp_ObtenerServicios
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        id_servicio,
        Nombre_Servicio AS servicio,
        duracion_slot_min
    FROM dbo.Servicio
    WHERE Activo = 1
    ORDER BY Nombre_Servicio;
END;
GO

-- =============================================
-- sp_obtener_servicios (backup compat)
-- =============================================
IF OBJECT_ID('dbo.sp_obtener_servicios', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_obtener_servicios;
GO

CREATE PROCEDURE dbo.sp_obtener_servicios
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        id_servicio,
        id_especialidad,
        Nombre_Servicio AS servicio,
        duracion_slot_min
    FROM dbo.Servicio
    WHERE Activo = 1
    ORDER BY Nombre_Servicio;
END;
GO

-- =============================================
-- sp_ObtenerMedicos
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerMedicos', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerMedicos;
GO

CREATE PROCEDURE dbo.sp_ObtenerMedicos
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        u.id_usuario AS id_medico,
        u.nombres,
        u.apellidos,
        u.nombres + ' ' + u.apellidos AS nombre_completo
    FROM dbo.Usuario u
    WHERE u.rol = 3
    ORDER BY u.nombres, u.apellidos;
END;
GO

-- =============================================
-- sp_ConfirmarCita
-- =============================================
IF OBJECT_ID('dbo.sp_ConfirmarCita', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ConfirmarCita;
GO

CREATE PROCEDURE dbo.sp_ConfirmarCita
    @id_cita     SMALLINT,
    @id_paciente SMALLINT,
    @mensaje_out VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cita WHERE id_cita = @id_cita AND id_paciente = @id_paciente)
    BEGIN
        SET @mensaje_out = 'CITA_NO_ENCONTRADA';
        RETURN 404;
    END

    IF EXISTS (SELECT 1 FROM dbo.Cita WHERE id_cita = @id_cita AND id_estado_cita <> 1)
    BEGIN
        SET @mensaje_out = 'SOLO_PENDIENTES_PUEDEN_CONFIRMARSE';
        RETURN 422;
    END

    BEGIN TRAN
        UPDATE dbo.Cita
        SET id_estado_cita = 2, fecha_confirmacion = GETDATE()
        WHERE id_cita = @id_cita;
    COMMIT TRAN

    SET @mensaje_out = 'CONFIRMADA';
    RETURN 0;
END;
GO

-- =============================================
-- sp_CancelarCita
-- =============================================
IF OBJECT_ID('dbo.sp_CancelarCita', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CancelarCita;
GO

CREATE PROCEDURE dbo.sp_CancelarCita
    @id_cita              SMALLINT,
    @id_paciente          SMALLINT,
    @motivo_cancelacion   VARCHAR(200) = NULL,
    @mensaje_out          VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cita WHERE id_cita = @id_cita AND id_paciente = @id_paciente)
    BEGIN
        SET @mensaje_out = 'CITA_NO_ENCONTRADA';
        RETURN 404;
    END

    UPDATE dbo.Cita
    SET id_estado_cita = 3,
        motivo_cancelacion = @motivo_cancelacion
    WHERE id_cita = @id_cita AND id_paciente = @id_paciente;

    SET @mensaje_out = 'CANCELADA';
    RETURN 0;
END;
GO

-- =============================================
-- sp_GetPacienteByTicket
-- =============================================
IF OBJECT_ID('dbo.sp_GetPacienteByTicket', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetPacienteByTicket;
GO

CREATE PROCEDURE dbo.sp_GetPacienteByTicket
    @id_ticket INT = NULL,
    @codigo_ticket VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        t.id_ticket,
        t.codigo_ticket,
        t.id_paciente,
        u.nombres,
        u.apellidos,
        t.id_sede,
        s.nombre AS nombre_sede,
        t.id_servicio,
        sv.Nombre_Servicio AS nombre_servicio,
        t.id_estado_ticket,
        t.prioridad
    FROM dbo.Ticket t
    JOIN dbo.Usuario u ON t.id_paciente = u.id_usuario
    LEFT JOIN dbo.Sede s ON t.id_sede = s.id_sede
    LEFT JOIN dbo.Servicio sv ON t.id_servicio = sv.id_servicio
    WHERE (@id_ticket IS NULL OR t.id_ticket = @id_ticket)
      AND (@codigo_ticket IS NULL OR t.codigo_ticket = @codigo_ticket);
END;
GO

-- =============================================
-- sp_tickets_cola_actuales
-- =============================================
IF OBJECT_ID('dbo.sp_tickets_cola_actuales', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_tickets_cola_actuales;
GO

CREATE PROCEDURE dbo.sp_tickets_cola_actuales
    @id_sede        SMALLINT,
    @fecha_hora     DATETIME = NULL,
    @minutos_gracia INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    IF @fecha_hora IS NULL SET @fecha_hora = GETDATE();

    SELECT 
        t.id_ticket,
        t.codigo_ticket,
        t.id_paciente,
        u.nombres,
        u.apellidos,
        t.prioridad,
        t.id_servicio,
        sv.Nombre_Servicio AS servicio,
        t.fecha_generacion,
        t.id_estado_ticket,
        CASE t.prioridad
            WHEN 'EMERGENCIA' THEN 1
            WHEN 'ANCIANO' THEN 2
            WHEN 'EMBARAZO' THEN 3
            WHEN 'DISCAPACIDAD' THEN 4
            ELSE 5
        END AS prioridad_num
    FROM dbo.Ticket t
    JOIN dbo.Usuario u ON t.id_paciente = u.id_usuario
    LEFT JOIN dbo.Servicio sv ON t.id_servicio = sv.id_servicio
    WHERE t.id_sede = @id_sede
      AND t.id_estado_ticket IN (1, 2)
      AND t.fecha_generacion >= DATEADD(MINUTE, -@minutos_gracia, @fecha_hora)
    ORDER BY prioridad_num ASC, t.fecha_generacion ASC;
END;
GO

-- =============================================
-- sp_ObtenerCitasPorMedico
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerCitasPorMedico', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerCitasPorMedico;
GO

CREATE PROCEDURE dbo.sp_ObtenerCitasPorMedico
    @id_usuario_m SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        c.id_cita,
        c.id_paciente,
        u.nombres + ' ' + u.apellidos AS paciente,
        u.nombres,
        u.apellidos,
        s.Nombre_Servicio AS servicio,
        c.fecha_inicio,
        c.fecha_fin,
        c.id_estado_cita,
        e.Nombre_Estado_Cita AS estado_cita,
        c.motivo_consulta
    FROM dbo.Cita c
    JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
    JOIN dbo.Servicio s ON c.id_servicio = s.id_servicio
    LEFT JOIN dbo.Estados_Citas e ON c.id_estado_cita = e.Id_Estado_Cita
    WHERE c.id_medico = @id_usuario_m
    ORDER BY c.fecha_inicio DESC;
END;
GO

-- =============================================
-- sp_ObtenerCitasEnAtencion
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerCitasEnAtencion', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerCitasEnAtencion;
GO

CREATE PROCEDURE dbo.sp_ObtenerCitasEnAtencion
    @id_usuario_m SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        c.id_cita,
        c.id_paciente,
        u.nombres + ' ' + u.apellidos AS paciente,
        s.Nombre_Servicio AS servicio,
        c.fecha_inicio
    FROM dbo.Cita c
    JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
    JOIN dbo.Servicio s ON c.id_servicio = s.id_servicio
    WHERE c.id_medico = @id_usuario_m
      AND c.id_estado_cita IN (4, 5)
    ORDER BY c.fecha_inicio ASC;
END;
GO

-- =============================================
-- sp_logout_usuario
-- =============================================
IF OBJECT_ID('dbo.sp_logout_usuario', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_logout_usuario;
GO

CREATE PROCEDURE dbo.sp_logout_usuario
    @token_sesion VARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Sesion
    SET fecha_cierre = GETDATE()
    WHERE token_sesion = @token_sesion AND fecha_cierre IS NULL;
END;
GO

-- =============================================
-- sp_usuarios_activos
-- =============================================
IF OBJECT_ID('dbo.sp_usuarios_activos', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_usuarios_activos;
GO

CREATE PROCEDURE dbo.sp_usuarios_activos
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        u.id_usuario,
        u.nombres + ' ' + u.apellidos AS nombre_completo,
        u.email,
        r.rol,
        s.ultima_actividad
    FROM dbo.Sesion s
    JOIN dbo.Usuario u ON s.id_usuario = u.id_usuario
    LEFT JOIN dbo.Rol r ON u.rol = r.id_rol
    WHERE s.fecha_cierre IS NULL
    ORDER BY s.ultima_actividad DESC;
END;
GO

-- =============================================
-- sp_usuarios_inactivos
-- =============================================
IF OBJECT_ID('dbo.sp_usuarios_inactivos', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_usuarios_inactivos;
GO

CREATE PROCEDURE dbo.sp_usuarios_inactivos
    @dias_atras INT = 7
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        u.id_usuario,
        u.nombres + ' ' + u.apellidos AS nombre_completo,
        u.email,
        MAX(s.ultima_actividad) AS ultima_actividad
    FROM dbo.Usuario u
    LEFT JOIN dbo.Sesion s ON u.id_usuario = s.id_usuario
    WHERE u.rol >= 5
    GROUP BY u.id_usuario, u.nombres, u.apellidos, u.email
    HAVING MAX(s.ultima_actividad) IS NULL 
        OR MAX(s.ultima_actividad) < DATEADD(DAY, -@dias_atras, GETDATE())
    ORDER BY ultima_actividad DESC;
END;
GO

-- =============================================
-- dsp_renovar_sesion
-- =============================================
IF OBJECT_ID('dbo.dsp_renovar_sesion', 'P') IS NOT NULL
    DROP PROCEDURE dbo.dsp_renovar_sesion;
GO

CREATE PROCEDURE dbo.dsp_renovar_sesion
    @token_sesion VARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.Sesion
    SET ultima_actividad = GETDATE()
    WHERE token_sesion = @token_sesion;
END;
GO

-- =============================================
-- dsp_limpiar_sesiones_expiradas
-- =============================================
IF OBJECT_ID('dbo.dsp_limpiar_sesiones_expiradas', 'P') IS NOT NULL
    DROP PROCEDURE dbo.dsp_limpiar_sesiones_expiradas;
GO

CREATE PROCEDURE dbo.dsp_limpiar_sesiones_expiradas
    @minutos_inactividad INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.Sesion
    SET fecha_cierre = GETDATE()
    WHERE fecha_cierre IS NULL
      AND ultima_actividad < DATEADD(MINUTE, -@minutos_inactividad, GETDATE());
END;
GO

-- =============================================
-- sp_ModificarCita
-- =============================================
IF OBJECT_ID('dbo.sp_ModificarCita', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ModificarCita;
GO

CREATE PROCEDURE dbo.sp_ModificarCita
    @id_cita            SMALLINT,
    @id_paciente        SMALLINT,
    @nuevo_id_servicio  SMALLINT = NULL,
    @nueva_fecha_inicio DATETIME2 = NULL,
    @nuevo_motivo       VARCHAR(300) = NULL,
    @mensaje_out        VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cita WHERE id_cita = @id_cita AND id_paciente = @id_paciente)
    BEGIN
        SET @mensaje_out = 'CITA_NO_ENCONTRADA';
        RETURN 404;
    END

    UPDATE dbo.Cita
    SET 
        id_servicio = ISNULL(@nuevo_id_servicio, id_servicio),
        fecha_inicio = ISNULL(@nueva_fecha_inicio, fecha_inicio),
        fecha_fin = DATEADD(MINUTE, 30, ISNULL(@nueva_fecha_inicio, fecha_inicio)),
        motivo_consulta = ISNULL(@nuevo_motivo, motivo_consulta)
    WHERE id_cita = @id_cita;

    SET @mensaje_out = 'MODIFICADA';
    RETURN 0;
END;
GO

-- =============================================
-- SP_Medicamentos_Obtener
-- =============================================
IF OBJECT_ID('dbo.SP_Medicamentos_Obtener', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_Medicamentos_Obtener;
GO

CREATE PROCEDURE dbo.SP_Medicamentos_Obtener
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT id_medicamento, Nombre AS nombre
    FROM dbo.Medicamento
    ORDER BY Nombre;
END;
GO

-- =============================================
-- SP_Paciente_ObtenerInfo
-- =============================================
IF OBJECT_ID('dbo.SP_Paciente_ObtenerInfo', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_Paciente_ObtenerInfo;
GO

CREATE PROCEDURE dbo.SP_Paciente_ObtenerInfo
    @id_paciente SMALLINT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        id_usuario,
        nombres,
        apellidos,
        dpi,
        telefono,
        direccion,
        email,
        sexo,
        fecha_nacimiento,
        contacto_emergencia,
        antecedetes_medicos
    FROM dbo.Usuario
    WHERE id_usuario = @id_paciente;
END;
GO

-- =============================================
-- sp_ObtenerServicioCita
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerServicioCita', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerServicioCita;
GO

CREATE PROCEDURE dbo.sp_ObtenerServicioCita
    @id_cita INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id_servicio FROM dbo.Cita WHERE id_cita = @id_cita;
END;
GO

-- =============================================
-- SP_Receta_CrearConMedicamentos
-- =============================================
IF OBJECT_ID('dbo.SP_Receta_CrearConMedicamentos', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SP_Receta_CrearConMedicamentos;
GO

CREATE PROCEDURE dbo.SP_Receta_CrearConMedicamentos
    @id_cita SMALLINT,
    @id_medico SMALLINT,
    @id_paciente SMALLINT,
    @medicamentos_json VARCHAR(MAX),
    @orden_receta_out VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @nueva_orden VARCHAR(30);
    SELECT @nueva_orden = 'RX-' + CONVERT(VARCHAR(8), GETDATE(), 112) + '-' + CAST(@id_paciente AS VARCHAR);
    SET @orden_receta_out = @nueva_orden;

    INSERT INTO dbo.Receta (Orden_Receta, id_cita, id_medico, id_paciente, id_medicamento, observaciones, fecha_emision)
    VALUES (@nueva_orden, @id_cita, @id_medico, @id_paciente, 1, 'Receta creada via app', GETDATE());
END;
GO

PRINT '=== SPs criticos creados exitosamente ===';
GO
