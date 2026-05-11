// services/transferencias.ts
import { sql, getConnection } from '../Connection';
import type { Context } from 'elysia';

interface PagoBody {
    email: string;
    telefono?: string;
    monto: number;
    concepto: string;
    numero_tarjeta: string;
    nombre_titular: string;
    fecha_expiracion: string;
    cvv: string;
    id_cita?: number;
    id_servicio?: number;
}

interface PagoTransferenciaBody {
    email: string;
    telefono?: string;
    monto: number;
    concepto: string;
    numero_cuenta: string;
    id_cita?: number;
    id_servicio?: number;
}

const getClientIp = (request: Request): string => {
    return request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           request.headers.get('host')?.split(':')[0] || 
           '0.0.0.0';
};

// =============================================
// 1. PAGAR CON TARJETA (A FAMKON)
// =============================================
export const pagarConTarjeta = async ({ body, set, request }: Context) => {
    const { 
        email, 
        telefono, 
        monto, 
        concepto, 
        numero_tarjeta, 
        nombre_titular, 
        fecha_expiracion, 
        cvv,
        id_cita, 
        id_servicio 
    } = body as PagoBody;
    
    const idempotencyKey = request.headers.get('idempotency-key');
    const ip_origen = getClientIp(request);

    // Validaciones
    if (!idempotencyKey) {
        set.status = 422;
        return { 
            success: false, 
            error: 'Idempotency-Key es requerido',
            code: 'IDEMPOTENCY_KEY_REQUIRED'
        };
    }

    if (!email && !telefono) {
        set.status = 422;
        return { 
            success: false, 
            error: 'Debe proporcionar email o teléfono',
            code: 'MISSING_FIELDS'
        };
    }

    if (!monto || monto <= 0 || !concepto) {
        set.status = 422;
        return { 
            success: false, 
            error: 'monto y concepto son requeridos',
            code: 'MISSING_FIELDS'
        };
    }

    if (!numero_tarjeta || !cvv || !nombre_titular || !fecha_expiracion) {
        set.status = 422;
        return { 
            success: false, 
            error: 'Datos de tarjeta incompletos: numero_tarjeta, cvv, nombre_titular, fecha_expiracion',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();
        
        const result = await pool.request()
            .input('email', sql.VarChar(100), email || null)
            .input('telefono', sql.VarChar(15), telefono || null)
            .input('numero_tarjeta', sql.VarChar(16), numero_tarjeta.replace(/\s/g, ''))
            .input('nombre_titular', sql.VarChar(100), nombre_titular)
            .input('fecha_expiracion', sql.VarChar(5), fecha_expiracion)
            .input('cvv', sql.VarChar(4), cvv)
            .input('monto', sql.Decimal(15,2), monto)
            .input('concepto', sql.VarChar(200), concepto)
            .input('ip_origen', sql.VarChar(50), ip_origen)
            .output('resultado', sql.Int)
            .output('mensaje', sql.VarChar(200))
            .execute('sp_pagar_con_tarjeta_famkon');

        if (result.output.resultado === 1) {
            set.status = 200;
            return {
                success: true,
                mensaje: result.output.mensaje,
                code: 'PAGO_EXITOSO'
            };
        } else {
            const tieneSaldo = result.output.mensaje?.includes('saldo') || result.output.mensaje?.includes('insuficiente');
            set.status = tieneSaldo ? 422 : 400;
            return {
                success: false,
                error: result.output.mensaje,
                code: 'PAGO_FALLIDO'
            };
        }
    } catch (error) {
        console.error('Error en pagarConTarjeta:', error);
        set.status = 500;
        return { 
            success: false, 
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 2. PAGAR CON TRANSFERENCIA (A FAMKON)
// =============================================
export const pagarConTransferencia = async ({ body, set, request }: Context) => {
    const { 
        email, 
        telefono, 
        monto, 
        concepto, 
        numero_cuenta,
        id_cita, 
        id_servicio 
    } = body as PagoTransferenciaBody;
    
    const idempotencyKey = request.headers.get('idempotency-key');
    const ip_origen = getClientIp(request);

    // Validaciones
    if (!idempotencyKey) {
        set.status = 422;
        return { 
            success: false, 
            error: 'Idempotency-Key es requerido',
            code: 'IDEMPOTENCY_KEY_REQUIRED'
        };
    }

    if (!email && !telefono) {
        set.status = 422;
        return { 
            success: false, 
            error: 'Debe proporcionar email o teléfono',
            code: 'MISSING_FIELDS'
        };
    }

    if (!monto || monto <= 0 || !concepto) {
        set.status = 422;
        return { 
            success: false, 
            error: 'monto y concepto son requeridos',
            code: 'MISSING_FIELDS'
        };
    }

    if (!numero_cuenta) {
        set.status = 422;
        return { 
            success: false, 
            error: 'numero_cuenta es requerido para transferencia',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();
        
        // Primero obtener el ID del usuario por email/telefono
        const userResult = await pool.request()
            .input('email', sql.VarChar(100), email || null)
            .input('telefono', sql.VarChar(15), telefono || null)
            .query(`
                SELECT id_usuario FROM dbo.ususarios 
                WHERE (email = @email OR telefono = @telefono)
            `);

        if (!userResult.recordset || userResult.recordset.length === 0) {
            set.status = 404;
            return {
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            };
        }

        const id_usuario = userResult.recordset[0].id_usuario;
        
        const result = await pool.request()
            .input('id_usuario_origen', sql.Int, id_usuario)
            .input('numero_cuenta_origen', sql.VarChar(20), numero_cuenta)
            .input('monto', sql.Decimal(15,2), monto)
            .input('concepto', sql.VarChar(200), concepto)
            .input('ip_origen', sql.VarChar(50), ip_origen)
            .input('id_servicio', sql.Int, id_servicio || null)
            .input('tipo_servicio', sql.VarChar(50), id_cita ? 'CITA' : (id_servicio ? 'SERVICIO' : 'GENERAL'))
            .output('resultado', sql.Int)
            .output('mensaje', sql.VarChar(200))
            .execute('sp_realizar_transferencia_famkon');

        if (result.output.resultado === 1) {
            set.status = 200;
            return {
                success: true,
                mensaje: result.output.mensaje,
                code: 'PAGO_EXITOSO'
            };
        } else {
            const tieneSaldo = result.output.mensaje?.includes('saldo') || result.output.mensaje?.includes('insuficiente');
            set.status = tieneSaldo ? 422 : 400;
            return {
                success: false,
                error: result.output.mensaje,
                code: 'PAGO_FALLIDO'
            };
        }
    } catch (error) {
        console.error('Error en pagarConTransferencia:', error);
        set.status = 500;
        return { 
            success: false, 
            error: 'Error interno del servidor',
            code: 'SERVER_ERROR'
        };
    }
};

// =============================================
// 3. CONSULTAR SALDO POR EMAIL/TELEFONO
// =============================================
export const consultarSaldo = async ({ body, set, request }: Context) => {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const telefono = url.searchParams.get('telefono');

    if (!email && !telefono) {
        set.status = 422;
        return {
            success: false,
            error: 'Debe proporcionar email o teléfono',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();
        
        // Obtener usuario por email/telefono
        const userResult = await pool.request()
            .input('email', sql.VarChar(100), email || null)
            .input('telefono', sql.VarChar(15), telefono || null)
            .query(`
                SELECT id_usuario FROM dbo.ususarios 
                WHERE (email = @email OR telefono = @telefono)
            `);

        if (!userResult.recordset || userResult.recordset.length === 0) {
            set.status = 404;
            return {
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            };
        }

        const id_usuario = userResult.recordset[0].id_usuario;
        
        const result = await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .execute('sp_consultar_saldo_usuario');

        if (!result.recordset || result.recordset.length === 0) {
            set.status = 404;
            return {
                success: false,
                mensaje: 'No se encontró una cuenta asociada',
                code: 'CUENTA_NO_ENCONTRADA'
            };
        }

        const data = result.recordset[0];
        return {
            success: true,
            data: {
                id_cuenta: data.id_cuenta,
                numero_cuenta: data.numero_cuenta,
                tipo_cuenta: data.tipo_cuenta,
                saldo: data.saldo,
                moneda: data.moneda,
                limite_transferencia: data.limite_transferencia
            }
        };
    } catch (error) {
        console.error('Error en consultarSaldo:', error);
        set.status = 500;
        return { success: false, error: 'Error interno del servidor' };
    }
};

// =============================================
// 4. OBTENER HISTORIAL POR EMAIL/TELEFONO
// =============================================
export const obtenerHistorial = async ({ query, set, request }: Context) => {
    const { limite = 20, offset = 0, fecha_inicio, fecha_fin, email, telefono } = query as any;

    if (!email && !telefono) {
        set.status = 422;
        return {
            success: false,
            error: 'Debe proporcionar email o teléfono',
            code: 'MISSING_FIELDS'
        };
    }

    try {
        const pool = await getConnection();
        
        // Obtener usuario por email/telefono
        const userResult = await pool.request()
            .input('email', sql.VarChar(100), email || null)
            .input('telefono', sql.VarChar(15), telefono || null)
            .query(`
                SELECT id_usuario FROM dbo.ususarios 
                WHERE (email = @email OR telefono = @telefono)
            `);

        if (!userResult.recordset || userResult.recordset.length === 0) {
            set.status = 404;
            return {
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            };
        }

        const id_usuario = userResult.recordset[0].id_usuario;
        
        const result = await pool.request()
            .input('id_usuario', sql.Int, id_usuario)
            .input('limite', sql.Int, parseInt(limite))
            .input('offset', sql.Int, parseInt(offset))
            .input('fecha_inicio', sql.Date, fecha_inicio || null)
            .input('fecha_fin', sql.Date, fecha_fin || null)
            .execute('sp_historial_transacciones_usuario');

        const recordsets = result.recordsets as any[];
        const transacciones = recordsets[0] || [];
        const estadisticas = (recordsets[1] && recordsets[1][0]) || {
            total_transacciones: 0,
            total_enviado: 0,
            total_recibido: 0,
            balance_neto: 0,
            ips_diferentes: 0
        };

        return {
            success: true,
            data: {
                transacciones: transacciones,
                estadisticas: {
                    total_transacciones: estadisticas.total_transacciones || 0,
                    total_enviado: estadisticas.total_enviado || 0,
                    total_recibido: estadisticas.total_recibido || 0,
                    balance_neto: estadisticas.balance_neto || 0,
                    ips_diferentes: estadisticas.ips_diferentes || 0
                }
            },
            paginacion: {
                limite: parseInt(limite),
                offset: parseInt(offset),
                total_mostrados: transacciones.length
            }
        };
    } catch (error) {
        console.error('Error en obtenerHistorial:', error);
        set.status = 500;
        return { success: false, error: 'Error interno del servidor' };
    }
};

// =============================================
// 5. OBTENER DETALLE DE PAGO
// =============================================
export const obtenerDetallePago = async ({ params, query, set, request }: Context) => {
    const { id } = params as { id: string };
    const { email, telefono } = query as any;

    if (!email && !telefono) {
        set.status = 422;
        return {
            success: false,
            error: 'Debe proporcionar email o teléfono',
            code: 'MISSING_FIELDS'
        };
    }

    if (!id) {
        set.status = 422;
        return { success: false, error: 'ID de transacción requerido' };
    }

    try {
        const pool = await getConnection();
        
        // Obtener usuario por email/telefono
        const userResult = await pool.request()
            .input('email', sql.VarChar(100), email || null)
            .input('telefono', sql.VarChar(15), telefono || null)
            .query(`
                SELECT id_usuario FROM dbo.ususarios 
                WHERE (email = @email OR telefono = @telefono)
            `);

        if (!userResult.recordset || userResult.recordset.length === 0) {
            set.status = 404;
            return {
                success: false,
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            };
        }

        const id_usuario = userResult.recordset[0].id_usuario;
        
        const result = await pool.request()
            .input('id_transferencia', sql.Int, parseInt(id))
            .input('id_usuario', sql.Int, id_usuario)
            .execute('sp_detalle_transaccion');

        if (!result.recordset || result.recordset.length === 0) {
            set.status = 404;
            return { success: false, error: 'Transacción no encontrada' };
        }

        return {
            success: true,
            data: result.recordset[0]
        };
    } catch (error) {
        console.error('Error en obtenerDetallePago:', error);
        set.status = 500;
        return { success: false, error: 'Error interno del servidor' };
    }
};