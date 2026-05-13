import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

interface GenerarTicketBody {
    id_paciente:     number;
    id_sede:         number;
    id_servicio:     number;
    prioridad:       'NORMAL' | 'ANCIANO' | 'EMBARAZO' | 'DISCAPACIDAD' | 'ESPECIAL';
    id_cita?:        number;
    motivo_especial?: string;
    id_supervisor?:  number;
}

interface LlamarSiguienteBody {
    id_sede:     number;
    id_servicio: number;
}

/** Estados que acepta dbo.sp_CambiarEstadoTicket (mapeados a id_estado_ticket en BD). */
const ESTADOS_TICKET_SP = [
    'EN_ESPERA',
    'LLAMADO',
    'EN_ATENCION',
    'FINALIZADO',
    'NO_SHOW'
] as const;
type EstadoTicketSp = (typeof ESTADOS_TICKET_SP)[number];

interface CambiarEstadoBody {
    nuevo_estado: EstadoTicketSp;
    motivo?:      string;
}

function extraerUsuario(authHeader: string | null): number | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        const decoded = Buffer.from(authHeader.replace('Bearer ', ''), 'base64').toString('utf-8');
        const id = parseInt(decoded.split(':')[0]);
        return isNaN(id) ? null : id;
    } catch {
        return null;
    }
}

export const generarTicketService = async ({ body, set, request }: Context) => {
    const idUsuario = extraerUsuario(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado', code: 'UNAUTHORIZED' }; }

    const { nombres, apellidos, id_sede, prioridad, id_cita } = body as {
        nombres: string;
        apellidos: string;
        id_sede: number;
        prioridad?: string;
        id_cita?: number;
    };

    if (!nombres || !apellidos || !id_sede) {
        set.status = 422;
        return { success: false, error: 'nombres, apellidos e id_sede son requeridos', code: 'MISSING_FIELDS' };
    }

    try {
        const pool = await getConnection();
        const req = pool.request()
            .input('nombres', sql.VarChar(120), nombres)
            .input('apellidos', sql.VarChar(120), apellidos)
            .input('id_sede', sql.Int, id_sede)
            .input('prioridad', sql.VarChar(20), prioridad || 'NORMAL')
            .input('id_cita', sql.Int, id_cita || null)
            .input('id_recepcionista', sql.Int, idUsuario)
            .output('id_ticket_out', sql.Int)
            .output('codigo_out', sql.VarChar(20))
            .output('mensaje_out', sql.VarChar(200));

        const result = await req.execute('dbo.sp_GenerarTicket');
        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 401) { set.status = 401; return { success: false, error: mensaje, code: 'UNAUTHORIZED' }; }
        if (rv === 404) { set.status = 404; return { success: false, error: mensaje, code: 'NOT_FOUND' }; }
        if (rv === 409) { set.status = 409; return { success: false, error: mensaje, code: 'TICKET_DUPLICADO' }; }
        if (rv === 422) { set.status = 422; return { success: false, error: mensaje, code: 'REGLA_NEGOCIO' }; }
        if (rv === 500) { set.status = 500; return { success: false, error: 'Error interno', code: 'SERVER_ERROR' }; }

        set.status = 201;
        return { success: true, mensaje, data: { id_ticket: result.output.id_ticket_out, codigo_ticket: result.output.codigo_out, estado: 'EN_ESPERA' } };
    } catch (error) {
        console.error('Error en generarTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno', code: 'SERVER_ERROR' };
    }
};

export const llamarSiguienteService = async ({ body, set, request }: Context) => {
    const idUsuario = extraerUsuario(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id_sede, id_servicio } = body as LlamarSiguienteBody;
    if (!id_sede || !id_servicio) { set.status = 422; return { success: false, error: 'id_sede e id_servicio requeridos' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.Int, id_sede)
            .input('id_servicio', sql.Int, id_servicio)
            .input('id_recepcionista', sql.Int, idUsuario)
            .input('k_fairness', sql.Int, 3)
            .output('id_ticket_out', sql.Int)
            .output('codigo_out', sql.VarChar(20))
            .output('prioridad_out', sql.VarChar(20))
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_LlamarSiguiente');

        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 404) { set.status = 404; return { success: false, error: mensaje, code: 'COLA_VACIA' }; }
        if (rv === 500) { set.status = 500; return { success: false, error: 'Error interno' }; }

        return { success: true, mensaje, data: { id_ticket: result.output.id_ticket_out, codigo_ticket: result.output.codigo_out, prioridad: result.output.prioridad_out, estado: 'LLAMADO' } };
    } catch (error) {
        console.error('Error en llamarSiguiente:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

async function ejecutarSpCambiarEstadoTicket(
    id_ticket: number,
    nuevo_estado: string,
    id_usuario: number,
    motivo: string | null
) {
    const pool = await getConnection();
    return pool.request()
        .input('id_ticket', sql.Int, id_ticket)
        .input('nuevo_estado', sql.VarChar(20), nuevo_estado)
        .input('id_usuario', sql.Int, id_usuario)
        .input('motivo', sql.VarChar(300), motivo)
        .output('mensaje_out', sql.VarChar(200))
        .execute('dbo.sp_CambiarEstadoTicket');
}

function respuestaSpCambiarEstado(id_ticket: number, nuevo_estado: string, result: { returnValue: number; output: { mensaje_out: string } }, set: Context['set']) {
    const rv = result.returnValue;
    const mensaje = result.output.mensaje_out;

    if (rv === 404) { set.status = 404; return { success: false as const, error: mensaje }; }
    if (rv === 422) { set.status = 422; return { success: false as const, error: mensaje }; }
    if (rv === 500) { set.status = 500; return { success: false as const, error: mensaje || 'Error interno' }; }
    if (rv !== 0) { set.status = 422; return { success: false as const, error: mensaje || 'Error al actualizar estado' }; }

    return { success: true as const, mensaje, data: { id_ticket, estado: nuevo_estado } };
}

export const cambiarEstadoTicketService = async ({ params, body, set, request }: Context) => {
    const idUsuario = extraerUsuario(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id } = params as { id: string };
    const { nuevo_estado, motivo } = body as CambiarEstadoBody;

    const est = String(nuevo_estado || '').toUpperCase() as EstadoTicketSp;
    if (!nuevo_estado || !ESTADOS_TICKET_SP.includes(est)) {
        set.status = 422; return { success: false, error: 'Estado inválido. Use: ' + ESTADOS_TICKET_SP.join(', ') };
    }

    try {
        const result = await ejecutarSpCambiarEstadoTicket(parseInt(id, 10), est, idUsuario, motivo || null);
        return respuestaSpCambiarEstado(parseInt(id, 10), est, result, set);
    } catch (error) {
        console.error('Error en cambiarEstadoTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

/** Estado del ticket desde columnas típicas del SP (texto, id numérico o id_estado_ticket). */
function normEstadoColaRow(r: Record<string, unknown>): string {
    const e = r.estado ?? r.estado_ticket ?? r.id_estado_ticket;
    if (typeof e === 'number') {
        const map = ['EN_ESPERA', 'LLAMADO', 'EN_ATENCION', 'FINALIZADO', 'NO_SHOW'];
        if (e >= 1 && e <= 5) return map[e - 1];
    }
    return String(e ?? '').trim().toUpperCase();
}

/**
 * sp_ObtenerColaPublica (versión actual): RS0 = ticket LLAMADO (0–1 filas), RS1 = próximos EN_ESPERA (TOP 5).
 * Compatibilidad: si solo hay un recordset mezclado, repartimos como antes.
 */
function parseColaPublicaRecordsets(result: { recordsets: unknown; recordset?: unknown }): {
    llamado_actual: Record<string, unknown> | null;
    proximos: Record<string, unknown>[];
} {
    const sets = result.recordsets as unknown[][];
    const s0 = Array.isArray(sets[0]) ? (sets[0] as Record<string, unknown>[]) : [];
    const s1 = Array.isArray(sets[1]) ? (sets[1] as Record<string, unknown>[]) : [];

    if (s1.length > 0 || s0.length > 0) {
        const llamado = s0.length ? s0[0] : null;
        if (s1.length > 0) {
            return { llamado_actual: llamado, proximos: s1 };
        }
        if (s0.length <= 1) {
            return { llamado_actual: llamado, proximos: [] };
        }
    }

    const flat =
        s0.length > 0
            ? s0
            : Array.isArray(result.recordset)
              ? (result.recordset as Record<string, unknown>[])
              : [];

    const cerrado = (r: Record<string, unknown>) => {
        const st = normEstadoColaRow(r);
        return st === 'FINALIZADO' || st === 'NO_SHOW';
    };
    const abiertos = flat.filter((r) => !cerrado(r));

    const esLlamadoOAtencion = (r: Record<string, unknown>) => {
        const st = normEstadoColaRow(r);
        return st === 'LLAMADO' || st === 'EN_ATENCION';
    };

    const idx = abiertos.findIndex(esLlamadoOAtencion);
    if (idx >= 0) {
        const llamado = abiertos[idx];
        const proximos = abiertos.filter((_, i) => i !== idx);
        return { llamado_actual: llamado, proximos };
    }

    return { llamado_actual: null, proximos: abiertos };
}

export const obtenerColaPublicaService = async ({ query, set }: Context) => {
    const { id_sede, id_servicio } = query as { id_sede?: string; id_servicio?: string };

    if (!id_sede) { set.status = 422; return { success: false, error: 'id_sede requerido' }; }

    const servRaw = id_servicio != null ? String(id_servicio).trim().toLowerCase() : '';
    const idServicioNum =
        servRaw !== '' && servRaw !== 'all' && servRaw !== 'todos'
            ? parseInt(String(id_servicio), 10)
            : null;
    if (idServicioNum !== null && Number.isNaN(idServicioNum)) {
        set.status = 422;
        return { success: false, error: 'id_servicio inválido' };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.Int, parseInt(id_sede))
            .input('id_servicio', sql.Int, idServicioNum)
            .execute('dbo.sp_ObtenerColaPublica');

        const { llamado_actual, proximos } = parseColaPublicaRecordsets(result);

        return { success: true, data: { llamado_actual, proximos } };
    } catch (error) {
        console.error('Error en obtenerColaPublica:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

export const obtenerTicketsColaActuales = async ({ query, set }: Context) => {
    const { id_sede, fecha_hora, minutos_gracia } = query as { 
        id_sede?: string; 
        fecha_hora?: string; 
        minutos_gracia?: string 
    };

    if (!id_sede) { set.status = 422; return { success: false, error: 'id_sede es requerido' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.Int, parseInt(id_sede))
            .input('fecha_hora', sql.DateTime, fecha_hora || new Date())
            .input('minutos_gracia', sql.Int, parseInt(minutos_gracia || '5'))
            .execute('dbo.sp_tickets_cola_actuales');

        return { success: true, data: result.recordset };
    } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
    }
};

/** Resuelve etiqueta de estado (texto o id numérico 1–5). */
function normalizarEstadoTicket(row: Record<string, unknown>): string {
    const e = row.estado ?? row.estado_ticket;
    if (typeof e === 'number') {
        const map = ['EN_ESPERA', 'LLAMADO', 'EN_ATENCION', 'FINALIZADO', 'NO_SHOW'];
        return map[e - 1] || String(e);
    }
    return String(e ?? '').toUpperCase();
}

export const obtenerPacientePorTicketService = async ({ query, set, request }: Context) => {
    const idUsuario = extraerUsuario(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado', code: 'UNAUTHORIZED' }; }

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
            const id = parseInt(id_ticket, 10);
            match = rows.find((r) => Number(r.id_ticket) === id) || null;
        } else {
            const activos = rows.filter((r) => {
                const est = normalizarEstadoTicket(r);
                return est !== 'FINALIZADO' && est !== 'NO_SHOW';
            });
            match = activos[0] || rows[0] || null;
        }

        return { success: true, data: match };
    } catch (error) {
        console.error('Error en obtenerPacientePorTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

/** Recepción y panel usan el mismo SP que valida transiciones y escribe fecha_fin en FINALIZADO. */
export const cambiarEstadoTicketManual = async ({ params, body, set, request }: Context) => {
    const idUsuario = extraerUsuario(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id } = params as { id: string };
    const { nuevo_estado, motivo } = body as { nuevo_estado: string; motivo?: string };

    const est = String(nuevo_estado || '').trim().toUpperCase();
    if (!est) { set.status = 422; return { success: false, error: 'nuevo_estado requerido' }; }
    if (!ESTADOS_TICKET_SP.includes(est as EstadoTicketSp)) {
        set.status = 422;
        return { success: false, error: 'Estado inválido. Use: ' + ESTADOS_TICKET_SP.join(', ') };
    }

    try {
        const idTicket = parseInt(id, 10);
        const result = await ejecutarSpCambiarEstadoTicket(idTicket, est, idUsuario, motivo || null);
        return respuestaSpCambiarEstado(idTicket, est, result, set);
    } catch (error) {
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};