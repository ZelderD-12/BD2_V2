import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

// =============================================
// BUSCAR PACIENTES (autocomplete)
// GET /api/pacientes/buscar?q=termino
// =============================================
export const buscarPacientesService = async ({ query, set }: Context) => {
    const { q } = query as { q?: string };

    if (!q || !q.trim()) {
        return { success: true, data: [] };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('q', sql.VarChar(100), q.trim())
            .execute('dbo.sp_BuscarPacientes');

        return { success: true, data: result.recordset || [] };
    } catch (error: any) {
        console.error('Error en buscarPacientes:', error);
        set.status = 500;
        return { success: false, error: error.message };
    }
};

// =============================================
// OBTENER CITAS DEL DÍA DE HOY (para recepción)
// GET /api/citas/hoy?id_sede=1
// =============================================
export const obtenerCitasDelDiaService = async ({ query, set }: Context) => {
    const { id_sede, fecha } = query as { id_sede?: string; fecha?: string };

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.SmallInt, id_sede ? parseInt(id_sede) : null)
            .input('fecha', sql.Date, fecha || null)
            .execute('dbo.sp_ObtenerCitasDelDia');

        return { success: true, data: result.recordset || [] };
    } catch (error: any) {
        console.error('Error en obtenerCitasDelDia:', error);
        set.status = 500;
        return { success: false, error: error.message };
    }
};

// =============================================
// OBTENER DETALLE DE CITA (para generar ticket rápido)
// GET /api/citas/:id/detalle
// =============================================
export const obtenerDetalleCitaService = async ({ params, set }: Context) => {
    const { id } = params as { id: string };
    const idCita = parseInt(id, 10);

    if (isNaN(idCita)) {
        set.status = 422;
        return { success: false, error: 'id_cita invalido' };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_cita', sql.SmallInt, idCita)
            .execute('dbo.sp_ObtenerDetalleCita');

        const rows = result.recordset || [];

        if (rows.length === 0) {
            set.status = 404;
            return { success: false, error: 'Cita no encontrada' };
        }

        return { success: true, data: rows[0] };
    } catch (error: any) {
        console.error('Error en obtenerDetalleCita:', error);
        set.status = 500;
        return { success: false, error: error.message };
    }
};
