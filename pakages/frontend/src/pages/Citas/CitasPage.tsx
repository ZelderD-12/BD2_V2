import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import "../../assets/styles/citas.css";
import "../../assets/styles/historial.css";

interface Cita {
  id_cita: number;
  id_paciente: number;
  servicio: string;
  medico: string;
  fecha_inicio: string;
  estado: string;
  motivo_consulta: string;
  motivo_cancelacion?: string;
}

interface Servicio {
  id_servicio: number;
  servicio: string;
}

interface Medico {
  id_medico: number;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  email: string;
  telefono: string;
}

interface Sede {
  id_sede: number;
  nombre: string;
  ubicacion: string;
  capacidad_slots: number;
}

const horariosDisponibles = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
];

export default function CitasPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [citas, setCitas] = useState<Cita[]>([]);
  const [citasHistorial, setCitasHistorial] = useState<Cita[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalModo, setModalModo] = useState<"crear" | "modificar">("crear");

  const [citaModificarId, setCitaModificarId] = useState<number | null>(null);

  const [selectedHistorial, setSelectedHistorial] = useState<any>(null);
  const [showModalHistorial, setShowModalHistorial] = useState(false);

  const LABEL_SIGNOS: Record<string, string> = {
    peso: 'Peso', talla: 'Talla', presion_arterial: 'Presión Arterial',
    temperatura: 'Temperatura', frecuencia_cardiaca: 'Frecuencia Cardíaca', glucosa: 'Glucosa'
  }
  const UNIDAD_SIGNOS: Record<string, string> = {
    peso: 'kg', talla: 'cm', presion_arterial: 'mmHg',
    temperatura: '°C', frecuencia_cardiaca: 'lpm', glucosa: 'mg/dL'
  }

  const [mensaje, setMensaje] = useState({
    texto: "",
    tipo: "",
  });

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [form, setForm] = useState({
    id_sede: "",
    id_servicio: "",
    id_medico: "",
    fecha: "",
    hora: "",
    motivo_consulta: "",
  });

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }

    cargarCitas();
    cargarServicios();
    cargarMedicos();
    cargarSedes();
  }, [isLoggedIn]);

  const cargarCitas = async (todas = false) => {
    try {
      const userId =
        localStorage.getItem("user_id") || localStorage.getItem("id_usuario");

      if (userId) {
        const res = await api.getCitasPaciente(parseInt(userId), todas);

        if (res.success) {
          if (todas) {
            setCitasHistorial(res.data || []);
          } else {
            setCitas(res.data || []);
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleHistorial = () => {
    setLoading(true);
    const nueva = !verHistorial;
    setVerHistorial(nueva);
    cargarCitas(nueva);
  };

  const cargarServicios = async () => {
    try {
      const res = await api.getServicios();
      if (res.success) {
        setServicios(res.data || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const cargarMedicos = async () => {
    try {
      const res = await api.getMedicos();
      if (res.success) {
        setMedicos(res.data || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const cargarSedes = async () => {
    try {
      console.log("Cargando sedes...");
      const res = await api.getSedes();
      console.log("Respuesta sedes:", res);

      if (res.success) {
        console.log("Sedes encontradas:", res.data);
        setSedes(res.data || []);
      } else {
        console.log("Error en sedes:", res.error);
      }
    } catch (error) {
      console.error("Error cargar sedes:", error);
    }
  };

  const getUserId = () => {
    return parseInt(
      localStorage.getItem("user_id") ||
        localStorage.getItem("id_usuario") ||
        "0",
    );
  };

  // ==========================
  // RESERVAR
  // ==========================
  const reservarCita = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.id_sede ||
      !form.id_servicio ||
      !form.id_medico ||
      !form.fecha ||
      !form.hora
    ) {
      setMensaje({
        texto: "Completa todos los campos",
        tipo: "error",
      });
      return;
    }

    try {
      const fechaHora = `${form.fecha}T${form.hora}:00`;

      const res = await api.reservarCita({
        id_paciente: getUserId(),
        id_medico: parseInt(form.id_medico),
        id_servicio: parseInt(form.id_servicio),
        id_sede: parseInt(form.id_sede),
        fecha_inicio: fechaHora,
        motivo_consulta: form.motivo_consulta,
      });

      if (res.success) {
        setMensaje({
          texto: `✅ Cita #${res.data.id_cita} creada correctamente`,
          tipo: "success",
        });

        setTimeout(() => {
          cerrarModal();
          cargarCitas();
        }, 1500);
      } else {
        setMensaje({
          texto: res.error || "Error al reservar",
          tipo: "error",
        });
      }
    } catch (error) {
      console.error(error);
      setMensaje({
        texto: "Error de conexión",
        tipo: "error",
      });
    }
  };

  // ==========================
  // MODIFICAR
  // ==========================
  const modificarCita = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!citaModificarId) return;

    try {
      const fechaHora = `${form.fecha}T${form.hora}:00`;

      const res = await api.modificarCita(citaModificarId, {
        id_paciente: getUserId(),
        nuevo_id_servicio: form.id_servicio
          ? parseInt(form.id_servicio)
          : undefined,
        nueva_fecha_inicio: fechaHora,
        motivo_consulta: form.motivo_consulta,
      });

      if (res.success) {
        setMensaje({
          texto: "✅ Cita modificada correctamente",
          tipo: "success",
        });

        setTimeout(() => {
          cerrarModal();
          cargarCitas();
        }, 1500);
      } else {
        setMensaje({
          texto: res.error || "Error al modificar",
          tipo: "error",
        });
      }
    } catch (error) {
      console.error(error);
      setMensaje({
        texto: "Error de conexión",
        tipo: "error",
      });
    }
  };

  // ==========================
  // CONFIRMAR
  // ==========================
  const handleConfirmarCita = async (id_cita: number, id_paciente: number) => {
    try {
      const res = await api.confirmarCita(id_cita, id_paciente);
      if (res.success) {
        alert("Cita confirmada exitosamente");
        cargarCitas();
      } else {
        alert("Error: " + (res.error || res.mensaje));
      }
    } catch (error) {
      console.error("Error al confirmar cita:", error);
      alert("Error al confirmar la cita");
    }
  };

  // ==========================
  // CANCELAR
  // ==========================
  const handleCancelarCita = async (idCita: number) => {
    const motivo = prompt("Motivo de cancelación");

    if (!confirm("¿Cancelar esta cita?")) return;

    try {
      const res = await api.cancelarCita(
        idCita,
        getUserId(),
        motivo || undefined,
      );

      if (res.success) {
        setMensaje({
          texto: "✅ Cita cancelada",
          tipo: "success",
        });

        cargarCitas();
      } else {
        setMensaje({
          texto: res.error || "Error al cancelar",
          tipo: "error",
        });
      }
    } catch (error) {
      console.error(error);
      setMensaje({
        texto: "Error de conexión",
        tipo: "error",
      });
    }
  };

  // ==========================
  // MODAL MODIFICAR
  // ==========================
  const abrirModificar = (cita: Cita) => {
    const fecha = cita.fecha_inicio.split("T")[0];
    const hora = cita.fecha_inicio.split("T")[1]?.substring(0, 5);

    setForm({
      id_sede: "",
      id_servicio: "",
      id_medico: "",
      fecha,
      hora,
      motivo_consulta: cita.motivo_consulta || "",
    });

    setCitaModificarId(cita.id_cita);
    setModalModo("modificar");
    setModalOpen(true);
  };

  // ==========================
  // MODAL CREAR
  // ==========================
  const abrirCrear = () => {
    setForm({
      id_sede: "",
      id_servicio: "",
      id_medico: "",
      fecha: "",
      hora: "",
      motivo_consulta: "",
    });

    setModalModo("crear");
    setCitaModificarId(null);
    setModalOpen(true);

    setMensaje({
      texto: "",
      tipo: "",
    });
  };

  // ==========================
  // CERRAR
  // ==========================
  const cerrarModal = () => {
    setModalOpen(false);

    setForm({
      id_sede: "",
      id_servicio: "",
      id_medico: "",
      fecha: "",
      hora: "",
      motivo_consulta: "",
    });

    setMensaje({
      texto: "",
      tipo: "",
    });
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const getEstadoBadgeClass = (estado: string) => {
    const map: Record<string, string> = {
      Pendiente: "estado-PENDIENTE",
      Confirmada: "estado-CONFIRMADA",
      Cancelada: "estado-CANCELADA",
      Reprogramada: "estado-REPROGRAMADA",
      Solicitada: "estado-SOLICITADA",
      No_Show: "estado-NO_SHOW",
      Expirada: "estado-EXPIRADA",
      Atendida: "estado-ATENDIDA",
    };
    return map[estado] || "estado-PENDIENTE";
  };

  const citaExpirada = (fecha: string) => {
    return new Date(fecha) < new Date();
  };

  if (!isLoggedIn) return null;

  return (
    <div className="citas-page">
      <div className="citas-container">
        <div className="citas-header">
          <Link to="/" className="btn-back">
            <i className="fas fa-arrow-left"></i>
            Volver
          </Link>

          <h1>
            <i className="fas fa-calendar-check"></i>
            Mis Citas
          </h1>

          <p>Gestiona tus citas médicas</p>
        </div>

        <div className="citas-actions">
          <button className="btn-nueva-cita" onClick={abrirCrear}>
            <i className="fas fa-plus-circle"></i>
            Agendar Nueva Cita
          </button>
          <button
            className={`btn-historial-citas ${verHistorial ? "activo" : ""}`}
            onClick={toggleHistorial}
          >
            <i className={`fas ${verHistorial ? "fa-calendar" : "fa-history"}`}></i>
            {verHistorial ? "Ver Citas Activas" : "Historial de Citas"}
          </button>
        </div>

        {/* MODAL */}
        {modalOpen && (
          <div className="modal-cita" onClick={cerrarModal}>
            <div
              className="modal-cita-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`modal-cita-header ${modalModo === "modificar" ? "bg-warning" : ""}`}
              >
                <h2>
                  <i
                    className={`fas ${modalModo === "crear" ? "fa-calendar-plus" : "fa-edit"}`}
                  ></i>
                  {modalModo === "crear" ? "Agendar Cita" : "Modificar Cita"}
                </h2>
                <span className="close-modal" onClick={cerrarModal}>
                  &times;
                </span>
              </div>

              <div className="modal-cita-body">
                <form
                  onSubmit={
                    modalModo === "crear" ? reservarCita : modificarCita
                  }
                >
                  {/* SEDE - NUEVO CAMPO */}
                  <div className="form-group-cita">
                    <label>
                      <i className="fas fa-building"></i>
                      Sede
                    </label>
                    <select
                      value={form.id_sede}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          id_sede: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Selecciona sede</option>
                      {sedes.map((s) => (
                        <option key={s.id_sede} value={s.id_sede}>
                          {s.nombre} - {s.ubicacion} (Capacidad:{" "}
                          {s.capacidad_slots})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SERVICIO */}
                  <div className="form-group-cita">
                    <label>
                      <i className="fas fa-stethoscope"></i>
                      Servicio
                    </label>
                    <select
                      value={form.id_servicio}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          id_servicio: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Selecciona servicio</option>
                      {servicios.map((s) => (
                        <option key={s.id_servicio} value={s.id_servicio}>
                          {s.servicio}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* MEDICO */}
                  <div className="form-group-cita">
                    <label>
                      <i className="fas fa-user-md"></i>
                      Médico
                    </label>
                    <select
                      value={form.id_medico}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          id_medico: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Selecciona médico</option>
                      {medicos.map((m) => (
                        <option key={m.id_medico} value={m.id_medico}>
                          {m.nombre_completo}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* FECHA Y HORA */}
                  <div className="form-row-cita">
                    <div className="form-group-cita">
                      <label>
                        <i className="fas fa-calendar-day"></i>
                        Fecha
                      </label>
                      <input
                        type="date"
                        min={minDate}
                        value={form.fecha}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            fecha: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="form-group-cita">
                      <label>
                        <i className="fas fa-clock"></i>
                        Hora
                      </label>
                      <select
                        value={form.hora}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            hora: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Selecciona hora</option>
                        {horariosDisponibles.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* MOTIVO */}
                  <div className="form-group-cita">
                    <label>
                      <i className="fas fa-comment"></i>
                      Motivo
                    </label>
                    <textarea
                      value={form.motivo_consulta}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          motivo_consulta: e.target.value,
                        })
                      }
                      placeholder="Describe tu consulta médica..."
                    />
                  </div>

                  <button
                    type="submit"
                    className={
                      modalModo === "crear"
                        ? "btn-guardar-cita"
                        : "btn-modificar-cita"
                    }
                  >
                    <i className="fas fa-save"></i>
                    {modalModo === "crear"
                      ? "Reservar Cita"
                      : "Guardar Cambios"}
                  </button>
                </form>

                {mensaje.texto && (
                  <div className={`mensaje-cita ${mensaje.tipo}`}>
                    {mensaje.texto}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LISTADO */}
        <div className="citas-grid">
          {(verHistorial ? citasHistorial : citas).length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-calendar-alt"></i>
              <h3>{verHistorial ? "No hay historial de citas" : "No tienes citas"}</h3>
              <p>{verHistorial ? "Aún no tienes citas finalizadas o canceladas" : "Agenda tu primera cita médica"}</p>
              {!verHistorial && (
                <button className="btn-nueva-cita" onClick={abrirCrear}>
                  Agendar Cita
                </button>
              )}
            </div>
          ) : (
            (verHistorial ? citasHistorial : citas).map((cita) => (
              <div
                key={cita.id_cita}
                className={`cita-card estado-${cita.estado.toLowerCase()} ${
                  citaExpirada(cita.fecha_inicio) ? "cita-expirada" : ""
                }`}
              >
                <div className="cita-header">
                  <span className="cita-especialidad">
                    <i className="fas fa-stethoscope"></i>
                    {cita.servicio}
                  </span>
                  <span
                    className={`estado-badge ${getEstadoBadgeClass(cita.estado)}`}
                  >
                    {cita.estado}
                  </span>
                </div>

                <div className="cita-info">
                  <p>
                    <i className="fas fa-calendar-day"></i>
                    {new Date(cita.fecha_inicio).toLocaleDateString()}
                  </p>
                  <p>
                    <i className="fas fa-clock"></i>
                    {new Date(cita.fecha_inicio).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p>
                    <i className="fas fa-user-md"></i>
                    {cita.medico}
                  </p>
                </div>

                <div className="cita-acciones">
                  {/* CONFIRMADA (solo en vista activa) */}
                  {!verHistorial && cita.estado === "Confirmada" && (
                    <>
                      <div className="cita-confirmada-box">
                        <div className="cita-confirmada-info">
                          <i className="fas fa-check-circle"></i>
                          Cita confirmada
                        </div>
                        <div className="ticket-cita">
                          <span className="ticket-label">Número de cita</span>
                          <span className="ticket-id">#{cita.id_cita}</span>
                        </div>
                      </div>
                      <button
                        className="btn-accion-cita btn-cancelar"
                        onClick={() => handleCancelarCita(cita.id_cita)}
                      >
                        <i className="fas fa-times"></i>
                        Cancelar Cita
                      </button>
                    </>
                  )}

                  {/* HISTORIAL: solo citas atendidas */}
                  {verHistorial && cita.estado === "Atendida" && cita.historial && (
                    <div className="cita-historial-box">
                      <div className="historial-detalles">
                        <p><strong>Diagnóstico:</strong> {cita.historial.diagnostico || "No registrado"}</p>
                        <p><strong>Síntomas:</strong> {cita.historial.sintomas || "No registrado"}</p>
                        {cita.historial.notas_doctor && (
                          <p><strong>Notas del doctor:</strong> {cita.historial.notas_doctor}</p>
                        )}
                        {(() => {
                          if (!cita.historial.signos_vitales) return null
                          try {
                            const sv = JSON.parse(cita.historial.signos_vitales)
                            const entries = Object.entries(LABEL_SIGNOS).filter(([k]) => sv[k] !== null && sv[k] !== '')
                            if (entries.length === 0) return null
                            return (
                              <div className="signos-vitales-list" style={{ marginTop: '6px' }}>
                                <strong>Signos Vitales:</strong>
                                <div className="signos-grid-mini" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                  {entries.map(([key, label]) => (
                                    <span key={key} className="signo-item" style={{ background: 'var(--color-card-bg)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.82rem' }}>
                                      {label}: <strong>{sv[key]}</strong> {UNIDAD_SIGNOS[key]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          } catch { return null }
                        })()}
                        {cita.historial.orden_receta && (
                          <p>
                            <strong>Receta:</strong>{" "}
                            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                              {cita.historial.orden_receta}
                            </span>
                          </p>
                        )}
                        {cita.historial.medicamentos && cita.historial.medicamentos.length > 0 && (
                          <div style={{ marginTop: "8px" }}>
                            <strong>Medicamentos recetados:</strong>
                            <ul style={{ margin: "4px 0 0 16px", fontSize: "0.85rem" }}>
                              {cita.historial.medicamentos.map((med: any, i: number) => (
                                <li key={i}>
                                  {med.nombre || med.medicamento} — {med.dosis} c/{med.frecuencia || med.cada} hrs
                                  {med.duracion ? ` por ${med.duracion} días` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {cita.historial.proxima_cita && (
                          <p style={{ marginTop: "8px" }}>
                            <strong>Próxima cita:</strong>{" "}
                            {new Date(cita.historial.proxima_cita).toLocaleDateString()}
                          </p>
                        )}
                        <button
                          className="btn-detalle"
                          onClick={() => { setSelectedHistorial(cita.historial); setShowModalHistorial(true) }}
                          style={{ marginTop: '8px', padding: '4px 12px', fontSize: '0.82rem', cursor: 'pointer' }}
                        >
                          <i className="fas fa-eye"></i> Ver Detalle Completo
                        </button>
                      </div>
                    </div>
                  )}
                  {verHistorial && cita.estado === "Cancelada" && (
                    <div className="cita-historial-box">
                      <p style={{ margin: "4px 0", color: "#666", fontSize: "0.85rem" }}>
                        <i className="fas fa-info-circle"></i>{" "}
                        Cancelada: {cita.motivo_cancelacion || "Sin motivo"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal detalle completo historial */}
      {showModalHistorial && selectedHistorial && (
        <div className="modal-overlay" onClick={() => setShowModalHistorial(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}><i className="fas fa-file-medical"></i> Detalle de Consulta</h2>
              <button className="modal-close" onClick={() => setShowModalHistorial(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><strong>Servicio:</strong> {selectedHistorial.servicio || selectedHistorial.servicio_nombre}</div>
              <div><strong>Médico:</strong> {selectedHistorial.medico_atendio || selectedHistorial.medico}</div>
              <div><strong>Fecha:</strong> {new Date(selectedHistorial.fecha_atencion).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div><strong>Motivo:</strong> {selectedHistorial.motivo_consulta || 'No especificado'}</div>
            </div>

            <hr style={{ margin: '16px 0', borderColor: 'var(--color-border)' }} />

            <div><strong>Diagnóstico:</strong> {selectedHistorial.diagnostico || 'No registrado'}</div>
            <div style={{ marginTop: '8px' }}><strong>Síntomas:</strong> {selectedHistorial.sintomas || 'No registrados'}</div>

            {(() => {
              if (!selectedHistorial.signos_vitales) return null
              try {
                const sv = JSON.parse(selectedHistorial.signos_vitales)
                const entries = Object.entries(LABEL_SIGNOS).filter(([k]) => sv[k] !== null && sv[k] !== '')
                if (entries.length === 0) return null
                return (
                  <div style={{ marginTop: '12px' }}>
                    <strong>Signos Vitales:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {entries.map(([key, label]) => (
                        <span key={key} style={{ background: 'var(--color-card-bg)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                          {label}: <strong>{sv[key]}</strong> {UNIDAD_SIGNOS[key]}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              } catch { return null }
            })()}

            {selectedHistorial.notas_doctor && (
              <div style={{ marginTop: '12px' }}>
                <strong>Notas del doctor:</strong> {selectedHistorial.notas_doctor}
              </div>
            )}

            {(() => {
              if (!selectedHistorial.medicamentos) return null
              const meds = typeof selectedHistorial.medicamentos === 'string'
                ? JSON.parse(selectedHistorial.medicamentos)
                : selectedHistorial.medicamentos
              if (!Array.isArray(meds) || meds.length === 0) return null
              return (
                <div style={{ marginTop: '16px' }}>
                  <strong>Medicamentos recetados:</strong>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Medicamento</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Indicaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meds.map((med: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}><strong>{med.nombre || med.medicamento}</strong></td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>
                            {med.dosis} c/{med.frecuencia || med.cada} hrs{med.duracion ? ` x ${med.duracion} días` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {selectedHistorial.orden_receta && (
              <div style={{ marginTop: '12px' }}>
                <strong>Receta:</strong> <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{selectedHistorial.orden_receta}</span>
              </div>
            )}

            {selectedHistorial.proxima_cita && (
              <div style={{ marginTop: '12px' }}>
                <strong>Próxima cita:</strong> {new Date(selectedHistorial.proxima_cita).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
