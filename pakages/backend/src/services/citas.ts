import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

// =============================================
// 1. RESERVAR CITA
// =============================================
export const reservarCitaService = async ({ body, set, request }: Context) => {
    const { id_paciente, id_medico, id_servicio, fecha_inicio, motivo_consulta } = body as {
        id_paciente: number;
        id_medico: number;
        id_servicio: number;
        fecha_inicio: string;
        motivo_consulta?: string;
    };

    // Validaciones
    if (!id_paciente || !id_medico || !id_servicio || !fecha_inicio) {
        set.status = 422;
        return {
            success: false,
            error: 'Campos requeridos: id_paciente, id_medico, id_servicio, fecha_inicio',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_paciente',     sql.Int,          id_paciente)
            .input('id_medico',       sql.Int,          id_medico)
            .input('id_servicio',     sql.Int,          id_servicio)
            .input('fecha_inicio',    sql.DateTime2,    new Date(fecha_inicio))
            .input('motivo_consulta', sql.VarChar(300), motivo_consulta || null)
            .output('id_cita_out',    sql.Int)
            .output('mensaje_out',    sql.VarChar(200))
            .execute('dbo.sp_ReservarCita');

        const mensaje = result.output.mensaje_out;
        const id_cita = result.output.id_cita_out;

        // Sin cupo
        if (result.returnValue === 409) {
            set.status = 409;
            return {
                success: false,
                error: mensaje,
                code: 'SIN_CUPO'
            };
        }

        // Regla de negocio
        if (result.returnValue === 422) {
            set.status = 422;
            return {
                success: false,
                error: mensaje,
                code: mensaje
            };
        }

        // Error interno
        if (result.returnValue === 500) {
            set.status = 500;
            return {
                success: false,
                error: 'Error interno del servidor',
                code: 'SERVER_ERROR'
            };
        }

        // Éxito
        set.status = 201;
        return {
            success: true,
            mensaje: 'Cita creada exitosamente',
            data: {
                id_cita,
                id_paciente,
                id_medico,
                id_servicio,
                fecha_inicio,
                estado: 'PENDIENTE'
            },
            code: 'CITA_CREADA'
        };

    } catch (error) {
        console.error('Error en reservarCita:', error);
        set.status = 500;
        return {
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 2. VER CITAS DE UN PACIENTE
// =============================================
export const obtenerCitasPaciente = async ({ params, set }: Context) => {
    const { id } = params as { id: string };

    if (!id) {
        set.status = 422;
        return {
            success: false,
            error: 'ID de paciente requerido',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_paciente', sql.Int, parseInt(id))
            .query(`
                SELECT 
                    c.id_cita,
                    c.fecha_inicio,
                    c.fecha_fin,
                    c.__estado__,
                    c.motivo_consulta,
                    c.fecha_solicitud,
                    s.__nombre__ AS servicio,
                    e.__nombre__ AS especialidad,
                    u.__nombres__ + ' ' + u.__apellidos__ AS medico
                FROM dbo.citas c
                INNER JOIN dbo.servicios s    ON c.id_servicio = s.id_servicio
                INNER JOIN dbo.especialidades e ON s.id_especialidad = e.id_especialidad
                INNER JOIN dbo.medicos m      ON c.id_medico = m.id_medico
                INNER JOIN dbo.ususarios u    ON m.id_usuario = u.id_usuario
                WHERE c.id_paciente = @id_paciente
                ORDER BY c.fecha_inicio DESC
            `);

        return {
            success: true,
            data: result.recordset
        };

    } catch (error) {
        console.error('Error en obtenerCitasPaciente:', error);
        set.status = 500;
        return {
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 3. VER SERVICIOS DISPONIBLES
// =============================================
export const obtenerServicios = async ({ set }: Context) => {
    try {
        const pool = await getConnection();

        const result = await pool.request()
            .query(`
                SELECT 
                    id_servicio,
                    nombre AS servicio
                FROM dbo.Servicio
            `);

        return {
            success: true,
            data: result.recordset
        };

    } catch (error: any) {
        console.error('Error en obtenerServicios:', error);
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

        const result = await pool.request()
            .query(`
                SELECT 
                    m.id_medico,
                    u.__nombres__ + ' ' + u.__apellidos__ AS nombre,
                    m.numero_colegiado,
                    e.__nombre__ AS especialidad
                FROM dbo.medicos m
                INNER JOIN dbo.ususarios u ON m.id_usuario = u.id_usuario
                INNER JOIN dbo.medicos_especialidades me ON m.id_medico = me.id_medico
                INNER JOIN dbo.especialidades e ON me.id_especialidad = e.id_especialidad
                WHERE m.__activo__ = 1
            `);

        return {
            success: true,
            data: result.recordset
        };

    } catch (error) {
        console.error('Error en obtenerMedicos:', error);
        set.status = 500;
        return {
            success: false,
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};