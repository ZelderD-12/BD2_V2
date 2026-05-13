import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, tienePermiso } from "../../context/AuthContext";
import "../../assets/styles/recepcion.css";

const API_BASE = "http://localhost:8080";

interface Ticket {
  id_ticket: number;
  codigo_ticket: string;
  prioridad: string;
  estado: string;
  paciente?: string;
  id_paciente?: number;
  servicio?: string;
  minutos_para_cita?: number;
}

export default function RecepcionPage() {
  const { isLoggedIn, userRolId } = useAuth();
  const navigate = useNavigate();

  const [idSede, setIdSede] = useState("1");
  const [idServicio, setIdServicio] = useState("1");
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

  useEffect(() => {
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!tienePermiso(userRolId, "VER_RECEPCION")) { navigate("/"); }
  }, [isLoggedIn, userRolId, navigate]);

  useEffect(() => {
    let interval: any;
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
    await cambiarEstado("NO_SHOW", "Paciente no se presentó en 5 minutos");
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

  const cargarColaConGracia = useCallback(async () => {
    if (!idSede) return;
    try {
      const ahora = new Date().toISOString();
      const res = await fetch(
        `${API_BASE}/api/tickets/cola-actuales?id_sede=${idSede}&fecha_hora=${ahora}&minutos_gracia=5`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        setCola(data.data || []);
        setContadorCola(data.data?.length || 0);
        const listos = (data.data || []).filter((t: Ticket) => t.minutos_para_cita != null && t.minutos_para_cita <= 0 && t.minutos_para_cita >= -5);
        if (listos.length > 0 && !ticketActual) {
          await seleccionarTicket(listos[0]);
        }
      }
    } catch (error) { console.error("Error cargando cola:", error); }
  }, [idSede, ticketActual]);

  useEffect(() => {
    cargarColaConGracia();
    const interval = setInterval(cargarColaConGracia, 5000);
    return () => clearInterval(interval);
  }, [cargarColaConGracia]);

  const generarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombres || !apellidos || !idSede) {
      setMensajeTicket({ texto: "Completa nombre, apellidos y sede", tipo: "error" }); return;
    }
    setGenerando(true);
    const body: any = { nombres, apellidos, id_sede: parseInt(idSede), prioridad };
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

  const seleccionarTicket = async (ticket: Ticket) => {
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticket.id_ticket}/cambiar-estado`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ nuevo_estado: "LLAMADO" })
      });
      const data = await res.json();
      if (data.success) {
        setTicketActual({ ...ticket, estado: "LLAMADO" });
        setTimerActivo(true);
        cargarColaConGracia();
        setMensajeAccion({ texto: `Ticket ${ticket.codigo_ticket} llamado`, tipo: "success" });
      } else { setMensajeAccion({ texto: data.error || "Error", tipo: "error" }); }
    } catch { setMensajeAccion({ texto: "Error de conexión", tipo: "error" }); }
  };

  const regresarAEspera = async () => {
    if (!ticketActual) return;
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketActual.id_ticket}/cambiar-estado`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ nuevo_estado: "EN_ESPERA", motivo: "Error de selección - regresa a cola" })
      });
      const data = await res.json();
      if (data.success) {
        setMensajeAccion({ texto: `Ticket regresado a cola de espera`, tipo: "info" });
        setTicketActual(null); setTimerActivo(false); setTiempoLlamado(0);
        cargarColaConGracia();
      } else { setMensajeAccion({ texto: data.error || "Error", tipo: "error" }); }
    } catch { setMensajeAccion({ texto: "Error de conexión", tipo: "error" }); }
  };

  const cancelarTicket = async (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Cancelar ticket ${ticket.codigo_ticket}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticket.id_ticket}/cambiar-estado`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ nuevo_estado: "NO_SHOW", motivo: "Cancelado por recepción" })
      });
      const data = await res.json();
      if (data.success) { setMensajeAccion({ texto: `Ticket cancelado`, tipo: "success" }); cargarColaConGracia(); }
      else { setMensajeAccion({ texto: data.error || "Error", tipo: "error" }); }
    } catch { setMensajeAccion({ texto: "Error de conexión", tipo: "error" }); }
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
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${ticketActual.id_ticket}/cambiar-estado`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ nuevo_estado: nuevoEstado, motivo: motivo || null })
      });
      const data = await res.json();
      if (data.success) {
        setMensajeAccion({ texto: `Ticket actualizado a ${nuevoEstado}`, tipo: "success" });
        if (nuevoEstado === "FINALIZADO" || nuevoEstado === "NO_SHOW") {
          setTicketActual(null); setTimerActivo(false); setTiempoLlamado(0);
        } else { setTicketActual({ ...ticketActual, estado: nuevoEstado }); }
        cargarColaConGracia();
      } else { setMensajeAccion({ texto: data.error || "Error", tipo: "error" }); }
    } catch { setMensajeAccion({ texto: "Error de conexión", tipo: "error" }); }
  };

  const minutos = Math.floor(tiempoLlamado / 60);
  const segundos = tiempoLlamado % 60;

  return (
    <div className="recepcion-page" style={{ marginTop: 120 }}>
      <div className="recepcion-container">
        <div className="recepcion-titulo">
          <h1><i className="fas fa-concierge-bell"></i> Panel de Recepción</h1>
          <p>Gestión de tickets y cola de atención</p>
          <button className="btn-pantalla" onClick={() => {
            window.open(`/pantalla?id_sede=${idSede}&id_servicio=${idServicio}`, "PantallaPublica", "fullscreen=yes,menubar=no,toolbar=no,location=no,status=no,titlebar=no");
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
                        <p><i className="fas fa-clock"></i> <strong>Estado:</strong> {ticketActual.estado}</p>
                      </div>
                    </div>
                    <div className="acciones-ticket">
                      {ticketActual.estado === "LLAMADO" && (<>
                        <button className="btn-accion btn-en-atencion" onClick={() => cambiarEstado("EN_ATENCION")}><i className="fas fa-user-check"></i> En Atención</button>
                        <button className="btn-accion btn-no-show" onClick={() => { if (confirm("¿Marcar como No Show?")) cambiarEstado("NO_SHOW", "Paciente no se presentó"); }}><i className="fas fa-user-slash"></i> No Show</button>
                        <button className="btn-accion" style={{ background: '#6C757D', color: 'white' }} onClick={regresarAEspera}><i className="fas fa-undo"></i> Volver a cola</button>
                      </>)}
                      {ticketActual.estado === "EN_ATENCION" && (
                        <button className="btn-accion btn-finalizar" onClick={() => { if (confirm("¿Finalizar atención?")) cambiarEstado("FINALIZADO"); }}><i className="fas fa-check-circle"></i> Finalizar</button>
                      )}
                    </div>
                  </>
                )}
                {mensajeAccion.texto && <div className={`mensaje ${mensajeAccion.tipo}`}>{mensajeAccion.texto}</div>}
              </div>
            </div>

            <div className="panel-card">
              <div className="card-header"><i className="fas fa-list-ol"></i><h2>Cola de Espera (Hoy)</h2><span className="badge-contador">{contadorCola}</span></div>
              <div className="card-body">
                {cola.length === 0 ? (
                  <div className="cola-vacia"><i className="fas fa-check-circle"></i><p>Cola vacía</p></div>
                ) : (
                  cola.map((t, i) => (
                    <div key={t.id_ticket} className={`cola-item prior-${t.prioridad}`}
                         onClick={() => seleccionarTicket(t)}
                         style={{ cursor: 'pointer', position: 'relative' }}>
                      <span className="cola-posicion">{i + 1}</span>
                      <span className="cola-codigo">{t.codigo_ticket}</span>
                      <div className="cola-datos" style={{ flex: 1 }}>
                        <p><span className={`prioridad-badge prior-${t.prioridad}`}>{t.prioridad}</span></p>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}