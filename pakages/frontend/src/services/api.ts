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
  }
}

export default API_URL