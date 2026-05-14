import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../services/api"
import "../../assets/styles/atencion.css"

interface CitaInfo {
  id_cita: number
  id_paciente: number
  paciente: string
  telefono_paciente: string
  servicio: string
  fecha_inicio: string
  motivo_consulta: string
  codigo_ticket: string
  id_ticket: number
  antecedentes_medicos?: string
}

interface Medicamento {
  id_medicamento: number
  nombre: string
}

interface MedicamentoSeleccionado {
  id_medicamento: number
  nombre: string
  dosis: string
  frecuencia: string
  duracion: string
}

export default function AtencionMedica() {
  const { id_cita } = useParams()
  const { user, isLoggedIn, userRolId } = useAuth()
  const navigate = useNavigate()

  const [cita, setCita] = useState<CitaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [medicamentosList, setMedicamentosList] = useState<Medicamento[]>([])
  const [ordenReceta, setOrdenReceta] = useState<string | null>(null)
  const [showAntecedentes, setShowAntecedentes] = useState(false)
  
  // Formulario de atención
  const [formData, setFormData] = useState({
    diagnostico: "",
    sintomas: "",
    peso: "",
    talla: "",
    presion_arterial: "",
    temperatura: "",
    frecuencia_cardiaca: "",
    glucosa: "",
    notas_doctor: "",
    proxima_cita: ""
  })

  // Medicamentos seleccionados
  const [medicamentos, setMedicamentos] = useState<MedicamentoSeleccionado[]>([])
  const [selectedMedicamento, setSelectedMedicamento] = useState("")
  const [dosis, setDosis] = useState("")
  const [frecuencia, setFrecuencia] = useState("")
  const [duracion, setDuracion] = useState("")

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
    if (id_cita) {
      cargarCita()
      cargarMedicamentos()
    }
  }, [id_cita])

  const cargarCita = async () => {
    try {
      const idUsuarioM = user?.id || parseInt(localStorage.getItem("user_id") || "0")
      const res = await api.getCitasMedicoEnAtencion(idUsuarioM)
      
      console.log("Citas en atención:", res)
      
      if (res.success && res.data) {
        const citaEncontrada = res.data.find((c: any) => c.id_cita === parseInt(id_cita!))
        console.log("Cita encontrada:", citaEncontrada)
        
        if (citaEncontrada) {
          setCita(citaEncontrada)
        }
      }
    } catch (error) {
      console.error("Error cargar cita:", error)
    } finally {
      setLoading(false)
    }
  }

  const cargarMedicamentos = async () => {
    try {
      const res = await api.getMedicamentos()
      if (res.success) {
        setMedicamentosList(res.data)
      }
    } catch (error) {
      console.error("Error cargar medicamentos:", error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const agregarMedicamento = () => {
    if (!selectedMedicamento) {
      alert("Seleccione un medicamento")
      return
    }

    const medicamento = medicamentosList.find(m => m.id_medicamento.toString() === selectedMedicamento)
    if (!medicamento) return

    setMedicamentos([
      ...medicamentos,
      {
        id_medicamento: medicamento.id_medicamento,
        nombre: medicamento.nombre,
        dosis: dosis || "No especificada",
        frecuencia: frecuencia || "No especificada",
        duracion: duracion || "No especificada"
      }
    ])

    setSelectedMedicamento("")
    setDosis("")
    setFrecuencia("")
    setDuracion("")
  }

  const eliminarMedicamento = (index: number) => {
    setMedicamentos(medicamentos.filter((_, i) => i !== index))
  }

  const formatearAntecedentes = (antecedentes: string | undefined) => {
    if (!antecedentes) return "No registrados"
    try {
      const parsed = JSON.parse(antecedentes)
      if (Array.isArray(parsed)) {
        return parsed.join(", ")
      }
      return antecedentes
    } catch {
      return antecedentes
    }
  }

  const finalizarAtencion = async () => {
    if (!formData.diagnostico.trim()) {
      alert("Por favor ingrese un diagnóstico")
      return
    }

    setSaving(true)

    const signosVitales = JSON.stringify({
      peso: formData.peso || null,
      talla: formData.talla || null,
      presion_arterial: formData.presion_arterial || null,
      temperatura: formData.temperatura || null,
      frecuencia_cardiaca: formData.frecuencia_cardiaca || null,
      glucosa: formData.glucosa || null
    })

    try {
      let orden_receta_final = null

      if (medicamentos.length > 0) {
        const medicamentosJson = medicamentos.map(med => ({
          id_medicamento: med.id_medicamento,
          nombre: med.nombre,
          dosis: med.dosis,
          frecuencia: med.frecuencia,
          duracion: med.duracion
        }))

        console.log("Medicamentos JSON:", JSON.stringify(medicamentosJson))

        const resReceta = await api.crearRecetaConMedicamentos(
          parseInt(id_cita!),
          JSON.stringify(medicamentosJson)
        )

        if (resReceta.success) {
          orden_receta_final = resReceta.data.orden_receta
          setOrdenReceta(orden_receta_final)
        } else {
          throw new Error("Error al crear la receta: " + (resReceta.error || "Desconocido"))
        }
      }

      const finalizarData = {
        id_cita: parseInt(id_cita!),
        id_medico: user?.id,
        diagnostico: formData.diagnostico,
        sintomas: formData.sintomas || null,
        signos_vitales: signosVitales,
        notas_doctor: formData.notas_doctor || null,
        proxima_cita: formData.proxima_cita || null,
        orden_receta: orden_receta_final
      }
      
      const res = await api.finalizarAtencion(finalizarData)

      if (res.success) {
        alert(`Atención finalizada correctamente\nNúmero de receta: ${orden_receta_final || "Sin receta"}`)
        navigate("/doctor")
      } else {
        alert("Error al finalizar: " + (res.error || "Desconocido"))
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Error al finalizar la atención: " + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="atencion-page">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          Cargando información...
        </div>
      </div>
    )
  }

  if (!cita) {
    return (
      <div className="atencion-page">
        <div className="empty-state">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Cita no encontrada</h3>
          <p>No se encontró la cita con ID: {id_cita}</p>
          <Link to="/doctor" className="btn-back">Volver al panel</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="atencion-page">
      <div className="atencion-container">
        <div className="atencion-header">
          <Link to="/doctor" className="btn-back">
            <i className="fas fa-arrow-left"></i>
            Volver
          </Link>
          <div>
            <h1>
              <i className="fas fa-stethoscope"></i>
              Atención Médica
            </h1>
            <p>Registrar consulta y receta médica</p>
          </div>
          <div className="ticket-info">
            <i className="fas fa-ticket-alt"></i>
            Ticket: {cita.codigo_ticket}
          </div>
        </div>

        {/* Información del paciente */}
        <div className="paciente-info">
          <div className="info-card">
            <h3><i className="fas fa-user"></i> Paciente</h3>
            <p><strong>{cita.paciente}</strong></p>
            <p><i className="fas fa-phone"></i> {cita.telefono_paciente || "No registrado"}</p>
            <p><i className="fas fa-calendar"></i> Fecha: {new Date(cita.fecha_inicio).toLocaleString()}</p>
            <p><i className="fas fa-comment"></i> Motivo: {cita.motivo_consulta || "No especificado"}</p>
          </div>
          <div className="info-card">
            <h3><i className="fas fa-stethoscope"></i> Servicio</h3>
            <p><strong>{cita.servicio}</strong></p>
          </div>
        </div>

        {/* ✅ ANTECEDENTES MÉDICOS */}
        <div className="antecedentes-card">
          <div className="antecedentes-header" onClick={() => setShowAntecedentes(!showAntecedentes)}>
            <h3>
              <i className="fas fa-notes-medical"></i>
              Antecedentes Médicos del Paciente
            </h3>
            <i className={`fas fa-chevron-${showAntecedentes ? 'up' : 'down'}`}></i>
          </div>
          {showAntecedentes && (
            <div className="antecedentes-content">
              <p>{formatearAntecedentes(cita.antecedentes_medicos)}</p>
            </div>
          )}
        </div>

        <div className="atencion-grid">
          {/* Columna izquierda - Datos clínicos */}
          <div className="clinical-data">
            <h2><i className="fas fa-heartbeat"></i> Signos Vitales</h2>
            <div className="signos-grid">
              <div className="input-group">
                <label>Peso (kg)</label>
                <input
                  type="number"
                  name="peso"
                  value={formData.peso}
                  onChange={handleInputChange}
                  step="0.1"
                  placeholder="Ej: 70.5"
                />
              </div>
              <div className="input-group">
                <label>Talla (cm)</label>
                <input
                  type="number"
                  name="talla"
                  value={formData.talla}
                  onChange={handleInputChange}
                  step="0.1"
                  placeholder="Ej: 165"
                />
              </div>
              <div className="input-group">
                <label>Presión Arterial</label>
                <input
                  type="text"
                  name="presion_arterial"
                  value={formData.presion_arterial}
                  onChange={handleInputChange}
                  placeholder="Ej: 120/80"
                />
              </div>
              <div className="input-group">
                <label>Temperatura (°C)</label>
                <input
                  type="number"
                  name="temperatura"
                  value={formData.temperatura}
                  onChange={handleInputChange}
                  step="0.1"
                  placeholder="Ej: 36.5"
                />
              </div>
              <div className="input-group">
                <label>Frecuencia Cardíaca (lpm)</label>
                <input
                  type="number"
                  name="frecuencia_cardiaca"
                  value={formData.frecuencia_cardiaca}
                  onChange={handleInputChange}
                  placeholder="Ej: 75"
                />
              </div>
              <div className="input-group">
                <label>Glucosa (mg/dL)</label>
                <input
                  type="number"
                  name="glucosa"
                  value={formData.glucosa}
                  onChange={handleInputChange}
                  placeholder="Ej: 95"
                />
              </div>
            </div>

            <h2><i className="fas fa-diagnoses"></i> Diagnóstico y Síntomas</h2>
            <div className="diagnostico-section">
              <div className="input-group full-width">
                <label>Diagnóstico *</label>
                <textarea
                  name="diagnostico"
                  value={formData.diagnostico}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Ingrese el diagnóstico principal..."
                  required
                ></textarea>
              </div>
              <div className="input-group full-width">
                <label>Síntomas</label>
                <textarea
                  name="sintomas"
                  value={formData.sintomas}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Describa los síntomas del paciente..."
                ></textarea>
              </div>
            </div>

            <h2><i className="fas fa-comment-dots"></i> Notas y Seguimiento</h2>
            <div className="seguimiento-section">
              <div className="input-group full-width">
                <label>Notas del Doctor</label>
                <textarea
                  name="notas_doctor"
                  value={formData.notas_doctor}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Notas adicionales, observaciones, recomendaciones..."
                ></textarea>
              </div>
              <div className="input-group">
                <label>Próxima Cita Sugerida</label>
                <input
                  type="datetime-local"
                  name="proxima_cita"
                  value={formData.proxima_cita}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Columna derecha - Receta médica */}
          <div className="receta-data">
            <h2><i className="fas fa-pills"></i> Receta Médica</h2>
            
            {ordenReceta && (
              <div className="orden-receta">
                <i className="fas fa-hashtag"></i>
                Orden de Receta: <strong>{ordenReceta}</strong>
              </div>
            )}

            <div className="agregar-medicamento">
              <div className="input-group">
                <label>Medicamento</label>
                <select
                  value={selectedMedicamento}
                  onChange={(e) => setSelectedMedicamento(e.target.value)}
                >
                  <option value="">Seleccionar medicamento...</option>
                  {medicamentosList.map(med => (
                    <option key={med.id_medicamento} value={med.id_medicamento}>
                      {med.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="signos-grid" style={{ marginBottom: "0.5rem" }}>
                <div className="input-group">
                  <label>Dosis</label>
                  <input
                    type="text"
                    value={dosis}
                    onChange={(e) => setDosis(e.target.value)}
                    placeholder="Ej: 500mg"
                  />
                </div>
                <div className="input-group">
                  <label>Frecuencia</label>
                  <input
                    type="text"
                    value={frecuencia}
                    onChange={(e) => setFrecuencia(e.target.value)}
                    placeholder="Ej: Cada 8 horas"
                  />
                </div>
                <div className="input-group">
                  <label>Duración</label>
                  <input
                    type="text"
                    value={duracion}
                    onChange={(e) => setDuracion(e.target.value)}
                    placeholder="Ej: 7 días"
                  />
                </div>
              </div>
              <button className="btn-agregar" onClick={agregarMedicamento} type="button">
                <i className="fas fa-plus"></i> Agregar Medicamento
              </button>
            </div>

            {medicamentos.length > 0 && (
              <div className="medicamentos-list">
                <h3>Medicamentos Recetados</h3>
                {medicamentos.map((med, index) => (
                  <div key={index} className="medicamento-item">
                    <div className="med-info">
                      <strong>{med.nombre}</strong>
                      <p><strong>Dosis:</strong> {med.dosis}</p>
                      <p><strong>Frecuencia:</strong> {med.frecuencia}</p>
                      <p><strong>Duración:</strong> {med.duracion}</p>
                    </div>
                    <button 
                      className="btn-eliminar"
                      onClick={() => eliminarMedicamento(index)}
                      type="button"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="atencion-footer">
          <button 
            className="btn-finalizar"
            onClick={finalizarAtencion}
            disabled={saving || !formData.diagnostico}
          >
            {saving ? (
              <><i className="fas fa-spinner fa-spin"></i> Guardando...</>
            ) : (
              <><i className="fas fa-check-circle"></i> Finalizar Atención</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}