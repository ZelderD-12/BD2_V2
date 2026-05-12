import { sql, getConnection } from '../../Connection';
import type { Context } from 'elysia';

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

export async function crearUsuario({ body, set }: Context) {
    const {
        nombres, apellidos, dpi, telefono, direccion, rol, sexo,
        fecha_nacimiento, email, antecedetes_medicos, password, contacto_emergencia
    } = body as CrearUsuarioBody;

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
            .input('usuario_ejecutor', sql.VarChar(100), email)
            .input('ip_origen', sql.VarChar(50), 'localhost')
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

    } catch (error: any) {
        console.error('Error al crear usuario:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Error interno del servidor' };
    }
}