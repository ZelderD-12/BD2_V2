import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { getConnection, sql } from './Connection';
import { login, crearUsuario, actualizarUsuario, obtenerUsuario } from './Controlles/usuarios/usuarios';
import {
    reservarCitaService,
    obtenerCitasPaciente,
    obtenerCitasMedico,
    obtenerServicios,
    obtenerMedicos,
    confirmarCitaService,
    modificarCitaService,
    cancelarCitaService,
    obtenerCitasMedicoEnAtencion,
    obtenerTodasCitasMedico,
} from './services/citas';
import {
    generarTicketService,
    llamarSiguienteService,
    cambiarEstadoTicketService,
    obtenerColaPublicaService,
    obtenerTicketsColaActuales,
    cambiarEstadoTicketManual,
    obtenerPacientePorTicketService,
    notificarWhatsappService
} from './services/tickets';
import { buscarPacientesService, obtenerDetalleCitaService, obtenerCitasDelDiaService } from './services/pacientes';
import {
    obtenerHistorialPaciente,
    obtenerHistorialCompletoPaciente,
    obtenerHistorialPorCita,
    guardarHistorialClinico,
    crearReceta,
    agregarMedicamentoReceta,
    consultarReceta,
    obtenerMedicamentos,
    finalizarAtencion,
    crearRecetaConMedicamentos,
    obtenerRecetasPaciente
} from './services/historialClinico';

import { logout, renovarSesion, obtenerUsuariosActivos, obtenerUsuariosInactivos, limpiarSesionesExpiradas } from './Controlles/usuarios/logout';
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
        const result = await pool.request().execute('sp_HealthCheck');
        return { success: true, data: result.recordset[0] };
    } catch (error: any) {
        set.status = 500;
        return { success: false, error: error.message };
    }
});

// ========== SEDES ==========
app.get('/api/sedes', async ({ set }) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .execute('sp_ObtenerSedes');
        
        console.log("Sedes encontradas:", result.recordset);
        
        return { 
            success: true, 
            data: result.recordset,
            count: result.recordset.length
        };
    } catch (error: any) {
        console.error("Error al obtener sedes:", error);
        set.status = 500;
        return { success: false, error: error.message };
    }
});

// ========== LOGOUT / SESIONES ==========
app.post('/api/logout', logout);
app.post('/api/sesion/renovar', renovarSesion);
app.get('/api/sesion/activos', obtenerUsuariosActivos);
app.get('/api/sesion/inactivos', obtenerUsuariosInactivos);
app.post('/api/sesion/limpiar', limpiarSesionesExpiradas);

// Usuarios
app.post('/Login', login);
app.post('/Usuario/crear', crearUsuario);
app.put('/Usuario/actualizar', actualizarUsuario);
app.get('/Usuario/:id', obtenerUsuario);

// Citas
app.post('/api/reservar/cita', reservarCitaService);
app.get('/api/citas/paciente/:id', obtenerCitasPaciente);
app.get('/api/citas/medico/:id', obtenerCitasMedico);
app.get('/api/citas/servicios', obtenerServicios);
app.get('/api/citas/medicos', obtenerMedicos);

app.post('/api/reservar/cita/:id/confirmar', confirmarCitaService);

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
app.post('/api/tickets/:id/notificar-whatsapp', notificarWhatsappService);

// Pacientes
app.get('/api/pacientes/buscar', buscarPacientesService);
app.get('/api/citas/hoy', obtenerCitasDelDiaService);
app.get('/api/citas/:id/detalle', obtenerDetalleCitaService);

app.get('/api/medico/:id_usuario_m/citas', obtenerTodasCitasMedico);
app.get('/api/medico/:id_usuario_m/citas/atencion', obtenerCitasMedicoEnAtencion);

// ========== HISTORIAL CLÍNICO ==========
app.get('/api/historial/paciente/:id_paciente', obtenerHistorialPaciente);
app.get('/api/historial/completo/:id_paciente', obtenerHistorialCompletoPaciente);
app.get('/api/historial/cita/:id_cita', obtenerHistorialPorCita);
app.post('/api/historial/guardar', guardarHistorialClinico);

// ========== RECETAS ==========
app.post('/api/receta/crear-con-medicamentos', crearRecetaConMedicamentos);
app.post('/api/receta/crear', crearReceta);
app.post('/api/receta/agregar', agregarMedicamentoReceta);
app.get('/api/receta/:orden_receta', consultarReceta);
app.get('/api/medicamentos', obtenerMedicamentos);
app.get('/api/recetas/paciente/:id_paciente', obtenerRecetasPaciente);

// ========== ATENCIÓN ==========
app.post('/api/atencion/finalizar', finalizarAtencion);

// ========== AUTO-EXPIRAR CITAS VENCIDAS ==========
async function expirarCitasVencidas() {
    try {
        const pool = await getConnection();
        // Confirmadas sin atender -> No_Show (6)
        const r1 = await pool.request()
            .input('nuevo_estado', sql.SmallInt, 6) // No_Show
            .input('estado_actual', sql.SmallInt, 2) // Confirmada
            .query(`
                UPDATE dbo.Cita
                SET id_estado_cita = @nuevo_estado
                WHERE id_estado_cita = @estado_actual
                  AND fecha_inicio < DATEADD(MINUTE, -30, GETDATE())
            `);
        if (r1.rowsAffected[0] > 0) {
            console.log(`[Auto-Expiracion] ${r1.rowsAffected[0]} citas Confirmadas -> No_Show`);
        }
        // Pendientes sin confirmar -> Expirada (7)
        const r2 = await pool.request()
            .input('nuevo_estado', sql.SmallInt, 7) // Expirada
            .input('estado_actual', sql.SmallInt, 1) // Pendiente
            .query(`
                UPDATE dbo.Cita
                SET id_estado_cita = @nuevo_estado
                WHERE id_estado_cita = @estado_actual
                  AND fecha_inicio < GETDATE()
            `);
        if (r2.rowsAffected[0] > 0) {
            console.log(`[Auto-Expiracion] ${r2.rowsAffected[0]} citas Pendientes -> Expirada`);
        }
    } catch (e) {
        console.error('[Auto-Expiracion] Error:', e);
    }
}
// Ejecutar cada 5 minutos
setInterval(expirarCitasVencidas, 5 * 60 * 1000);
// Primera ejecucion al iniciar
expirarCitasVencidas();

const port = 8080;
app.listen(port);
console.log('\n🚀 API corriendo en http://localhost:' + port);