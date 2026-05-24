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

// Silenciar logs internos de mssql
const originalError = console.error;
console.error = (...args) => {
    const message = args.join(' ');
    // Filtrar los logs de tipo de datos
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

export async function getConnection(): Promise<ConnectionPool> {
    if (pool && pool.connected) {
        return pool;
    }
    pool = await sql.connect(dbConfig);
    return pool;
}

export async function closeConnection(): Promise<void> {
    if (pool && pool.connected) {
        await pool.close();
        pool = null;
    }
}

export { sql };