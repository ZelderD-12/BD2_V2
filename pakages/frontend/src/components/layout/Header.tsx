import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const { isLoggedIn, userNombre, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="header-simple">
      <div className="header-simple-container">
        <div className="header-logo">
          <i className="fas fa-heartbeat"></i>
          <span>FamKon Clinic</span>
        </div>
        <div className="header-user-area">
          {!isLoggedIn ? (
            <Link to="/login" className="btn-login-header">
              <i className="fas fa-sign-in-alt"></i> Iniciar Sesión
            </Link>
          ) : (
            <div id="userInfoHeader" style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <span id="userNameHeader" style={{ color: 'var(--celeste-oscuro)', fontWeight: 500 }}>
                👤 {userNombre}
              </span>
              <button onClick={handleLogout} className="btn-logout-header">
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}