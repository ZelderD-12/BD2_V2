import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../services/api"
import "../../assets/styles/doctor.css"

interface CitaMedico {
  id_cita: number
  servicio: string
  paciente: string
  id_paciente: number
  telefono_paciente: string
  fecha_inicio: string
  fecha_fin: string
  estado_cita: string
  motivo_consulta: string
  id_ticket: number
  codigo_ticket: string
  estado_ticket: string
  minutos_en_atencion?: number
}

export default function DoctorPage() {
  const { isLoggedIn, userRolId, user } = useAuth()
  const navigate = useNavigate()

  const [citas, setCitas] = useState<CitaMedico[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
    cargarCitasEnAtencion()
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(() => {
      cargarCitasEnAtencion(true)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [isLoggedIn, userRolId])

  const cargarCitasEnAtencion = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    
    try {
      const idUsuarioM = user?.id || parseInt(localStorage.getItem("user_id") || "0")
      console.log("ID Usuario Médico:", idUsuarioM)

      const res = await api.getCitasMedicoEnAtencion(idUsuarioM)
      console.log("Respuesta:", res)

      if (res.success) {
        setCitas(res.data || [])
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  const verHistorialClinico = (idPaciente: number) => {
    navigate(`/historial/${idPaciente}`)
  }

  const finalizarAtencion = (cita: CitaMedico) => {
    sessionStorage.setItem('atencion_activa', cita.id_cita.toString())
    navigate(`/atencion/${cita.id_cita}`)
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
              Pacientes en Atención
            </h1>
            <p>Pacientes que están siendo atendidos actualmente</p>
          </div>
          <button 
            className="btn-refresh" 
            onClick={() => cargarCitasEnAtencion()}
            disabled={refreshing}
          >
            <i className={`fas fa-sync-alt ${refreshing ? 'fa-spin' : ''}`}></i>
            Actualizar
          </button>
        </div>

        <div className="doctor-citas-grid">
          {loading ? (
            <div className="loading-spinner">
              <i className="fas fa-spinner fa-spin"></i>
              Cargando pacientes en atención...
            </div>
          ) : citas.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-user-clock"></i>
              <h3>No hay pacientes en atención</h3>
              <p>Espera a que te asignen un paciente</p>
            </div>
          ) : (
            citas.map((cita) => (
              <div key={cita.id_cita} className="doctor-cita-card">
                <div className="doctor-cita-header">
                  <span className="doctor-cita-servicio">
                    <i className="fas fa-stethoscope"></i>
                    {cita.servicio}
                  </span>
                  <span className="estado-badge estado-ATENCION">
                    <i className="fas fa-user-check"></i>
                    {cita.estado_ticket || "En Atención"}
                  </span>
                  {cita.minutos_en_atencion !== undefined && (
                    <span className="tiempo-atencion">
                      <i className="fas fa-hourglass-half"></i>
                      {cita.minutos_en_atencion} min
                    </span>
                  )}
                </div>

                <div className="doctor-cita-body">
                  <p>
                    <i className="fas fa-user"></i>
                    <strong>Paciente:</strong> {cita.paciente}
                  </p>
                  <p>
                    <i className="fas fa-phone"></i>
                    <strong>Teléfono:</strong> {cita.telefono_paciente || "No registrado"}
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
                  {cita.codigo_ticket && (
                    <p className="doctor-cita-ticket">
                      <i className="fas fa-ticket-alt"></i>
                      <strong>Ticket:</strong> {cita.codigo_ticket}
                    </p>
                  )}
                </div>

                <div className="doctor-cita-footer">
                  <button 
                    className="btn-historial"
                    onClick={() => verHistorialClinico(cita.id_paciente)}
                  >
                    <i className="fas fa-notes-medical"></i>
                    Ver Historial Clínico
                  </button>
                  <button 
                    className="btn-finalizar"
                    onClick={() => finalizarAtencion(cita)}
                  >
                    <i className="fas fa-check-circle"></i>
                    Finalizar Atención
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}