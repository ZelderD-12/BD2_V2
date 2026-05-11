import { sql, getConnection } from '../../Connection';
import type { Context } from 'elysia';

export async function obtenerUsuario({ params, set }: Context) {
    const { id } = params as { id: string };
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_usuario', sql.Int, parseInt(id))
            .query('SELECT * FROM dbo.Usuario WHERE id_usuario = @id_usuario');
        if (result.recordset.length === 0) {
            set.status = 404;
            return { success: false, message: 'No encontrado' };
        }
        return { success: true, data: result.recordset[0] };
    } catch (error: any) {
        set.status = 500;
        return { success: false, message: error.message };
    }
}