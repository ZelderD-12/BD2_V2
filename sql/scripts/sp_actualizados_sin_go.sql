-- =============================================
-- SP ACTUALIZADOS - CLINICA
-- SIN GO - Ejecutar cada CREATE por separado
-- =============================================
-- PASO 1 (opcional): Dropear los SPs viejos
-- (solo si ya existen, para recrearlos)
-- =============================================
IF OBJECT_ID('dbo.sp_ReservarCita', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_ReservarCita;
IF OBJECT_ID('dbo.sp_CancelarCita', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CancelarCita;
IF OBJECT_ID('dbo.sp_ConfirmarCita', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_ConfirmarCita;
IF OBJECT_ID('dbo.sp_GenerarTicket', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GenerarTicket;
--
-- =============================================
-- PASO 2: Ejecutar cada CREATE uno por uno
-- (seleccionar desde "CREATE" hasta "END;")
-- =============================================

-- ========== 1. sp_ReservarCita ==========
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

    IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE id_servicio = @id_servicio AND Activo = 1)
    BEGIN SET @mensaje_out = 'SERVICIO_NO_EXISTE'; RETURN 422; END
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE id_usuario = @id_medico AND rol = 3)
    BEGIN SET @mensaje_out = 'MEDICO_NO_EXISTE'; RETURN 422; END
    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE id_usuario = @id_paciente)
    BEGIN SET @mensaje_out = 'PACIENTE_NO_EXISTE'; RETURN 404; END
    IF NOT EXISTS (SELECT 1 FROM dbo.Sede WHERE id_sede = @id_sede AND activo = 1)
    BEGIN SET @mensaje_out = 'SEDE_NO_EXISTE'; RETURN 422; END

    BEGIN TRY
        BEGIN TRANSACTION;
        IF EXISTS (SELECT 1 FROM dbo.Cita WITH (UPDLOCK, HOLDLOCK)
                   WHERE id_paciente = @id_paciente AND id_medico = @id_medico
                     AND id_servicio = @id_servicio AND id_sede = @id_sede
                     AND fecha_inicio = @fecha_inicio AND id_estado_cita IN (1, 2))
        BEGIN ROLLBACK; SET @mensaje_out = 'CITA_DUPLICADA'; RETURN 422; END

        DECLARE @ultima_fecha_fin DATETIME2;
        SELECT TOP 1 @ultima_fecha_fin = fecha_fin FROM dbo.Cita
        WHERE id_paciente = @id_paciente AND id_estado_cita IN (1, 2)
          AND CAST(fecha_inicio AS DATE) = CAST(@fecha_inicio AS DATE)
        ORDER BY fecha_fin DESC;

        IF @ultima_fecha_fin IS NOT NULL AND @fecha_inicio < DATEADD(HOUR, 1, @ultima_fecha_fin)
        BEGIN ROLLBACK; SET @mensaje_out = 'DEBE_ESPERAR_1H'; RETURN 422; END

        DECLARE @capacidad_slot INT, @ocupadas INT;
        SELECT @capacidad_slot = capacidad_slots FROM dbo.Sede WHERE id_sede = @id_sede;
        IF @capacidad_slot IS NULL OR @capacidad_slot = 0 SET @capacidad_slot = 1;

        SELECT @ocupadas = COUNT(*) FROM dbo.Cita WITH (UPDLOCK, HOLDLOCK)
        WHERE id_sede = @id_sede AND id_servicio = @id_servicio
          AND id_medico = @id_medico AND fecha_inicio = @fecha_inicio
          AND id_estado_cita IN (1, 2);

        IF @ocupadas >= @capacidad_slot
        BEGIN ROLLBACK; SET @mensaje_out = 'SIN_CUPO'; RETURN 409; END

        INSERT INTO dbo.Cita (id_paciente, id_medico, id_servicio, id_sede,
                              fecha_inicio, fecha_fin, id_estado_cita, motivo_consulta, fecha_solicitud)
        VALUES (@id_paciente, @id_medico, @id_servicio, @id_sede,
                @fecha_inicio, DATEADD(MINUTE, 30, @fecha_inicio),
                2, @motivo_consulta, GETDATE());

        SET @id_cita_out = SCOPE_IDENTITY();
        SET @mensaje_out = 'CREADA';
        COMMIT;
        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SET @mensaje_out = 'Error: ' + ERROR_MESSAGE();
        RETURN 500;
    END CATCH
END;
--
-- ========== 2. sp_CancelarCita ==========
CREATE PROCEDURE dbo.sp_CancelarCita
    @id_cita              SMALLINT,
    @id_paciente          SMALLINT,
    @motivo_cancelacion   VARCHAR(200) = NULL,
    @mensaje_out          VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Cita WHERE id_cita = @id_cita AND id_paciente = @id_paciente)
    BEGIN SET @mensaje_out = 'CITA_NO_ENCONTRADA'; RETURN 404; END

    UPDATE dbo.Cita
    SET id_estado_cita = 4,
        motivo_cancelacion = @motivo_cancelacion
    WHERE id_cita = @id_cita AND id_paciente = @id_paciente;

    SET @mensaje_out = 'CANCELADA';
    RETURN 0;
END;
--
-- ========== 3. sp_ConfirmarCita ==========
CREATE PROCEDURE dbo.sp_ConfirmarCita
    @id_cita     SMALLINT,
    @id_paciente SMALLINT,
    @mensaje_out VARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @estado_actual INT;
    SELECT @estado_actual = id_estado_cita
    FROM dbo.Cita
    WHERE id_cita = @id_cita AND id_paciente = @id_paciente;

    IF @estado_actual IS NULL
    BEGIN SET @mensaje_out = 'CITA_NO_ENCONTRADA'; RETURN 404; END

    IF @estado_actual IN (3, 4, 6, 7)
    BEGIN SET @mensaje_out = 'CITA_NO_VIGENTE'; RETURN 422; END

    IF @estado_actual = 2
    BEGIN SET @mensaje_out = 'YA_CONFIRMADA'; RETURN 0; END

    UPDATE dbo.Cita
    SET id_estado_cita = 2, fecha_confirmacion = GETDATE()
    WHERE id_cita = @id_cita;

    SET @mensaje_out = 'CONFIRMADA';
    RETURN 0;
END;
--
-- ========== 4. sp_GenerarTicket ==========
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
    DECLARE @id_paciente SMALLINT, @id_servicio SMALLINT, @ultimo_codigo VARCHAR(20), @ultimo_seq INT;

    IF @prioridad NOT IN ('NORMAL','ANCIANO','EMBARAZO','DISCAPACIDAD','ESPECIAL')
    BEGIN SET @mensaje_out = 'Prioridad invalida'; RETURN 422; END

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE id_usuario = @id_recepcionista AND rol IN (5,6,7,8,9,10))
    BEGIN SET @mensaje_out = 'Solo personal autorizado (roles 5-10) puede generar tickets'; RETURN 401; END

    IF @id_cita IS NOT NULL AND @id_cita > 0
    BEGIN
        DECLARE @estado_cita INT, @id_paciente_cita SMALLINT, @id_servicio_cita SMALLINT, @id_sede_cita SMALLINT, @nombres_cita VARCHAR(120), @apellidos_cita VARCHAR(120);

        SELECT @id_paciente_cita = c.id_paciente, @id_servicio_cita = c.id_servicio, @estado_cita = c.id_estado_cita, @id_sede_cita = c.id_sede, @nombres_cita = u.nombres, @apellidos_cita = u.apellidos
        FROM dbo.Cita c JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario WHERE c.id_cita = @id_cita;

        IF @id_paciente_cita IS NULL
        BEGIN SET @mensaje_out = 'La cita #' + CAST(@id_cita AS VARCHAR) + ' no existe'; RETURN 404; END

        IF @estado_cita IN (3, 4, 6, 7)
        BEGIN SET @mensaje_out = 'La cita ya no esta vigente (Reprogramada, Cancelada, No Show o Expirada)'; RETURN 422; END

        IF @nombres IS NULL
        BEGIN SET @nombres = @nombres_cita; SET @apellidos = @apellidos_cita; SET @id_paciente = @id_paciente_cita; SET @id_servicio = @id_servicio_cita; SET @id_sede = @id_sede_cita; END
        ELSE
        BEGIN SET @id_paciente = @id_paciente_cita; SET @id_servicio = @id_servicio_cita; SET @id_sede = @id_sede_cita; END
    END
    ELSE
    BEGIN
        IF @nombres IS NULL OR @apellidos IS NULL
        BEGIN SET @mensaje_out = 'Para ticket sin cita, debe proporcionar nombres y apellidos'; RETURN 422; END
        SELECT @id_paciente = id_usuario FROM dbo.Usuario WHERE nombres = @nombres AND apellidos = @apellidos;
        IF @id_paciente IS NULL
        BEGIN SET @mensaje_out = 'Paciente no encontrado con esos datos'; RETURN 404; END
    END

    SELECT TOP 1 @ultimo_codigo = codigo_ticket FROM dbo.Ticket WHERE id_sede = @id_sede ORDER BY id_ticket DESC;
    IF @ultimo_codigo IS NULL SET @ultimo_seq = 1
    ELSE BEGIN
        BEGIN TRY
            SET @ultimo_seq = CAST(SUBSTRING(@ultimo_codigo, 2, LEN(@ultimo_codigo)) AS INT) + 1;
        END TRY
        BEGIN CATCH
            SET @ultimo_seq = 1;
        END CATCH
    END

    SET @codigo_out = CHAR(64 + @id_sede) + RIGHT('000' + CAST(@ultimo_seq AS VARCHAR), 3);

    INSERT INTO dbo.Ticket (id_paciente, id_sede, id_servicio, prioridad, id_estado_ticket, codigo_ticket, fecha_generacion, id_cita, id_recepcionista)
    VALUES (@id_paciente, @id_sede, @id_servicio, @prioridad, 1, @codigo_out, GETDATE(), @id_cita, @id_recepcionista);

    SET @id_ticket_out = SCOPE_IDENTITY();
    SET @mensaje_out = 'TICKET_CREADO';
    RETURN 0;
END;
