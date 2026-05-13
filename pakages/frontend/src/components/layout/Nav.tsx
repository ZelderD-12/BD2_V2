import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Nav() {
  const { isLoggedIn, tienePermiso, userRolId } = useAuth()
  const location = useLocation()

  // Recepción (5,6) no ve Mis Citas
  const esRecepcion = userRolId === 5 || userRolId === 6

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
          
          {/* Mis Citas - NO aparece para Recepción */}
          {isLoggedIn && !esRecepcion && (
            <li>
              <Link to="/citas" className={`nav-simple-link ${location.pathname === '/citas' ? 'active' : ''}`}>
                Mis Citas
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