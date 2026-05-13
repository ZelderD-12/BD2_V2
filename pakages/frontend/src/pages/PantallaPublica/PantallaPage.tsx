import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../../assets/styles/pantalla_publica.css'

const API_BASE = 'http://localhost:8080'

export default function PantallaPage() {
  const [searchParams] = useSearchParams()
  const idSede = searchParams.get('id_sede') || '1'
  const idServicio = searchParams.get('id_servicio') || '1'

  const [hora, setHora] = useState('')
  const [llamado, setLlamado] = useState<any>(null)
  const [cola, setCola] = useState<any[]>([])
  const [ultimoLlamadoId, setUltimoLlamadoId] = useState<number | null>(null)

  // Limpiar estilos del body al montar/desmontar
  useEffect(() => {
    const originalStyles = {
      background: document.body.style.background,
      overflow: document.body.style.overflow,
      color: document.body.style.color,
      minHeight: document.body.style.minHeight
    }
    
    document.body.style.background = 'linear-gradient(135deg, #0077B6 0%, #00B4D8 100%)'
    document.body.style.overflow = 'hidden'
    document.body.style.color = 'white'
    document.body.style.minHeight = '100vh'
    
    return () => {
      document.body.style.background = originalStyles.background
      document.body.style.overflow = originalStyles.overflow
      document.body.style.color = originalStyles.color
      document.body.style.minHeight = originalStyles.minHeight
    }
  }, [])

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => {
      const ahora = new Date()
      setHora(ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Sonido beep
  const beep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch (e) {}
  }

  // Voz
  const hablar = (texto: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto)
      u.lang = 'es-ES'; u.rate = 0.9; u.volume = 1
      window.speechSynthesis.speak(u)
    }
  }

  const obtenerCola = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pantalla/cola?id_sede=${idSede}&id_servicio=${idServicio}`)
      const data = await res.json()
      if (data.success) {
        const nuevo = data.data.llamado_actual || null
        setCola(data.data.proximos?.slice(0, 5) || [])

        if (nuevo && nuevo.id_ticket !== ultimoLlamadoId) {
          setLlamado(nuevo)
          setUltimoLlamadoId(nuevo.id_ticket)
          beep()
          hablar(`Cita ${nuevo.codigo_ticket}. Pase a ventanilla.`)
        } else if (!nuevo) {
          setLlamado(null)
        }
      }
    } catch (e) {}
  }, [idSede, idServicio, ultimoLlamadoId])

  useEffect(() => {
    obtenerCola()
    const interval = setInterval(obtenerCola, 3000)
    return () => clearInterval(interval)
  }, [obtenerCola])

  return (
    <div className="pantalla-publica-wrapper">
      <div className="pantalla-header">
        <div className="header-logo">
          <i className="fas fa-heartbeat"></i>
          <span>FamKon Clinic</span>
        </div>
        <div className="header-info">
          <span className="hora-actual">{hora}</span>
          <span className="sede-label"><i className="fas fa-map-marker-alt"></i> Sede Zona 19</span>
        </div>
      </div>

      <div className="pantalla-body">
        <div className="seccion-llamado">
          <div className="llamado-label">
            <i className="fas fa-bullhorn"></i> TURNO EN ATENCION
          </div>
          {llamado ? (
            <div className="ticket-llamado-activo">
              <div className="ticket-numero-pantalla">{llamado.codigo_ticket}</div>
              {llamado.paciente && <div className="ticket-paciente-nombre"><i className="fas fa-user"></i> {llamado.paciente}</div>}
              <div className={`ticket-prioridad-pantalla prior-${llamado.prioridad}`}>{llamado.prioridad}</div>
              <div className="ticket-consultorio"><i className="fas fa-door-open"></i> Pase a ventanilla</div>
            </div>
          ) : (
            <div className="ticket-llamado-vacio">
              <div className="sin-ticket">
                <i className="fas fa-hourglass-half"></i>
                <p>Esperando llamado...</p>
              </div>
            </div>
          )}
        </div>

        <div className="seccion-proximos">
          <div className="proximos-label">
            <i className="fas fa-list-ol"></i> PROXIMOS
          </div>
          <div className="proximos-lista">
            {cola.length === 0 ? (
              <div className="proximos-vacio">
                <i className="fas fa-check-circle"></i>
                <p>Sin pacientes en espera</p>
              </div>
            ) : (
              cola.map((t, i) => (
                <div key={t.id_ticket} className={`proximo-item prior-${t.prioridad}`}>
                  <span className="proximo-pos">{i + 1}</span>
                  <span className="proximo-codigo">{t.codigo_ticket}</span>
                  <div className="proximo-datos">
                    <span className={`proximo-prioridad prior-${t.prioridad}`}>{t.prioridad}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="pantalla-footer">
        <marquee className="footer-mensaje">
          Bienvenido a FamKon Clinic &nbsp;&nbsp;|&nbsp;&nbsp;
          Por favor este atento a su numero de turno &nbsp;&nbsp;|&nbsp;&nbsp;
          Gracias por su paciencia &nbsp;&nbsp;|&nbsp;&nbsp;
          Respete el orden de llegada
        </marquee>
      </div>
    </div>
  )
}