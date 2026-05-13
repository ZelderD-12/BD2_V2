import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../../assets/styles/pantalla_publica.css'

const API_BASE = 'http://localhost:8080'

function normEst(t: Record<string, unknown>): string {
  const e = t.estado ?? t.estado_ticket ?? t.id_estado_ticket
  if (typeof e === 'number') {
    const map = ['EN_ESPERA', 'LLAMADO', 'EN_ATENCION', 'FINALIZADO', 'NO_SHOW']
    if (e >= 1 && e <= 5) return map[e - 1]
    return String(e)
  }
  return String(e ?? '').toUpperCase()
}

export default function PantallaPage() {
  const [searchParams] = useSearchParams()
  const idSede = searchParams.get('id_sede') || '1'
  /** Sin `id_servicio` la API envía NULL al SP: cola de toda la sede (evita ocultar tickets de otro servicio). */
  const idServicio = searchParams.get('id_servicio')

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
      const fecha = encodeURIComponent(new Date().toISOString())
      const qsPub = new URLSearchParams({ id_sede: idSede })
      if (idServicio != null && idServicio !== '' && idServicio.toLowerCase() !== 'all') {
        qsPub.set('id_servicio', idServicio)
      }
      const [resPub, resAct] = await Promise.all([
        fetch(`${API_BASE}/api/pantalla/cola?${qsPub}`),
        fetch(`${API_BASE}/api/tickets/cola-actuales?id_sede=${idSede}&fecha_hora=${fecha}&minutos_gracia=5`)
      ])
      const dataPub = await resPub.json()
      const dataAct = await resAct.json()

      const activosAct = (dataAct.success ? dataAct.data || [] : []).filter((t: Record<string, unknown>) => {
        const s = normEst(t)
        return s !== 'FINALIZADO' && s !== 'NO_SHOW'
      })

      const llamadoPublica = dataPub.success ? dataPub.data?.llamado_actual : null
      const llamadoAct = activosAct.find((t: Record<string, unknown>) => normEst(t) === 'LLAMADO') as Record<string, unknown> | undefined
      const nuevo = (llamadoPublica as Record<string, unknown> | null) || llamadoAct || null

      const byId = new Map<number, Record<string, unknown>>()
      for (const t of activosAct) byId.set(t.id_ticket as number, t)
      if (dataPub.success) {
        for (const p of (dataPub.data?.proximos || []) as Record<string, unknown>[]) {
          if (normEst(p) === 'FINALIZADO' || normEst(p) === 'NO_SHOW') continue
          if (!byId.has(p.id_ticket as number)) byId.set(p.id_ticket as number, p)
        }
      }
      setCola([...byId.values()].slice(0, 8))

      if (nuevo && (nuevo as { id_ticket?: number }).id_ticket !== ultimoLlamadoId) {
        const nt = nuevo as { id_ticket: number; codigo_ticket?: string }
        setLlamado(nuevo)
        setUltimoLlamadoId(nt.id_ticket)
        beep()
        hablar(`Ticket ${nt.codigo_ticket ?? ''}. Pase a ventanilla.`)
      } else if (!nuevo) {
        setLlamado(null)
      } else {
        setLlamado(nuevo)
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