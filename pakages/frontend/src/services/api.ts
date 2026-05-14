const API_URL = 'http://localhost:8080'

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    return res.json()
  },

  async register(userData: any) {
    const res = await fetch(`${API_URL}/Usuario/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    })
    return res.json()
  },

  // Usuarios
  async getUsuario(id: number) {
    const res = await fetch(`${API_URL}/Usuario/${id}`)
    return res.json()
  },

  async actualizarUsuario(data: any) {
    const res = await fetch(`${API_URL}/Usuario/actualizar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // DB Test
  async getDbTest() {
    const res = await fetch(`${API_URL}/api/db-test`)
    return res.json()
  },

  // Servicios
  async getServicios() {
    const res = await fetch(`${API_URL}/api/citas/servicios`)
    return res.json()
  },

  // Médicos
  async getMedicos() {
    const res = await fetch(`${API_URL}/api/citas/medicos`)
    return res.json()
  },

  // ========== CITAS ==========
  async getCitasPaciente(idPaciente: number) {
    const res = await fetch(`${API_URL}/api/citas/paciente/${idPaciente}`)
    return res.json()
  },

  async getCitasMedico(idMedico: number) {
    const res = await fetch(`${API_URL}/api/citas/medico/${idMedico}`)
    return res.json()
  },

  async getCitasMedicoEnAtencion(idUsuarioM: number) {
    const res = await fetch(`${API_URL}/api/medico/${idUsuarioM}/citas/atencion`)
    return res.json()
  },

  async reservarCita(data: {
    id_paciente: number;
    id_medico: number;
    id_servicio: number;
    fecha_inicio: string;
    motivo_consulta?: string;
  }) {
    const res = await fetch(`${API_URL}/api/reservar/cita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async confirmarCita(idCita: number, idPaciente: number) {
    const res = await fetch(`${API_URL}/api/citas/${idCita}/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_paciente: idPaciente })
    })
    return res.json()
  },

  async modificarCita(idCita: number, data: {
    id_paciente: number;
    nuevo_id_servicio?: number;
    nueva_fecha_inicio?: string;
    motivo_consulta?: string;
  }) {
    const res = await fetch(`${API_URL}/api/citas/${idCita}/modificar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async cancelarCita(idCita: number, idPaciente: number, motivo?: string) {
    const res = await fetch(`${API_URL}/api/citas/${idCita}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_paciente: idPaciente, motivo_cancelacion: motivo })
    })
    return res.json()
  },

  // ========== TICKETS (RECEPCIÓN) ==========
  async generarTicket(data: any) {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`${API_URL}/api/tickets/generar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async llamarSiguiente(data: any) {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`${API_URL}/api/tickets/siguiente`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async cambiarEstadoTicket(id: number, data: any) {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`${API_URL}/api/tickets/${id}/estado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async getCola(idSede: number, idServicio: number) {
    const res = await fetch(`${API_URL}/api/pantalla/cola?id_sede=${idSede}&id_servicio=${idServicio}`)
    return res.json()
  },

  // ========== HISTORIAL CLÍNICO ==========
  async getHistorialPaciente(idPaciente: number) {
    const res = await fetch(`${API_URL}/api/historial/paciente/${idPaciente}`)
    return res.json()
  },

  async getHistorialCompletoPaciente(idPaciente: number, idMedico?: number) {
    let url = `${API_URL}/api/historial/completo/${idPaciente}`
    if (idMedico) url += `?id_medico=${idMedico}`
    const res = await fetch(url)
    return res.json()
  },

  async getHistorialPorCita(idCita: number) {
    const res = await fetch(`${API_URL}/api/historial/cita/${idCita}`)
    return res.json()
  },

  async guardarHistorialClinico(data: any) {
    const res = await fetch(`${API_URL}/api/historial/guardar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // ========== RECETAS ==========
  async getMedicamentos() {
    const res = await fetch(`${API_URL}/api/medicamentos`)
    return res.json()
  },

  async crearReceta(id_cita: number, id_medicamento: number, observaciones?: string) {
    const res = await fetch(`${API_URL}/api/receta/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cita, id_medicamento, observaciones })
    })
    return res.json()
  },

  async crearRecetaConMedicamentos(id_cita: number, medicamentos_json: string) {
    const res = await fetch(`${API_URL}/api/receta/crear-con-medicamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_cita, medicamentos_json })
    })
    return res.json()
  },

  async agregarMedicamentoReceta(orden_receta: string, id_medicamento: number, observaciones?: string) {
    const res = await fetch(`${API_URL}/api/receta/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden_receta, id_medicamento, observaciones })
    })
    return res.json()
  },

  async consultarReceta(orden_receta: string) {
    const res = await fetch(`${API_URL}/api/receta/${orden_receta}`)
    return res.json()
  },

  // ========== ATENCIÓN ==========
  async finalizarAtencion(data: any) {
    const res = await fetch(`${API_URL}/api/atencion/finalizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  }
}

export default API_URL