import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, tienePermiso } from "../../context/AuthContext";
import "../../assets/styles/recepcion.css";
import "../../assets/styles/citas.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function useAutoClearMessage(delay = 5000) {
  const [msg, setMsg] = useState({ texto: "", tipo: "" });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const setMessage = useCallback((newMsg: { texto: string; tipo: string }) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMsg(newMsg);
    if (newMsg.texto) {
      timerRef.current = setTimeout(() => setMsg({ texto: "", tipo: "" }), delay);
    }
  }, [delay]);
  return [msg, setMessage] as const;
}

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

interface CitaDelDia {
  id_cita: number;
  id_paciente: number;
  paciente_nombre: string;
  email: string;
  id_sede: number;
  sede_nombre: string;
  id_servicio: number;
  servicio_nombre: string;
  id_medico: number;
  medico_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  id_estado_cita: number;
  estado_cita: string;
  motivo_consulta: string;
  tiene_ticket: number;
}

function estadoDeTicket(t: Ticket): string {
  const e = t.estado ?? t.estado_ticket;
  if (typeof e === "number") {
    const map: Record<number, string> = {
      1: "EN_ESPERA", 2: "LLAMADO", 3: "EN_ATENCION",
      4: "FINALIZADO", 5: "NO_SHOW"
    };
    return map[e] || String(e);
  }
  return String(e || "EN_ESPERA").toUpperCase();
}

function ticketActivoEnCola(t: Ticket): boolean {
  const e = estadoDeTicket(t);
  return e === "EN_ESPERA" || e === "LLAMADO";
}

export default function RecepcionPage() {
  const { isLoggedIn, userRolId } = useAuth();
  const navigate = useNavigate();

  const [idSede, setIdSede] = useState("");
  const [idServicio, setIdServicio] = useState("");
  const [serviciosCola, setServiciosCola] = useState<{ id_servicio: number; servicio: string }[]>([]);
  const [cargandoServiciosCola, setCargandoServiciosCola] = useState(true);
  const [sedes, setSedes] = useState<{ id_sede: number; nombre: string }[]>([]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split("T")[0]);

  const [idCita, setIdCita] = useState("");
  const [citaDetalle, setCitaDetalle] = useState<CitaDelDia | null>(null);
  const [buscandoCita, setBuscandoCita] = useState(false);
  const [prioridad, setPrioridad] = useState("NORMAL");

  const [citasDelDia, setCitasDelDia] = useState<CitaDelDia[]>([]);
  const [cargandoCitas, setCargandoCitas] = useState(false);

  const [mensajeTicket, setMensajeTicket] = useAutoClearMessage();
  const [mensajeLlamar, setMensajeLlamar] = useAutoClearMessage();
  const [mensajeAccion, setMensajeAccion] = useAutoClearMessage();
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
  const primeraCargaRef = useRef(true);

  const [modalModificarOpen, setModalModificarOpen] = useState(false);
  const [medicos, setMedicos] = useState<{ id_medico: number; nombre_completo: string }[]>([]);
  const [modForm, setModForm] = useState({ id_servicio: "", id_medico: "", fecha: "", hora: "", motivo_consulta: "" });
  const [modificando, setModificando] = useState(false);

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
        const [servRes, sedeRes, medRes] = await Promise.all([
          fetch(`${API_BASE}/api/citas/servicios`),
          fetch(`${API_BASE}/api/sedes`),
          fetch(`${API_BASE}/api/citas/medicos`),
        ]);
        const servData = await servRes.json();
        const sedeData = await sedeRes.json();
        if (cancel) return;

        if (servData.success) {
          const list = (servData.data || []).map((s: any) => ({
            id_servicio: Number(s.id_servicio),
            servicio: String(s.servicio || s.Nombre_Servicio || s.nombre || `Servicio ${s.id_servicio}`),
          }));
          setServiciosCola(list);
          setIdServicio((prev) => {
            if (list.length === 0) return "";
            if (prev && list.some((x) => String(x.id_servicio) === prev)) return prev;
            return String(list[0].id_servicio);
          });
        }

        if (sedeData.success) {
          const sedesList = (sedeData.data || []).map((s: any) => ({
            id_sede: Number(s.id_sede),
            nombre: String(s.nombre || `Sede ${s.id_sede}`),
          }));
          setSedes(sedesList);
          setIdSede((prev) => {
            if (sedesList.length === 0) return "";
            if (prev && sedesList.some((x) => String(x.id_sede) === prev)) return prev;
            return String(sedesList[0]?.id_sede || "");
          });
        }
        const medData = await medRes.json();
        if (medData.success && !cancel) {
          setMedicos((medData.data || []).map((m: any) => ({
            id_medico: Number(m.id_medico),
            nombre_completo: m.nombre_completo || `${m.nombres || ''} ${m.apellidos || ''}`.trim(),
          })));
        }
      } catch {
          if (!cancel) { setServiciosCola([]); setSedes([]); }
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
      if (primeraCargaRef.current) setTiempoLlamado(0);
      primeraCargaRef.current = false;
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
    await cambiarEstadoPorId(ticketActual.id_ticket, "NO_SHOW", "Paciente no se presento en 5 minutos");
    setMensajeAccion({ texto: "Ticket " + ticketActual.codigo_ticket + " marcado como No Show.", tipo: "error" });
  };

  const getAuthHeaders = () => {
    const userId = localStorage.getItem('user_id') || '';
    const token = btoa(userId + ':');
    return { "Content-Type": "application/json", Authorization: "Bearer " + token };
  };

  // ===== CARGAR CITAS DEL DÍA =====
  const cargarCitasDelDia = useCallback(async () => {
    setCargandoCitas(true);
    try {
      const params = new URLSearchParams();
      if (idSede) params.set("id_sede", idSede);
      if (fechaFiltro) params.set("fecha", fechaFiltro);
      const res = await fetch(`${API_BASE}/api/citas/hoy?${params}`);
      const data = await res.json();
      if (data.success) setCitasDelDia(data.data || []);
    } catch {
      setCitasDelDia([]);
    } finally {
      setCargandoCitas(false);
    }
  }, [idSede, fechaFiltro]);

  useEffect(() => {
    cargarCitasDelDia();
  }, [cargarCitasDelDia]);

  // ===== BUSCAR CITA POR N° =====
  const buscarCita = async (citaId?: string) => {
    const id = citaId || idCita;
    if (!id.trim()) return;
    setBuscandoCita(true);
    setCitaDetalle(null);
    setMensajeTicket({ texto: "", tipo: "" });
    try {
      const res = await fetch(`${API_BASE}/api/citas/${id.trim()}/detalle`);
      const data = await res.json();
      if (data.success && data.data) {
        setCitaDetalle(data.data);
        setMensajeTicket({ texto: "Cita #" + id + " encontrada: " + data.data.nombres + " " + data.data.apellidos, tipo: "success" });
      } else {
        setMensajeTicket({ texto: data.error || "Cita no encontrada", tipo: "error" });
      }
    } catch {
      setMensajeTicket({ texto: "Error de conexion", tipo: "error" });
    } finally {
      setBuscandoCita(false);
    }
  };

  // ===== SELECCIONAR CITA DE LA LISTA =====
  const seleccionarCitaDeLista = (cita: CitaDelDia) => {
    setIdCita(String(cita.id_cita));
    setCitaDetalle(cita);
    setMensajeTicket({ texto: "Cita #" + cita.id_cita + " seleccionada: " + cita.paciente_nombre, tipo: "success" });
  };

  // ===== MODIFICAR CITA =====
  const horarios = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];

  const abrirModificar = () => {
    if (!citaDetalle) return;
    const fecha = citaDetalle.fecha_inicio.split("T")[0];
    const hora = citaDetalle.fecha_inicio.split("T")[1]?.substring(0, 5);
    setModForm({
      id_servicio: String(citaDetalle.id_servicio),
      id_medico: String(citaDetalle.id_medico),
      fecha, hora: hora || "",
      motivo_consulta: citaDetalle.motivo_consulta || ""
    });
    setModalModificarOpen(true);
  };

  const handleModificarCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citaDetalle) return;
    setModificando(true);
    try {
      const fechaHora = `${modForm.fecha}T${modForm.hora}:00`;
      const userId = localStorage.getItem("user_id") || localStorage.getItem("id_usuario");
      const res = await fetch(`${API_BASE}/api/citas/${citaDetalle.id_cita}/modificar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_paciente: citaDetalle.id_paciente,
          nuevo_id_servicio: modForm.id_servicio ? parseInt(modForm.id_servicio) : undefined,
          nuevo_id_medico: modForm.id_medico ? parseInt(modForm.id_medico) : undefined,
          nueva_fecha_inicio: fechaHora,
          motivo_consulta: modForm.motivo_consulta || undefined,
          id_recepcionista: userId ? parseInt(userId) : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setMensajeTicket({ texto: "Cita modificada correctamente", tipo: "success" });
        setModalModificarOpen(false);
        setCitaDetalle(null);
        setIdCita("");
        cargarCitasDelDia();
      } else {
        setMensajeTicket({ texto: data.error || "Error al modificar", tipo: "error" });
      }
    } catch {
      setMensajeTicket({ texto: "Error de conexion", tipo: "error" });
    } finally {
      setModificando(false);
    }
  };

  // ===== NOTIFICAR WHATSAPP =====
  const notificarWhatsapp = async (idTicket: number) => {
    try {
      await fetch(`${API_BASE}/api/tickets/${idTicket}/notificar-whatsapp`, {
        method: "POST", headers: getAuthHeaders()
      });
    } catch {}
  };

  // ===== GENERAR TICKET =====
  const generarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citaDetalle) {
      setMensajeTicket({ texto: "Debe buscar una cita primero", tipo: "error" });
      return;
    }
    setGenerando(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/generar`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ id_cita: citaDetalle.id_cita, prioridad })
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setMensajeTicket({ texto: "Ticket " + (data.data?.codigo_ticket || "") + " generado", tipo: "success" });
        setIdCita(""); setCitaDetalle(null); setPrioridad("NORMAL");
        cargarColaConGracia();
        cargarCitasDelDia();
      } else {
        setMensajeTicket({ texto: data.error || "Error", tipo: "error" });
      }
    } catch {
      setMensajeTicket({ texto: "Error de conexion", tipo: "error" });
    } finally {
      setGenerando(false);
    }
  };

  // ===== CAMBIAR ESTADO + WHATSAPP =====
  const cambiarEstadoPorId = async (id_ticket: number, nuevoEstado: string, motivo?: string, snapshot?: Ticket | null) => {
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id_ticket}/cambiar-estado`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ nuevo_estado: nuevoEstado, motivo: motivo || null })
      });
      const data = await res.json();
      if (data.success) {
        setMensajeAccion({ texto: "Ticket actualizado a " + nuevoEstado, tipo: "success" });

        if (nuevoEstado === "FINALIZADO" || nuevoEstado === "NO_SHOW") {
          if (ticketActual?.id_ticket === id_ticket) { setTicketActual(null); setTimerActivo(false); setTiempoLlamado(0); }
          if (colaSeleccion?.id_ticket === id_ticket) { setColaSeleccion(null); setDetallePaciente(null); }
        }

        if (nuevoEstado === "EN_ATENCION") {
          if (ticketActual?.id_ticket === id_ticket) { setTicketActual(null); setTimerActivo(false); setTiempoLlamado(0); }
          if (colaSeleccion?.id_ticket === id_ticket) { setColaSeleccion(null); setDetallePaciente(null); }
        }

        if (nuevoEstado === "LLAMADO") {
          const enCola = snapshot ?? colaSeleccion ?? cola.find((c) => c.id_ticket === id_ticket);
          if (enCola) { setTicketActual({ ...enCola, estado: "LLAMADO" }); setTimerActivo(true); }
          notificarWhatsapp(id_ticket);
        }

        if (nuevoEstado === "EN_ESPERA" && ticketActual?.id_ticket === id_ticket) {
          setTicketActual(null); setTimerActivo(false); setTiempoLlamado(0);
        }

        cargarColaConGracia();
        return true;
      }
      setMensajeAccion({ texto: data.error || "Error", tipo: "error" });
      return false;
    } catch {
      setMensajeAccion({ texto: "Error de conexion", tipo: "error" });
      return false;
    }
  };

  const llamarTicketSeleccion = async () => {
    if (!colaSeleccion) return;
    await cambiarEstadoPorId(colaSeleccion.id_ticket, "LLAMADO", undefined, colaSeleccion);
  };

  const regresarAEspera = async () => {
    if (!ticketActual) return;
    await cambiarEstadoPorId(ticketActual.id_ticket, "EN_ESPERA", "Regresa a cola");
    setMensajeAccion({ texto: "Ticket regresado a cola", tipo: "info" });
  };

  const llamarTicketDirecto = async (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    await cambiarEstadoPorId(ticket.id_ticket, "LLAMADO", undefined, ticket);
  };

  const llamarSiguiente = async () => {
    if (!idSede || !idServicio) {
      setMensajeLlamar({ texto: "Selecciona sede y servicio", tipo: "error" });
      return;
    }
    setLlamando(true);
    try {
      const res = await fetch(`${API_BASE}/api/tickets/siguiente`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ id_sede: parseInt(idSede), id_servicio: parseInt(idServicio) })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMensajeLlamar({ texto: "Llamando " + data.data.codigo_ticket, tipo: "success" });
        setTicketActual({ ...data.data, estado: "LLAMADO" });
        setTimerActivo(true);
        notificarWhatsapp(data.data.id_ticket);
        cargarColaConGracia();
      } else {
        setMensajeLlamar({ texto: data.error || "No hay pacientes", tipo: "info" });
      }
    } catch {
      setMensajeLlamar({ texto: "Error de conexion", tipo: "error" });
    } finally {
      setLlamando(false);
    }
  };

  const cambiarEstado = async (nuevoEstado: string, motivo?: string) => {
    if (!ticketActual) return;
    await cambiarEstadoPorId(ticketActual.id_ticket, nuevoEstado, motivo);
  };

  // ===== COLA =====
  const cargarColaConGracia = useCallback(async () => {
    if (!idSede) return;
    try {
      const fecha = encodeURIComponent(new Date().toISOString());
      const [resActuales, resPublica] = await Promise.all([
        fetch(`${API_BASE}/api/tickets/cola-actuales?id_sede=${idSede}&fecha_hora=${fecha}&minutos_gracia=5`),
        fetch(`${API_BASE}/api/pantalla/cola?id_sede=${idSede}`),
      ]);
      const dataActuales = await resActuales.json();
      const dataPublica = await resPublica.json();

      const byId = new Map<number, Ticket>();
      for (const t of dataActuales.data || []) {
        const row = t as Ticket;
        if (ticketActivoEnCola(row)) byId.set(row.id_ticket, { ...row, estado: estadoDeTicket(row) });
      }
      if (dataPublica.success) {
        const llamado = dataPublica.data?.llamado_actual as Ticket | null;
        if (llamado?.id_ticket && ticketActivoEnCola(llamado) && !byId.has(llamado.id_ticket)) {
          byId.set(llamado.id_ticket, { ...llamado, estado: estadoDeTicket(llamado) });
        }
        if (primeraCargaRef.current && llamado?.id_ticket) {
          primeraCargaRef.current = false;
          setTicketActual({ ...llamado, estado: 'LLAMADO' });
          setTimerActivo(true);
          const elapsed = llamado.fecha_llamado ? Math.floor((Date.now() - new Date(llamado.fecha_llamado).getTime()) / 1000) : 0;
          setTiempoLlamado(Math.max(0, elapsed));
        }
        const proximos = (dataPublica.data?.proximos || []) as Ticket[];
        for (const t of proximos) {
          if (!byId.has(t.id_ticket) && ticketActivoEnCola(t)) byId.set(t.id_ticket, { ...t, estado: estadoDeTicket(t) });
        }
      }

      const activos = [...byId.values()].filter(ticketActivoEnCola);
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
    const i = setInterval(cargarColaConGracia, 5000);
    return () => clearInterval(i);
  }, [cargarColaConGracia]);

  useEffect(() => {
    if (!colaSeleccion) return;
    const handler = (e: MouseEvent) => {
      if (colaCardRef.current && e.target instanceof Node && !colaCardRef.current.contains(e.target)) cerrarDetalleCola();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colaSeleccion, cerrarDetalleCola]);

  const seleccionarFilaCola = (ticket: Ticket) => {
    if (colaSeleccion?.id_ticket === ticket.id_ticket) { cerrarDetalleCola(); return; }
    setColaSeleccion(ticket);
    setDetallePaciente(null);
    cargarPacienteSeleccion(ticket);
  };

  const dobleClickCola = (ticket: Ticket) => {
    if (estadoDeTicket(ticket) === "EN_ESPERA") {
      cambiarEstadoPorId(ticket.id_ticket, "LLAMADO", undefined, ticket);
    }
  };

  const cargarPacienteSeleccion = async (ticket: Ticket) => {
    setCargandoPaciente(true);
    setDetallePaciente(null);
    try {
      const q = new URLSearchParams({ codigo_ticket: ticket.codigo_ticket, id_ticket: String(ticket.id_ticket) });
      const res = await fetch(`${API_BASE}/api/tickets/paciente-por-codigo?${q}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setDetallePaciente(data.data);
    } catch {
      setMensajeAccion({ texto: "Error al cargar paciente", tipo: "error" });
    } finally {
      setCargandoPaciente(false);
    }
  };

  const nombrePacienteDetalle = () => {
    if (!detallePaciente) return null;
    const nc = detallePaciente.nombre_completo as string;
    if (nc?.trim()) return nc.trim();
    const ap = detallePaciente as Record<string, string>;
    return `${ap.nombres || ""} ${ap.apellidos || ""}`.trim() || null;
  };

  const minutos = Math.floor(tiempoLlamado / 60);
  const segundos = tiempoLlamado % 60;
  const estSel = colaSeleccion ? estadoDeTicket(colaSeleccion) : "";

  return (
    <div className="recepcion-page">
      <div className="recepcion-container">
        <div className="recepcion-titulo">
          <h1><i className="fas fa-concierge-bell"></i> Panel de Recepcion</h1>
          <p>Gestion de tickets y cola de atencion</p>
          <button className="btn-pantalla" onClick={() => {
            const qs = new URLSearchParams({ id_sede: idSede });
            if (idServicio.trim() !== "") qs.set("id_servicio", idServicio);
            window.open("/pantalla?" + qs, "PantallaPublica", "fullscreen=yes,menubar=no,toolbar=no,location=no,status=no,titlebar=no");
          }}>
            <i className="fas fa-tv"></i> Abrir Pantalla Publica
          </button>
        </div>

        {timerActivo && ticketActual && (
          <div style={{
            background: tiempoLlamado > 240 ? "#dc3545" : "#fff3cd",
            color: tiempoLlamado > 240 ? "white" : "#856404",
            padding: "10px 20px", borderRadius: 10, marginBottom: 20,
            textAlign: "center", fontWeight: 700,
            animation: tiempoLlamado > 240 ? "pulse 0.5s infinite" : "none"
          }}>
            <i className="fas fa-hourglass-half"></i> Ticket {ticketActual.codigo_ticket} llamado hace {minutos}:{segundos.toString().padStart(2, "0")}
            {tiempoLlamado > 240 && " - Se marcara como No Show!"}
          </div>
        )}

        <div className="panel-grid">
          <div className="panel-left">
            {/* GENERAR TICKET */}
            <div className="panel-card">
              <div className="card-header"><i className="fas fa-ticket-alt"></i><h2>Generar Ticket</h2></div>
              <div className="card-body">
                <form onSubmit={generarTicket}>
                  <div className="form-group">
                    <label><i className="fas fa-calendar-alt"></i> Numero Cita</label>
                    <div className="buscador-cita-row">
                      <input
                        type="number" value={idCita}
                        onChange={e => { setIdCita(e.target.value); setCitaDetalle(null); }}
                        placeholder="Ej: 123"
                        className="buscador-cita-input"
                      />
                      <button
                        type="button"
                        className="btn-buscar-cita"
                        onClick={() => buscarCita()}
                        disabled={buscandoCita || !idCita.trim()}
                      >
                        {buscandoCita ? <><i className="fas fa-spinner fa-spin"></i> Buscando</> : <><i className="fas fa-search"></i> Buscar</>}
                      </button>
                    </div>
                  </div>
                  {citaDetalle && (
                    <div style={{
                      background: "#e8f5e9", padding: "10px 12px", borderRadius: 8,
                      marginBottom: 10, fontSize: "0.85rem", border: "1px solid #c8e6c9",
                      position: "relative"
                    }}>
                      <button type="button" onClick={() => { setIdCita(""); setCitaDetalle(null); }}
                        style={{
                          position: "absolute", top: 4, right: 4, border: "none",
                          background: "transparent", cursor: "pointer", fontSize: "1.1rem",
                          color: "#999", padding: "2px 6px", lineHeight: 1
                        }}
                        title="Quitar cita">
                        <i className="fas fa-times"></i>
                      </button>
                      <p style={{ margin: "2px 0" }}><strong><i className="fas fa-user"></i> Paciente:</strong> {citaDetalle.paciente_nombre || (citaDetalle.nombres + ' ' + citaDetalle.apellidos)}</p>
                      <p style={{ margin: "2px 0" }}><strong><i className="fas fa-stethoscope"></i> Servicio:</strong> {citaDetalle.servicio_nombre || citaDetalle.nombre_servicio}</p>
                      <p style={{ margin: "2px 0" }}><strong><i className="fas fa-user-md"></i> Medico:</strong> {citaDetalle.medico_nombre || (citaDetalle.medico_nombres + ' ' + citaDetalle.medico_apellidos)}</p>
                      <p style={{ margin: "2px 0" }}><strong><i className="fas fa-clock"></i> Fecha:</strong> {new Date(citaDetalle.fecha_inicio).toLocaleString()}</p>
                      <button type="button" onClick={abrirModificar}
                        style={{ marginTop: 6, padding: "4px 12px", borderRadius: 6, border: "1px solid #0077B6", background: "white", color: "#0077B6", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                        <i className="fas fa-edit"></i> Modificar Cita
                      </button>
                    </div>
                  )}
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
                  {mensajeTicket.texto && <div className={"mensaje " + mensajeTicket.tipo}>{mensajeTicket.texto}</div>}
                  <button type="submit" className="btn-generar" disabled={generando || !citaDetalle}>
                    {generando
                      ? <><i className="fas fa-spinner fa-spin"></i> Generando...</>
                      : <><i className="fas fa-plus-circle"></i> Generar Ticket</>}
                  </button>
                </form>
              </div>
            </div>

            {/* MODAL MODIFICAR CITA */}
            {modalModificarOpen && (
              <div className="modal-cita" onClick={() => setModalModificarOpen(false)}>
                <div className="modal-cita-content" onClick={e => e.stopPropagation()}>
                  <div className="modal-cita-header">
                    <h2><i className="fas fa-edit"></i> Modificar Cita #{citaDetalle?.id_cita}</h2>
                    <span className="close-modal" onClick={() => setModalModificarOpen(false)}>&times;</span>
                  </div>
                  <div className="modal-cita-body">
                    <form onSubmit={handleModificarCita}>
                      <div className="form-group-cita">
                        <label><i className="fas fa-stethoscope"></i> Servicio</label>
                        <select value={modForm.id_servicio} onChange={e => setModForm({ ...modForm, id_servicio: e.target.value })} required>
                          <option value="">Selecciona servicio</option>
                          {serviciosCola.map(s => <option key={s.id_servicio} value={s.id_servicio}>{s.servicio}</option>)}
                        </select>
                      </div>
                      <div className="form-group-cita">
                        <label><i className="fas fa-user-md"></i> Médico</label>
                        <select value={modForm.id_medico} onChange={e => setModForm({ ...modForm, id_medico: e.target.value })} required>
                          <option value="">Selecciona médico</option>
                          {medicos.map(m => <option key={m.id_medico} value={m.id_medico}>{m.nombre_completo}</option>)}
                        </select>
                      </div>
                      <div className="form-row-cita">
                        <div className="form-group-cita">
                          <label><i className="fas fa-calendar-day"></i> Fecha</label>
                          <input type="date" value={modForm.fecha}
                            onChange={e => setModForm({ ...modForm, fecha: e.target.value })} required />
                        </div>
                        <div className="form-group-cita">
                          <label><i className="fas fa-clock"></i> Hora</label>
                          <select value={modForm.hora} onChange={e => setModForm({ ...modForm, hora: e.target.value })} required>
                            <option value="">Selecciona hora</option>
                            {horarios.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group-cita">
                        <label><i className="fas fa-comment"></i> Motivo</label>
                        <textarea value={modForm.motivo_consulta}
                          onChange={e => setModForm({ ...modForm, motivo_consulta: e.target.value })}
                          placeholder="Motivo de consulta..." />
                      </div>
                      <button type="submit" className="btn-guardar-cita" disabled={modificando}>
                        {modificando ? <><i className="fas fa-spinner fa-spin"></i> Guardando...</> : <><i className="fas fa-save"></i> Guardar Cambios</>}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* CITAS DEL DIA */}
            <div className="panel-card">
              <div className="card-header">
                <i className="fas fa-calendar-day"></i>
                <h2>Citas</h2>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
                  <select value={idSede} onChange={(e) => setIdSede(e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem" }}>
                    <option value="">Todas las sedes</option>
                    {sedes.map((s) => <option key={s.id_sede} value={s.id_sede}>{s.nombre}</option>)}
                  </select>
                  <input type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem" }} />
                  <span className="badge-contador">{citasDelDia.length}</span>
                </div>
              </div>
              <div className="card-body">
                {cargandoCitas ? (
                  <p style={{ textAlign: "center", color: "#999" }}><i className="fas fa-spinner fa-spin"></i> Cargando...</p>
                ) : citasDelDia.length === 0 ? (
                  <div className="cola-vacia"><i className="fas fa-calendar-times"></i><p>Sin citas confirmadas para hoy</p></div>
                ) : (
                  citasDelDia.map((cita) => {
                    const hora = new Date(cita.fecha_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={cita.id_cita}
                        className={"cola-item prior-NORMAL" + (citaDetalle?.id_cita === cita.id_cita ? " cola-item-seleccionado" : "")}
                        onClick={() => seleccionarCitaDeLista(cita)}
                        style={{ cursor: "pointer" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0077B6", minWidth: 55 }}>{hora}</span>
                        <div className="cola-datos" style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600 }}>{cita.paciente_nombre}</p>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
                            {cita.servicio_nombre} - Dr. {cita.medico_nombre}
                          </p>
                        </div>
                        {cita.tiene_ticket === 1 ? (
                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 10, background: "#fff3cd", color: "#856404" }}>
                            <i className="fas fa-ticket-alt"></i> Con ticket
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 10, background: "#d4edda", color: "#155724" }}>
                            Sin ticket
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* LLAMAR SIGUIENTE */}
            <div className="panel-card">
              <div className="card-header verde"><i className="fas fa-bullhorn"></i><h2>Llamar Siguiente</h2></div>
              <div className="card-body llamar-body">
                <p className="llamar-desc">Llama al siguiente segun prioridad</p>
                <button className="btn-llamar" onClick={llamarSiguiente} disabled={llamando}>
                  {llamando ? <><i className="fas fa-spinner fa-spin"></i> Llamando...</> : <><i className="fas fa-bullhorn"></i> Llamar Siguiente</>}
                </button>
                {mensajeLlamar.texto && <div className={"mensaje " + mensajeLlamar.tipo}>{mensajeLlamar.texto}</div>}
              </div>
            </div>
          </div>

          <div className="panel-right">
            {/* TICKET ACTUAL */}
            <div className="panel-card">
              <div className="card-header naranja"><i className="fas fa-user-clock"></i><h2>Ticket Actual</h2></div>
              <div className="card-body">
                {!ticketActual ? (
                  <div className="ticket-actual-vacio"><i className="fas fa-inbox"></i><p>Sin ticket en atencion</p></div>
                ) : (
                  <>
                    <div className="ticket-info-card">
                      <div className="ticket-codigo-grande">{ticketActual.codigo_ticket}</div>
                      <div className="ticket-detalle">
                        <p><i className="fas fa-user"></i> <strong>Paciente:</strong> {ticketActual.paciente || "ID: " + ticketActual.id_paciente}</p>
                        <p><i className="fas fa-sort-amount-up"></i> <strong>Prioridad:</strong> <span className={"prioridad-badge prior-" + ticketActual.prioridad}>{ticketActual.prioridad}</span></p>
                        <p><i className="fas fa-clock"></i> <strong>Estado:</strong> {estadoDeTicket(ticketActual)}</p>
                      </div>
                    </div>
                    <div className="acciones-ticket">
                      {estadoDeTicket(ticketActual) === "LLAMADO" && (<>
                        <button className="btn-accion btn-en-atencion" onClick={() => cambiarEstado("EN_ATENCION")}><i className="fas fa-user-check"></i> En Atencion</button>
                        <button className="btn-accion btn-no-show" onClick={() => { if (confirm("Marcar como No Show?")) cambiarEstado("NO_SHOW", "Paciente no se presento"); }}><i className="fas fa-user-slash"></i> No Show</button>
                        <button className="btn-accion" style={{ background: '#6C757D', color: 'white' }} onClick={regresarAEspera}><i className="fas fa-undo"></i> Volver a cola</button>
                      </>)}
                      {estadoDeTicket(ticketActual) === "EN_ATENCION" && (
                        <button className="btn-accion btn-finalizar" onClick={() => { if (confirm("Finalizar atencion?")) cambiarEstado("FINALIZADO"); }}><i className="fas fa-check-circle"></i> Finalizar</button>
                      )}
                    </div>
                  </>
                )}
                {mensajeAccion.texto && <div className={"mensaje " + mensajeAccion.tipo}>{mensajeAccion.texto}</div>}
              </div>
            </div>

            {/* COLA DE ESPERA */}
            <div className="panel-card" ref={colaCardRef}>
              <div className="card-header"><i className="fas fa-list-ol"></i><h2>Cola de Espera (Hoy)</h2><span className="badge-contador">{contadorCola}</span></div>
              <div className="card-body">
                {cola.length === 0 ? (
                  <div className="cola-vacia"><i className="fas fa-check-circle"></i><p>Cola vacia</p></div>
                ) : (
                  cola.map((t, i) => {
                    const est = estadoDeTicket(t);
                    return (
                      <div key={t.id_ticket}
                        className={"cola-item prior-" + t.prioridad + (colaSeleccion?.id_ticket === t.id_ticket ? " cola-item-seleccionado" : "")}
                        onClick={() => seleccionarFilaCola(t)}
                        onDoubleClick={() => dobleClickCola(t)}
                        style={{ cursor: "pointer", position: "relative" }}>
                        <span className="cola-posicion">{i + 1}</span>
                        <span className="cola-codigo">{t.codigo_ticket}</span>
                        <div className="cola-datos" style={{ flex: 1 }}>
                          <p style={{ margin: 0 }}>
                            <span className={"prioridad-badge prior-" + t.prioridad}>{t.prioridad}</span>
                            <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#555" }}>{est}</span>
                          </p>
                          {t.minutos_para_cita != null && (
                            <p style={{ fontSize: "0.7rem", color: t.minutos_para_cita < 0 ? "#dc3545" : "#28a745", margin: 0 }}>
                              <i className={"fas " + (t.minutos_para_cita < 0 ? "fa-exclamation-circle" : "fa-clock")}></i>{" "}
                              {t.minutos_para_cita < 0 ? Math.abs(t.minutos_para_cita) + " min tarde" : "En " + t.minutos_para_cita + " min"}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {est === "EN_ESPERA" && (
                            <button className="btn-accion btn-en-atencion"
                              style={{ fontSize: '0.7rem', padding: '4px 10px', minWidth: 'auto' }}
                              onClick={(e) => llamarTicketDirecto(t, e)}
                              title="Llamar ticket directo">
                              <i className="fas fa-bullhorn"></i> Llamar
                            </button>
                          )}
                          <button className="btn-accion btn-no-show"
                            style={{ fontSize: '0.7rem', padding: '4px 10px', minWidth: 'auto' }}
                            onClick={(e) => { e.stopPropagation(); if (confirm("Cancelar ticket " + t.codigo_ticket + "?")) cambiarEstadoPorId(t.id_ticket, "NO_SHOW", "Cancelado por recepcion"); }}
                            title="Cancelar ticket"><i className="fas fa-times"></i></button>
                        </div>
                      </div>
                    );
                  })
                )}

                {colaSeleccion && (
                  <div className="cola-detalle-seleccion" style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #dee2e6", background: "#f8f9fa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div><strong><i className="fas fa-id-card"></i> {colaSeleccion.codigo_ticket}</strong>
                        <span style={{ marginLeft: 10, fontSize: "0.85rem" }}>Estado: {estSel}</span></div>
                      <button onClick={(e) => { e.stopPropagation(); cerrarDetalleCola(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#999" }} title="Cerrar"><i className="fas fa-times"></i></button>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      {cargandoPaciente && <p style={{ margin: 0, color: "#666" }}><i className="fas fa-spinner fa-spin"></i> Cargando...</p>}
                      {!cargandoPaciente && nombrePacienteDetalle() && <p style={{ margin: "8px 0", fontSize: "1.05rem" }}><i className="fas fa-user"></i> {nombrePacienteDetalle()}</p>}
                    </div>
                    <div className="acciones-ticket" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
                      {estSel === "EN_ESPERA" && <button className="btn-accion btn-en-atencion" onClick={llamarTicketSeleccion}><i className="fas fa-bullhorn"></i> Llamar</button>}
                      {estSel === "LLAMADO" && (<>
                        <button className="btn-accion btn-en-atencion" onClick={() => cambiarEstadoPorId(colaSeleccion.id_ticket, "EN_ATENCION")}><i className="fas fa-user-check"></i> En atencion</button>
                        <button className="btn-accion" style={{ background: "#6C757D", color: "white" }} onClick={() => cambiarEstadoPorId(colaSeleccion.id_ticket, "EN_ESPERA", "Regreso a cola")}><i className="fas fa-undo"></i> En espera</button>
                      </>)}
                      {(estSel === "EN_ESPERA" || estSel === "LLAMADO") && <button className="btn-accion btn-no-show" onClick={() => { if (confirm("No show?")) cambiarEstadoPorId(colaSeleccion.id_ticket, "NO_SHOW"); }}><i className="fas fa-user-slash"></i> No show</button>}
                      {estSel === "EN_ATENCION" && <button className="btn-accion btn-finalizar" onClick={() => { if (confirm("Finalizar?")) cambiarEstadoPorId(colaSeleccion.id_ticket, "FINALIZADO"); }}><i className="fas fa-check-circle"></i> Finalizar</button>}
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
