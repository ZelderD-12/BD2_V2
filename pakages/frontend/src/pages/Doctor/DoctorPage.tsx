import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../services/api"
import "../../assets/styles/doctor.css"

interface CitaMedico {
  id_cita: number
  servicio: string
  paciente: string
  fecha_inicio: string
  estado: string
  motivo_consulta: string
}

export default function DoctorPage() {
  const { isLoggedIn, userRolId, user } = useAuth()
  const navigate = useNavigate()

  const [citas, setCitas] = useState<CitaMedico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login")
      return
    }
    if (userRolId !== 3) {
      navigate("/")
      return
    }
  }, [isLoggedIn, userRolId, navigate])

  useEffect(() => {
    if (!isLoggedIn || userRolId !== 3) return
    cargarCitas()
  }, [isLoggedIn, userRolId])

  const cargarCitas = async () => {
    try {
      const idMedico = user?.id || parseInt(localStorage.getItem("user_id") || "0")
      if (!idMedico) return

      const res = await api.getCitasMedico(idMedico)
      if (res.success) {
        setCitas(res.data || [])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadgeClass = (estado: string) => {
    const map: Record<string, string> = {
      Pendiente: "estado-PENDIENTE",
      Confirmada: "estado-CONFIRMADA",
      Cancelada: "estado-CANCELADA",
      Completada: "estado-ATENDIDA",
    }
    return map[estado] || "estado-PENDIENTE"
  }

  const getEstadoIcon = (estado: string) => {
    const map: Record<string, string> = {
      Pendiente: "fa-clock",
      Confirmada: "fa-check-circle",
      Cancelada: "fa-times-circle",
      Completada: "fa-check-double",
    }
    return map[estado] || "fa-question-circle"
  }

  if (!isLoggedIn || userRolId !== 3) return null

  return (
    <div className="doctor-page">
      <div className="doctor-container">
        <div className="doctor-header">
          <Link to="/" className="btn-back">
            <i className="fas fa-arrow-left"></i>
            Volver
          </Link>
          <div>
            <h1>
              <i className="fas fa-user-md"></i>
              Mis Consultas
            </h1>
            <p>Consulta de citas asignadas</p>
          </div>
        </div>

        <div className="doctor-citas-grid">
          {loading ? (
            <div className="loading-spinner">
              <i className="fas fa-spinner fa-spin"></i>
              Cargando citas...
            </div>
          ) : citas.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-calendar-alt"></i>
              <h3>No hay citas asignadas</h3>
              <p>No tienes citas programadas actualmente</p>
            </div>
          ) : (
            citas.map((cita) => (
              <div key={cita.id_cita} className="doctor-cita-card">
                <div className="doctor-cita-header">
                  <span className="doctor-cita-servicio">
                    <i className="fas fa-stethoscope"></i>
                    {cita.servicio}
                  </span>
                  <span className={`estado-badge ${getEstadoBadgeClass(cita.estado)}`}>
                    <i className={`fas ${getEstadoIcon(cita.estado)}`}></i>
                    {cita.estado}
                  </span>
                </div>

                <div className="doctor-cita-body">
                  <p>
                    <i className="fas fa-user"></i>
                    <strong>Paciente:</strong> {cita.paciente}
                  </p>
                  <p>
                    <i className="fas fa-calendar-day"></i>
                    <strong>Fecha:</strong>{" "}
                    {new Date(cita.fecha_inicio).toLocaleDateString()}
                  </p>
                  <p>
                    <i className="fas fa-clock"></i>
                    <strong>Hora:</strong>{" "}
                    {new Date(cita.fecha_inicio).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {cita.motivo_consulta && (
                    <p className="doctor-cita-motivo">
                      <i className="fas fa-comment"></i>
                      <strong>Motivo:</strong> {cita.motivo_consulta}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
