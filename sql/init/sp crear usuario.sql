CREATE   PROCEDURE dbo.sp_crear_usuario
    @nombres VARCHAR(120),
    @apellidos VARCHAR(120),
    @dpi CHAR(13),
    @telefono CHAR(8),  
    @direccion VARCHAR(250) = NULL,
    @rol SMALLINT,
    @sexo CHAR(1),  
    @fecha_nacimiento DATE,
    @email VARCHAR(100),
    @antecedetes_medicos VARCHAR(300) = NULL,
    @password VARCHAR(125),
    @contacto_emergencia CHAR(8) = NULL,  -- Nuevo parámetro
    @usuario_ejecutor VARCHAR(100) = NULL,
    @ip_origen VARCHAR(50) = NULL,
    @id_usuario INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Resultado INT = 0;
    DECLARE @Mensaje VARCHAR(500) = '';
    DECLARE @Edad INT;
    DECLARE @RolNombre VARCHAR(150);
    
    BEGIN TRY
        -- 1. VALIDACIONES DE CAMPOS OBLIGATORIOS
        IF @nombres IS NULL OR LTRIM(RTRIM(@nombres)) = ''
        BEGIN
            SET @Mensaje = 'El campo nombres es obligatorio';
            THROW 50001, @Mensaje, 1;
        END
        
        IF @apellidos IS NULL OR LTRIM(RTRIM(@apellidos)) = ''
        BEGIN
            SET @Mensaje = 'El campo apellidos es obligatorio';
            THROW 50002, @Mensaje, 1;
        END
        
        IF @dpi IS NULL OR LTRIM(RTRIM(@dpi)) = ''
        BEGIN
            SET @Mensaje = 'El campo DPI es obligatorio';
            THROW 50003, @Mensaje, 1;
        END
        
        -- 2. VALIDAR FORMATO DPI (13 dígitos)
        IF LEN(@dpi) != 13 OR ISNUMERIC(@dpi) = 0
        BEGIN
            SET @Mensaje = 'El DPI debe contener exactamente 13 dígitos numéricos';
            THROW 50004, @Mensaje, 1;
        END
        
        -- 3. VALIDAR EMAIL
        IF @email IS NULL OR LTRIM(RTRIM(@email)) = ''
        BEGIN
            SET @Mensaje = 'El campo email es obligatorio';
            THROW 50005, @Mensaje, 1;
        END
        
        -- Validar formato de email
        IF @email NOT LIKE '%_@__%.__%' OR CHARINDEX(' ', @email) > 0
        BEGIN
            SET @Mensaje = 'El formato del email no es válido';
            THROW 50006, @Mensaje, 1;
        END
        
        -- 4. VALIDAR PASSWORD
        IF @password IS NULL OR LEN(@password) < 6
        BEGIN
            SET @Mensaje = 'La contraseña debe tener al menos 6 caracteres';
            THROW 50015, @Mensaje, 1;
        END
        
        
        IF @rol NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
        BEGIN
            SET @Mensaje = 'Rol no válido. Valores permitidos: 1-10';
            THROW 50007, @Mensaje, 1;
        END
        
        -- Obtener nombre del rol
        SELECT @RolNombre = rol FROM dbo.Rol  WHERE id_rol = @rol;
        
        -- 6. VALIDAR SEXO (convertir a binary para la tabla)
        DECLARE @sexo_binary BINARY(1);
        IF @sexo = 'M'
            SET @sexo_binary = 0x4D;  -- ASCII 'M'
        ELSE IF @sexo = 'F'
            SET @sexo_binary = 0x46;  -- ASCII 'F'
        ELSE IF @sexo = 'O'
            SET @sexo_binary = 0x4F;  -- ASCII 'O'
        ELSE
        BEGIN
            SET @Mensaje = 'Sexo no válido. Valores permitidos: M, F, O';
            THROW 50008, @Mensaje, 1;
        END
        
        -- 7. VALIDAR TELÉFONO
        IF @telefono IS NULL OR LTRIM(RTRIM(@telefono)) = ''
        BEGIN
            SET @Mensaje = 'El teléfono es obligatorio';
            THROW 50011, @Mensaje, 1;
        END
        
        -- Validar longitud exacta de 8 caracteres
        IF LEN(@telefono) != 8
        BEGIN
            SET @Mensaje = 'El teléfono debe tener exactamente 8 caracteres';
            THROW 50012, @Mensaje, 1;
        END
        
        -- 8. VALIDAR CONTACTO DE EMERGENCIA (si se proporciona)
        IF @contacto_emergencia IS NOT NULL AND LTRIM(RTRIM(@contacto_emergencia)) != ''
        BEGIN
            -- Validar longitud exacta de 8 caracteres
            IF LEN(@contacto_emergencia) != 8
            BEGIN
                SET @Mensaje = 'El contacto de emergencia debe tener exactamente 8 caracteres';
                THROW 50019, @Mensaje, 1;
            END
            
            -- **VALIDACIÓN IMPORTANTE: Verificar que teléfono y contacto_emergencia NO sean iguales**
            IF @telefono = @contacto_emergencia
            BEGIN
                SET @Mensaje = 'El número de teléfono no puede ser igual al contacto de emergencia';
                THROW 50020, @Mensaje, 1;
            END
        END
        
        -- 9. VALIDAR FECHA DE NACIMIENTO
        IF @fecha_nacimiento IS NULL
        BEGIN
            SET @Mensaje = 'La fecha de nacimiento es obligatoria';
            THROW 50009, @Mensaje, 1;
        END
        
        IF @fecha_nacimiento > GETDATE()
        BEGIN
            SET @Mensaje = 'La fecha de nacimiento no puede ser futura';
            THROW 50010, @Mensaje, 1;
        END
        
        -- Calcular edad
        SET @Edad = DATEDIFF(YEAR, @fecha_nacimiento, GETDATE())
        IF @Edad < 0 OR @Edad > 120
        BEGIN
            SET @Mensaje = 'Edad no válida';
            THROW 50016, @Mensaje, 1;
        END
        
        -- 10. VERIFICAR SI EL CORREO YA EXISTE
        IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE email = @email)
        BEGIN
            SET @Mensaje = 'El correo electrónico ya está registrado en el sistema';
            THROW 50014, @Mensaje, 1;
        END
        
        -- 11. VERIFICAR SI EL DPI YA EXISTE
        IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE dpi = @dpi)
        BEGIN
            SET @Mensaje = 'Ya existe un usuario registrado con este DPI';
            THROW 50013, @Mensaje, 1;
        END
        
        -- 12. VERIFICAR SI EL TELÉFONO YA EXISTE (opcional)
        IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE telefono = @telefono)
        BEGIN
            SET @Mensaje = 'El número de teléfono ya está registrado en el sistema';
            THROW 50021, @Mensaje, 1;
        END
        
        -- 13. ENCRIPTAR CONTRASEÑA
        DECLARE @password_hash VARCHAR(125);
        SET @password_hash = CONVERT(VARCHAR(125), HASHBYTES('SHA2_256', @password), 2);
        
        -- 14. INSERTAR USUARIO
        INSERT INTO dbo.Usuario (
            nombres,
            apellidos,
            dpi,
            telefono,
            direccion,
            rol,
            sexo,
            fecha_nacimiento,
            email,
            antecedetes_medicos,
            pasword,
            contacto_emergencia
        )
        VALUES (
            @nombres,
            @apellidos,
            @dpi,
            @telefono,
            @direccion,
            @rol,
            @sexo_binary,
            @fecha_nacimiento,
            @email,
            @antecedetes_medicos,
            @password_hash,
            @contacto_emergencia
        );
        
        -- Obtener el ID del usuario insertado
        SET @id_usuario = SCOPE_IDENTITY();
        
        -- 15. REGISTRAR LOG DE CREACIÓN DE USUARIO
        INSERT INTO dbo.LogUsuario (
    tipo_accion,
    usuario_afectado_id,
    usuario_afectado_email,
    accion_realizada,
    ip_origen,
    usuario_ejecutor,
    detalles
)
VALUES (
    'CREAR_USUARIO',
    @id_usuario,
    @email,
    'Usuario creado exitosamente',
    @ip_origen,
    ISNULL(@usuario_ejecutor, @email),
    (SELECT 
        (SELECT @nombres AS nombres, @apellidos AS apellidos, @email AS email, 
                @RolNombre AS rol, @Edad AS edad, @telefono AS telefono, 
                ISNULL(@contacto_emergencia, '') AS contacto_emergencia
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    )
);
        
        -- 16. RETORNAR RESULTADO EXITOSO
        SET @Resultado = 1;
        SET @Mensaje = 'Usuario creado exitosamente con ID: ' + CAST(@id_usuario AS VARCHAR);
        
        SELECT 
            @Resultado AS Resultado,
            @Mensaje AS Mensaje,
            @id_usuario AS id_usuario,
            @Edad AS Edad_Calculada,
            @RolNombre AS Nombre_Rol;
            
    END TRY
    BEGIN CATCH
        -- Manejo de errores
        SET @Resultado = 0;
        SET @Mensaje = ERROR_MESSAGE();
        
        SELECT 
            @Resultado AS Resultado,
            @Mensaje AS Mensaje,
            NULL AS id_usuario,
            NULL AS Edad_Calculada,
            NULL AS Nombre_Rol;
        
        -- Registrar error en logs
        INSERT INTO dbo.LogUsuario (
    tipo_accion, accion_realizada, ip_origen, usuario_ejecutor, detalles
)
VALUES (
    'ERROR_CREAR_USUARIO',
    'Error al crear usuario',
    @ip_origen,
    @usuario_ejecutor,
    (SELECT ERROR_MESSAGE() AS error, @email AS email, @dpi AS dpi FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
);
        
    END CATCH
END