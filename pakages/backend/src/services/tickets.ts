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

interface CambiarEstadoBody {
    nuevo_estado: 'EN_ATENCION' | 'FINALIZADO' | 'NO_SHOW';
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

export const cambiarEstadoTicketService = async ({ params, body, set, request }: Context) => {
    const idUsuario = extraerUsuario(request.headers.get('authorization'));
    if (!idUsuario) { set.status = 401; return { success: false, error: 'No autorizado' }; }

    const { id } = params as { id: string };
    const { nuevo_estado, motivo } = body as CambiarEstadoBody;

    if (!nuevo_estado || !['EN_ATENCION','FINALIZADO','NO_SHOW'].includes(nuevo_estado)) {
        set.status = 422; return { success: false, error: 'Estado inválido' };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_ticket', sql.Int, parseInt(id))
            .input('nuevo_estado', sql.VarChar(20), nuevo_estado)
            .input('id_usuario', sql.Int, idUsuario)
            .input('motivo', sql.VarChar(300), motivo || null)
            .output('mensaje_out', sql.VarChar(200))
            .execute('dbo.sp_CambiarEstadoTicket');

        const rv = result.returnValue;
        const mensaje = result.output.mensaje_out;

        if (rv === 404) { set.status = 404; return { success: false, error: mensaje }; }
        if (rv === 422) { set.status = 422; return { success: false, error: mensaje }; }
        if (rv === 500) { set.status = 500; return { success: false, error: 'Error interno' }; }

        return { success: true, mensaje, data: { id_ticket: parseInt(id), estado: nuevo_estado } };
    } catch (error) {
        console.error('Error en cambiarEstadoTicket:', error);
        set.status = 500;
        return { success: false, error: 'Error interno' };
    }
};

export const obtenerColaPublicaService = async ({ query, set }: Context) => {
    const { id_sede, id_servicio } = query as { id_sede?: string; id_servicio?: string };

    if (!id_sede) { set.status = 422; return { success: false, error: 'id_sede requerido' }; }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id_sede', sql.Int, parseInt(id_sede))
            .input('id_servicio', sql.Int, id_servicio ? parseInt(id_servicio) : null)
            .execute('dbo.sp_ObtenerColaPublica');

        const llamado = (result.recordsets as any[])[0]?.[0] || null;
        const proximos = (result.recordsets as any[][])[1] || [];

        return { success: true, data: { llamado_actual: llamado, proximos } };
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