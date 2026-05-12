const API_URL = 'http://localhost:8080'

export const api = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    return res.json()
  },

  async getDbTest() {
    const res = await fetch(`${API_URL}/api/db-test`)
    return res.json()
  },

  async getServicios() {
    const res = await fetch(`${API_URL}/api/citas/servicios`)
    return res.json()
  },

  async getMedicos() {
    const res = await fetch(`${API_URL}/api/citas/medicos`)
    return res.json()
  },

  async getCitasPaciente(idPaciente: number) {
    const res = await fetch(`${API_URL}/api/citas/paciente/${idPaciente}`)
    return res.json()
  },

  async reservarCita(data: any) {
    const res = await fetch(`${API_URL}/api/reservar/cita`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
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
  }
}

export default API_URL