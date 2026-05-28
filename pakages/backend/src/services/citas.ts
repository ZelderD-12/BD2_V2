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
    nuevo_id_medico?: number;
    nueva_fecha_inicio?: string;
    motivo_consulta?: string;
    id_recepcionista?: number;
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
// 1. RESERVAR CITA (con id_sede)
// =============================================
export const reservarCitaService = async ({ body, set }: Context) => {
    const { id_paciente, id_medico, id_servicio, id_sede, fecha_inicio, motivo_consulta } = body as {
        id_paciente: number;
        id_medico: number;
        id_servicio: number;
        id_sede: number;
        fecha_inicio: string;
        motivo_consulta?: string;
    };

    if (!id_paciente || !id_medico || !id_servicio || !id_sede || !fecha_inicio) {
        set.status = 422;
        return {
            success: false,
            error: 'Campos requeridos: id_paciente, id_medico, id_servicio, id_sede, fecha_inicio',
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
            .input('id_sede', sql.SmallInt, id_sede)
            .input('fecha_inicio', sql.DateTime2, fecha)
            .input('motivo_consulta', sql.VarChar(300), motivo_consulta || null)
            .output('id_cita_out', sql.SmallInt)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_ReservarCita');

        const returnValue = result.returnValue;
        const mensaje: string = result.output.mensaje_out;
        const id_cita: number = result.output.id_cita_out;

        if (returnValue === 0) {
            // Auto-confirmar la cita
            try {
                await pool.request()
                    .input('id_cita', sql.SmallInt, id_cita)
                    .input('id_paciente', sql.SmallInt, id_paciente)
                    .output('mensaje_out', sql.VarChar(200))
                    .execute('dbo.sp_ConfirmarCita');
            } catch { /* si falla la confirmacion, la cita queda pendiente */ }

            set.status = 201;
            return {
                success: true,
                mensaje: 'Cita creada y confirmada exitosamente',
                code: 'CITA_CREADA',
                data: {
                    id_cita,
                    id_paciente,
                    id_medico,
                    id_servicio,
                    id_sede,
                    fecha_inicio,
                    estado: 'Confirmada'
                }
            };
        }

        if (returnValue === 409) {
            set.status = 409;
            return {
                success: false,
                error: 'No hay cupo disponible para este horario',
                code: 'SIN_CUPO'
            };
        }

        set.status = returnValue === 404 ? 404 : 422;

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
export const obtenerCitasPaciente = async ({ params, query, set }: Context) => {
    const { id } = params as ParamsWithId;
    const { mostrar_todas } = query as { mostrar_todas?: string };

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_paciente', sql.SmallInt, parseInt(id))
            .input('mostrar_todas', sql.Bit, mostrar_todas === '1' || mostrar_todas === 'true')
            .execute('dbo.sp_ObtenerCitasPaciente');

        let historialMap: Record<number, any> = {};
        if (mostrar_todas === '1' || mostrar_todas === 'true') {
            const histResult = await pool.request()
                .input('id_paciente', sql.SmallInt, parseInt(id))
                .query(`
                    SELECT
                        h.id_cita,
                        h.diagnostico,
                        h.sintomas,
                        h.signos_vitales,
                        h.notas_doctor,
                        h.proxima_cita,
                        h.orden_receta,
                        r.Orden_Receta,
                        r.medicamentos_json
                    FROM HistorialClinico h
                    LEFT JOIN Receta r ON r.id_cita = h.id_cita AND r.id_paciente = h.id_paciente
                    WHERE h.id_paciente = @id_paciente
                `);
            for (const row of histResult.recordset) {
                historialMap[row.id_cita] = {
                    diagnostico: row.diagnostico,
                    sintomas: row.sintomas,
                    signos_vitales: row.signos_vitales,
                    notas_doctor: row.notas_doctor,
                    proxima_cita: row.proxima_cita,
                    orden_receta: row.Orden_Receta,
                    medicamentos: row.medicamentos_json ? JSON.parse(row.medicamentos_json) : null,
                };
            }
        }

        const data = result.recordset.map((row: any) => {
            const hist = historialMap[row.id_cita];
            return {
                id_cita: row.id_cita,
                id_paciente: row.id_paciente,
                servicio: row.nombre_servicio,
                medico: `${row.medico_nombres || ''} ${row.medico_apellidos || ''}`.trim(),
                fecha_inicio: row.fecha_inicio,
                estado: row.estado_cita,
                motivo_consulta: row.motivo_consulta,
                motivo_cancelacion: row.motivo_cancelacion,
                historial: hist || null,
            };
        });

        return {
            success: true,
            data
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
    const { id_paciente, nuevo_id_servicio, nuevo_id_medico, nueva_fecha_inicio, motivo_consulta, id_recepcionista } = body as ModificarCitaBody;

    try {
        const pool = await getConnection();

        const fecha = nueva_fecha_inicio ? new Date(nueva_fecha_inicio) : null;

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id))
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('nuevo_id_servicio', sql.SmallInt, nuevo_id_servicio || null)
            .input('nuevo_id_medico', sql.SmallInt, nuevo_id_medico || null)
            .input('nueva_fecha_inicio', sql.DateTime2, fecha)
            .input('nuevo_motivo', sql.VarChar(300), motivo_consulta || null)
            .input('id_recepcionista', sql.SmallInt, id_recepcionista || null)
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
            .execute('dbo.sp_ObtenerCitasEnAtencion');  // Este SP debe tener antecedentes

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