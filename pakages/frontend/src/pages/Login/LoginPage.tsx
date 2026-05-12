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

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/')
    }
  }, [isLoggedIn, navigate])

  const getRedirectPath = (rolId: number): string => {
    // Roles 5 (Recepción/Secretaría) y 6 (Recepción) -> recepcion
    if (rolId === 5 || rolId === 6) return '/recepcion'
    // Doctor (3) podría ir a su panel
    // if (rolId === 3) return '/doctor'
    // Los demás van al home
    return '/'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setMessage('Ingresa tu correo electrónico')
      setMessageType('error')
      return
    }
    if (!password) {
      setMessage('Ingresa tu contraseña')
      setMessageType('error')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await api.login(email, password)

      if (result.success && result.token) {
        const userData = {
          id: result.usuario.id,
          nombres: result.usuario.nombres,
          apellidos: result.usuario.apellidos,
          email: result.usuario.email,
          rol: result.usuario.rol,
          rol_nombre: result.usuario.rol_nombre
        }

        login(result.token, userData)
        setMessage('Inicio de sesión exitoso. Redirigiendo...')
        setMessageType('success')
        
        const redirectPath = getRedirectPath(result.usuario.rol)
        setTimeout(() => navigate(redirectPath), 1500)
        return
      }

      setMessage(result.message || 'Error al iniciar sesión')
      setMessageType('error')
    } catch (err) {
      setMessage('Error de conexión con el servidor')
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
              <i className="fas fa-heartbeat"></i>
              <h1>FamKon Clinic</h1>
            </div>
            <p>Inicia sesión para acceder al sistema</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-envelope"></i> Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ejemplo@correo.com" required />
            </div>

            <div className="form-group">
              <label><i className="fas fa-lock"></i> Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" required />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? <><i className="fas fa-spinner fa-spin"></i> Verificando...</> : <><i className="fas fa-sign-in-alt"></i> Iniciar Sesión</>}
            </button>
          </form>

          {message && <div className={`form-message ${messageType}`}>{message}</div>}

          <div className="login-footer">
            <Link to="/"><i className="fas fa-arrow-left"></i> Volver al inicio</Link>
          </div>

          <div className="register-link">
            <p>¿No tienes una cuenta?</p>
            <Link to="/register"><i className="fas fa-user-plus"></i> Crear nueva cuenta</Link>
          </div>
        </div>
      </div>
    </div>
  )
}