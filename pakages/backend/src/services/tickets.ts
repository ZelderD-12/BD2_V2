import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

const ESTADOS_TICKET_SP = [
    'EN_ESPERA', 'LLAMADO', 'EN_ATENCION', 'FINALIZADO', 'NO_SHOW'
] as const;
type EstadoTicketSp = (typeof ESTADOS_TICKET_SP)[number];

function extraerUsuario(authHeader: string | null): number | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.replace('Bearer ', '');
    try {
        // Intento 1: base64(userId + ':')
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const id = parseInt(decoded.split(':')[0]);
        if (!isNaN(id)) return id;
    } catch {}
    try {
        // Intento 2: JWT (extraer payload, buscar sub o userId)
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
            const uid = payload.sub || payload.userId || payload.id;
            if (uid) { const n = parseInt(uid); if (!isNaN(n)) return n; }
        }
    } catch {}
    // Intento 3: token de sesion de sp_login_usuario (buscar en tabla Sesion)
    return null;
}

async function obtenerUsuarioPorToken(token: string): Promise<number | null> {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('token_sesion', sql.VarChar(500), token)
            .execute('dbo.sp_obtener_usuario_por_token');
        const row = result.recordset?.[0];
        return row?.id_usuario ? parseInt(row.id_usuario) : null;
    } catch { return null; }
}

async function extraerUsuarioAsync(authHeader: string | null): Promise<number | null> {
    const r = extraerUsuario(authHeader);
    if (r) return r;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return obtenerUsuarioPorToken(authHeader.replace('Bearer ', ''));
}

// =============================================
// GENERAR TICKET
// =============================================
export const generarTicketService = async ({ body, set, request }: Context) => {
    const idUsuario = await extraerUsuarioAsync(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado', code: 'UNAUTHORIZED' }; }

    const { nombres, apellidos, id_sede, prioridad, id_cita } = body as {
        nombres?: string; apellidos?: string; id_sede?: number; prioridad?: string; id_cita?: number;
    };

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('nombres', sql.VarChar(120), nombres || null)
            .input('apellidos', sql.VarChar(120), apellidos || null)
            .input('id_sede', sql.SmallInt, id_sede || null)
            .input('prioridad', sql.VarChar(20), prioridad || 'NORMAL')
            .input('id_cita', sql.SmallInt, id_cita || null)
            .input('id_recepcionista', sql.SmallInt, idUsuario)
            .output('id_ticket_out', sql.SmallInt)
            .output('codigo_out', sql.VarChar(20))
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_GenerarTicket');

        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 0) {
            set.status = 201;
            return { success: true, mensaje, data: { id_ticket: result.output.id_ticket_out, codigo_ticket: result.output.codigo_out, estado: 'EN_ESPERA' }, code: 'TICKET_CREADO' };
        }

        const statusMap: Record<number, number> = { 401: 401, 404: 404, 409: 409, 422: 422 };
        set.status = statusMap[rv] || 500;
        return { success: false, error: mensaje, code: 'ERROR_' + rv };
    } catch (error) {
        console.error('Error en generarTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno', code: 'SERVER_ERROR' };
    }
};

// =============================================
// LLAMAR SIGUIENTE
// =============================================
export const llamarSiguienteService = async ({ body, set, request }: Context) => {
    const idUsuario = await extraerUsuarioAsync(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id_sede, id_servicio } = body as { id_sede: number; id_servicio: number };
    if (!id_sede || !id_servicio) { set.status = 422; return { success: false, error: 'id_sede e id_servicio requeridos' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.SmallInt, id_sede)
            .input('id_servicio', sql.SmallInt, id_servicio)
            .input('id_recepcionista', sql.SmallInt, idUsuario)
            .input('k_fairness', sql.Int, 3)
            .output('id_ticket_out', sql.SmallInt)
            .output('codigo_out', sql.VarChar(20))
            .output('prioridad_out', sql.VarChar(20))
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_LlamarSiguiente');

        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 404) { set.status = 404; return { success: false, error: mensaje, code: 'COLA_VACIA' }; }
        if (rv === 409) { set.status = 409; return { success: false, error: mensaje, code: 'TICKET_TOMADO' }; }
        if (rv === 500) { set.status = 500; return { success: false, error: 'Error interno' }; }

        return { success: true, mensaje, data: { id_ticket: result.output.id_ticket_out, codigo_ticket: result.output.codigo_out, prioridad: result.output.prioridad_out, estado: 'LLAMADO' } };
    } catch (error) {
        console.error('Error en llamarSiguiente:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

// =============================================
// CAMBIAR ESTADO TICKET (ruta: /api/tickets/:id/estado)
// =============================================
export const cambiarEstadoTicketService = async ({ params, body, set, request }: Context) => {
    const idUsuario = await extraerUsuarioAsync(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id } = params as { id: string };
    const { nuevo_estado, motivo } = body as { nuevo_estado: string; motivo?: string };

    const est = String(nuevo_estado || '').toUpperCase() as EstadoTicketSp;
    if (!ESTADOS_TICKET_SP.includes(est)) {
        set.status = 422;
        return { success: false, error: 'Estado invalido. Use: ' + ESTADOS_TICKET_SP.join(', ') };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_ticket', sql.SmallInt, parseInt(id, 10))
            .input('nuevo_estado', sql.VarChar(20), est)
            .input('id_usuario', sql.SmallInt, idUsuario)
            .input('motivo', sql.VarChar(300), motivo || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_CambiarEstadoTicket');

        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 0) {
            return { success: true, mensaje, data: { id_ticket: parseInt(id), estado: est } };
        }

        set.status = rv === 404 ? 404 : 422;
        return { success: false, error: mensaje };
    } catch (error) {
        console.error('Error en cambiarEstadoTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

// =============================================
// OBTENER COLA PUBLICA
// =============================================
export const obtenerColaPublicaService = async ({ query, set }: Context) => {
    const { id_sede, id_servicio } = query as { id_sede?: string; id_servicio?: string };

    if (!id_sede) { set.status = 422; return { success: false, error: 'id_sede requerido' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.SmallInt, parseInt(id_sede))
            .input('id_servicio', sql.SmallInt, id_servicio ? parseInt(id_servicio) : null)
            .execute('dbo.sp_ObtenerColaPublica');

        const recordsets = result.recordsets as any[][];
        const llamado = recordsets[0]?.[0] || null;
        const proximos = recordsets[1] || [];

        return { success: true, data: { llamado_actual: llamado, proximos } };
    } catch (error) {
        console.error('Error en obtenerColaPublica:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

// =============================================
// TICKETS COLA ACTUALES
// =============================================
export const obtenerTicketsColaActuales = async ({ query, set }: Context) => {
    const { id_sede } = query as { id_sede?: string };

    if (!id_sede) { set.status = 422; return { success: false, error: 'id_sede es requerido' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.SmallInt, parseInt(id_sede))
            .input('fecha_hora', sql.DateTime, new Date())
            .input('minutos_gracia', sql.Int, 5)
            .execute('dbo.sp_tickets_cola_actuales');

        return { success: true, data: result.recordset || [] };
    } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
    }
};

// =============================================
// PACIENTE POR TICKET
// =============================================
export const obtenerPacientePorTicketService = async ({ query, set }: Context) => {
    const { codigo_ticket, id_ticket } = query as { codigo_ticket?: string; id_ticket?: string };

    if (!codigo_ticket?.trim()) { set.status = 422; return { success: false, error: 'codigo_ticket requerido' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('codigo_ticket', sql.VarChar(20), codigo_ticket.trim())
            .execute('dbo.sp_GetPacienteByTicket');

        const rows = (result.recordset || []) as Record<string, unknown>[];
        let match: Record<string, unknown> | null = null;

        if (id_ticket) {
            match = rows.find((r) => Number(r.id_ticket) === parseInt(id_ticket, 10)) || null;
        } else {
            match = rows[0] || null;
        }

        return { success: true, data: match };
    } catch (error) {
        console.error('Error en obtenerPacientePorTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

// =============================================
// CAMBIAR ESTADO MANUAL (ruta: /api/tickets/:id/cambiar-estado)
// =============================================
export const cambiarEstadoTicketManual = async ({ params, body, set, request }: Context) => {
    const idUsuario = await extraerUsuarioAsync(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id } = params as { id: string };
    const { nuevo_estado, motivo } = body as { nuevo_estado: string; motivo?: string };

    const est = String(nuevo_estado || '').trim().toUpperCase();
    if (!ESTADOS_TICKET_SP.includes(est as EstadoTicketSp)) {
        set.status = 422;
        return { success: false, error: 'Estado invalido. Use: ' + ESTADOS_TICKET_SP.join(', ') };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_ticket', sql.SmallInt, parseInt(id, 10))
            .input('nuevo_estado', sql.VarChar(20), est)
            .input('id_usuario', sql.SmallInt, idUsuario)
            .input('motivo', sql.VarChar(300), motivo || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_CambiarEstadoTicket');

        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 0) {
            return { success: true, mensaje, data: { id_ticket: parseInt(id), estado: est } };
        }

        set.status = rv === 404 ? 404 : 422;
        return { success: false, error: mensaje };
    } catch (error) {
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

// =============================================
// NOTIFICAR WHATSAPP (PLACEHOLDER)
// =============================================
export const notificarWhatsappService = async ({ params, set, request }: Context) => {
    const idUsuario = await extraerUsuarioAsync(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id } = params as { id: string };
    const idTicket = parseInt(id, 10);
    if (isNaN(idTicket)) { set.status = 422; return { success: false, error: 'id_ticket invalido' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_ticket', sql.SmallInt, idTicket)
            .execute('dbo.sp_GetPacienteByTicket');

        const rows = result.recordset as any[];
        if (!rows || rows.length === 0) {
            set.status = 404;
            return { success: false, error: 'Ticket no encontrado' };
        }

        const paciente = rows[0];
        const telefono = paciente.telefono || paciente.telefono_paciente;
        const nombre = paciente.paciente || paciente.nombre_completo || 'Paciente';
        const codigo = paciente.codigo_ticket;

        console.log(`[WHATSAPP-PLACEHOLDER] Enviar mensaje a ${nombre} (tel: ${telefono}) - Ticket ${codigo}: "Su turno ha sido llamado. Pase a recepcion."`);

        return {
            success: true,
            mensaje: 'Notificacion enviada (placeholder)',
            data: {
                destinatario: nombre,
                telefono: telefono || 'No registrado',
                ticket: codigo,
                mensaje: `Hola ${nombre}, su turno ${codigo} ha sido llamado. Pase a recepcion.`
            }
        };
    } catch (error) {
        console.error('Error en notificarWhatsapp:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};
