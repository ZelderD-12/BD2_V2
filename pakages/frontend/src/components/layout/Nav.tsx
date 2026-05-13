import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Nav() {
  const { isLoggedIn, tienePermiso } = useAuth()
  const location = useLocation()

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
          <li>
            <Link to={isLoggedIn ? "/citas" : "/login"} className="nav-simple-link">
              Mis Citas
            </Link>
          </li>
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