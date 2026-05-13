import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Nav() {
  const { isLoggedIn, tienePermiso, userRolId } = useAuth()
  const location = useLocation()

  // Citas: visible sin login (redirige a login) y para paciente (rol 2) al iniciar sesión
  const mostrarCitas = !isLoggedIn || userRolId === 2

  return (
    <nav className="navbar-simple">
      <div className="nav-simple-container">
        <ul className="nav-simple-menu">
          <li>
            <Link to="/" className={`nav-simple-link ${location.pathname === '/' ? 'active' : ''}`}>
              Inicio
            </Link>
          </li>
          <li>
            <Link to="/servicios" className={`nav-simple-link ${location.pathname === '/servicios' ? 'active' : ''}`}>
              Servicios
            </Link>
          </li>
          <li><a href="#contacto" className="nav-simple-link">Contacto</a></li>
          
          {/* Citas: público o paciente (rol 2) */}
          {mostrarCitas && (
            <li>
              <Link
                to={isLoggedIn ? '/citas' : '/login'}
                className={`nav-simple-link ${location.pathname === '/citas' ? 'active' : ''}`}
              >
                Citas
              </Link>
            </li>
          )}
          
          {/* Panel Recepción - SOLO para roles 5 y 6 */}
          {tienePermiso('VER_RECEPCION') && (
            <li>
              <Link to="/recepcion" className={`nav-simple-link ${location.pathname === '/recepcion' ? 'active' : ''}`}>
                Panel Recepción
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  )
}