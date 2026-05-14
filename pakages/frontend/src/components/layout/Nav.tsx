import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Nav() {
  const { isLoggedIn, tienePermiso, userRolId } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Citas: visible sin login (redirige a login) y para paciente (rol 2) al iniciar sesión
  const mostrarCitas = !isLoggedIn || userRolId === 2

  // Consulta activa del doctor (persiste aunque navegue a otras rutas)
  const [atencionActiva, setAtencionActiva] = useState(sessionStorage.getItem('atencion_activa'))

  const cancelarConsulta = () => {
    sessionStorage.removeItem('atencion_activa')
    setAtencionActiva(null)
    if (location.pathname.startsWith('/atencion/')) {
      navigate('/doctor')
    }
  }

  return (
    <nav className="navbar-simple">
      <div className="nav-simple-container nav-flex">
        <ul className="nav-simple-menu nav-left">
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
          
          {/* Panel Doctor - SOLO para rol 3 */}
          {isLoggedIn && userRolId === 3 && (
            <li>
              <Link to="/doctor" className={`nav-simple-link ${location.pathname === '/doctor' ? 'active' : ''}`}>
                Mis Consultas
              </Link>
            </li>
          )}

          {/* Consulta Actual + botón cancelar */}
          {isLoggedIn && userRolId === 3 && atencionActiva && (
            <li className="nav-consulta-activa">
              <Link to={`/atencion/${atencionActiva}`} className={`nav-simple-link ${location.pathname.startsWith('/atencion/') ? 'active' : ''}`}>
                <i className="fas fa-stethoscope"></i>
                Consulta Actual
              </Link>
              <button className="nav-cancelar-consulta" onClick={cancelarConsulta} title="Cancelar consulta actual">
                <i className="fas fa-times"></i>
              </button>
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

        <ul className="nav-simple-menu nav-right">
          <li>
            <Link to="/contacto" className={`nav-simple-link nav-link-contacto ${location.pathname === '/contacto' ? 'active' : ''}`}>
              <i className="fas fa-address-card"></i>
              Contacto de los desarrolladores
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}