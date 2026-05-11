import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { getConnection, sql } from './Connection';

const app = new Elysia();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health check
app.get('/', () => ({
    message: 'API de Clinica funcionando',
    version: '2.0.0'
}));

app.get('/health', () => ({
    status: 'OK',
    timestamp: new Date().toISOString()
}));

// Test conexión BD
app.get('/api/db-test', async ({ set }) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT 
                @@SERVERNAME as server_name,
                DB_NAME() as database_name,
                @@VERSION as version,
                GETDATE() as server_time
        `);
        return {
            success: true,
            message: 'Conexion exitosa a SQL Server',
            data: result.recordset[0]
        };
    } catch (error: any) {
        set.status = 500;
        return { success: false, message: 'Error de conexion', error: error.message };
    }
});

// LOGIN
app.post('/Login', async ({ body, set }) => {
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
        set.status = 400;
        return { success: false, message: 'Email y password requeridos' };
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .input('password', sql.VarChar(125), password)
            .input('ip_origen', sql.VarChar(50), 'localhost')
            .input('user_agent', sql.VarChar(200), 'test')
            .execute('sp_login_usuario');

        const data = result.recordset?.[0];

        if (data?.Resultado === 1) {
            return {
                success: true,
                message: data.Mensaje,
                token: data.token,
                usuario: {
                    id: data.id_usuario,
                    nombres: data.nombres,
                    apellidos: data.apellidos,
                    email: data.email,
                    rol: data.rol,
                    rol_nombre: data.rol_nombre
                }
            };
        }

        set.status = 401;
        return { success: false, message: data?.Mensaje || 'Credenciales incorrectas', code: data?.Codigo };

    } catch (error: any) {
        set.status = 500;
        return { success: false, message: 'Error interno', error: error.message };
    }
});

const port = 8080;
app.listen(port);
console.log(`API corriendo en http://localhost:${port}`);