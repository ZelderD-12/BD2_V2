const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const api = {
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

  async getDbTest() {
    const res = await fetch(`${API_URL}/health`)
    return res.json()
  },

  async getPatients() {
    const res = await fetch(`${API_URL}/api/patients`)
    return res.json()
  }
}

export default API_URL