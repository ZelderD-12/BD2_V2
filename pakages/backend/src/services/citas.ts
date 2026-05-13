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

        return {
            success: false,
            error: 'Campos requeridos',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();
        const fecha = new Date(fecha_inicio);

        const result = await pool.request()
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('id_medico', sql.SmallInt, id_medico)
            .input('id_servicio', sql.SmallInt, id_servicio)
            .input('fecha_inicio', sql.DateTime2, fecha)
            .input('motivo_consulta', sql.VarChar(300), motivo_consulta || null)
            .output('id_cita_out', sql.SmallInt)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ReservarCita');

        const returnValue = result.returnValue;
        const mensaje = result.output.mensaje_out;
        const id_cita = result.output.id_cita_out;

        if (returnValue === 0) {
            set.status = 201;

            return {
                success: true,
                mensaje: 'Cita creada exitosamente',
                code: 'CITA_CREADA',
                data: {
                    id_cita,
                    id_paciente,
                    id_medico,
                    id_servicio,
                    fecha_inicio,
                    estado: 'Pendiente'
                }
            };
        }

        set.status =
            returnValue === 404
                ? 404
                : returnValue === 409
                    ? 409
                    : 422;

        return {
            success: false,
            error: mensaje,
            code: mensaje
        };

    } catch (error: any) {
        console.error('Error reservar cita:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message,
            code: 'SERVER_ERROR'
        };
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
            .input('id_paciente', sql.SmallInt, parseInt(id))
            .execute('dbo.sp_ObtenerCitasPaciente');

        return {
            success: true,
            data: result.recordset
        };

    } catch (error: any) {
        console.error('Error obtener citas:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message
        };
    }
};

// =============================================
// 3. VER SERVICIOS DISPONIBLES
// =============================================
export const obtenerServicios = async ({ set }: Context) => {
    try {
        const pool = await getConnection();

        // ✅ YA NO USA QUERY DIRECTA
        const result = await pool.request()
            .execute('dbo.sp_ObtenerServicios');

        return {
            success: true,
            data: result.recordset
        };

    } catch (error: any) {
        console.error('Error obtener servicios:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message
        };
    }
};

// =============================================
// 4. VER MEDICOS DISPONIBLES
// =============================================
export const obtenerMedicos = async ({ set }: Context) => {
    try {
        const pool = await getConnection();

        const result = await pool.request()
            .execute('dbo.sp_ObtenerMedicos');

        return {
            success: true,
            data: result.recordset
        };

    } catch (error: any) {
        console.error('Error obtener médicos:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message
        };
    }
};

// =============================================
// 5. CONFIRMAR CITA
// =============================================
export const confirmarCitaService = async ({ params, body, set }: Context) => {
    const { id } = params as { id: string };

    const { id_paciente } = body as {
        id_paciente: number;
    };

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ConfirmarCita');

        const returnValue = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (returnValue === 0) {
            return {
                success: true,
                mensaje: 'Cita confirmada',
                code: 'CITA_CONFIRMADA'
            };
        }

        set.status =
            returnValue === 404
                ? 404
                : 409;

        return {
            success: false,
            error: mensaje
        };

    } catch (error: any) {
        console.error('Error confirmar cita:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message
        };
    }
};

// =============================================
// 6. MODIFICAR CITA
// =============================================
export const modificarCitaService = async ({ params, body, set }: Context) => {
    const { id } = params as { id: string };

    const {
        id_paciente,
        nuevo_id_servicio,
        nueva_fecha_inicio,
        motivo_consulta
    } = body as {
        id_paciente: number;
        nuevo_id_servicio?: number;
        nueva_fecha_inicio?: string;
        motivo_consulta?: string;
    };

    try {
        const pool = await getConnection();

        const fecha = nueva_fecha_inicio
            ? new Date(nueva_fecha_inicio)
            : null;

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('nuevo_id_servicio', sql.SmallInt, nuevo_id_servicio || null)
            .input('nueva_fecha_inicio', sql.DateTime2, fecha)
            .input('motivo_consulta', sql.VarChar(300), motivo_consulta || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ModificarCita');

        const returnValue = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (returnValue === 0) {
            return {
                success: true,
                mensaje: 'Cita modificada',
                code: 'CITA_MODIFICADA'
            };
        }

        set.status =
            returnValue === 404
                ? 404
                : returnValue === 409
                    ? 409
                    : 422;

        return {
            success: false,
            error: mensaje
        };

    } catch (error: any) {
        console.error('Error modificar cita:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message
        };
    }
};

// =============================================
// 7. CANCELAR CITA
// =============================================
export const cancelarCitaService = async ({ params, body, set }: Context) => {
    const { id } = params as { id: string };

    const {
        id_paciente,
        motivo_cancelacion
    } = body as {
        id_paciente: number;
        motivo_cancelacion?: string;
    };

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('motivo_cancelacion', sql.VarChar(200), motivo_cancelacion || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_CancelarCita');

        const returnValue = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (returnValue === 0) {
            return {
                success: true,
                mensaje: 'Cita cancelada',
                code: 'CITA_CANCELADA'
            };
        }

        set.status =
            returnValue === 404
                ? 404
                : returnValue === 409
                    ? 409
                    : 422;

        return {
            success: false,
            error: mensaje
        };

    } catch (error: any) {
        console.error('Error cancelar cita:', error);

        set.status = 500;

        return {
            success: false,
            error: error.message
        };
    }
};