import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import '../../assets/styles/contacto.css'

const developers = [
  {
    id: 0,
    name: 'Gustavo Adolfo Tobías Ramírez',
    role: 'Project Manager & Full Stack Developer',
    image: '/images/Gustavo Adolfo Tobías RAmírez.jpg',
    badge: 'jefe-badge',
    carnet: '3590-23-12434',
    phone: '5115-1685',
    email: 'gtobias@email.com',
    description: 'Encargado de la gestión del proyecto y desarrollo full stack de la plataforma FamKon Clinic. Responsable de la arquitectura, implementación y coordinación del equipo de desarrollo.',
  },
  {
    id: 1,
    name: 'Esdras Esteban Miranda Pérez',
    role: 'Backend Developer & Encargado de Redes',
    image: '/images/Esdras Esteban Miranda Pérez.jpeg',
    badge: 'team-badge',
    carnet: '3590-23-3159',
    phone: '4879-4789',
    email: 'Emirandap5@miumg',
    description: 'Encargado del despliegue de la base de datos, administración de redes y desarrollo backend de la plataforma FamKon Clinic. Mano derecha del Project Manager.',
  },
  {
    id: 2,
    name: 'Nineth Abigail Flores Pineda',
    role: 'Full Stack Developer',
    image: '/images/Nineth Abigail Flores Pineda.jpeg',
    badge: 'team-badge',
    carnet: '3590-23-4656',
    phone: '5443-0720',
    email: 'nfloresp@miumg.edu.gt',
    description: 'Encargada de la gestión de reglas para solicitar citas médicas y desarrollo backend de la plataforma FamKon Clinic.',
  },
  {
    id: 3,
    name: 'Marvin Gerardo Salazar',
    role: 'Backend Developer & Auditor de Base de Datos',
    image: '/images/Marvin Gerardo Salazar.jpeg',
    badge: 'team-badge',
    carnet: '3590-21-15538',
    phone: '5962-5467',
    email: 'msalazarp8@miumg.edu.gt',
    description: 'Encargado del desarrollo backend y auditoría de la base de datos de la plataforma FamKon Clinic.',
  },
  {
    id: 4,
    name: 'Diego Armando Alexander Castellanos De La Cruz',
    role: 'DBA - Administrador de Base de Datos',
    image: '/images/Diego Armando Alexander Castellanos De La Cruz.png',
    badge: 'team-badge',
    carnet: '3590-23-795',
    phone: '4252-3049',
    email: 'dcastellanosd1@miumg.edu.gt',
    description: 'Encargado de la administración, mantenimiento y optimización de la base de datos de la plataforma FamKon Clinic.',
  },
]

export default function ContactoPage() {
  const [current, setCurrent] = useState(0)
  const [prevIndex, setPrevIndex] = useState<number | null>(null)
  const [animDir, setAnimDir] = useState<'left' | 'right'>('right')
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const changeTo = useCallback((index: number, dir: 'left' | 'right') => {
    if (animating) return
    setAnimating(true)
    setPrevIndex(current)
    setAnimDir(dir)
    setCurrent(index)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setAnimating(false)
      setPrevIndex(null)
    }, 450)
  }, [current, animating])

  const next = useCallback(() => {
    changeTo((current + 1) % developers.length, 'right')
  }, [current, changeTo])

  const prev = useCallback(() => {
    changeTo((current - 1 + developers.length) % developers.length, 'left')
  }, [current, changeTo])

  const goTo = useCallback((index: number) => {
    const dir = index > current ? 'right' : 'left'
    changeTo(index, dir)
  }, [current, changeTo])

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(next, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, next])

  const getCardClass = (index: number) => {
    if (index === current) return 'contacto-card active'
    if (index === prevIndex) {
      return `contacto-card exit-${animDir === 'right' ? 'left' : 'right'}`
    }
    return 'contacto-card hidden'
  }

  return (
    <div className="contacto-page">
      <div className="contacto-container">
        <div className="contacto-header">
          <Link to="/" className="btn-back">
            <i className="fas fa-arrow-left"></i> Volver
          </Link>
          <h1><i className="fas fa-address-card"></i> Contacto</h1>
          <p>Información del desarrollador</p>
        </div>

        <div className="contacto-carousel">
          <div className="contacto-carousel-inner">
            {developers.map((dev, index) => (
              <div
                key={dev.id}
                className={`${getCardClass(index)} ${dev.badge}`}
              >
                <div className="contacto-foto">
                  <img
                    src={dev.image}
                    alt={dev.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      const parent = (e.target as HTMLImageElement).parentElement
                      if (parent) {
                        const icon = document.createElement('i')
                        icon.className = 'fas fa-user-circle'
                        icon.style.cssText = 'font-size: 8rem; color: #0077B6;'
                        parent.appendChild(icon)
                      }
                    }}
                  />
                </div>

                <h2 className="contacto-nombre">{dev.name}</h2>
                <p className="contacto-rol">{dev.role}</p>

                <div className="contacto-divisor">
                  <span><i className="fas fa-graduation-cap"></i></span>
                </div>

                <div className="contacto-detalles">
                  <div className="contacto-item">
                    <i className="fas fa-id-card"></i>
                    <div>
                      <span className="contacto-label">Carnet</span>
                      <span className="contacto-valor">{dev.carnet}</span>
                    </div>
                  </div>
                  <div className="contacto-item">
                    <i className="fas fa-phone-alt"></i>
                    <div>
                      <span className="contacto-label">Teléfono</span>
                      <span className="contacto-valor">{dev.phone}</span>
                    </div>
                  </div>
                  <div className="contacto-item">
                    <i className="fas fa-envelope"></i>
                    <div>
                      <span className="contacto-label">Email</span>
                      <span className="contacto-valor">{dev.email}</span>
                    </div>
                  </div>
                </div>

                <div className="contacto-divisor">
                  <span><i className="fas fa-laptop-code"></i></span>
                </div>

                <p className="contacto-descripcion">{dev.description}</p>
              </div>
            ))}
          </div>

          <div className="contacto-nav">
            <button
              className="contacto-nav-btn"
              onClick={() => { setIsAutoPlaying(false); prev() }}
              aria-label="Anterior"
            >
              <i className="fas fa-chevron-left"></i>
            </button>

            <div className="contacto-dots">
              {developers.map((_, index) => (
                <button
                  key={index}
                  className={`contacto-dot ${index === current ? 'active' : ''}`}
                  onClick={() => { setIsAutoPlaying(false); goTo(index) }}
                  aria-label={`Ir a ${developers[index].name}`}
                />
              ))}
            </div>

            <button
              className="contacto-nav-btn"
              onClick={() => { setIsAutoPlaying(false); next() }}
              aria-label="Siguiente"
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
