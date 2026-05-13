import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, tienePermiso } from "../../context/AuthContext";
import "../../assets/styles/recepcion.css";

const API_BASE = "http://localhost:8080";

interface Ticket {
  id_ticket: number;
  codigo_ticket: string;
  prioridad: string;
  estado?: string;
  estado_ticket?: number | string;
  paciente?: string;
  id_paciente?: number;
  servicio?: string;
  minutos_para_cita?: number;
}

function estadoDeTicket(t: Ticket): string {
  const e = t.estado ?? t.estado_ticket;
  if (typeof e === "number") {
    const map = ["EN_ESPERA", "LLAMADO", "EN_ATENCION", "FINALIZADO", "NO_SHOW"];
    return map[e - 1] || String(e);
  }
  return String(e || "EN_ESPERA").toUpperCase();
}

function ticketActivoEnCola(t: Ticket): boolean {
  const e = estadoDeTicket(t);
  return e !== "FINALIZADO" && e !== "NO_SHOW";
}

export default function RecepcionPage() {
  const { isLoggedIn, userRolId } = useAuth();
  const navigate = useNavigate();

  const [idSede, setIdSede] = useState("1");
  const [idServicio, setIdServicio] = useState("");
  const [serviciosCola, setServiciosCola] = useState<{ id_servicio: number; servicio: string }[]>([]);
  const [cargandoServiciosCola, setCargandoServiciosCola] = useState(true);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [prioridad, setPrioridad] = useState("NORMAL");
  const [idCita, setIdCita] = useState("");
  const [mensajeTicket, setMensajeTicket] = useState({ texto: "", tipo: "" });
  const [mensajeLlamar, setMensajeLlamar] = useState({ texto: "", tipo: "" });
  const [mensajeAccion, setMensajeAccion] = useState({ texto: "", tipo: "" });
  const [generando, setGenerando] = useState(false);
  const [llamando, setLlamando] = useState(false);
  const [ticketActual, setTicketActual] = useState<Ticket | null>(null);
  const [cola, setCola] = useState<Ticket[]>([]);
  const [contadorCola, setContadorCola] = useState(0);
  const [tiempoLlamado, setTiempoLlamado] = useState(0);
  const [timerActivo, setTimerActivo] = useState(false);
  const [colaSeleccion, setColaSeleccion] = useState<Ticket | null>(null);
  const [detallePaciente, setDetallePaciente] = useState<Record<string, unknown> | null>(null);
  const [cargandoPaciente, setCargandoPaciente] = useState(false);
  const colaCardRef = useRef<HTMLDivElement>(null);

  const cerrarDetalleCola = useCallback(() => {
    setColaSeleccion(null);
    setDetallePaciente(null);
    setCargandoPaciente(false);
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargandoServiciosCola(true);
      try {
        const res = await fetch(`${API_BASE}/api/citas/servicios`);
        const data = await res.json();
        if (cancel || !data.success) return;
        const list = (data.data || []).map((s: { id_servicio: number; servicio?: string; nombre?: string }) => ({
          id_servicio: Number(s.id_servicio),
          servicio: String(s.servicio ?? s.nombre ?? `Servicio ${s.id_servicio}`),
        }));
        setServiciosCola(list);
        setIdServicio((prev) => {
          if (list.length === 0) return "";
          if (prev && list.some((x) => String(x.id_servicio) === prev)) return prev;
          return String(list[0].id_servicio);
        });
      } catch {
        if (!cancel) setServiciosCola([]);
      } finally {
        if (!cancel) setCargandoServiciosCola(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!tienePermiso(userRolId, "VER_RECEPCION")) { navigate("/"); }
  }, [isLoggedIn, userRolId, navigate]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActivo && ticketActual) {
      setTiempoLlamado(0);
      interval = setInterval(() => {
        setTiempoLlamado((prev) => {
          if (prev >= 300) { clearInterval(interval); handleNoShowAutomatico(); return 0; }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActivo, ticketActual]);

  const handleNoShowAutomatico = async () => {
    if (!ticketActual) return;
    await cambiarEstadoPorId(ticketActual.id_ticket, "NO_SHOW", "Paciente no se presentó en 5 minutos");
    setMensajeAccion({ texto: `⚠️ Ticket ${ticketActual.codigo_ticket} marcado como No Show.`, tipo: "error" });
  };

  const getAuthHeaders = () => {
    const userId = localStorage.getItem('user_id') || '';
    const token = btoa(userId + ':');
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  };

  const generarUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

  const cargarPacienteSeleccion = async (ticket: Ticket) => {
    setCargandoPaciente(true);
    setDetallePaciente(null);
    try {
      const q = new URLSearchParams({
        codigo_ticket: ticket.codigo_ticket,
        id_ticket: String(ticket.id_ticket),
      });
      const res = await fetch(`${API_BASE}/api/tickets/paciente-por-codigo?${q}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setDetallePaciente(data.data);
      else setMensajeAccion({ texto: data.error || "No se pudo cargar el paciente", tipo: "error" });
    } catch {
      setMensajeAccion({ texto: "Error de conexión al cargar paciente", tipo: "error" });
    } finally {
      setCargandoPaciente(false);
    }
  };

  const cargarColaConGracia = useCallback(async () => {
    if (!idSede) return;
    try {
      const fecha = encodeURIComponent(new Date().toISOString());
      const colaPubQs = new URLSearchParams({ id_sede: idSede });
      if (idServicio.trim() !== "") colaPubQs.set("id_servicio", idServicio);
      const [resActuales, resPublica] = await Promise.all([
        fetch(`${API_BASE}/api/tickets/cola-actuales?id_sede=${idSede}&fecha_hora=${fecha}&minutos_gracia=5`),
        fetch(`${API_BASE}/api/pantalla/cola?${colaPubQs}`),
      ]);
      const dataActuales = await resActuales.json();
      const dataPublica = await resPublica.json();

      const byId = new Map<number, Ticket>();

      for (const t of dataActuales.data || []) {
        const row = t as Ticket;
        byId.set(row.id_ticket, { ...row, estado: estadoDeTicket(row) });
      }

      if (dataPublica.success) {
        const llamado = dataPublica.data?.llamado_actual as Ticket | null;
        if (llamado?.id_ticket && ticketActivoEnCola(llamado) && !byId.has(llamado.id_ticket)) {
          byId.set(llamado.id_ticket, { ...llamado, estado: estadoDeTicket(llamado) });
        }
        const proximos = (dataPublica.data?.proximos || []) as Ticket[];
        for (const t of proximos) {
          if (!byId.has(t.id_ticket) && ticketActivoEnCola(t)) {
            byId.set(t.id_ticket, { ...t, estado: estadoDeTicket(t) });
          }
        }
      }

      const merged = [...byId.values()];
      const activos = merged.filter(ticketActivoEnCola);
      setCola(activos);
      setContadorCola(activos.length);

      setColaSeleccion((prev) => {
        if (!prev) return null;
        return activos.find((x) => x.id_ticket === prev.id_ticket) ?? null;
      });
    } catch (error) { console.error("Error cargando cola:", error); }
  }, [idSede, idServicio]);

  useEffect(() => {
    cargarColaConGracia();
    const interval = setInterval(cargarColaConGracia, 5000);
    return () => clearInterval(interval);
  }, [cargarColaConGracia]);

  useEffect(() => {
    if (!colaSeleccion) return;
    const handleMouseDown = (e: MouseEvent) => {
      const root = colaCardRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) {
        cerrarDetalleCola();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [colaSeleccion, cerrarDetalleCola]);

  const seleccionarFilaCola = (ticket: Ticket) => {
    if (colaSeleccion?.id_ticket === ticket.id_ticket) {
      cerrarDetalleCola();
      return;
    }
    setColaSeleccion(ticket);
    setDetallePaciente(null);
    void cargarPacienteSeleccion(ticket);
  };

  const generarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombres || !apellidos || !idSede || !idServicio) {
      setMensajeTicket({ texto: "Completa nombre, apellidos, sede y servicio", tipo: "error" }); return;
    }
    setGenerando(true);
    const body: Record<string, unknown> = {
      nombres,
      apellidos,
      id_sede: parseInt(idSede),
      id_servicio: parseInt(idServicio, 10),
      prioridad,
    };
    if (idCita) body.id_cita = parseInt(idCita);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/generar`, {
        method: "POST", headers: { ...getAuthHeaders(), "Idempotency-Key": generarUUID() }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.status === 201) {
        setMensajeTicket({ texto: `Ticket ${data.data.codigo_ticket} generado`, tipo: "success" });
        setNombres(""); setApellidos(""); setPrioridad("NORMAL"); setIdCita(""); cargarColaConGracia();
      } else { setMensajeTicket({ texto: data.error || "Error", tipo: "error" }); }
    } catch { setMensajeTicket({ texto: "Error de conexión", tipo: "error" }); }
    finally { setGenerando(false); }
  };

  const actualizarTicketLocal = (id_ticket: number, patch: Partial<Ticket>) => {
    setCola((prev) => prev.map((t) => (t.id_ticket === id_ticket ? { ...t, ...patch } : t)));
    setColaSeleccion((prev) => (prev?.id_ticket === id_ticket ? { ...prev, ...patch } : prev));
    setTicketActual((prev) => (prev?.id_ticket === id_ticket ? { ...prev, ...patch } : prev));
  };

  const cambiarEstadoPorId = async (
    id_ticket: number,
    nuevoEstado: string,
    motivo?: string,
    snapshot?: Ticket | null
  ) => {
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id_ticket}/cambiar-estado`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ nuevo_estado: nuevoEstado, motivo: motivo || null })
      });
      const data = await res.json();
      if (data.success) {
        setMensajeAccion({ texto: `Ticket actualizado a ${nuevoEstado}`, tipo: "success" });
        actualizarTicketLocal(id_ticket, { estado: nuevoEstado });
        if (nuevoEstado === "FINALIZADO" || nuevoEstado === "NO_SHOW") {
          if (ticketActual?.id_ticket === id_ticket) {
            setTicketActual(null); setTimerActivo(false); setTiempoLlamado(0);
          }
          if (colaSeleccion?.id_ticket === id_ticket) {
            setColaSeleccion(null); setDetallePaciente(null);
          }
        }
        if (nuevoEstado === "LLAMADO") {
          const enCola =
            snapshot && snapshot.id_ticket === id_ticket
              ? snapshot
              : colaSeleccion?.id_ticket === id_ticket
                ? colaSeleccion
                : cola.find((c) => c.id_ticket === id_ticket);
          if (enCola) {
            setTicketActual({ ...enCola, estado: "LLAMADO" });
            setTimerActivo(true);
          }
        }
        if (nuevoEstado === "EN_ESPERA") {
          if (ticketActual?.id_ticket === id_ticket) {
            setTicketActual(null);
            setTimerActivo(false);
            setTiempoLlamado(0);
          }
        }
        cargarColaConGracia();
        return true;
      }
      setMensajeAccion({ texto: data.error || "Error", tipo: "error" });
      return false;
    } catch {
      setMensajeAccion({ texto: "Error de conexión", tipo: "error" });
      return false;
    }
  };

  const llamarTicketSeleccion = async () => {
    if (!colaSeleccion) return;
    await cambiarEstadoPorId(colaSeleccion.id_ticket, "LLAMADO", undefined, colaSeleccion);
  };

  const regresarAEspera = async () => {
    if (!ticketActual) return;
    await cambiarEstadoPorId(ticketActual.id_ticket, "EN_ESPERA", "Error de selección - regresa a cola");
    setMensajeAccion({ texto: `Ticket regresado a cola de espera`, tipo: "info" });
  };

  const cancelarTicket = async (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Cancelar ticket ${ticket.codigo_ticket}?`)) return;
    await cambiarEstadoPorId(ticket.id_ticket, "NO_SHOW", "Cancelado por recepción");
    setMensajeAccion({ texto: `Ticket cancelado`, tipo: "success" });
  };

  const llamarSiguiente = async () => {
    if (!idSede || !idServicio) { setMensajeLlamar({ texto: "Selecciona sede y servicio", tipo: "error" }); return; }
    setLlamando(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/siguiente`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ id_sede: parseInt(idSede), id_servicio: parseInt(idServicio) })
      });
      const data = await res.json();
      if (res.status === 200) {
        setMensajeLlamar({ texto: `Llamando ${data.data.codigo_ticket}`, tipo: "success" });
        setTicketActual({ ...data.data, estado: "LLAMADO" });
        setTimerActivo(true); cargarColaConGracia();
      } else if (res.status === 404) { setMensajeLlamar({ texto: "No hay pacientes", tipo: "info" }); }
      else { setMensajeLlamar({ texto: data.error || "Error", tipo: "error" }); }
    } catch { setMensajeLlamar({ texto: "Error de conexión", tipo: "error" }); }
    finally { setLlamando(false); }
  };

  const cambiarEstado = async (nuevoEstado: string, motivo?: string) => {
    if (!ticketActual) return;
    await cambiarEstadoPorId(ticketActual.id_ticket, nuevoEstado, motivo);
  };

  const nombrePacienteDetalle = () => {
    if (!detallePaciente) return null;
    const nc = detallePaciente.nombre_completo as string | undefined;
    if (nc && String(nc).trim()) return String(nc).trim();
    const ap = detallePaciente as Record<string, string>;
    const n = ap.nombres ?? "";
    const apellido = ap.apellidos ?? ap.apellido ?? "";
    const joined = `${n} ${apellido}`.trim();
    return joined || null;
  };

  const minutos = Math.floor(tiempoLlamado / 60);
  const segundos = tiempoLlamado % 60;
  const estSel = colaSeleccion ? estadoDeTicket(colaSeleccion) : "";

  return (
    <div className="recepcion-page">
      <div className="recepcion-container">
        <div className="recepcion-titulo">
          <h1><i className="fas fa-concierge-bell"></i> Panel de Recepción</h1>
          <p>Gestión de tickets y cola de atención</p>
          <button className="btn-pantalla" onClick={() => {
            const qs = new URLSearchParams({ id_sede: idSede });
            if (idServicio.trim() !== "") qs.set("id_servicio", idServicio);
            window.open(`/pantalla?${qs}`, "PantallaPublica", "fullscreen=yes,menubar=no,toolbar=no,location=no,status=no,titlebar=no");
          }}>
            <i className="fas fa-tv"></i> Abrir Pantalla Pública
          </button>
        </div>

        {timerActivo && ticketActual && (
          <div style={{
            background: tiempoLlamado > 240 ? "#dc3545" : "#fff3cd",
            color: tiempoLlamado > 240 ? "white" : "#856404",
            padding: "10px 20px", borderRadius: 10, marginBottom: 20, textAlign: "center", fontWeight: 700,
            animation: tiempoLlamado > 240 ? "pulse 0.5s infinite" : "none"
          }}>
            <i className="fas fa-hourglass-half"></i> Ticket {ticketActual.codigo_ticket} llamado hace {minutos}:{segundos.toString().padStart(2, "0")}
            {tiempoLlamado > 240 && " - ¡Se marcará como No Show!"}
          </div>
        )}

        <div className="panel-grid">
          <div className="panel-left">
            <div className="panel-card">
              <div className="card-header"><i className="fas fa-ticket-alt"></i><h2>Generar Ticket</h2></div>
              <div className="card-body">
                <form onSubmit={generarTicket}>
                  <div className="form-group"><label><i className="fas fa-building"></i> Sede</label>
                    <select value={idSede} onChange={e => setIdSede(e.target.value)} required>
                      <option value="1">Sede Zona 19</option><option value="2">Sede Zona 10</option>
                    </select></div>
                  <div className="form-group"><label><i className="fas fa-stethoscope"></i> Servicio (cola pública)</label>
                    <select value={idServicio} onChange={e => setIdServicio(e.target.value)} required disabled={cargandoServiciosCola || serviciosCola.length === 0}>
                      {cargandoServiciosCola && <option value="">Cargando servicios…</option>}
                      {!cargandoServiciosCola && serviciosCola.length === 0 && <option value="">Sin servicios en catálogo</option>}
                      {!cargandoServiciosCola && serviciosCola.map((s) => (
                        <option key={s.id_servicio} value={String(s.id_servicio)}>{s.servicio}</option>
                      ))}
                    </select></div>
                  <div className="form-group"><label><i className="fas fa-user"></i> Nombres</label>
                    <input type="text" value={nombres} onChange={e => setNombres(e.target.value)} placeholder="Ej: Maria" required /></div>
                  <div className="form-group"><label><i className="fas fa-user"></i> Apellidos</label>
                    <input type="text" value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Ej: Lopez" required /></div>
                  <div className="form-group"><label><i className="fas fa-sort-amount-up"></i> Prioridad</label>
                    <select value={prioridad} onChange={e => setPrioridad(e.target.value)} required>
                      <option value="NORMAL">Normal</option><option value="ANCIANO">Adulto Mayor</option>
                      <option value="EMBARAZO">Embarazo</option><option value="DISCAPACIDAD">Discapacidad</option>
                      <option value="ESPECIAL">ESPECIAL</option></select></div>
                  <div className="form-group"><label><i className="fas fa-calendar-check"></i> ID Cita (opcional)</label>
                    <input type="number" value={idCita} onChange={e => setIdCita(e.target.value)} placeholder="ID de cita confirmada" /></div>
                  {mensajeTicket.texto && <div className={`mensaje ${mensajeTicket.tipo}`}>{mensajeTicket.texto}</div>}
                  <button type="submit" className="btn-generar" disabled={generando}>
                    {generando ? <><i className="fas fa-spinner fa-spin"></i> Generando...</> : <><i className="fas fa-plus-circle"></i> Generar Ticket</>}
                  </button>
                </form>
              </div>
            </div>

            <div className="panel-card">
              <div className="card-header verde"><i className="fas fa-bullhorn"></i><h2>Llamar Siguiente (Auto)</h2></div>
              <div className="card-body llamar-body">
                <p className="llamar-desc">Llama al siguiente según prioridad</p>
                <button className="btn-llamar" onClick={llamarSiguiente} disabled={llamando}>
                  {llamando ? <><i className="fas fa-spinner fa-spin"></i> Llamando...</> : <><i className="fas fa-bullhorn"></i> Llamar Siguiente</>}
                </button>
                {mensajeLlamar.texto && <div className={`mensaje ${mensajeLlamar.tipo}`}>{mensajeLlamar.texto}</div>}
              </div>
            </div>
          </div>

          <div className="panel-right">
            <div className="panel-card">
              <div className="card-header naranja"><i className="fas fa-user-clock"></i><h2>Ticket Actual</h2></div>
              <div className="card-body">
                {!ticketActual ? (
                  <div className="ticket-actual-vacio"><i className="fas fa-inbox"></i><p>Sin ticket en atención</p></div>
                ) : (
                  <>
                    <div className="ticket-info-card">
                      <div className="ticket-codigo-grande">{ticketActual.codigo_ticket}</div>
                      <div className="ticket-detalle">
                        <p><i className="fas fa-user"></i> <strong>Paciente:</strong> {ticketActual.paciente || `ID: ${ticketActual.id_paciente}`}</p>
                        <p><i className="fas fa-sort-amount-up"></i> <strong>Prioridad:</strong> <span className={`prioridad-badge prior-${ticketActual.prioridad}`}>{ticketActual.prioridad}</span></p>
                        <p><i className="fas fa-clock"></i> <strong>Estado:</strong> {estadoDeTicket(ticketActual)}</p>
                      </div>
                    </div>
                    <div className="acciones-ticket">
                      {estadoDeTicket(ticketActual) === "LLAMADO" && (<>
                        <button className="btn-accion btn-en-atencion" onClick={() => cambiarEstado("EN_ATENCION")}><i className="fas fa-user-check"></i> En Atención</button>
                        <button className="btn-accion btn-no-show" onClick={() => { if (confirm("¿Marcar como No Show?")) cambiarEstado("NO_SHOW", "Paciente no se presentó"); }}><i className="fas fa-user-slash"></i> No Show</button>
                        <button className="btn-accion" style={{ background: '#6C757D', color: 'white' }} onClick={regresarAEspera}><i className="fas fa-undo"></i> Volver a cola</button>
                      </>)}
                      {estadoDeTicket(ticketActual) === "EN_ATENCION" && (
                        <button className="btn-accion btn-finalizar" onClick={() => { if (confirm("¿Finalizar ticket? El paciente ya fue atendido; saldrá de la cola pública.")) cambiarEstado("FINALIZADO", "Atención médica completada"); }}><i className="fas fa-check-circle"></i> Finalizar atención</button>
                      )}
                    </div>
                  </>
                )}
                {mensajeAccion.texto && <div className={`mensaje ${mensajeAccion.tipo}`}>{mensajeAccion.texto}</div>}
              </div>
            </div>

            <div className="panel-card" ref={colaCardRef}>
              <div className="card-header"><i className="fas fa-list-ol"></i><h2>Cola de Espera (Hoy)</h2><span className="badge-contador">{contadorCola}</span></div>
              <div className="card-body">
                <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>
                  Lista unificada (citas del momento + cola pública). Solo turnos en espera, llamados o en atención.
                  Pulse una fila para ver el paciente; pulse de nuevo la misma fila, use Cerrar o haga clic fuera de esta tarjeta para ocultar el panel.
                </p>
                {cola.length === 0 ? (
                  <div className="cola-vacia"><i className="fas fa-check-circle"></i><p>Cola vacía</p></div>
                ) : (
                  cola.map((t, i) => (
                    <div
                      key={t.id_ticket}
                      className={`cola-item prior-${t.prioridad}${colaSeleccion?.id_ticket === t.id_ticket ? " cola-item-seleccionado" : ""}`}
                      onClick={() => seleccionarFilaCola(t)}
                      style={{ cursor: "pointer", position: "relative" }}
                    >
                      <span className="cola-posicion">{i + 1}</span>
                      <span className="cola-codigo">{t.codigo_ticket}</span>
                      <div className="cola-datos" style={{ flex: 1 }}>
                        <p style={{ margin: 0 }}>
                          <span className={`prioridad-badge prior-${t.prioridad}`}>{t.prioridad}</span>
                          <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#555" }}>{estadoDeTicket(t)}</span>
                        </p>
                        {t.minutos_para_cita != null && (
                          <p style={{ fontSize: "0.7rem", color: t.minutos_para_cita < 0 ? "#dc3545" : "#28a745", margin: 0 }}>
                            <i className={`fas ${t.minutos_para_cita < 0 ? "fa-exclamation-circle" : "fa-clock"}`}></i>{" "}
                            {t.minutos_para_cita < 0 ? `${Math.abs(t.minutos_para_cita)} min tarde` : `En ${t.minutos_para_cita} min`}
                          </p>
                        )}
                      </div>
                      <button className="btn-accion btn-no-show" style={{ fontSize: '0.7rem', padding: '4px 10px', minWidth: 'auto' }}
                        onClick={(e) => cancelarTicket(t, e)} title="Cancelar ticket">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))
                )}

                {colaSeleccion && (
                  <div className="cola-detalle-seleccion" style={{
                    marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #dee2e6",
                    background: "#f8f9fa"
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong><i className="fas fa-id-card"></i> {colaSeleccion.codigo_ticket}</strong>
                        <span style={{ marginLeft: 10, fontSize: "0.85rem" }}>Estado: {estSel}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-cerrar-detalle-cola"
                        onClick={(e) => { e.stopPropagation(); cerrarDetalleCola(); }}
                        title="Cerrar sin cambiar el ticket"
                      >
                        <i className="fas fa-times"></i> Cerrar
                      </button>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      {cargandoPaciente && <p style={{ margin: 0, color: "#666" }}><i className="fas fa-spinner fa-spin"></i> Cargando paciente…</p>}
                      {!cargandoPaciente && nombrePacienteDetalle() && (
                        <p style={{ margin: "8px 0", fontSize: "1.05rem" }}><i className="fas fa-user"></i> {nombrePacienteDetalle()}</p>
                      )}
                      {!cargandoPaciente && detallePaciente === null && (
                        <p style={{ margin: 0, color: "#999", fontSize: "0.9rem" }}>Sin datos de paciente para este id_ticket.</p>
                      )}
                    </div>
                    <div className="acciones-ticket" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
                      {estSel === "EN_ESPERA" && (
                        <button type="button" className="btn-accion btn-llamar" onClick={llamarTicketSeleccion}><i className="fas fa-bullhorn"></i> Llamar</button>
                      )}
                      {estSel === "LLAMADO" && (
                        <>
                          <button type="button" className="btn-accion btn-en-atencion" onClick={() => void cambiarEstadoPorId(colaSeleccion.id_ticket, "EN_ATENCION")}><i className="fas fa-user-check"></i> En atención</button>
                          <button type="button" className="btn-accion" style={{ background: "#6C757D", color: "white" }} onClick={() => void cambiarEstadoPorId(colaSeleccion.id_ticket, "EN_ESPERA", "Regreso a cola")}><i className="fas fa-undo"></i> En espera</button>
                        </>
                      )}
                      {(estSel === "EN_ESPERA" || estSel === "LLAMADO") && (
                        <button type="button" className="btn-accion btn-no-show" onClick={() => { if (confirm("¿No show?")) void cambiarEstadoPorId(colaSeleccion.id_ticket, "NO_SHOW"); }}><i className="fas fa-user-slash"></i> No show</button>
                      )}
                      {estSel === "EN_ATENCION" && (
                        <button type="button" className="btn-accion btn-finalizar" onClick={() => { if (confirm("¿Finalizar ticket? El paciente ya fue atendido; saldrá de la cola pública.")) void cambiarEstadoPorId(colaSeleccion.id_ticket, "FINALIZADO", "Atención médica completada"); }}><i className="fas fa-check-circle"></i> Finalizar atención</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
