import { sql, getConnection } from '../../Connection';
import type { Context } from 'elysia';

interface DatabaseError {
    message: string;
    code?: string;
    number?: number;
}

// =============================================
// 1. LOGOUT - CERRAR SESIÓN
// =============================================
export const logout = async ({ headers, set }: Context) => {
    // Obtener token del header Authorization
    const authHeader = headers.authorization || headers.Authorization;
    let token: string | null = null;
    
    if (authHeader && typeof authHeader === 'string') {
        // Extraer token del Bearer
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            token = parts[1];
        } else {
            token = authHeader;
        }
    }
    
    // También puede venir en el body o en un header custom
    const bodyToken = (headers as any).token;
    const finalToken = token || bodyToken;
    
    if (!finalToken) {
        set.status = 401;
        return {
            success: false,
            error: 'No se proporcionó token de sesión',
            code: 'TOKEN_REQUIRED'
        };
    }
    
    try {
        const pool = await getConnection();
        
        // Ejecutar SP de logout
        const result = await pool.request()
            .input('token_sesion', sql.VarChar(500), finalToken)
            .execute('dbo.sp_logout_usuario');
        
        const recordset = result.recordset || [];
        const data = recordset[0];
        
        if (data?.Resultado === 1) {
            return {
                success: true,
                message: data.Mensaje || 'Sesión cerrada exitosamente',
                code: data.Codigo || 'LOGOUT_EXITOSO'
            };
        } else {
            set.status = 400;
            return {
                success: false,
                error: data?.Mensaje || 'Error al cerrar sesión',
                code: data?.Codigo || 'LOGOUT_ERROR'
            };
        }
        
    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error en logout:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 2. RENOVAR SESIÓN (KEEP-ALIVE)
// =============================================
export const renovarSesion = async ({ headers, set }: Context) => {
    const authHeader = headers.authorization || headers.Authorization;
    let token: string | null = null;
    
    if (authHeader && typeof authHeader === 'string') {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            token = parts[1];
        } else {
            token = authHeader;
        }
    }
    
    if (!token) {
        set.status = 401;
        return {
            success: false,
            error: 'No se proporcionó token de sesión',
            code: 'TOKEN_REQUIRED'
        };
    }
    
    try {
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('token_sesion', sql.VarChar(500), token)
            .execute('dbo.dsp_renovar_sesion');
        
        const recordset = result.recordset || [];
        const data = recordset[0];
        
        if (data?.Resultado === 1) {
            return {
                success: true,
                message: data.Mensaje || 'Sesión renovada',
                code: data.Codigo || 'SESION_RENOVADA'
            };
        } else {
            set.status = 401;
            return {
                success: false,
                error: data?.Mensaje || 'Sesión no válida',
                code: data?.Codigo || 'SESION_INVALIDA'
            };
        }
        
    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error renovar sesión:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 3. OBTENER USUARIOS ACTIVOS
// =============================================
export const obtenerUsuariosActivos = async ({ set }: Context) => {
    try {
        const pool = await getConnection();
        
        const result = await pool.request()
            .execute('dbo.sp_usuarios_activos');
        
        return {
            success: true,
            data: result.recordset || [],
            count: result.recordset?.length || 0
        };
        
    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener usuarios activos:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 4. OBTENER USUARIOS INACTIVOS (HISTORIAL)
// =============================================
export const obtenerUsuariosInactivos = async ({ query, set }: Context) => {
    const { dias } = query as { dias?: string };
    const diasAtras = dias ? parseInt(dias) : 7;
    
    try {
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('dias_atras', sql.Int, diasAtras)
            .execute('dbo.sp_usuarios_inactivos');
        
        return {
            success: true,
            data: result.recordset || [],
            count: result.recordset?.length || 0,
            filtro: { dias_atras: diasAtras }
        };
        
    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener usuarios inactivos:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 5. LIMPIAR SESIONES EXPIRADAS
// =============================================
export const limpiarSesionesExpiradas = async ({ set }: Context) => {
    try {
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('minutos_inactividad', sql.Int, 30)
            .execute('dbo.dsp_limpiar_sesiones_expiradas');
        
        const recordset = result.recordset || [];
        const data = recordset[0];
        
        return {
            success: true,
            message: data?.Mensaje || 'Sesiones expiradas limpiadas',
            code: data?.Codigo || 'SESIONES_LIMPIADAS',
            sesiones_cerradas: data?.sesiones_cerradas || 0
        };
        
    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error limpiar sesiones expiradas:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};