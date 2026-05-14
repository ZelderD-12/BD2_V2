import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

// =============================================
// TIPOS Y INTERFACES
// =============================================

interface ReservarCitaBody {
    id_paciente: number;
    id_medico: number;
    id_servicio: number;
    fecha_inicio: string;
    motivo_consulta?: string;
}

interface ConfirmarCitaBody {
    id_paciente: number;
}

interface ModificarCitaBody {
    id_paciente: number;
    nuevo_id_servicio?: number;
    nueva_fecha_inicio?: string;
    motivo_consulta?: string;
}

interface CancelarCitaBody {
    id_paciente: number;
    motivo_cancelacion?: string;
}

interface ParamsWithId {
    id: string;
}

interface DatabaseError {
    message: string;
    code?: string;
    number?: number;
}

// =============================================
// 1. RESERVAR CITA
// =============================================
export const reservarCitaService = async ({ body, set }: Context) => {
    const { id_paciente, id_medico, id_servicio, fecha_inicio, motivo_consulta } = body as ReservarCitaBody;

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
        const mensaje: string = result.output.mensaje_out;
        const id_cita: number = result.output.id_cita_out;

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

        set.status = returnValue === 404 ? 404 : returnValue === 409 ? 409 : 422;

        return {
            success: false,
            error: mensaje,
            code: mensaje
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error reservar cita:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 2. VER CITAS DE UN PACIENTE
// =============================================
export const obtenerCitasPaciente = async ({ params, set }: Context) => {
    const { id } = params as ParamsWithId;

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_paciente', sql.SmallInt, parseInt(id))
            .execute('dbo.sp_ObtenerCitasPaciente');

        return {
            success: true,
            data: result.recordset
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener citas:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
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
            .execute('dbo.sp_ObtenerServicios');

        return {
            success: true,
            data: result.recordset
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener servicios:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
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

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener médicos:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 5. CONFIRMAR CITA
// =============================================
export const confirmarCitaService = async ({ params, body, set }: Context) => {
    const { id } = params as ParamsWithId;
    const { id_paciente } = body as ConfirmarCitaBody;

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ConfirmarCita');

        const returnValue = result.returnValue;
        const mensaje: string = result.output.mensaje_out;

        if (returnValue === 0) {
            return {
                success: true,
                mensaje: 'Cita confirmada',
                code: 'CITA_CONFIRMADA'
            };
        }

        set.status = returnValue === 404 ? 404 : 409;

        return {
            success: false,
            error: mensaje
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error confirmar cita:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 6. MODIFICAR CITA
// =============================================
export const modificarCitaService = async ({ params, body, set }: Context) => {
    const { id } = params as ParamsWithId;
    const { id_paciente, nuevo_id_servicio, nueva_fecha_inicio, motivo_consulta } = body as ModificarCitaBody;

    try {
        const pool = await getConnection();

        const fecha = nueva_fecha_inicio ? new Date(nueva_fecha_inicio) : null;

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('nuevo_id_servicio', sql.SmallInt, nuevo_id_servicio || null)
            .input('nueva_fecha_inicio', sql.DateTime2, fecha)
            .input('motivo_consulta', sql.VarChar(300), motivo_consulta || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ModificarCita');

        const returnValue = result.returnValue;
        const mensaje: string = result.output.mensaje_out;

        if (returnValue === 0) {
            return {
                success: true,
                mensaje: 'Cita modificada',
                code: 'CITA_MODIFICADA'
            };
        }

        set.status = returnValue === 404 ? 404 : returnValue === 409 ? 409 : 422;

        return {
            success: false,
            error: mensaje
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error modificar cita:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 7. VER CITAS DE UN MEDICO
// =============================================
export const obtenerCitasMedico = async ({ params, set }: Context) => {
    const { id_usuario_m } = params as { id_usuario_m: string };

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_usuario_m', sql.SmallInt, parseInt(id_usuario_m))
            .execute('dbo.sp_ObtenerCitasPorMedico');

        return {
            success: true,
            data: result.recordset,
            count: result.recordset.length
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener citas del medico:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 8. CANCELAR CITA
// =============================================
export const cancelarCitaService = async ({ params, body, set }: Context) => {
    const { id } = params as ParamsWithId;
    const { id_paciente, motivo_cancelacion } = body as CancelarCitaBody;

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('motivo_cancelacion', sql.VarChar(200), motivo_cancelacion || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_CancelarCita');

        const returnValue = result.returnValue;
        const mensaje: string = result.output.mensaje_out;

        if (returnValue === 0) {
            return {
                success: true,
                mensaje: 'Cita cancelada',
                code: 'CITA_CANCELADA'
            };
        }

        set.status = returnValue === 404 ? 404 : returnValue === 409 ? 409 : 422;

        return {
            success: false,
            error: mensaje
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error cancelar cita:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

export const obtenerCitasMedicoEnAtencion = async ({ params, set }: Context) => {
    const { id_usuario_m } = params as { id_usuario_m: string };

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_usuario_m', sql.SmallInt, parseInt(id_usuario_m))
            .execute('dbo.sp_ObtenerCitasEnAtencion');  // Usa el SP que ya tienes

        return {
            success: true,
            data: result.recordset,
            count: result.recordset.length
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener citas en atencion:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};


export const obtenerTodasCitasMedico = async ({ params, set }: Context) => {
    const { id_usuario_m } = params as { id_usuario_m: string };

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_usuario_m', sql.SmallInt, parseInt(id_usuario_m))
            .execute('dbo.sp_ObtenerTodasCitasPorMedico');

        return {
            success: true,
            data: result.recordset,
            count: result.recordset.length
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener todas las citas del medico:', err);

        set.status = 500;

        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};