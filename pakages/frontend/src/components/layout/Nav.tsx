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
          <li><a href="#servicios" className="nav-simple-link">Servicios</a></li>
          <li><a href="#contacto" className="nav-simple-link">Contacto</a></li>
          <li>
            <Link to={isLoggedIn ? "/citas" : "/login"} className="nav-simple-link" id="navCitasSimple">
              Mis Citas
            </Link>
          </li>
          {isLoggedIn && (
            <li id="navPagarSimple" style={{ display: 'list-item' }}>
              <Link to="/pagar" className="nav-simple-link">Pagar</Link>
            </li>
          )}
          {tienePermiso('VER_RECEPCION') && (
            <li id="navRecepcionSimple" style={{ display: 'list-item' }}>
              <Link to="/recepcion" className="nav-simple-link">Panel Recepción</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  )
}