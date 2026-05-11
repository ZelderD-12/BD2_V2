// api.ts
import dotenv from 'dotenv';
dotenv.config();

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { login, crearUsuario, actualizarUsuario, obtenerUsuario } from './Controlles/usuarios';
import { 
    pagarConTarjeta,
    pagarConTransferencia,
    consultarSaldo, 
    obtenerHistorial, 
    obtenerDetallePago 
} from './services/transferencias';

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
    obtenerColaPublicaService
} from './services/tickets';

const app = new Elysia();

// Configuración CORS corregida
app.use(cors({
    origin: true, // Permite cualquier origen
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'], // 👈 CORREGIDO: exposeHeaders (sin 'd')
    credentials: true,
    maxAge: 86400 // 24 horas
}));

// Manejo explícito de OPTIONS para preflight
app.options('*', ({ set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Idempotency-Key';
    set.status = 204;
    return null;
});

// Health check
app.get('/', () => ({
    message: 'API de Clinica funcionando',
    version: '2.0.0'
}));

app.get('/health', () => ({
    status: 'OK',
    timestamp: new Date().toISOString()
}));

// Usuarios
app.post('/Login', login);
app.post('/Usuario/crear', crearUsuario);
app.put('/Usuario/actualizar', actualizarUsuario);
app.get('/Usuario/:id', obtenerUsuario);

// =============================================
// PAGOS A FAMKON (usando email/telefono)
// =============================================

// Pago con tarjeta
app.post('/pagos/tarjeta', pagarConTarjeta);

// Pago con transferencia bancaria
app.post('/pagos/transferencia', pagarConTransferencia);

// Consultar saldo (por email o telefono)
app.get('/pagos/saldo', consultarSaldo);

// Obtener historial de pagos
app.get('/pagos/historial', obtenerHistorial);

// Obtener detalle de un pago
app.get('/pagos/detalle/:id', obtenerDetallePago);

app.post('/api/reservar/cita',      reservarCitaService);
app.get('/api/citas/paciente/:id',  obtenerCitasPaciente);
app.get('/api/citas/servicios',     obtenerServicios);
app.get('/api/citas/medicos',       obtenerMedicos);

// Tickets y cola de recepcion
app.post('/api/tickets/generar',         generarTicketService);
app.post('/api/tickets/siguiente',       llamarSiguienteService);
app.post('/api/tickets/:id/estado',      cambiarEstadoTicketService);
app.get('/api/pantalla/cola',            obtenerColaPublicaService);

const port = parseInt(process.env.APP_PORT || '8080');
app.listen(port);

console.log(`\n API Clinica FamKon corriendo en http://localhost:${port}`);