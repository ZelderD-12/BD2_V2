import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import '../../assets/styles/servicios.css'

interface Servicio {
  id_servicio: number
  servicio: string
  duracion_slot_min?: number
  capacidad_slot?: number
}

const iconosServicios: Record<string, string> = {
  'Consulta General': 'fa-stethoscope',
  'Odontología': 'fa-tooth',
  'Cardiología': 'fa-heartbeat',
  'Neurología': 'fa-brain',
  'Pediatría': 'fa-baby-carriage',
  'Laboratorio Clínico': 'fa-flask',
  'Radiología': 'fa-x-ray',
  'Medicina a Domicilio': 'fa-truck',
  'default': 'fa-hospital'
}

const coloresServicios = [
  'linear-gradient(135deg, #00C49A, #6EE7B7)',
  'linear-gradient(135deg, #0077B6, #00B4D8)',
  'linear-gradient(135deg, #FF6B6B, #FF8E8E)',
  'linear-gradient(135deg, #FFD93D, #FFE66D)',
  'linear-gradient(135deg, #6C5CE7, #A29BFE)',
  'linear-gradient(135deg, #FD7E14, #FFA94D)',
  'linear-gradient(135deg, #20C997, #38D9A9)',
  'linear-gradient(135deg, #E91E63, #F06292)',
]

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [hoverId, setHoverId] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    api.getServicios()
      .then(res => {
        if (res.success && res.data?.length > 0) setServicios(res.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const getIcono = (servicio: string) => iconosServicios[servicio] || iconosServicios['default']

  if (loading) return <LoadingSpinner texto="Cargando servicios..." />

  return (
    <div className="servicios-page">
      <div className="container">
        <div className="servicios-header">
          <h1 className="servicios-title">
            <i className="fas fa-star"></i>Nuestros Servicios
          </h1>
          <p className="servicios-subtitle">Atención médica de calidad con los mejores especialistas</p>
        </div>

        <div className="servicios-grid">
          {servicios.map((servicio, index) => {
            const isSelected = seleccionado === servicio.id_servicio
            const color = coloresServicios[index % coloresServicios.length]

            return (
              <div
                key={servicio.id_servicio}
                className={`servicio-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSeleccionado(isSelected ? null : servicio.id_servicio)}
                onMouseEnter={() => setHoverId(servicio.id_servicio)}
                onMouseLeave={() => setHoverId(null)}
                style={{ borderColor: isSelected ? '#00C49A' : 'transparent' }}
              >
                {isSelected && <div className="servicio-card-glow" style={{ background: color }} />}

                <div className="servicio-icon" style={{ background: color }}>
                  <i className={`fas ${getIcono(servicio.servicio)}`}></i>
                </div>

                <h3 className="servicio-name">{servicio.servicio}</h3>
                <p className="servicio-desc">Atención especializada para tu bienestar y salud integral</p>

                <div className="servicio-details">
                  <div className="servicio-details-inner">
                    {servicio.duracion_slot_min && (
                      <div className="servicio-detail-item">
                        <i className="fas fa-clock" style={{ color: '#00C49A' }}></i>
                        <p>{servicio.duracion_slot_min} min</p>
                      </div>
                    )}
                    {servicio.capacidad_slot && (
                      <div className="servicio-detail-item">
                        <i className="fas fa-users" style={{ color: '#0077B6' }}></i>
                        <p>{servicio.capacidad_slot} pers.</p>
                      </div>
                    )}
                    <div className="servicio-detail-item">
                      <i className="fas fa-check-circle" style={{ color: '#28a745' }}></i>
                      <p>Disponible</p>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="servicio-check" style={{ background: color }}>
                    <i className="fas fa-check"></i>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="servicios-back">
          <Link to="/"><i className="fas fa-arrow-left"></i> Volver al inicio</Link>
        </div>
      </div>
    </div>
  )
}