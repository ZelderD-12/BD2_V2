import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import '../../assets/styles/login.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')

  const [form, setForm] = useState({
    nombres: '', apellidos: '', dpi: '', telefono: '', direccion: '',
    rol: '2', sexo: '', fecha_nacimiento: '', email: '',
    antecedetes_medicos: '', password: '', confirmPassword: '', contacto_emergencia: ''
  })

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.id]: e.target.value })
  }

  const validar = (): boolean => {
    if (!form.nombres || !form.apellidos) { setMessage('Nombres y apellidos requeridos'); setMessageType('error'); return false }
    if (!/^\d{13}$/.test(form.dpi)) { setMessage('DPI debe tener 13 dígitos'); setMessageType('error'); return false }
    if (!/^\d{8}$/.test(form.telefono)) { setMessage('Teléfono debe tener 8 dígitos'); setMessageType('error'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setMessage('Email inválido'); setMessageType('error'); return false }
    if (!form.fecha_nacimiento) { setMessage('Fecha de nacimiento requerida'); setMessageType('error'); return false }
    if (!form.sexo) { setMessage('Selecciona el sexo'); setMessageType('error'); return false }
    if (form.password.length < 6) { setMessage('Contraseña mínima 6 caracteres'); setMessageType('error'); return false }
    if (form.password !== form.confirmPassword) { setMessage('Contraseñas no coinciden'); setMessageType('error'); return false }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validar()) return

    setLoading(true)
    try {
      const result = await api.register({
        nombres: form.nombres,
        apellidos: form.apellidos,
        dpi: form.dpi,
        telefono: form.telefono,
        direccion: form.direccion || null,
        rol: parseInt(form.rol),
        sexo: form.sexo,
        fecha_nacimiento: form.fecha_nacimiento,
        email: form.email,
        antecedetes_medicos: form.antecedetes_medicos || null,
        password: form.password,
        contacto_emergencia: form.contacto_emergencia || null
      })

      if (result.success) {
        setMessage('Cuenta creada. Redirigiendo al login...')
        setMessageType('success')
        setTimeout(() => navigate('/login'), 2000)
      } else {
        setMessage(result.message || 'Error al crear cuenta')
        setMessageType('error')
      }
    } catch {
      setMessage('Error de conexión')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <i className="fas fa-user-plus"></i>
              <h1>Crear Cuenta</h1>
            </div>
            <p>Regístrate para agendar tus citas médicas</p>
          </div>

          <form onSubmit={handleSubmit} style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Nombres *</label>
                <input type="text" id="nombres" value={form.nombres} onChange={handleChange} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Apellidos *</label>
                <input type="text" id="apellidos" value={form.apellidos} onChange={handleChange} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>DPI * (13 dígitos)</label>
                <input type="text" id="dpi" value={form.dpi} onChange={handleChange} maxLength={13} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Teléfono * (8 dígitos)</label>
                <input type="text" id="telefono" value={form.telefono} onChange={handleChange} maxLength={8} required />
              </div>
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <input type="text" id="direccion" value={form.direccion} onChange={handleChange} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Sexo *</label>
                <select id="sexo" value={form.sexo} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Tipo *</label>
                <select id="rol" value={form.rol} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  <option value="1">Anónimo</option>
                  <option value="2">Paciente</option>
                  <option value="3">Doctor</option>
                  <option value="4">Enfermería</option>
                  <option value="5">Recepción/Secretaría</option>
                  <option value="6">Recepción</option>
                  <option value="7">Farmacia/Laboratorio</option>
                  <option value="8">Finanzas/Contabilidad</option>
                  <option value="9">Técnico</option>
                  <option value="10">Auditor</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Email *</label>
                <input type="email" id="email" value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Fecha Nac. *</label>
                <input type="date" id="fecha_nacimiento" value={form.fecha_nacimiento} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Contacto Emergencia (opcional)</label>
              <input type="text" id="contacto_emergencia" value={form.contacto_emergencia} onChange={handleChange} maxLength={8} />
            </div>

            <div className="form-group">
              <label>Antecedentes Médicos</label>
              <textarea id="antecedetes_medicos" value={form.antecedetes_medicos} onChange={handleChange} rows={2} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Contraseña *</label>
                <input type="password" id="password" value={form.password} onChange={handleChange} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Confirmar *</label>
                <input type="password" id="confirmPassword" value={form.confirmPassword} onChange={handleChange} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? <><i className="fas fa-spinner fa-spin"></i> Creando...</> : <><i className="fas fa-user-plus"></i> Crear Cuenta</>}
            </button>
          </form>

          {message && <div className={`form-message ${messageType}`} style={{ marginTop: 10 }}>{message}</div>}

          <div className="login-footer" style={{ marginTop: 10 }}>
            <Link to="/login"><i className="fas fa-arrow-left"></i> Volver al Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}