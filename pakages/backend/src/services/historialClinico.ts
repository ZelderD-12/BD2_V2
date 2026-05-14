import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

// =============================================
// INTERFACES
// =============================================

interface DatabaseError {
    message: string;
    code?: string;
    number?: number;
}

// =============================================
// 1. OBTENER MEDICAMENTOS
// =============================================
export const obtenerMedicamentos = async ({ set }: Context) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query('SELECT id_medicamento, nombre FROM dbo.Medicamento ORDER BY nombre');
        return {
            success: true,
            data: result.recordset,
            count: result.recordset.length
        };
    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener medicamentos:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 2. CREAR RECETA MÉDICA
// =============================================
export const crearReceta = async ({ body, set }: Context) => {
    const { id_cita, id_medicamento, observaciones } = body as {
        id_cita: number;
        id_medicamento: number;
        observaciones?: string;
    };

    if (!id_cita || !id_medicamento) {
        set.status = 422;
        return {
            success: false,
            error: 'Campos requeridos: id_cita, id_medicamento'
        };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, id_cita)
            .input('id_medicamento', sql.SmallInt, id_medicamento)
            .input('observaciones', sql.VarChar(500), observaciones || null)
            .output('Orden_Receta', sql.VarChar(30))
            .execute('dbo.SP_Receta_Crear');

        const orden_receta = result.output.Orden_Receta;

        return {
            success: true,
            message: 'Receta creada exitosamente',
            data: {
                orden_receta,
                id_cita,
                id_medicamento,
                observaciones
            }
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error crear receta:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 3. AGREGAR MEDICAMENTO A RECETA EXISTENTE
// =============================================
export const agregarMedicamentoReceta = async ({ body, set }: Context) => {
    const { orden_receta, id_medicamento, observaciones } = body as {
        orden_receta: string;
        id_medicamento: number;
        observaciones?: string;
    };

    if (!orden_receta || !id_medicamento) {
        set.status = 422;
        return {
            success: false,
            error: 'Campos requeridos: orden_receta, id_medicamento'
        };
    }

    try {
        const pool = await getConnection();

        await pool.request()
            .input('Orden_Receta', sql.VarChar(30), orden_receta)
            .input('id_medicamento', sql.SmallInt, id_medicamento)
            .input('observaciones', sql.VarChar(500), observaciones || null)
            .execute('dbo.SP_Receta_AgregarLinea');

        return {
            success: true,
            message: 'Medicamento agregado a la receta',
            data: {
                orden_receta,
                id_medicamento
            }
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error agregar medicamento:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 9. FINALIZAR ATENCIÓN (con actualización de ticket)
// =============================================
export const finalizarAtencion = async ({ body, set }: Context) => {
    const {
        id_cita,
        id_medico,
        diagnostico,
        sintomas,
        signos_vitales,
        notas_doctor,
        proxima_cita,
        orden_receta
    } = body as {
        id_cita: number;
        id_medico: number;
        diagnostico: string;
        sintomas?: string;
        signos_vitales?: string;
        notas_doctor?: string;
        proxima_cita?: string;
        orden_receta?: string;
    };

    if (!id_cita || !id_medico || !diagnostico) {
        set.status = 422;
        return {
            success: false,
            error: 'Campos requeridos: id_cita, id_medico, diagnostico'
        };
    }

    try {
        const pool = await getConnection();

        // 1. Obtener id_paciente
        const citaResult = await pool.request()
            .input('id_cita', sql.SmallInt, id_cita)
            .query('SELECT id_paciente FROM Cita WHERE id_cita = @id_cita');
        
        const id_paciente = citaResult.recordset[0]?.id_paciente;

        // 2. Guardar historial clínico
        await pool.request()
            .input('id_cita', sql.SmallInt, id_cita)
            .input('id_paciente', sql.SmallInt, id_paciente)
            .input('id_medico', sql.SmallInt, id_medico)
            .input('diagnostico', sql.VarChar(500), diagnostico)
            .input('sintomas', sql.VarChar(500), sintomas || null)
            .input('signos_vitales', sql.VarChar(200), signos_vitales || null)
            .input('notas_doctor', sql.VarChar(sql.MAX), notas_doctor || null)
            .input('proxima_cita', sql.Date, proxima_cita || null)
            .input('orden_receta', sql.VarChar(30), orden_receta || null)
            .query(`
                IF EXISTS (SELECT 1 FROM HistorialClinico WHERE id_cita = @id_cita)
                BEGIN
                    UPDATE HistorialClinico SET
                        diagnostico = @diagnostico,
                        sintomas = @sintomas,
                        signos_vitales = @signos_vitales,
                        notas_doctor = @notas_doctor,
                        proxima_cita = @proxima_cita,
                        orden_receta = @orden_receta,
                        modificado_por = @id_medico,
                        fecha_modificacion = GETDATE()
                    WHERE id_cita = @id_cita
                END
                ELSE
                BEGIN
                    INSERT INTO HistorialClinico (id_cita, id_paciente, id_medico, fecha_atencion, diagnostico, sintomas, signos_vitales, notas_doctor, proxima_cita, orden_receta, creado_por, fecha_creacion)
                    VALUES (@id_cita, @id_paciente, @id_medico, GETDATE(), @diagnostico, @sintomas, @signos_vitales, @notas_doctor, @proxima_cita, @orden_receta, @id_medico, GETDATE())
                END
            `);

        // 3. Actualizar estado de la cita a Completada (4)
        await pool.request()
            .input('id_cita', sql.SmallInt, id_cita)
            .query('UPDATE Cita SET id_estado_cita = 4 WHERE id_cita = @id_cita');

        // 4. Actualizar ticket a Finalizado (4)
        await pool.request()
            .input('id_cita', sql.SmallInt, id_cita)
            .query(`
                UPDATE Ticket 
                SET id_estado_ticket = 4, 
                    fecha_fin = GETDATE()
                WHERE id_cita = @id_cita
            `);

        return {
            success: true,
            message: 'Atención finalizada correctamente',
            data: {
                id_cita,
                ticket_finalizado: true,
                cita_completada: true
            }
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error finalizar atención:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// Función auxiliar para obtener id_paciente
async function getPacienteId(id_cita: number): Promise<number> {
    const pool = await getConnection();
    const result = await pool.request()
        .input('id_cita', sql.SmallInt, id_cita)
        .query('SELECT id_paciente FROM Cita WHERE id_cita = @id_cita');
    return result.recordset[0]?.id_paciente || 0;
}

// =============================================
// 5. OBTENER HISTORIAL POR PACIENTE
// =============================================
export const obtenerHistorialPaciente = async ({ params, set }: Context) => {
    const { id_paciente } = params as { id_paciente: string };

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_paciente', sql.SmallInt, parseInt(id_paciente))
            .query(`
                SELECT 
                    h.*,
                    c.fecha_inicio,
                    s.Nombre_Servicio as servicio,
                    m.nombres + ' ' + m.apellidos as medico
                FROM HistorialClinico h
                INNER JOIN Cita c ON h.id_cita = c.id_cita
                INNER JOIN Servicio s ON c.id_servicio = s.id_servicio
                INNER JOIN Usuario m ON h.id_medico = m.id_usuario
                WHERE h.id_paciente = @id_paciente
                ORDER BY h.fecha_atencion DESC
            `);

        return {
            success: true,
            data: result.recordset,
            count: result.recordset.length
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener historial:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 6. OBTENER HISTORIAL COMPLETO
// =============================================
export const obtenerHistorialCompletoPaciente = async ({ params, set }: Context) => {
    const { id_paciente } = params as { id_paciente: string };

    try {
        const pool = await getConnection();
        
        // Información del paciente
        const pacienteResult = await pool.request()
            .input('id_paciente', sql.SmallInt, parseInt(id_paciente))
            .query(`
                SELECT id_usuario, nombres, apellidos, dpi, telefono, direccion, email, sexo, fecha_nacimiento,
                       DATEDIFF(YEAR, fecha_nacimiento, GETDATE()) as edad
                FROM Usuario
                WHERE id_usuario = @id_paciente AND rol = 2
            `);

        // Historial
        const historialResult = await pool.request()
            .input('id_paciente', sql.SmallInt, parseInt(id_paciente))
            .query(`
                SELECT 
                    h.id_historial,
                    h.id_cita,
                    h.fecha_atencion,
                    h.diagnostico,
                    h.sintomas,
                    h.signos_vitales,
                    h.notas_doctor,
                    h.proxima_cita,
                    h.orden_receta,
                    c.fecha_inicio as fecha_cita,
                    c.motivo_consulta,
                    s.Nombre_Servicio as servicio,
                    m.nombres + ' ' + m.apellidos as medico_atendio
                FROM HistorialClinico h
                INNER JOIN Cita c ON h.id_cita = c.id_cita
                INNER JOIN Servicio s ON c.id_servicio = s.id_servicio
                INNER JOIN Usuario m ON h.id_medico = m.id_usuario
                WHERE h.id_paciente = @id_paciente
                ORDER BY h.fecha_atencion DESC
            `);

        return {
            success: true,
            data: {
                paciente: pacienteResult.recordset[0] || null,
                historial: historialResult.recordset || []
            }
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener historial completo:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 7. OBTENER HISTORIAL POR CITA
// =============================================
export const obtenerHistorialPorCita = async ({ params, set }: Context) => {
    const { id_cita } = params as { id_cita: string };

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_cita', sql.SmallInt, parseInt(id_cita))
            .query(`
                SELECT 
                    h.*,
                    c.fecha_inicio,
                    s.Nombre_Servicio as servicio,
                    m.nombres + ' ' + m.apellidos as medico,
                    p.nombres + ' ' + p.apellidos as paciente
                FROM HistorialClinico h
                INNER JOIN Cita c ON h.id_cita = c.id_cita
                INNER JOIN Servicio s ON c.id_servicio = s.id_servicio
                INNER JOIN Usuario m ON h.id_medico = m.id_usuario
                INNER JOIN Usuario p ON h.id_paciente = p.id_usuario
                WHERE h.id_cita = @id_cita
            `);

        return {
            success: true,
            data: result.recordset[0] || null
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error obtener historial por cita:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 8. GUARDAR HISTORIAL
// =============================================
export const guardarHistorialClinico = async ({ body, set }: Context) => {
    const data = body as any;

    try {
        const pool = await getConnection();
        
        await pool.request()
            .input('id_cita', sql.SmallInt, data.id_cita)
            .input('id_paciente', sql.SmallInt, data.id_paciente)
            .input('id_medico', sql.SmallInt, data.id_medico)
            .input('diagnostico', sql.VarChar(500), data.diagnostico || null)
            .input('sintomas', sql.VarChar(500), data.sintomas || null)
            .input('signos_vitales', sql.VarChar(200), data.signos_vitales || null)
            .input('notas_doctor', sql.VarChar(sql.MAX), data.notas_doctor || null)
            .input('proxima_cita', sql.Date, data.proxima_cita || null)
            .input('orden_receta', sql.VarChar(30), data.orden_receta || null)
            .query(`
                IF EXISTS (SELECT 1 FROM HistorialClinico WHERE id_cita = @id_cita)
                BEGIN
                    UPDATE HistorialClinico SET
                        diagnostico = @diagnostico,
                        sintomas = @sintomas,
                        signos_vitales = @signos_vitales,
                        notas_doctor = @notas_doctor,
                        proxima_cita = @proxima_cita,
                        orden_receta = @orden_receta,
                        modificado_por = @id_medico,
                        fecha_modificacion = GETDATE()
                    WHERE id_cita = @id_cita
                END
                ELSE
                BEGIN
                    INSERT INTO HistorialClinico (id_cita, id_paciente, id_medico, fecha_atencion, diagnostico, sintomas, signos_vitales, notas_doctor, proxima_cita, orden_receta, creado_por, fecha_creacion)
                    VALUES (@id_cita, @id_paciente, @id_medico, GETDATE(), @diagnostico, @sintomas, @signos_vitales, @notas_doctor, @proxima_cita, @orden_receta, @id_medico, GETDATE())
                END
            `);

        return {
            success: true,
            message: 'Historial guardado correctamente'
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error guardar historial:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// 9. CONSULTAR RECETA COMPLETA
// =============================================
export const consultarReceta = async ({ params, set }: Context) => {
    const { orden_receta } = params as { orden_receta: string };

    if (!orden_receta) {
        set.status = 422;
        return {
            success: false,
            error: 'Se requiere el número de orden de receta'
        };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('Orden_Receta', sql.VarChar(30), orden_receta)
            .query(`
                SELECT 
                    r.id_receta,
                    r.Orden_Receta,
                    r.id_cita,
                    r.id_medico,
                    r.id_paciente,
                    r.id_medicamento,
                    r.observaciones,
                    m.nombre AS medicamento_nombre,
                    u_paciente.nombres + ' ' + u_paciente.apellidos AS paciente,
                    u_medico.nombres + ' ' + u_medico.apellidos AS medico
                FROM dbo.Receta r
                INNER JOIN dbo.Medicamento m ON r.id_medicamento = m.id_medicamento
                INNER JOIN dbo.Usuario u_paciente ON r.id_paciente = u_paciente.id_usuario
                INNER JOIN dbo.Usuario u_medico ON r.id_medico = u_medico.id_usuario
                WHERE r.Orden_Receta = @Orden_Receta
                ORDER BY r.id_receta ASC
            `);

        if (result.recordset.length === 0) {
            set.status = 404;
            return {
                success: false,
                error: 'Receta no encontrada'
            };
        }

        return {
            success: true,
            data: result.recordset,
            count: result.recordset.length,
            orden_receta: orden_receta
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error consultar receta:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};

// =============================================
// CREAR RECETA CON MEDICAMENTOS EN JSON
// =============================================
export const crearRecetaConMedicamentos = async ({ body, set }: Context) => {
    const { id_cita, medicamentos_json } = body as {
        id_cita: number;
        medicamentos_json: string;
    };

    if (!id_cita || !medicamentos_json) {
        set.status = 422;
        return {
            success: false,
            error: 'Campos requeridos: id_cita, medicamentos_json'
        };
    }

    try {
        const pool = await getConnection();

        const result = await pool.request()
            .input('id_cita', sql.SmallInt, id_cita)
            .input('medicamentos_json', sql.VarChar(sql.MAX), medicamentos_json)
            .output('Orden_Receta', sql.VarChar(30))
            .execute('dbo.SP_Receta_CrearConMedicamentos');

        const orden_receta = result.output.Orden_Receta;

        return {
            success: true,
            message: 'Receta creada exitosamente',
            data: {
                orden_receta,
                id_cita
            }
        };

    } catch (error: unknown) {
        const err = error as DatabaseError;
        console.error('Error crear receta con medicamentos:', err);
        set.status = 500;
        return {
            success: false,
            error: err.message || 'Error interno del servidor'
        };
    }
};