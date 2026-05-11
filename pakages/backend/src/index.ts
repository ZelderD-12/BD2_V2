import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { getConnection, sql } from './Connection';
import { login, crearUsuario, actualizarUsuario, obtenerUsuario } from './Controlles/usuarios/usuarios';

const app = new Elysia();

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Health
app.get('/', () => ({ message: 'API de Clinica funcionando', version: '2.0.0' }));
app.get('/health', () => ({ status: 'OK', timestamp: new Date().toISOString() }));

// Test BD
app.get('/api/db-test', async ({ set }) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT @@SERVERNAME as server_name, DB_NAME() as database_name, @@VERSION as version, GETDATE() as server_time
        `);
        return { success: true, message: 'Conexion exitosa', data: result.recordset[0] };
    } catch (error: any) {
        set.status = 500;
        return { success: false, message: 'Error', error: error.message };
    }
});

// Usuarios
app.post('/Login', login);
app.post('/Usuario/crear', crearUsuario);
app.put('/Usuario/actualizar', actualizarUsuario);
app.get('/Usuario/:id', obtenerUsuario);

const port = 8080;
app.listen(port);
console.log(`\n🚀 API corriendo en http://localhost:${port}`);