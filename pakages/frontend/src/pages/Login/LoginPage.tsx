import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import '../../assets/styles/login.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [loading, setLoading] = useState(false)
  const { login, isLoggedIn } = useAuth()
  const navigate = useNavigate()

  // Si ya está logueado, redirigir
  useEffect(() => {
    if (isLoggedIn) {
      setMessage('Ya tienes una sesión activa. Redirigiendo...')
      setMessageType('success')
      setTimeout(() => navigate('/'), 1500)
    }
  }, [isLoggedIn, navigate])

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      showMessage('Ingresa tu correo electrónico', 'error')
      return
    }
    
    if (!password) {
      showMessage('Ingresa tu contraseña', 'error')
      return
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showMessage('Ingresa un correo electrónico válido', 'error')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await api.login(email, password)

      if (result.success && result.token) {
        const nombre = result.usuario?.nombres 
          ? `${result.usuario.nombres} ${result.usuario.apellidos || ''}`
          : email.split('@')[0]
        const rol = result.usuario?.rol_nombre || result.usuario?.rol || 'PACIENTE'

        login(result.token, nombre, rol)
        localStorage.setItem('user_email', email)
        localStorage.setItem('user_id', result.usuario?.id || '')

        showMessage('Sesión iniciada correctamente. Redirigiendo...', 'success')
        setTimeout(() => navigate('/'), 1500)
        return
      }

      // Manejar códigos de error
      let mensajeError = result.message || 'Error al iniciar sesión'
      
      if (result.code === 'USUARIO_NO_ENCONTRADO') {
        mensajeError = 'No existe una cuenta con este correo. ¿Deseas registrarte?'
      } else if (result.code === 'CONTRASENA_INCORRECTA') {
        mensajeError = 'Contraseña incorrecta. Por favor verifica tu contraseña.'
      } else if (result.code === 'CUENTA_BLOQUEADA') {
        mensajeError = result.message || 'Cuenta bloqueada por muchos intentos fallidos.'
      } else if (result.code === 'DEMASIADOS_INTENTOS') {
        mensajeError = result.message || 'Demasiados intentos fallidos.'
      }
      
      showMessage(mensajeError, 'error')
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
              <i className="fas fa-heartbeat"></i>
              <h1>FamKon Clinic</h1>
            </div>
            <p>Inicia sesión para agendar tus citas</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-envelope"></i> Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                required
              />
            </div>

            <div className="form-group">
              <label><i className="fas fa-lock"></i> Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
              />
            </div>

            <div className="forgot-password">
              <a href="#"><i className="fas fa-key"></i> ¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> Verificando...</>
              ) : (
                <><i className="fas fa-sign-in-alt"></i> Iniciar Sesión</>
              )}
            </button>
          </form>

          {message && (
            <div className={`form-message ${messageType}`}>
              {message}
            </div>
          )}

          <div className="login-footer">
            <Link to="/"><i className="fas fa-arrow-left"></i> Volver al inicio</Link>
          </div>

          <div className="register-link">
            <p>¿No tienes una cuenta?</p>
            <Link to="/register">
              <i className="fas fa-user-plus"></i> Crear nueva cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}