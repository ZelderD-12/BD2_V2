import { sql, getConnection } from '../../Connection';
import type { Context } from 'elysia';

export async function login({ body, set, request }: Context) {
    const { email, password } = body as { email: string; password: string };
    const ip_origen = request.headers.get('host') || 'localhost';

    if (!email || !password) {
        set.status = 400;
        return { success: false, message: 'Email y contraseña requeridos' };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .input('password', sql.VarChar(125), password)
            .input('ip_origen', sql.VarChar(50), ip_origen)
            .input('user_agent', sql.VarChar(200), 'web')
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

        set.status = 401;
        return { success: false, message: data?.Mensaje || 'Error', code: data?.Codigo };
    } catch (error: any) {
        set.status = 500;
        return { success: false, message: 'Error interno', error: error.message };
    }
}