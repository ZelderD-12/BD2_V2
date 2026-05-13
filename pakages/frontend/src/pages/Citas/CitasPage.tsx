import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import '../../assets/styles/citas.css'

interface Cita {
  id_cita: number
  servicio: string
  medico: string
  fecha_inicio: string
  estado: string
  motivo_consulta: string
  especialidad?: string
  sede?: string
}

const horariosDisponibles = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30"
]

export default function CitasPage() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' })

  // Form state
  const [servicios, setServicios] = useState<any[]>([])
  const [medicos, setMedicos] = useState<any[]>([])
  const [form, setForm] = useState({
    id_servicio: '',
    id_medico: '',
    fecha: '',
    hora: '',
    motivo_consulta: ''
  })

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    cargarCitas()
    cargarServicios()
    cargarMedicos()
  }, [isLoggedIn])

  const cargarCitas = async () => {
    try {
      const userId = localStorage.getItem('user_id') || localStorage.getItem('id_usuario')
      if (userId) {
        const res = await api.getCitasPaciente(parseInt(userId))
        if (res.success) setCitas(res.data || [])
      }
    } catch (error) {
      console.error('Error cargando citas:', error)
    } finally {
      setLoading(false)
    }
  }

  const cargarServicios = async () => {
    try {
      const res = await api.getServicios()
      if (res.success) setServicios(res.data || [])
    } catch (error) {}
  }

  const cargarMedicos = async () => {
    try {
      const res = await api.getMedicos()
      if (res.success) setMedicos(res.data || [])
    } catch (error) {}
  }

  const reservarCita = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.id_servicio || !form.id_medico || !form.fecha || !form.hora) {
      setMensaje({ texto: 'Completa todos los campos', tipo: 'error' })
      return
    }

    try {
      const userId = localStorage.getItem('user_id') || localStorage.getItem('id_usuario')
      const fechaHora = `${form.fecha}T${form.hora}:00`

      const res = await api.reservarCita({
        id_paciente: parseInt(userId || '0'),
        id_medico: parseInt(form.id_medico),
        id_servicio: parseInt(form.id_servicio),
        fecha_inicio: fechaHora,
        motivo_consulta: form.motivo_consulta
      })

      if (res.success) {
        setMensaje({ texto: 'Cita agendada correctamente', tipo: 'success' })
        setTimeout(() => {
          setModalOpen(false)
          setForm({ id_servicio: '', id_medico: '', fecha: '', hora: '', motivo_consulta: '' })
          cargarCitas()
        }, 1500)
      } else {
        setMensaje({ texto: res.error || 'Error al agendar', tipo: 'error' })
      }
    } catch (error) {
      setMensaje({ texto: 'Error de conexión', tipo: 'error' })
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  if (!isLoggedIn) return null

  return (
    <div className="citas-page">
      <div className="citas-container">
        <div className="citas-header">
          <Link to="/" className="btn-back">
            <i className="fas fa-arrow-left"></i> Volver al inicio
          </Link>
          <h1><i className="fas fa-calendar-check"></i> Mis Citas</h1>
          <p>Gestiona tus citas médicas</p>
        </div>

        <div className="citas-actions">
          <button className="btn-nueva-cita" onClick={() => setModalOpen(true)}>
            <i className="fas fa-plus-circle"></i> Agendar Nueva Cita
          </button>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="modal-cita" style={{ display: 'flex' }} onClick={() => setModalOpen(false)}>
            <div className="modal-cita-content" onClick={e => e.stopPropagation()}>
              <div className="modal-cita-header">
                <h2><i className="fas fa-calendar-plus"></i> Agendar Cita</h2>
                <span className="close-modal" onClick={() => setModalOpen(false)}>&times;</span>
              </div>
              <div className="modal-cita-body">
                <form onSubmit={reservarCita}>
                  <div className="form-group-cita">
                    <label><i className="fas fa-stethoscope"></i> Servicio</label>
                    <select value={form.id_servicio} onChange={e => setForm({...form, id_servicio: e.target.value})} required>
                      <option value="">Selecciona servicio</option>
                      {servicios.map((s: any) => (
                        <option key={s.id_servicio} value={s.id_servicio}>{s.servicio || s.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-cita">
                    <label><i className="fas fa-user-md"></i> Médico</label>
                    <select value={form.id_medico} onChange={e => setForm({...form, id_medico: e.target.value})} required>
                      <option value="">Selecciona médico</option>
                      {medicos.map((m: any) => (
                        <option key={m.id_medico} value={m.id_medico}>{m.nombre} - {m.especialidad}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row-cita">
                    <div className="form-group-cita">
                      <label><i className="fas fa-calendar-day"></i> Fecha</label>
                      <input type="date" min={minDate} value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} required />
                    </div>
                    <div className="form-group-cita">
                      <label><i className="fas fa-clock"></i> Hora</label>
                      <select value={form.hora} onChange={e => setForm({...form, hora: e.target.value})} required>
                        <option value="">Selecciona hora</option>
                        {horariosDisponibles.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group-cita">
                    <label><i className="fas fa-comment"></i> Motivo (opcional)</label>
                    <input type="text" value={form.motivo_consulta} onChange={e => setForm({...form, motivo_consulta: e.target.value})} placeholder="Motivo de la consulta" />
                  </div>

                  <button type="submit" className="btn-guardar-cita">
                    <i className="fas fa-save"></i> Reservar Cita
                  </button>
                </form>
                {mensaje.texto && (
                  <div className={`mensaje-cita ${mensaje.tipo}`}>{mensaje.texto}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de citas */}
        <div className="citas-grid">
          {loading ? (
            <div className="loading-spinner">
              <i className="fas fa-spinner fa-spin"></i> Cargando tus citas...
            </div>
          ) : citas.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-calendar-alt"></i>
              <h3>No tienes citas agendadas</h3>
              <p>Agenda tu primera cita médica</p>
              <button className="btn-nueva-cita" onClick={() => setModalOpen(true)}>Agendar Cita</button>
            </div>
          ) : (
            citas.map(cita => (
              <div key={cita.id_cita} className="cita-card">
                <div className="cita-header">
                  <span className="cita-especialidad">
                    <i className="fas fa-stethoscope"></i> {cita.servicio}
                  </span>
                  <span className={`estado-badge estado-${cita.estado}`}>{cita.estado}</span>
                </div>
                <div className="cita-info">
                  <p><i className="fas fa-calendar-day"></i> {new Date(cita.fecha_inicio).toLocaleDateString()}</p>
                  <p><i className="fas fa-clock"></i> {new Date(cita.fecha_inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                  <p><i className="fas fa-user-md"></i> {cita.medico}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}