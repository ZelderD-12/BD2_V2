import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import '../../assets/styles/login.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    dpi: '',
    telefono: '',
    email: '',
    fecha_nacimiento: '',
    sexo: '',
    rol: '2',
    direccion: '',
    password: '',
    confirmPassword: '',
    contacto_emergencia: '',
    antecedentes_medicos: ''
  })

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value })
  }

  const validar = () => {
    if (!formData.nombres) { showMessage('Ingresa tus nombres', 'error'); return false }
    if (!formData.apellidos) { showMessage('Ingresa tus apellidos', 'error'); return false }
    if (!/^\d{13}$/.test(formData.dpi)) { showMessage('DPI debe tener 13 dígitos', 'error'); return false }
    if (!/^\d{8}$/.test(formData.telefono)) { showMessage('Teléfono debe tener 8 dígitos', 'error'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { showMessage('Email inválido', 'error'); return false }
    if (!formData.fecha_nacimiento) { showMessage('Ingresa tu fecha de nacimiento', 'error'); return false }
    if (!formData.sexo) { showMessage('Selecciona tu sexo', 'error'); return false }
    if (formData.password.length < 6) { showMessage('Contraseña mínima 6 caracteres', 'error'); return false }
    if (formData.password !== formData.confirmPassword) { showMessage('Las contraseñas no coinciden', 'error'); return false }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validar()) return

    setLoading(true)
    try {
      const result = await api.register({
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        dpi: formData.dpi,
        telefono: formData.telefono,
        direccion: formData.direccion || null,
        rol: parseInt(formData.rol),
        sexo: formData.sexo,
        fecha_nacimiento: formData.fecha_nacimiento,
        email: formData.email,
        antecedentes_medicos: formData.antecedentes_medicos || null,
        password: formData.password,
        contacto_emergencia: formData.contacto_emergencia || null
      })

      if (result.success) {
        showMessage('Cuenta creada correctamente. Redirigiendo...', 'success')
        setTimeout(() => navigate('/login'), 2000)
      } else {
        showMessage(result.message || 'Error al crear cuenta', 'error')
      }
    } catch (err) {
      showMessage('Error de conexión con el servidor', 'error')
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

          <form onSubmit={handleSubmit} style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '10px' }}>
            <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-user"></i> Nombres *</label>
                <input type="text" id="nombres" value={formData.nombres} onChange={handleChange} placeholder="Juan Carlos" required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-user"></i> Apellidos *</label>
                <input type="text" id="apellidos" value={formData.apellidos} onChange={handleChange} placeholder="Pérez Gómez" required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-id-card"></i> DPI *</label>
                <input type="text" id="dpi" value={formData.dpi} onChange={handleChange} maxLength={13} placeholder="1234567890123" required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-phone"></i> Teléfono *</label>
                <input type="text" id="telefono" value={formData.telefono} onChange={handleChange} maxLength={8} placeholder="55551234" required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-envelope"></i> Correo *</label>
                <input type="email" id="email" value={formData.email} onChange={handleChange} placeholder="ejemplo@correo.com" required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-calendar"></i> Fecha Nac. *</label>
                <input type="date" id="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-venus-mars"></i> Sexo *</label>
                <select id="sexo" value={formData.sexo} onChange={handleChange} required>
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-user-tag"></i> Tipo *</label>
                <select id="rol" value={formData.rol} onChange={handleChange} required>
                  <option value="1">Anónimo</option>
                  <option value="2">Paciente</option>
                  <option value="3">Doctor/a</option>
                  <option value="4">Trabajador/a</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label><i className="fas fa-map-marker-alt"></i> Dirección</label>
              <input type="text" id="direccion" value={formData.direccion} onChange={handleChange} placeholder="Ciudad, Zona, Calle..." />
            </div>

            <div className="form-group">
              <label><i className="fas fa-phone-alt"></i> Contacto Emergencia</label>
              <input type="text" id="contacto_emergencia" value={formData.contacto_emergencia} onChange={handleChange} maxLength={8} placeholder="Teléfono (opcional)" />
            </div>

            <div className="form-group">
              <label><i className="fas fa-notes-medical"></i> Antecedentes Médicos</label>
              <textarea id="antecedentes_medicos" value={formData.antecedentes_medicos} onChange={handleChange} rows={2} placeholder="Alergias, enfermedades..." />
            </div>

            <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-lock"></i> Contraseña *</label>
                <input type="password" id="password" value={formData.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label><i className="fas fa-lock"></i> Confirmar *</label>
                <input type="password" id="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Repite tu contraseña" required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> Creando cuenta...</>
              ) : (
                <><i className="fas fa-user-plus"></i> Crear Cuenta</>
              )}
            </button>
          </form>

          {message && (
            <div className={`form-message ${messageType}`} style={{ marginTop: 15 }}>
              {message}
            </div>
          )}

          <div className="login-footer" style={{ marginTop: 15 }}>
            <Link to="/login"><i className="fas fa-arrow-left"></i> Volver al Login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}