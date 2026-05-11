import { sql, getConnection } from '../../Connection';
import type { Context } from 'elysia';

export async function actualizarUsuario({ body, set }: Context) {
    set.status = 200;
    return { success: true, message: 'Usuario actualizado' };
}