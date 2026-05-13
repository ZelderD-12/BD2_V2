import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { getConnection, sql } from './Connection';
import { login, crearUsuario, actualizarUsuario, obtenerUsuario } from './Controlles/usuarios/usuarios';
import {
    reservarCitaService,
    obtenerCitasPaciente,
    obtenerServicios,
    obtenerMedicos
} from './services/citas';
import {
    generarTicketService,
    llamarSiguienteService,
    cambiarEstadoTicketService,
    obtenerColaPublicaService,
    obtenerTicketsColaActuales,
    cambiarEstadoTicketManual,
    obtenerPacientePorTicketService
} from './services/tickets';

const app = new Elysia();

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    credentials: true,
    maxAge: 86400
}));

app.options('*', ({ set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Idempotency-Key';
    set.status = 204;
    return null;
});

// Health
app.get('/', () => ({ message: 'API de Clinica funcionando  del Grupo 3', version: '2.0.0' }));
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

// Citas
app.post('/api/reservar/cita', reservarCitaService);
app.get('/api/citas/paciente/:id', obtenerCitasPaciente);
app.get('/api/citas/servicios', obtenerServicios);
app.get('/api/citas/medicos', obtenerMedicos);

// Tickets y cola de recepción
app.post('/api/tickets/generar', generarTicketService);
app.post('/api/tickets/siguiente', llamarSiguienteService);
app.post('/api/tickets/:id/estado', cambiarEstadoTicketService);
app.get('/api/pantalla/cola', obtenerColaPublicaService);
app.get('/api/tickets/cola-actuales', obtenerTicketsColaActuales);
app.get('/api/tickets/paciente-por-codigo', obtenerPacientePorTicketService);
app.post('/api/tickets/:id/cambiar-estado', cambiarEstadoTicketManual);

const port = 8080;
app.listen(port);
console.log(`\n🚀 API corriendo en http://localhost:${port}`);