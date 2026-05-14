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
    obtenerPacientePorTicketService
} from './services/tickets';
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
    crearRecetaConMedicamentos
} from './services/historialClinico';

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

// ========== SEDES ==========
app.get('/api/sedes', async ({ set }) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query('SELECT id_sede, nombre, ubicacion, capacidad_slots FROM dbo.Sede WHERE activo = 1 ORDER BY id_sede');
        
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

// Endpoint alternativo para confirmar cita (id_cita en body)
// Endpoint para confirmar cita (id_cita en body)
app.post('/api/citas/confirmar', async ({ body, set }) => {
  const { id_cita, id_paciente } = body as { id_cita: number; id_paciente: number };
  
  const mockContext = {
      params: { id: String(id_cita) },
      body: { id_paciente },
      set
  } as any;
  
  return confirmarCitaService(mockContext);
});

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

// ========== ATENCIÓN ==========
app.post('/api/atencion/finalizar', finalizarAtencion);

const port = 8080;
app.listen(port);
console.log('\n🚀 API corriendo en http://localhost:' + port);