import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../services/api"
import "../../assets/styles/historial.css"

interface HistorialEntry {
  id_historial: number
  id_cita: number
  fecha_atencion: string
  fecha_cita: string
  diagnostico: string
  sintomas: string
  signos_vitales: string
  servicio: string
  medico_atendio: string
  motivo_consulta: string
  notas_doctor: string
  proxima_cita: string
  orden_receta: string
  medicamentos: string
  info_ticket: string
}

interface PacienteInfo {
  id_usuario: number
  nombres: string
  apellidos: string
  dpi: string
  telefono: string
  direccion: string
  email: string
  sexo: string
  fecha_nacimiento: string
  edad: number
}

export default function HistorialClinico() {
  const { id_paciente } = useParams()
  const { isLoggedIn, userRolId } = useAuth()
  const navigate = useNavigate()

  const [paciente, setPaciente] = useState<PacienteInfo | null>(null)
  const [historial, setHistorial] = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCita, setSelectedCita] = useState<HistorialEntry | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login")
      return
    }
    if (userRolId !== 3 && userRolId !== 5 && userRolId !== 6) {
      navigate("/")
      return
    }
  }, [isLoggedIn, userRolId, navigate])

  useEffect(() => {
    if (id_paciente) {
      cargarHistorial()
    }
  }, [id_paciente])

  const cargarHistorial = async () => {
    try {
      const res = await api.getHistorialCompletoPaciente(parseInt(id_paciente!))
      if (res.success) {
        setPaciente(res.data.paciente)
        setHistorial(res.data.historial || [])
      }
    } catch (error) {
      console.error("Error cargando historial:", error)
    } finally {
      setLoading(false)
    }
  }

  const verDetalle = (entry: HistorialEntry) => {
    setSelectedCita(entry)
    setShowModal(true)
  }

  const formatearFecha = (fecha: string) => {
    if (!fecha) return "No especificada"
    return new Date(fecha).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const medicamentosList = (medicamentosJson: string) => {
    if (!medicamentosJson) return []
    try {
      return JSON.parse(medicamentosJson)
    } catch {
      return []
    }
  }

  const signosVitalesList = (signosJson: string) => {
    if (!signosJson) return null
    try {
      return JSON.parse(signosJson)
    } catch {
      return null
    }
  }

  const LABEL_SIGNOS: Record<string, string> = {
    peso: 'Peso',
    talla: 'Talla',
    presion_arterial: 'Presión Arterial',
    temperatura: 'Temperatura',
    frecuencia_cardiaca: 'Frecuencia Cardíaca',
    glucosa: 'Glucosa'
  }

  const UNIDAD_SIGNOS: Record<string, string> = {
    peso: 'kg',
    talla: 'cm',
    presion_arterial: 'mmHg',
    temperatura: '°C',
    frecuencia_cardiaca: 'lpm',
    glucosa: 'mg/dL'
  }

  if (!isLoggedIn || (userRolId !== 3 && userRolId !== 5 && userRolId !== 6)) return null

  return (
    <div className="historial-page">
      <div className="historial-container">
        <div className="historial-header">
          <Link to="/doctor" className="btn-back">
            <i className="fas fa-arrow-left"></i>
            Volver
          </Link>
          <div>
            <h1>
              <i className="fas fa-notes-medical"></i>
              Historial Clínico
            </h1>
            <p>Consulta el historial médico del paciente</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin"></i>
            Cargando historial...
          </div>
        ) : !paciente ? (
          <div className="empty-state">
            <i className="fas fa-user-slash"></i>
            <h3>Paciente no encontrado</h3>
            <p>No se pudo encontrar la información del paciente</p>
          </div>
        ) : (
          <>
            {/* Información del paciente */}
            <div className="paciente-info-card">
              <div className="paciente-header">
                <i className="fas fa-user-circle"></i>
                <h2>{paciente.nombres} {paciente.apellidos}</h2>
              </div>
              <div className="paciente-details">
                <div className="info-row">
                  <span><i className="fas fa-id-card"></i> DPI:</span>
                  <strong>{paciente.dpi || "No registrado"}</strong>
                </div>
                <div className="info-row">
                  <span><i className="fas fa-phone"></i> Teléfono:</span>
                  <strong>{paciente.telefono || "No registrado"}</strong>
                </div>
                <div className="info-row">
                  <span><i className="fas fa-envelope"></i> Email:</span>
                  <strong>{paciente.email || "No registrado"}</strong>
                </div>
                <div className="info-row">
                  <span><i className="fas fa-venus-mars"></i> Sexo:</span>
                  <strong>{paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Femenino" : "Otro"}</strong>
                </div>
                <div className="info-row">
                  <span><i className="fas fa-calendar"></i> Edad:</span>
                  <strong>{paciente.edad} años</strong>
                </div>
                <div className="info-row">
                  <span><i className="fas fa-map-marker-alt"></i> Dirección:</span>
                  <strong>{paciente.direccion || "No registrada"}</strong>
                </div>
              </div>
            </div>

            {/* Historial de consultas */}
            <h2 className="section-title">
              <i className="fas fa-history"></i>
              Historial de Consultas
            </h2>

            {historial.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-folder-open"></i>
                <h3>No hay consultas registradas</h3>
                <p>Este paciente aún no tiene historial médico</p>
              </div>
            ) : (
              <div className="historial-grid">
                {historial.map((item) => (
                  <div key={item.id_historial} className="historial-card">
                    <div className="historial-card-header">
                      <span className="servicio-badge">
                        <i className="fas fa-stethoscope"></i>
                        {item.servicio}
                      </span>
                      <span className="fecha-badge">
                        <i className="fas fa-calendar-alt"></i>
                        {formatearFecha(item.fecha_atencion)}
                      </span>
                    </div>

                    <div className="historial-card-body">
                      <p>
                        <i className="fas fa-user-md"></i>
                        <strong>Médico:</strong> {item.medico_atendio}
                      </p>
                      <p>
                        <i className="fas fa-stethoscope"></i>
                        <strong>Diagnóstico:</strong> {item.diagnostico || "No especificado"}
                      </p>
                      {item.sintomas && (
                        <p>
                          <i className="fas fa-thermometer"></i>
                          <strong>Síntomas:</strong> {item.sintomas}
                        </p>
                      )}
                      {(() => {
                        const sv = signosVitalesList(item.signos_vitales)
                        if (!sv) return null
                        const entries = Object.entries(LABEL_SIGNOS).filter(([key]) => sv[key] !== null && sv[key] !== '')
                        return (
                          <div className="signos-vitales-list">
                            <i className="fas fa-heartbeat"></i>
                            <strong>Signos Vitales:</strong>
                            <div className="signos-grid-mini">
                              {entries.map(([key, label]) => (
                                <span key={key} className="signo-item">
                                  {label}: <strong>{sv[key]}</strong> {UNIDAD_SIGNOS[key]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <div className="historial-card-footer">
                      <button 
                        className="btn-detalle"
                        onClick={() => verDetalle(item)}
                      >
                        <i className="fas fa-eye"></i>
                        Ver Detalle Completo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de detalle */}
      {showModal && selectedCita && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-file-medical"></i>
                Detalle de Consulta
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3><i className="fas fa-info-circle"></i> Información General</h3>
                <div className="detail-grid">
                  <div><strong>Fecha de Atención:</strong> {formatearFecha(selectedCita.fecha_atencion)}</div>
                  <div><strong>Servicio:</strong> {selectedCita.servicio}</div>
                  <div><strong>Médico:</strong> {selectedCita.medico_atendio}</div>
                  <div><strong>Motivo de Consulta:</strong> {selectedCita.motivo_consulta || "No especificado"}</div>
                </div>
              </div>

              <div className="detail-section">
                <h3><i className="fas fa-diagnoses"></i> Diagnóstico y Síntomas</h3>
                <div className="detail-grid">
                  <div><strong>Diagnóstico:</strong> {selectedCita.diagnostico || "No especificado"}</div>
                  <div><strong>Síntomas:</strong> {selectedCita.sintomas || "No especificados"}</div>
                  <div>
                    <strong>Signos Vitales:</strong>
                    {(() => {
                      const sv = signosVitalesList(selectedCita.signos_vitales)
                      if (!sv) return " No registrados"
                      const entries = Object.entries(LABEL_SIGNOS).filter(([key]) => sv[key] !== null && sv[key] !== '')
                      return (
                        <div className="signos-grid-mini" style={{ marginTop: '0.3rem', marginLeft: 0 }}>
                          {entries.map(([key, label]) => (
                            <span key={key} className="signo-item">
                              {label}: <strong>{sv[key]}</strong> {UNIDAD_SIGNOS[key]}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {medicamentosList(selectedCita.medicamentos).length > 0 && (
                <div className="detail-section">
                  <h3><i className="fas fa-pills"></i> Medicamentos Recetados</h3>
                  <table className="medicamentos-table">
                    <thead>
                      <tr>
                        <th>Medicamento</th>
                        <th>Indicaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicamentosList(selectedCita.medicamentos).map((med: any, idx: number) => (
                        <tr key={idx}>
                          <td><strong>{med.medicamento}</strong></td>
                          <td>{med.indicaciones || "Sin indicaciones"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedCita.notas_doctor && (
                <div className="detail-section">
                  <h3><i className="fas fa-comment-dots"></i> Notas del Doctor</h3>
                  <p className="notas-doctor">{selectedCita.notas_doctor}</p>
                </div>
              )}

              {selectedCita.proxima_cita && (
                <div className="detail-section">
                  <h3><i className="fas fa-calendar-alt"></i> Próxima Cita Sugerida</h3>
                  <p>{formatearFecha(selectedCita.proxima_cita)}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cerrar" onClick={() => setShowModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}