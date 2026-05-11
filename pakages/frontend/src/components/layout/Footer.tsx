export default function Footer() {
    return (
      <footer className="footer-simple">
        <div className="footer-simple-container">
          <div className="footer-simple-content">
            <div>
              <h3><i className="fas fa-heartbeat"></i> FamKon Clinic</h3>
              <p>Zona 19, Ciudad de Guatemala</p>
            </div>
            <div>
              <h4>Enlaces</h4>
              <ul>
                <li><a href="#inicio">Inicio</a></li>
                <li><a href="#servicios">Servicios</a></li>
                <li><a href="#contacto">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4>Síguenos</h4>
              <div className="social-simple">
                <a href="#"><i className="fab fa-facebook"></i></a>
                <a href="#"><i className="fab fa-instagram"></i></a>
                <a href="#"><i className="fab fa-whatsapp"></i></a>
              </div>
            </div>
          </div>
          <div className="footer-simple-bottom">
            <p>&copy; 2026 FamKon Clinic - Zona 19, Guatemala</p>
          </div>
        </div>
      </footer>
    )
  }