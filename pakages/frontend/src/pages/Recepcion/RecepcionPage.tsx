import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import '../../assets/styles/recepcion.css'

const API_BASE = 'http://localhost:8080'

interface Ticket {
  id_ticket: number
  codigo_ticket: string
  prioridad: string
  estado: string
  paciente?: string
  id_paciente?: number
  servicio?: string
}

export default function RecepcionPage() {
  const { isLoggedIn, userRol } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [idSede, setIdSede] = useState('1')
  const [idServicio, setIdServicio] = useState('1')
  const [idPaciente, setIdPaciente] = useState('')
  const [prioridad, setPrioridad] = useState('NORMAL')
  const [idSupervisor, setIdSupervisor] = useState('')
  const [motivoEspecial, setMotivoEspecial] = useState('')
  const [idCita, setIdCita] = useState('')
  const [mensajeTicket, setMensajeTicket] = useState({ texto: '', tipo: '' })
  const [mensajeLlamar, setMensajeLlamar] = useState({ texto: '', tipo: '' })
  const [mensajeAccion, setMensajeAccion] = useState({ texto: '', tipo: '' })
  const [generando, setGenerando] = useState(false)
  const [llamando, setLlamando] = useState(false)

  // Ticket actual
  const [ticketActual, setTicketActual] = useState<Ticket | null>(null)
  
  // Cola
  const [cola, setCola] = useState<Ticket[]>([])
  const [contadorCola, setContadorCola] = useState(0)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    if (userRol !== 'Resepcionista') {
      navigate('/')
      return
    }
  }, [isLoggedIn, userRol, navigate])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  const generarUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }

  const cargarCola = useCallback(async () => {
    if (!idSede || !idServicio) return
    try {
      const res = await fetch(`${API_BASE}/api/pantalla/cola?id_sede=${idSede}&id_servicio=${idServicio}`, {
        headers: getAuthHeaders()
      })
      const data = await res.json()
      if (data.data?.proximos) {
        setCola(data.data.proximos)
        setContadorCola(data.data.proximos.length)
      }
    } catch (error) {
      console.error('Error cargando cola:', error)
    }
  }, [idSede, idServicio])

  // Polling cada 5 segundos
  useEffect(() => {
    cargarCola()
    const interval = setInterval(cargarCola, 5000)
    return () => clearInterval(interval)
  }, [cargarCola])

  const generarTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idSede || !idServicio || !idPaciente || !prioridad) {
      setMensajeTicket({ texto: 'Completa todos los campos', tipo: 'error' })
      return
    }

    if (prioridad === 'ESPECIAL' && (!idSupervisor || !motivoEspecial)) {
      setMensajeTicket({ texto: 'Ticket ESPECIAL requiere supervisor y motivo', tipo: 'error' })
      return
    }

    setGenerando(true)
    const body: any = {
      id_paciente: parseInt(idPaciente),
      id_sede: parseInt(idSede),
      id_servicio: parseInt(idServicio),
      prioridad
    }
    if (idCita) body.id_cita = parseInt(idCita)
    if (prioridad === 'ESPECIAL') {
      body.id_supervisor = parseInt(idSupervisor)
      body.motivo_especial = motivoEspecial
    }

    try {
      const res = await fetch(`${API_BASE}/api/tickets/generar`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Idempotency-Key': generarUUID() },
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (res.status === 201) {
        setMensajeTicket({ texto: `Ticket ${data.data.codigo_ticket} generado`, tipo: 'success' })
        setIdPaciente('')
        setPrioridad('NORMAL')
        setIdCita('')
        cargarCola()
      } else {
        setMensajeTicket({ texto: data.error || 'Error', tipo: 'error' })
      }
    } catch {
      setMensajeTicket({ texto: 'Error de conexión', tipo: 'error' })
    } finally {
      setGenerando(false)
    }
  }

  const llamarSiguiente = async () => {
    if (!idSede || !idServicio) {
      setMensajeLlamar({ texto: 'Selecciona sede y servicio', tipo: 'error' })
      return
    }

    setLlamando(true)
    try {
      const res = await fetch(`${API_BASE}/api/tickets/siguiente`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id_sede: parseInt(idSede), id_servicio: parseInt(idServicio) })
      })
      const data = await res.json()

      if (res.status === 200) {
        setMensajeLlamar({ texto: `Llamando ticket ${data.data.codigo_ticket}`, tipo: 'success' })
        setTicketActual({ ...data.data, estado: 'LLAMADO' })
        cargarCola()
      } else if (res.status === 404) {
        setMensajeLlamar({ texto: 'No hay pacientes en cola', tipo: 'info' })
      } else {
        setMensajeLlamar({ texto: data.error || 'Error', tipo: 'error' })
      }
    } catch {
      setMensajeLlamar({ texto: 'Error de conexión', tipo: 'error' })
    } finally {
      setLlamando(false)
    }
  }

  const cambiarEstado = async (nuevoEstado: string, motivo?: string) => {
    if (!ticketActual) return
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketActual.id_ticket}/estado`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nuevo_estado: nuevoEstado, motivo: motivo || null })
      })
      const data = await res.json()

      if (res.status === 200) {
        setMensajeAccion({ texto: `Ticket actualizado a ${nuevoEstado}`, tipo: 'success' })
        if (nuevoEstado === 'FINALIZADO' || nuevoEstado === 'NO_SHOW') {
          setTicketActual(null)
        } else {
          setTicketActual({ ...ticketActual, estado: nuevoEstado })
        }
        cargarCola()
      } else {
        setMensajeAccion({ texto: data.error || 'Error', tipo: 'error' })
      }
    } catch {
      setMensajeAccion({ texto: 'Error de conexión', tipo: 'error' })
    }
  }

  return (
    <div className="recepcion-page" style={{ marginTop: 120 }}>
      <div className="recepcion-container">
        <div className="recepcion-titulo">
          <h1><i className="fas fa-concierge-bell"></i> Panel de Recepción</h1>
          <p>Gestión de tickets y cola de atención</p>
        </div>

        <div className="panel-grid">
          {/* Columna izquierda */}
          <div className="panel-left">
            {/* Generar Ticket */}
            <div className="panel-card">
              <div className="card-header">
                <i className="fas fa-ticket-alt"></i>
                <h2>Generar Ticket</h2>
              </div>
              <div className="card-body">
                <form onSubmit={generarTicket}>
                  <div className="form-group">
                    <label><i className="fas fa-building"></i> Sede</label>
                    <select value={idSede} onChange={e => setIdSede(e.target.value)} required>
                      <option value="1">Sede Zona 19</option>
                      <option value="2">Sede Zona 10</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-stethoscope"></i> Servicio</label>
                    <select value={idServicio} onChange={e => setIdServicio(e.target.value)} required>
                      <option value="1">Consulta General</option>
                      <option value="2">Odontología</option>
                      <option value="3">Cardiología</option>
                      <option value="4">Neurología</option>
                      <option value="5">Pediatría</option>
                      <option value="6">Laboratorio Clínico</option>
                      <option value="7">Radiología</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-user"></i> ID Paciente</label>
                    <input type="number" value={idPaciente} onChange={e => setIdPaciente(e.target.value)} placeholder="Ej: 1234" required />
                  </div>

                  <div className="form-group">
                    <label><i className="fas fa-sort-amount-up"></i> Prioridad</label>
                    <select value={prioridad} onChange={e => setPrioridad(e.target.value)} required>
                      <option value="NORMAL">Normal</option>
                      <option value="ANCIANO">Adulto Mayor</option>
                      <option value="EMBARAZO">Embarazo</option>
                      <option value="DISCAPACIDAD">Discapacidad</option>
                      <option value="ESPECIAL">ESPECIAL</option>
                    </select>
                  </div>

                  {prioridad === 'ESPECIAL' && (
                    <div className="seccion-especial">
                      <div className="alerta-especial">
                        <i className="fas fa-exclamation-triangle"></i> Requiere autorización
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-user-shield"></i> ID Supervisor</label>
                        <input type="number" value={idSupervisor} onChange={e => setIdSupervisor(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label><i className="fas fa-comment-alt"></i> Motivo</label>
                        <textarea value={motivoEspecial} onChange={e => setMotivoEspecial(e.target.value)} rows={2} required />
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label><i className="fas fa-calendar-check"></i> Desde cita (opcional)</label>
                    <input type="number" value={idCita} onChange={e => setIdCita(e.target.value)} placeholder="ID de cita" />
                  </div>

                  {mensajeTicket.texto && (
                    <div className={`mensaje ${mensajeTicket.tipo}`}>{mensajeTicket.texto}</div>
                  )}

                  <button type="submit" className="btn-generar" disabled={generando}>
                    {generando ? <><i className="fas fa-spinner fa-spin"></i> Generando...</> : <><i className="fas fa-plus-circle"></i> Generar Ticket</>}
                  </button>
                </form>
              </div>
            </div>

            {/* Llamar Siguiente */}
            <div className="panel-card">
              <div className="card-header verde">
                <i className="fas fa-bullhorn"></i>
                <h2>Llamar Siguiente</h2>
              </div>
              <div className="card-body llamar-body">
                <p className="llamar-desc">Llama al siguiente paciente en cola según prioridad</p>
                <button className="btn-llamar" onClick={llamarSiguiente} disabled={llamando}>
                  {llamando ? <><i className="fas fa-spinner fa-spin"></i> Llamando...</> : <><i className="fas fa-bullhorn"></i> Llamar Siguiente</>}
                </button>
                {mensajeLlamar.texto && (
                  <div className={`mensaje ${mensajeLlamar.tipo}`}>{mensajeLlamar.texto}</div>
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="panel-right">
            {/* Ticket Actual */}
            <div className="panel-card">
              <div className="card-header naranja">
                <i className="fas fa-user-clock"></i>
                <h2>Ticket Actual</h2>
              </div>
              <div className="card-body">
                {!ticketActual ? (
                  <div className="ticket-actual-vacio">
                    <i className="fas fa-inbox"></i>
                    <p>Sin ticket en atención</p>
                  </div>
                ) : (
                  <>
                    <div className="ticket-info-card">
                      <div className="ticket-codigo-grande">{ticketActual.codigo_ticket}</div>
                      <div className="ticket-detalle">
                        <p><i className="fas fa-user"></i> <strong>Paciente:</strong> {ticketActual.paciente || `ID: ${ticketActual.id_paciente}`}</p>
                        <p><i className="fas fa-sort-amount-up"></i> <strong>Prioridad:</strong> <span className={`prioridad-badge prior-${ticketActual.prioridad}`}>{ticketActual.prioridad}</span></p>
                        <p><i className="fas fa-stethoscope"></i> <strong>Servicio:</strong> {ticketActual.servicio || '-'}</p>
                        <p><i className="fas fa-clock"></i> <strong>Estado:</strong> {ticketActual.estado}</p>
                      </div>
                    </div>
                    <div className="acciones-ticket">
                      {ticketActual.estado === 'LLAMADO' && (
                        <>
                          <button className="btn-accion btn-en-atencion" onClick={() => cambiarEstado('EN_ATENCION')}>
                            <i className="fas fa-user-check"></i> En Atención
                          </button>
                          <button className="btn-accion btn-no-show" onClick={() => {
                            if (confirm('¿Marcar como No Show?')) cambiarEstado('NO_SHOW', 'Paciente no se presentó')
                          }}>
                            <i className="fas fa-user-slash"></i> No Show
                          </button>
                        </>
                      )}
                      {ticketActual.estado === 'EN_ATENCION' && (
                        <button className="btn-accion btn-finalizar" onClick={() => {
                          if (confirm('¿Finalizar atención?')) cambiarEstado('FINALIZADO')
                        }}>
                          <i className="fas fa-check-circle"></i> Finalizar
                        </button>
                      )}
                    </div>
                  </>
                )}
                {mensajeAccion.texto && (
                  <div className={`mensaje ${mensajeAccion.tipo}`}>{mensajeAccion.texto}</div>
                )}
              </div>
            </div>

            {/* Cola de Espera */}
            <div className="panel-card">
              <div className="card-header">
                <i className="fas fa-list-ol"></i>
                <h2>Cola de Espera</h2>
                <span className="badge-contador">{contadorCola}</span>
              </div>
              <div className="card-body">
                {cola.length === 0 ? (
                  <div className="cola-vacia">
                    <i className="fas fa-check-circle"></i>
                    <p>Cola vacía</p>
                  </div>
                ) : (
                  cola.map((t, i) => (
                    <div key={t.id_ticket} className={`cola-item prior-${t.prioridad}`}>
                      <span className="cola-posicion">{i + 1}</span>
                      <span className="cola-codigo">{t.codigo_ticket}</span>
                      <div className="cola-datos">
                        <p><span className={`prioridad-badge prior-${t.prioridad}`}>{t.prioridad}</span></p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}