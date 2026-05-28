import sql, { ConnectionPool } from 'mssql';

const dbConfig = {
    server: process.env.DB_HOST || '',
    database: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: (process.env.DB_PASSWORD || '').replace(/^"(.*)"$/, '$1'),
    port: parseInt(process.env.DB_PORT || ''),
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 50,
        min: 5,
        idleTimeoutMillis: 60000
    },
    connectionTimeout: 30000,
    requestTimeout: 45000,
    debug: false
};

let pool: ConnectionPool | null = null;
let reconectando = false;

// Silenciar logs internos de mssql
const originalError = console.error;
console.error = (...args) => {
    const message = args.join(' ');
    if (message.includes('type: [sql.SmallInt]') ||
        message.includes('scale: undefined') ||
        message.includes('precision: undefined') ||
        message.includes('nullable: true') ||
        message.includes('caseSensitive: false') ||
        message.includes('identity: false') ||
        message.includes('readOnly: false')) {
        return;
    }
    originalError(...args);
};

const MAX_REINTENTOS = 15;
const ESPERA_BASE = 1000;

function escucharEventosPool(p: ConnectionPool) {
    p.on('error', (err) => {
        console.error('Error en el pool de conexión:', err.message);
        pool = null;
    });
}

async function crearConexion(intento = 1): Promise<ConnectionPool> {
    if (reconectando && intento === 1) {
        // Si ya hay una reconexión en curso, esperar a que termine
        let esperas = 0;
        while (reconectando && esperas < 30) {
            await new Promise(r => setTimeout(r, 1000));
            esperas++;
            if (pool && pool.connected) return pool;
        }
    }
    reconectando = true;
    try {
        // Cerrar pool anterior si existe
        if (pool) {
            try { await pool.close(); } catch { /* ignorar error al cerrar */ }
            pool = null;
        }

        const nuevoPool = new ConnectionPool(dbConfig);
        escucharEventosPool(nuevoPool);
        await nuevoPool.connect();
        pool = nuevoPool;
        console.log(`Conectado a SQL Server (intento ${intento})`);
        reconectando = false;
        return pool;
    } catch (err: any) {
        console.error(`Conexión fallida (intento ${intento}/${MAX_REINTENTOS}):`, err.message);
        if (intento >= MAX_REINTENTOS) {
            reconectando = false;
            throw err;
        }
        const espera = ESPERA_BASE * Math.pow(2, intento - 1);
        await new Promise(r => setTimeout(r, espera));
        return crearConexion(intento + 1);
    }
}

export async function getConnection(): Promise<ConnectionPool> {
    if (pool && pool.connected) {
        return pool;
    }
    return crearConexion();
}

export async function closeConnection(): Promise<void> {
    if (pool) {
        try { await pool.close(); } catch { /* ignorar */ }
        pool = null;
    }
}

export { sql };