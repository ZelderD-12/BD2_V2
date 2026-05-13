import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

// =============================================
// 1. RESERVAR CITA
// =============================================
export const reservarCitaService = async ({ body, set }: Context) => {
    const { id_paciente, id_medico, id_servicio, fecha_inicio, motivo_consulta } = body as {
        id_paciente: number;
        id_medico: number;
        id_servicio: number;
        fecha_inicio: string;
        motivo_consulta?: string;
    };

    if (!id_paciente || !id_medico || !id_servicio || !fecha_inicio) {
        set.status = 422;
        return { success: false, error: 'Campos requeridos', code: 'MISSING_FIELDS' };
    }

    try {
        const pool = await getConnection();
        const fecha = new Date(fecha_inicio);

        const result = await pool.request()
            .input('id_paciente', sql.Int, id_paciente)
            .input('id_medico', sql.Int, id_medico)
            .input('id_servicio', sql.Int, id_servicio)
            .input('fecha_inicio', sql.DateTime2, fecha)
            .input('motivo_consulta', sql.VarChar(300), motivo_consulta || null)
            .output('id_cita_out', sql.Int)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ReservarCita');

        const returnValue = result.returnValue;
        const id_cita = result.output.id_cita_out;
        const mensaje = result.output.mensaje_out;

        if (returnValue === 0) {
            set.status = 201;
            return {
                success: true,
                mensaje: 'Cita creada exitosamente',
                data: { id_cita, id_paciente, id_medico, id_servicio, fecha_inicio, estado: 'PENDIENTE' },
                code: 'CITA_CREADA'
            };
        }

        set.status = returnValue === 404 ? 404 : returnValue === 409 ? 409 : 422;
        return { success: false, error: mensaje, code: mensaje };

    } catch (error: any) {
        console.error('Error:', error.message);
        set.status = 500;
        return { success: false, error: error.message, code: 'SERVER_ERROR' };
    }
};

// =============================================
// 2. VER CITAS DE UN PACIENTE
// =============================================
export const obtenerCitasPaciente = async ({ params, set }: Context) => {
    const { id } = params as { id: string };

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_paciente', sql.Int, parseInt(id))
            .query(`
                SELECT 
                    c.id_cita,
                    c.fecha_inicio,
                    c.fecha_fin,
                    ec.nombre AS estado,
                    c.motivo_consulta,
                    c.fecha_solicitud,
                    s.Nombre_Servicio AS servicio,
                    u.nombres + ' ' + u.apellidos AS medico
                FROM dbo.Cita c
                INNER JOIN dbo.Servicio s ON c.id_servicio = s.id_servicio
                INNER JOIN dbo.Estados_Citas ec ON c.id_estado_cita = ec.id_estado_cita
                INNER JOIN dbo.Usuario u ON c.id_medico = u.id_usuario
                WHERE c.id_paciente = @id_paciente
                ORDER BY c.fecha_inicio DESC
            `);

        return { success: true, data: result.recordset };
    } catch (error: any) {
        console.error('Error:', error.message);
        set.status = 500;
        return { success: false, error: error.message };
    }
};

// =============================================
// 3. VER SERVICIOS DISPONIBLES
// =============================================
function normalizarFilaServicio(row: Record<string, unknown>) {
    const nombreServicio = (row.servicio ?? row.nombre ?? row.Nombre_Servicio) as string | undefined;
    return {
        ...row,
        servicio: nombreServicio,
        nombre: nombreServicio
    };
}

export const obtenerServicios = async ({ set }: Context) => {
    try {
        const pool = await getConnection();
        let rows: Record<string, unknown>[] = [];
        try {
            const result = await pool.request().execute('dbo.sp_ObtenerServicios');
            const rs = result.recordsets as unknown[][] | undefined;
            rows = (Array.isArray(rs?.[0]) ? rs[0] : result.recordset || []) as Record<string, unknown>[];
        } catch {
            const result = await pool.request().query(`
                SELECT 
                    id_servicio,
                    Nombre_Servicio AS servicio,
                    duracion_slot_min,
                    capacidad_slot,
                    Activo
                FROM dbo.Servicio
                WHERE Activo = 1
                ORDER BY Nombre_Servicio
            `);
            rows = result.recordset as Record<string, unknown>[];
        }
        return { success: true, data: rows.map(normalizarFilaServicio) };
    } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
    }
};

// =============================================
// 4. VER MEDICOS DISPONIBLES
// =============================================
export const obtenerMedicos = async ({ set }: Context) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                u.id_usuario AS id_medico,
                u.nombres + ' ' + u.apellidos AS nombre,
                u.email,
                u.telefono,
                'Médico General' AS especialidad
            FROM dbo.Usuario u
            WHERE u.rol = 3
            ORDER BY u.nombres
        `);
        return { success: true, data: result.recordset };
    } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
    }
};