// Connection.ts
import dotenv from 'dotenv';
dotenv.config();

import sql, { ConnectionPool } from 'mssql';
import type { config } from 'mssql';  

const dbConfig: config = {
    server: process.env.DB_HOST || '',
    database: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || ''),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool: ConnectionPool | null = null;

export async function getConnection(): Promise<ConnectionPool> {
    try {
        if (pool && pool.connected) {
            console.log(' Usando conexión existente');
            return pool;
        }  
        pool = await sql.connect(dbConfig); 
        return pool;
    } catch (error) {
        console.error(' Error de conexión:', error);
        throw error;
    }
}

export async function closeConnection(): Promise<void> {
    if (pool && pool.connected) {
        await pool.close();
        console.log(' Conexión cerrada');
        pool = null;
    }
}

export { sql };