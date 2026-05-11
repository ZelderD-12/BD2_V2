import { sql, getConnection } from '../../Connection';
import type { Context } from 'elysia';

export async function crearUsuario({ body, set }: Context) {
    set.status = 200;
    return { success: true, message: 'Usuario creado' };
}