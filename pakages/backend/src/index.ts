import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { getConnection, sql } from './Connection';
import { login, crearUsuario, actualizarUsuario, obtenerUsuario } from './Controlles/usuarios/usuarios';
import {
    reservarCitaService,
    obtenerCitasPaciente,
    obtenerServicios,
    obtenerMedicos,
    confirmarCitaService,
    modificarCitaService,
    cancelarCitaService
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
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
}));

// Health
app.get('/', () => ({ message: 'API Clinica Grupo 3', version: '3.0.0' }));
app.get('/health', () => ({ status: 'OK', timestamp: new Date().toISOString() }));

// DB Test
app.get('/api/db-test', async ({ set }) => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT @@SERVERNAME as server, DB_NAME() as db, GETDATE() as time');
        return { success: true, data: result.recordset[0] };
    } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
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
app.post('/api/citas/:id/confirmar', confirmarCitaService);
app.put('/api/citas/:id/modificar', modificarCitaService);
app.post('/api/citas/:id/cancelar', cancelarCitaService);

// Tickets
app.post('/api/tickets/generar', generarTicketService);
app.post('/api/tickets/siguiente', llamarSiguienteService);
app.post('/api/tickets/:id/estado', cambiarEstadoTicketService);
app.get('/api/pantalla/cola', obtenerColaPublicaService);
app.get('/api/tickets/cola-actuales', obtenerTicketsColaActuales);
app.get('/api/tickets/paciente-por-codigo', obtenerPacientePorTicketService);
app.post('/api/tickets/:id/cambiar-estado', cambiarEstadoTicketManual);

const port = 8080;
app.listen(port);
console.log('\n🚀 API corriendo en http://localhost:' + port);