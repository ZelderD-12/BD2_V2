import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../assets/styles/FamKon_Clinic.css'

export default function HomePage() {
  const { isLoggedIn, tienePermiso } = useAuth()

  return (
    <>
      <section id="inicio" className="hero">
        <div className="hero-content">
          <h1>Bienvenido a <span className="highlight">FamKon Clinic</span></h1>
          <p>Tu salud es nuestra prioridad.</p>
          <div className="hero-buttons">
            <Link to={isLoggedIn ? "/citas" : "/login"} className="btn btn-primary">Agendar Cita</Link>
            <Link to="/servicios" className="btn btn-secondary">Ver Servicios</Link>
            {tienePermiso('VER_RECEPCION') && (
              <Link to="/recepcion" className="btn btn-secondary">Recepción</Link>
            )}
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat"><h3>+1000</h3><p>Pacientes</p></div>
          <div className="stat"><h3>+15</h3><p>Médicos</p></div>
          <div className="stat"><h3>+8</h3><p>Años</p></div>
        </div>
      </section>
    </>
  )
}