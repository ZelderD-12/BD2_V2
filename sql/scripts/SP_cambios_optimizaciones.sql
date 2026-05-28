-- =============================================
-- PROYECTO BD II - CLINICA
-- SP MODIFICADOS Y NUEVOS
-- Fecha: Mayo 2026
-- =============================================
-- NOTA: Ejecutar contra BD ClinicaF
-- Orden: 1) MODIFICAR → 2) NUEVOS
-- =============================================

-- =============================================
-- 1. MODIFICAR sp_ReservarCita
--    - Fix regla 1 hora: solo mismo día
--    - Control de capacidad del slot
--    - UPDLOCK/HOLDLOCK para concurrencia G1
-- =============================================
-- Si existe, eliminamos para recrear
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

    -- Validar servicio
    IF NOT EXISTS (
        SELECT 1 FROM dbo.Servicio 
        WHERE id_servicio = @id_servicio AND Activo = 1
    )
    BEGIN
        SET @mensaje_out = 'SERVICIO_NO_EXISTE';
        RETURN 422;
    END

    -- Validar médico
    IF NOT EXISTS (
        SELECT 1 FROM dbo.Usuario 
        WHERE id_usuario = @id_medico AND rol = 3
    )
    BEGIN
        SET @mensaje_out = 'MEDICO_NO_EXISTE';
        RETURN 422;
    END

    -- Validar paciente
    IF NOT EXISTS (
        SELECT 1 FROM dbo.Usuario 
        WHERE id_usuario = @id_paciente
    )
    BEGIN
        SET @mensaje_out = 'PACIENTE_NO_EXISTE';
        RETURN 404;
    END

    -- Validar sede
    IF NOT EXISTS (
        SELECT 1 FROM dbo.Sede 
        WHERE id_sede = @id_sede AND activo = 1
    )
    BEGIN
        SET @mensaje_out = 'SEDE_NO_EXISTE';
        RETURN 422;
    END

    -- ============================================
    -- INICIO TRANSACCIÓN CONCURRENTE
    -- ============================================
    BEGIN TRY
        BEGIN TRANSACTION;

        -- ============================================
        -- VERIFICAR DUPLICADO (CON LOCK)
        -- ============================================
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

        -- ============================================
        -- REGLA 1 HORA: Solo mismo día
        -- ============================================
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

        -- ============================================
        -- CONTROL DE CAPACIDAD DEL SLOT
        -- ============================================
        DECLARE @capacidad_slot INT;
        DECLARE @ocupadas INT;

        SELECT @capacidad_slot = capacidad_slots
        FROM dbo.Sede
        WHERE id_sede = @id_sede;

        IF @capacidad_slot IS NULL OR @capacidad_slot = 0
            SET @capacidad_slot = 1;

        -- Contar citas PENDIENTE(1) + CONFIRMADA(2) en el mismo slot
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

        -- ============================================
        -- INSERTAR CITA
        -- ============================================
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


-- =============================================
-- 2. MODIFICAR sp_GenerarTicket
--    - nombres/apellidos/id_sede OPCIONALES
--    - Si hay id_cita y no vienen nombres, derivar desde la BD
--    - Ya no requiere id_servicio (se obtiene de la cita)
-- =============================================
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

    -- ============================================
    -- VALIDACIONES INICIALES
    -- ============================================

    -- Validar prioridad
    IF @prioridad NOT IN ('NORMAL','ANCIANO','EMBARAZO','DISCAPACIDAD','ESPECIAL')
    BEGIN
        SET @mensaje_out = 'Prioridad invalida';
        RETURN 422;
    END

    -- Validar recepcionista
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

    -- ============================================
    -- DERIVAR DATOS DESDE id_cita (si aplica)
    -- ============================================
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

        -- Validar existencia
        IF @id_paciente_cita IS NULL
        BEGIN
            SET @mensaje_out = 'La cita #' + CAST(@id_cita AS VARCHAR) + ' no existe';
            RETURN 404;
        END

        -- Validar que la cita aun este vigente (no cancelada, no vencida)
        IF @estado_cita IN (3, 4, 6, 7)
        BEGIN
            SET @mensaje_out = 'La cita ya no esta vigente (Reprogramada, Cancelada, No Show o Expirada)';
            RETURN 422;
        END

        -- Si no se pasaron nombres explícitos, usar los de la cita
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
            -- Se pasaron nombres manuales: usar id_paciente de todas formas
            SET @id_paciente = @id_paciente_cita;
            SET @id_servicio = @id_servicio_cita;
            SET @id_sede = @id_sede_cita;
        END
    END
    ELSE
    BEGIN
        -- ============================================
        -- SIN CITA: walk-in, necesita nombres explícitos
        -- ============================================
        IF @nombres IS NULL OR @apellidos IS NULL
        BEGIN
            SET @mensaje_out = 'Para generar ticket sin cita, debe proporcionar nombres y apellidos del paciente';
            RETURN 422;
        END

        -- Buscar paciente por nombre exacto
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

        -- Sin cita → Consulta General
        SET @id_servicio = 1;

        IF @id_sede IS NULL
        BEGIN
            SET @mensaje_out = 'Debe especificar la sede para ticket sin cita';
            RETURN 422;
        END
    END

    -- ============================================
    -- VALIDAR SERVICIO
    -- ============================================
    IF NOT EXISTS (SELECT 1 FROM dbo.Servicio WHERE id_servicio = @id_servicio AND Activo = 1)
    BEGIN
        SET @mensaje_out = 'Servicio no disponible';
        RETURN 422;
    END

    -- ============================================
    -- PRIORIDAD ESPECIAL
    -- ============================================
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

    -- ============================================
    -- TRANSACCIÓN
    -- ============================================
    BEGIN TRY
        SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
        BEGIN TRANSACTION;

        -- ============================================
        -- VALIDAR DUPLICADO POR CITA
        -- ============================================
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

        -- ============================================
        -- GENERAR CORRELATIVO
        -- ============================================
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

        -- Evitar colisiones de código
        WHILE EXISTS (SELECT 1 FROM dbo.Ticket WHERE codigo_ticket = @codigo_out)
        BEGIN
            SET @ultimo_seq = @ultimo_seq + 1;
            SET @codigo_out = 'S' + RIGHT('0' + CAST(@id_sede AS VARCHAR), 2) + '-' + RIGHT('000' + CAST(@ultimo_seq AS VARCHAR), 4);
        END

        -- ============================================
        -- INSERTAR TICKET
        -- ============================================
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

-- =============================================
-- 3. NUEVO: sp_ObtenerDetalleCita
--    Retorna datos de la cita + paciente
--    Para: buscar por N° Cita y auto-completar
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerDetalleCita', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerDetalleCita;
GO

CREATE PROCEDURE dbo.sp_ObtenerDetalleCita
    @id_cita SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

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
        c.motivo_consulta
    FROM dbo.Cita c
    JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
    JOIN dbo.Sede s ON c.id_sede = s.id_sede
    JOIN dbo.Servicio sv ON c.id_servicio = sv.id_servicio
    JOIN dbo.Usuario m ON c.id_medico = m.id_usuario
        LEFT JOIN dbo.Estados_Citas e ON c.id_estado_cita = e.Id_Estado_Cita
    WHERE c.id_cita = @id_cita;
END;
GO

-- =============================================
-- 4. NUEVO: sp_BuscarPacientes
--    Busca pacientes (rol=2) por nombre con LIKE
--    Para: autocomplete en generación de ticket
-- =============================================
IF OBJECT_ID('dbo.sp_BuscarPacientes', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_BuscarPacientes;
GO

CREATE PROCEDURE dbo.sp_BuscarPacientes
    @q VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    IF @q IS NULL OR LTRIM(RTRIM(@q)) = ''
    BEGIN
        -- Si no hay búsqueda, retornar vacío
        SELECT TOP 0
            id_usuario, nombres, apellidos, email, telefono
        FROM dbo.Usuario
        WHERE 1 = 0;
        RETURN;
    END

    DECLARE @pattern VARCHAR(102) = '%' + @q + '%';

    SELECT TOP 20
        id_usuario,
        nombres,
        apellidos,
        email,
        telefono
    FROM dbo.Usuario
    WHERE rol = 2
      AND (
          nombres LIKE @pattern
          OR apellidos LIKE @pattern
          OR CONCAT(nombres, ' ', apellidos) LIKE @pattern
      )
    ORDER BY
        -- Priorizar coincidencias al inicio
        CASE WHEN nombres LIKE @q + '%' THEN 0 ELSE 1 END,
        nombres ASC,
        apellidos ASC;
END;
GO

-- =============================================
-- 5. NUEVO: sp_ObtenerCitasDelDia
--    Retorna las citas CONFIRMADAS del día de hoy
--    Para: que recepcion vea los pacientes del día
-- =============================================
IF OBJECT_ID('dbo.sp_ObtenerCitasDelDia', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ObtenerCitasDelDia;
GO

CREATE PROCEDURE dbo.sp_ObtenerCitasDelDia
    @id_sede SMALLINT = NULL,
    @fecha DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @fecha IS NULL
        SET @fecha = CAST(GETDATE() AS DATE);

    SELECT
        c.id_cita,
        c.id_paciente,
        CONCAT(u.nombres, ' ', u.apellidos) AS paciente_nombre,
        u.email,
        c.id_sede,
        s.nombre AS sede_nombre,
        c.id_servicio,
        sv.Nombre_Servicio AS servicio_nombre,
        c.id_medico,
        CONCAT(m.nombres, ' ', m.apellidos) AS medico_nombre,
        c.fecha_inicio,
        c.fecha_fin,
        c.id_estado_cita,
        e.Nombre_Estado_Cita AS estado_cita,
        c.motivo_consulta,
        CASE WHEN t.id_ticket IS NOT NULL THEN 1 ELSE 0 END AS tiene_ticket,
        t.codigo_ticket,
        t.id_estado_ticket
    FROM dbo.Cita c
    JOIN dbo.Usuario u ON c.id_paciente = u.id_usuario
    JOIN dbo.Sede s ON c.id_sede = s.id_sede
    JOIN dbo.Servicio sv ON c.id_servicio = sv.id_servicio
    JOIN dbo.Usuario m ON c.id_medico = m.id_usuario
    LEFT JOIN dbo.Estados_Citas e ON c.id_estado_cita = e.Id_Estado_Cita
    LEFT JOIN dbo.Ticket t ON c.id_cita = t.id_cita AND t.id_estado_ticket IN (1, 2)
    WHERE CAST(c.fecha_inicio AS DATE) = @fecha
      AND c.id_estado_cita = 2
      AND (@id_sede IS NULL OR c.id_sede = @id_sede)
    ORDER BY c.fecha_inicio ASC;
END;
GO

PRINT '+++ Todos los SPs fueron creados/modificados correctamente +++';
GO
