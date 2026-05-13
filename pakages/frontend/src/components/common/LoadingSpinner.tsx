import '../../assets/styles/loading.css'

export default function LoadingSpinner({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner-icon">
          <i className="fas fa-heartbeat"></i>
        </div>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p className="loading-text">{texto}</p>
      </div>
    </div>
  )
}