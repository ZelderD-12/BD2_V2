import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, tienePermiso } from "../../context/AuthContext";
import "../../assets/styles/farmacia.css";

const API_BASE = "http://localhost:8080";

export default function FarmaciaPage() {
  const { isLoggedIn, userRolId } = useAuth();
  const navigate = useNavigate();

  const [sedes, setSedes] = useState<{ id_sede: number; nombre: string }[]>([]);
  const [idSede, setIdSede] = useState("");
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [recetasPendientes, setRecetasPendientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const [cantidadAumentar, setCantidadAumentar] = useState(10);
  const [medSeleccionado, setMedSeleccionado] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/login"); return; }
    if (!tienePermiso(userRolId, "VER_FARMACIA")) { navigate("/"); }
  }, [isLoggedIn, userRolId, navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/api/sedes`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSedes(d.data || []);
          if (d.data?.length > 0) setIdSede(String(d.data[0].id_sede));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!idSede) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/farmacia/medicamentos/${idSede}`).then(r => r.json()),
      fetch(`${API_BASE}/api/farmacia/recetas-pendientes/${idSede}`).then(r => r.json()),
    ])
      .then(([medRes, recRes]) => {
        if (medRes.success) setMedicamentos(medRes.data || []);
        if (recRes.success) setRecetasPendientes(recRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [idSede]);

  const aumentarStock = async (id_medicamento: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/farmacia/aumentar-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_medicamento,
          id_sede: parseInt(idSede),
          cantidad: cantidadAumentar,
          id_usuario: parseInt(localStorage.getItem("user_id") || "0"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMensaje({ texto: `Stock aumentado en ${cantidadAumentar}`, tipo: "success" });
        const res2 = await fetch(`${API_BASE}/api/farmacia/medicamentos/${idSede}`);
        const d2 = await res2.json();
        if (d2.success) setMedicamentos(d2.data || []);
        setMedSeleccionado(null);
      } else {
        setMensaje({ texto: data.error || "Error", tipo: "error" });
      }
    } catch {
      setMensaje({ texto: "Error de conexion", tipo: "error" });
    }
  };

  const entregarReceta = async (orden_receta: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/farmacia/entregar-receta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orden_receta,
          id_usuario: parseInt(localStorage.getItem("user_id") || "0"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMensaje({ texto: `Receta ${orden_receta} entregada`, tipo: "success" });
        const res2 = await fetch(`${API_BASE}/api/farmacia/recetas-pendientes/${idSede}`);
        const d2 = await res2.json();
        if (d2.success) setRecetasPendientes(d2.data || []);
      } else {
        setMensaje({ texto: data.error || "Error", tipo: "error" });
      }
    } catch {
      setMensaje({ texto: "Error de conexion", tipo: "error" });
    }
  };

  return (
    <div className="farmacia-page">
      <div className="farmacia-container">
        <div className="farmacia-header">
          <h1><i className="fas fa-tablets"></i> Farmacia</h1>
          <select value={idSede} onChange={e => setIdSede(e.target.value)}
            className="sede-select">
            <option value="">Seleccione sede</option>
            {sedes.map(s => <option key={s.id_sede} value={s.id_sede}>{s.nombre}</option>)}
          </select>
        </div>

        {mensaje.texto && (
          <div className={`mensaje-farmacia ${mensaje.tipo}`}>
            <i className={`fas ${mensaje.tipo === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>
            {mensaje.texto}
          </div>
        )}

        {loading ? (
          <div className="loading-farmacia"><i className="fas fa-spinner fa-spin"></i> Cargando...</div>
        ) : (
          <div className="farmacia-grid">
            {/* INVENTARIO */}
            <div className="panel-card">
              <div className="card-header">
                <i className="fas fa-boxes"></i>
                <h2>Inventario</h2>
                <span className="badge-contador">{medicamentos.length}</span>
              </div>
              <div className="card-body" style={{ maxHeight: 400, overflowY: "auto" }}>
                {medicamentos.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#999" }}>Sin medicamentos</p>
                ) : (
                  <table className="tabla-farmacia">
                    <thead>
                      <tr>
                        <th>Medicamento</th>
                        <th>Stock</th>
                        <th>Min.</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicamentos.map(m => (
                        <tr key={m.id_medicamento} className={m.stock_bajo ? "stock-bajo" : ""}>
                          <td>
                            <strong>{m.nombre}</strong>
                            {m.presentacion && <span style={{ color: "#666", fontSize: "0.8rem" }}> ({m.presentacion})</span>}
                          </td>
                          <td className={`stock-valor ${m.stock_actual <= m.stock_minimo ? "bajo" : ""}`}>
                            {m.stock_actual}
                          </td>
                          <td>{m.stock_minimo}</td>
                          <td>
                            {medSeleccionado === m.id_medicamento ? (
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input type="number" value={cantidadAumentar}
                                  onChange={e => setCantidadAumentar(parseInt(e.target.value) || 0)}
                                  style={{ width: 60, padding: "2px 4px", borderRadius: 4, border: "1px solid #ccc" }}
                                  min={1} />
                                <button onClick={() => aumentarStock(m.id_medicamento)}
                                  className="btn-farma btn-sm btn-success">
                                  <i className="fas fa-check"></i>
                                </button>
                                <button onClick={() => setMedSeleccionado(null)}
                                  className="btn-farma btn-sm btn-cancel">
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setMedSeleccionado(m.id_medicamento); setCantidadAumentar(10); }}
                                className="btn-farma btn-sm btn-primary">
                                <i className="fas fa-plus"></i> Stock
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* RECETAS PENDIENTES */}
            <div className="panel-card">
              <div className="card-header">
                <i className="fas fa-prescription"></i>
                <h2>Recetas Pendientes</h2>
                <span className="badge-contador">{recetasPendientes.length}</span>
              </div>
              <div className="card-body" style={{ maxHeight: 400, overflowY: "auto" }}>
                {recetasPendientes.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#999" }}>Sin recetas pendientes</p>
                ) : (
                  recetasPendientes.map(r => (
                    <div key={r.Orden_Receta} className="receta-pendiente-item">
                      <div className="receta-info">
                        <strong style={{ color: "var(--color-primary)" }}>{r.Orden_Receta}</strong>
                        <p style={{ margin: "2px 0", fontSize: "0.85rem" }}>{r.paciente_nombre}</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "#999" }}>
                          {new Date(r.fecha_emision).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => entregarReceta(r.Orden_Receta)}
                        className="btn-farma btn-sm btn-success">
                        <i className="fas fa-check-double"></i> Entregado
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
