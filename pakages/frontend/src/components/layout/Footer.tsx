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
                <li><a href="/">Inicio</a></li>
                <li><a href="/servicios">Servicios</a></li>
                <li><a href="/contacto">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4>Desarrollado por</h4>
              <div className="footer-umg">
                <div className="umg-logo-wrapper">
                  <img
                    src="/images/Escudo_de_la_universidad_Mariano_Gálvez_Guatemala.svg.png"
                    alt="Universidad Mariano Gálvez"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
                <div className="umg-texto">
                  <p className="umg-title">Universidad Mariano Gálvez</p>
                  <p className="umg-project">Base de Datos II - Proyecto Final</p>
                </div>
              </div>
            </div>
          </div>
          <div className="footer-simple-bottom">
            <p>&copy; 2026 FamKon Clinic - Todos los derechos reservados</p>
            <p className="footer-dev">Desarrollado por: Gustavo Adolfo Tobías Ramírez - 3590-23-12434</p>
          </div>
        </div>
      </footer>
    )
  }