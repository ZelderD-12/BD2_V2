import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../assets/styles/FamKon_Clinic.css'  // ← Importa el CSS

export default function HomePage() {
  const { isLoggedIn, userRol } = useAuth()

  return (
    <>
      {/* Hero Section */}
      <section id="inicio" className="hero">
        <div className="hero-content">
          <h1>Bienvenido a <span className="highlight">FamKon Clinic</span></h1>
          <p>Tu salud es nuestra prioridad.</p>
          <div className="hero-buttons">
            <Link to={isLoggedIn ? "/citas" : "/login"} className="btn btn-primary">
              Agendar Cita
            </Link>
            <a href="#servicios" className="btn btn-secondary">Ver Servicios</a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat"><h3>+5000</h3><p>Pacientes</p></div>
          <div className="stat"><h3>+15</h3><p>Médicos</p></div>
          <div className="stat"><h3>+8</h3><p>Años</p></div>
        </div>
      </section>
    </>
  )
}