// controllers/usuarios.ts
import { sql, getConnection } from '../Connetion';
import type { Context } from 'elysia';

interface LoginBody {
    email: string;
    password: string;
}

interface CrearUsuarioBody {
    nombres: string;
    apellidos: string;
    dpi: string;
    telefono: string;
    direccion?: string;
    rol: number;
    sexo: string;
    fecha_nacimiento: string;
    email: string;
    antecedetes_medicos?: string;
    password: string;
    contacto_emergencia?: string;
}

interface ActualizarUsuarioBody {
    id_usuario: number;
    nombres: string;
    apellidos: string;
    telefono: string;
    direccion?: string;
    email: string;
    antecedetes_medicos?: string;
    contacto_emergencia?: string;
}

const getClientIp = (request: Request): string => {
    return request.headers.get('x-forwarded-for') ||
           request.headers.get('x-real-ip') ||
           request.headers.get('host')?.split(':')[0] ||
           '0.0.0.0';
};

export const login = async ({ body, set, request }: Context) => {
    const { email, password } = body as LoginBody;
    const ip_origen = getClientIp(request);
    const user_agent = request.headers.get('user-agent') || '';

    if (!email || !password) {
        set.status = 400;
        return { success: false, message: 'Email y contraseña son requeridos' };
    }

    try {
        const pool = await getConnection();

        // Usar el Stored Procedure
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .input('password', sql.VarChar(125), password)
            .input('ip_origen', sql.VarChar(50), ip_origen)
            .input('user_agent', sql.VarChar(200), user_agent)
            .output('session_id', sql.VarChar(100))
            .execute('sp_login_usuario');

        const data = result.recordset?.[0];

        if (data?.Resultado === 1) {
            return {
                success: true,
                message: data.Mensaje,
                token: data.token,
                usuario: {
                    id: data.id_usuario,
                    nombres: data.nombres,
                    apellidos: data.apellidos,
                    email: data.email,
                    rol: data.rol,
                    rol_nombre: data.rol_nombre
                }
            };
        }

        // Manejar diferentes códigos de error
        let statusCode = 401;
        let errorMessage = data?.Mensaje || 'Credenciales incorrectas';
        
        if (data?.Codigo === 'CUENTA_BLOQUEADA') {
            statusCode = 423; // Locked
        } else if (data?.Codigo === 'DEMASIADOS_INTENTOS') {
            statusCode = 429; // Too Many Requests
        }

        set.status = statusCode;
        return { 
            success: false, 
            message: errorMessage,
            code: data?.Codigo 
        };

    } catch (error) {
        console.error('Error en login:', error);
        set.status = 500;
        return { success: false, message: 'Error interno del servidor' };
    }
};

export const crearUsuario = async ({ body, set, request }: Context) => {
    const {
        nombres, apellidos, dpi, telefono, direccion, rol, sexo,
        fecha_nacimiento, email, antecedetes_medicos, password, contacto_emergencia
    } = body as CrearUsuarioBody;

    const ip_origen = getClientIp(request);
    const usuario_ejecutor = email || 'sistema';

    if (!nombres || !apellidos || !dpi || !telefono || !rol || !sexo || !fecha_nacimiento || !email || !password) {
        set.status = 400;
        return { success: false, message: 'Todos los campos obligatorios deben ser completados' };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('nombres', sql.VarChar(120), nombres)
            .input('apellidos', sql.VarChar(120), apellidos)
            .input('dpi', sql.Char(13), dpi)
            .input('telefono', sql.Char(8), telefono)
            .input('direccion', sql.VarChar(250), direccion || null)
            .input('rol', sql.SmallInt, rol)
            .input('sexo', sql.Char(1), sexo)
            .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
            .input('email', sql.VarChar(100), email)
            .input('antecedetes_medicos', sql.VarChar(300), antecedetes_medicos || null)
            .input('password', sql.VarChar(125), password)
            .input('contacto_emergencia', sql.Char(8), contacto_emergencia || null)
            .input('usuario_ejecutor', sql.VarChar(100), usuario_ejecutor)
            .input('ip_origen', sql.VarChar(50), ip_origen)
            .output('id_usuario', sql.Int)
            .execute('sp_crear_usuario');

        const data = result.recordset?.[0];

        if (data?.Resultado === 1) {
            return {
                success: true,
                message: data.Mensaje,
                data: {
                    id_usuario: data.id_usuario,
                    edad: data.Edad_Calculada,
                    rol: data.Nombre_Rol
                }
            };
        }

        set.status = 400;
        return { success: false, message: data?.Mensaje || 'Error al crear usuario' };

    } catch (error) {
        console.error('Error al crear usuario:', error);
        set.status = 500;
        return { success: false, message: 'Error interno del servidor' };
    }
};

export const actualizarUsuario = async ({ body, set, request }: Context) => {
    const {
        id_usuario, nombres, apellidos, telefono, direccion,
        email, antecedetes_medicos, contacto_emergencia
    } = body as ActualizarUsuarioBody;

    const ip_origen = getClientIp(request);
    const usuario_ejecutor = email || 'sistema';

    if (!id_usuario || !nombres || !apellidos || !telefono || !email) {
        set.status = 400;
        return { success: false, message: 'ID, nombres, apellidos, teléfono y email son obligatorios' };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .input('nombres', sql.VarChar(120), nombres)
            .input('apellidos', sql.VarChar(120), apellidos)
            .input('telefono', sql.Char(8), telefono)
            .input('direccion', sql.VarChar(250), direccion || null)
            .input('email', sql.VarChar(100), email)
            .input('antecedetes_medicos', sql.VarChar(300), antecedetes_medicos || null)
            .input('contacto_emergencia', sql.Char(8), contacto_emergencia || null)
            .input('usuario_ejecutor', sql.VarChar(100), usuario_ejecutor)
            .input('ip_origen', sql.VarChar(50), ip_origen)
            .execute('sp_actualizar_usuario');

        const data = result.recordset?.[0];

        if (data?.Resultado === 1) {
            return { success: true, message: data.Mensaje };
        }

        set.status = 400;
        return { success: false, message: data?.Mensaje || 'Error al actualizar usuario' };

    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        set.status = 500;
        return { success: false, message: 'Error interno del servidor' };
    }
};

export const obtenerUsuario = async ({ params, set }: Context) => {
    const { id } = params as { id: string };

    if (!id) {
        set.status = 400;
        return { success: false, message: 'ID de usuario requerido' };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_usuario', sql.Int, parseInt(id))
            .query(`
                SELECT
                    u.id_usuario, u.nombres, u.apellidos, u.dpi, u.telefono,
                    u.direccion, u.rol, u.sexo, u.fecha_nacimiento, u.email,
                    u.antecedetes_medicos, u.contacto_emergencia, r.rol as rol_nombre
                FROM dbo.Usuario u
                LEFT JOIN dbo.Rol r ON u.rol = r.id_rol
                WHERE u.id_usuario = @id_usuario
            `);                                                                                                                                                                                             
   
        if (result.recordset.length === 0) {                                                                                                                                                                
            set.status = 404;                                                                                                                                                                             
            return { success: false, message: 'Usuario no encontrado' };
        }
                                                                                                                                                                                                              
        const usuario = result.recordset[0];
        usuario.edad = new Date().getFullYear() - new Date(usuario.fecha_nacimiento).getFullYear();                                                                                                         
                                                                                                                                                                                                            
        return { success: true, data: usuario };                                                                                                                                                          

    } catch (error) {                                                                                                                                                                                       
        console.error('Error al obtener usuario:', error);
        set.status = 500;                                                                                                                                                                                   
        return { success: false, message: 'Error interno del servidor' };                                                                                                                                 
    }                                                                                                                                                                                                     
};