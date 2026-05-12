import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import '../../assets/styles/FamKon_Clinic.css'

export default function HomePage() {
  const { isLoggedIn, tienePermiso } = useAuth()
  const [servicios, setServicios] = useState<any[]>([])

  useEffect(() => {
    api.getServicios()
      .then(res => {
        if (res.success) setServicios(res.data || [])
      })
      .catch(() => {
        setServicios([
          { id_servicio: 1, servicio: 'Consulta General' },
          { id_servicio: 2, servicio: 'Odontología' },
          { id_servicio: 3, servicio: 'Cardiología' },
          { id_servicio: 4, servicio: 'Neurología' }
        ])
      })
  }, [])

  return (
    <>
      <section id="inicio" className="hero">
        <div className="hero-content">
          <h1>Bienvenido a <span className="highlight">FamKon Clinic</span></h1>
          <p>Tu salud es nuestra prioridad.</p>
          <div className="hero-buttons">
            <Link to={isLoggedIn ? "/citas" : "/login"} className="btn btn-primary">Agendar Cita</Link>
            <a href="#servicios" className="btn btn-secondary">Ver Servicios</a>
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

      <section id="servicios" className="servicios">
        <div className="container">
          <h2>Nuestros Servicios</h2>
          <div className="servicios-grid">
            {servicios.map(s => (
              <div key={s.id_servicio} className="servicio-card">
                <i className="fas fa-stethoscope"></i>
                <h3>{s.servicio}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}