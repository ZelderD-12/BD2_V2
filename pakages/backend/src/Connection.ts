import sql, { ConnectionPool } from 'mssql';

const dbConfig = {
    server: process.env.DB_HOST || '',
    database: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || ''),
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
};

let pool: ConnectionPool | null = null;

export async function getConnection(): Promise<ConnectionPool> {
    if (pool && pool.connected) {
        return pool;
    }
    console.log('Conectando a SQL Server...');
    console.log('Server:', dbConfig.server, 'DB:', dbConfig.database, 'Port:', dbConfig.port);
    pool = await sql.connect(dbConfig);
    console.log(' Conectado a SQL Server');
    return pool;
}

export async function closeConnection(): Promise<void> {
    if (pool && pool.connected) {
        await pool.close();
        pool = null;
    }
}

export { sql };