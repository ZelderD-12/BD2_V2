import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../../assets/styles/pantalla_publica.css'

const API_BASE = 'http://localhost:8080'

interface TicketLlamado {
  id_ticket: number
  codigo_ticket: string
  prioridad: string
  paciente?: string
  ventanilla?: string
}

interface TicketEnCola {
  id_ticket: number
  codigo_ticket: string
  prioridad: string
}

export default function PantallaPage() {
  const [searchParams] = useSearchParams()
  const idSede = searchParams.get('id_sede') || '1'
  const idServicio = searchParams.get('id_servicio') || '1'

  const [hora, setHora] = useState('')
  const [llamado, setLlamado] = useState<TicketLlamado | null>(null)
  const [cola, setCola] = useState<TicketEnCola[]>([])

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      const ahora = new Date()
      setHora(ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Obtener cola cada 3 segundos
  const obtenerCola = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pantalla/cola?id_sede=${idSede}&id_servicio=${idServicio}`)
      const data = await res.json()
      if (data.success) {
        setLlamado(data.data.llamado_actual || null)
        setCola(data.data.proximos?.slice(0, 5) || [])
      }
    } catch (error) {
      console.error('Error obteniendo cola:', error)
    }
  }, [idSede, idServicio])

  useEffect(() => {
    obtenerCola()
    const interval = setInterval(obtenerCola, 3000)
    return () => clearInterval(interval)
  }, [obtenerCola])

  return (
    <div className="pantalla-publica">
      {/* Header */}
      <header className="pantalla-header">
        <div className="pantalla-logo">
          <i className="fas fa-heartbeat"></i>
          <span>FamKon Clinic</span>
        </div>
        <div className="pantalla-info">
          <div className="pantalla-reloj">
            <i className="fas fa-clock"></i>
            <span>{hora}</span>
          </div>
          <div className="pantalla-sede">
            <i className="fas fa-map-marker-alt"></i>
            <span>Sede Zona 19</span>
          </div>
        </div>
      </header>

      {/* Cuerpo */}
      <main className="pantalla-body">
        {/* Ticket llamado */}
        <section className="pantalla-llamado">
          <div className="llamado-label">
            <i className="fas fa-bullhorn"></i> TURNO EN ATENCIÓN
          </div>
          {llamado ? (
            <div className="llamado-ticket">
              <div className="llamado-codigo">{llamado.codigo_ticket}</div>
              {llamado.paciente && (
                <div className="llamado-paciente">
                  <i className="fas fa-user"></i> {llamado.paciente}
                </div>
              )}
              <div className={`llamado-prioridad prior-${llamado.prioridad}`}>
                {llamado.prioridad}
              </div>
              <div className="llamado-ventanilla">
                <i className="fas fa-door-open"></i> Pase a ventanilla
                {llamado.ventanilla && <span> #{llamado.ventanilla}</span>}
              </div>
            </div>
          ) : (
            <div className="llamado-vacio">
              <i className="fas fa-hourglass-half"></i>
              <p>Esperando llamado...</p>
            </div>
          )}
        </section>

        {/* Cola de espera */}
        <section className="pantalla-cola">
          <div className="cola-label">
            <i className="fas fa-list-ol"></i> PRÓXIMOS
          </div>
          {cola.length === 0 ? (
            <div className="cola-vacia">
              <i className="fas fa-check-circle"></i>
              <p>Sin pacientes en espera</p>
            </div>
          ) : (
            <div className="cola-lista">
              {cola.map((ticket, index) => (
                <div key={ticket.id_ticket} className={`cola-item prior-${ticket.prioridad}`}>
                  <span className="cola-pos">{index + 1}</span>
                  <span className="cola-codigo">{ticket.codigo_ticket}</span>
                  <span className={`cola-prioridad prior-${ticket.prioridad}`}>{ticket.prioridad}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="pantalla-footer">
        <marquee>
          Bienvenido a FamKon Clinic | Por favor esté atento a su número de turno | Gracias por su paciencia
        </marquee>
      </footer>
    </div>
  )
}