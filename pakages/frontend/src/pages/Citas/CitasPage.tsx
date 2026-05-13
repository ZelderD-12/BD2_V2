import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import "../../assets/styles/citas.css";

interface Cita {
  id_cita: number;
  servicio: string;
  medico: string;
  fecha_inicio: string;
  estado: string;
  motivo_consulta: string;
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
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalModo, setModalModo] = useState<"crear" | "modificar">("crear");

  const [citaModificarId, setCitaModificarId] = useState<number | null>(null);

  const [mensaje, setMensaje] = useState({
    texto: "",
    tipo: "",
  });

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);

  const [form, setForm] = useState({
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
  }, [isLoggedIn]);

  const cargarCitas = async () => {
    try {
      const userId =
        localStorage.getItem("user_id") || localStorage.getItem("id_usuario");

      if (userId) {
        const res = await api.getCitasPaciente(parseInt(userId));

        if (res.success) {
          setCitas(res.data || []);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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

    if (!form.id_servicio || !form.id_medico || !form.fecha || !form.hora) {
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
  const handleConfirmarCita = async (idCita: number) => {
    if (!confirm("¿Confirmar esta cita?")) return;

    try {
      const res = await api.confirmarCita(idCita, getUserId());

      if (res.success) {
        setMensaje({
          texto: "✅ Cita confirmada",
          tipo: "success",
        });

        cargarCitas();
      } else {
        setMensaje({
          texto: res.error || "Error al confirmar",
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
      Completada: "estado-ATENDIDA",
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
          {loading ? (
            <div className="loading-spinner">
              <i className="fas fa-spinner fa-spin"></i>
              Cargando citas...
            </div>
          ) : citas.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-calendar-alt"></i>

              <h3>No tienes citas</h3>

              <p>Agenda tu primera cita médica</p>

              <button className="btn-nueva-cita" onClick={abrirCrear}>
                Agendar Cita
              </button>
            </div>
          ) : (
            citas.map((cita) => (
              <div
                key={cita.id_cita}
                className={`cita-card ${
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
                  {/* ======================
                      PENDIENTE
                  ====================== */}
                  {cita.estado === "Pendiente" && (
                    <>
                      <button
                        className="btn-accion-cita btn-confirmar"
                        onClick={() => handleConfirmarCita(cita.id_cita)}
                      >
                        <i className="fas fa-check"></i>
                        Confirmar
                      </button>

                      <button
                        className="btn-accion-cita btn-modificar"
                        onClick={() => abrirModificar(cita)}
                      >
                        <i className="fas fa-edit"></i>
                        Modificar
                      </button>

                      <button
                        className="btn-accion-cita btn-cancelar"
                        onClick={() => handleCancelarCita(cita.id_cita)}
                      >
                        <i className="fas fa-times"></i>
                        Cancelar
                      </button>
                    </>
                  )}

                  {/* ======================
                      CONFIRMADA
                  ====================== */}
                  {cita.estado === "Confirmada" && (
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
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
