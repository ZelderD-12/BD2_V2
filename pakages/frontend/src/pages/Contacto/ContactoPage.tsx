import { Link } from 'react-router-dom'
import '../../assets/styles/contacto.css'

export default function ContactoPage() {
  return (
    <div className="contacto-page">
      <div className="contacto-container">
        <div className="contacto-header">
          <Link to="/" className="btn-back">
            <i className="fas fa-arrow-left"></i> Volver
          </Link>
          <h1><i className="fas fa-address-card"></i> Contacto</h1>
          <p>Información del desarrollador</p>
        </div>

        <div className="contacto-card">
          <div className="contacto-foto jefe-badge">
            <img
              src="/images/Gustavo Adolfo Tobías RAmírez.jpg"
              alt="Gustavo Adolfo Tobías Ramírez"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const parent = (e.target as HTMLImageElement).parentElement
                if (parent) {
                  const icon = document.createElement('i')
                  icon.className = 'fas fa-user-circle'
                  icon.style.cssText = 'font-size: 8rem; color: #0077B6;'
                  parent.appendChild(icon)
                }
              }}
            />
          </div>

          <h2 className="contacto-nombre">Gustavo Adolfo Tobías Ramírez</h2>
          <p className="contacto-rol">Project Manager & Full Stack Developer</p>

          <div className="contacto-divisor">
            <span><i className="fas fa-graduation-cap"></i></span>
          </div>

          <div className="contacto-detalles">
            <div className="contacto-item">
              <i className="fas fa-id-card"></i>
              <div>
                <span className="contacto-label">Carnet</span>
                <span className="contacto-valor">3590-23-12434</span>
              </div>
            </div>
            <div className="contacto-item">
              <i className="fas fa-phone-alt"></i>
              <div>
                <span className="contacto-label">Teléfono</span>
                <span className="contacto-valor">5115-1685</span>
              </div>
            </div>
            <div className="contacto-item">
              <i className="fas fa-envelope"></i>
              <div>
                <span className="contacto-label">Email</span>
                <span className="contacto-valor">gtobias@email.com</span>
              </div>
            </div>
          </div>

          <div className="contacto-divisor">
            <span><i className="fas fa-laptop-code"></i></span>
          </div>

          <p className="contacto-descripcion">
            Encargado de la gestión del proyecto y desarrollo full stack de la plataforma
            FamKon Clinic. Responsable de la arquitectura, implementación y coordinación
            del equipo de desarrollo.
          </p>
        </div>
      </div>
    </div>
  )
}
