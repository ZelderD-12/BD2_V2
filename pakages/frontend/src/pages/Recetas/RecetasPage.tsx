import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import "../../assets/styles/recetas.css";

interface Medicamento {
  id_medicamento: number;
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

interface Receta {
  Orden_Receta: string;
  fecha_emision: string;
  id_medico: number;
  medico_nombre: string;
  total_medicamentos: number;
  id_cita: number;
  medicamentos: Medicamento[];
}

export default function RecetasPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { navigate("/login"); return; }
    cargarRecetas();
  }, [isLoggedIn]);

  const cargarRecetas = async () => {
    const userId = localStorage.getItem("user_id") || localStorage.getItem("id_usuario");
    if (!userId) { setLoading(false); return; }
    try {
      const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
      const res = await fetch(`${API_URL}/api/recetas/paciente/${userId}`);
      const data = await res.json();
      if (data.success) setRecetas(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recetas-page">
      <div className="recetas-container">
        <div className="recetas-header">
          <h1><i className="fas fa-prescription"></i> Mis Recetas</h1>
          <p>Historial de recetas médicas asociadas a tus citas</p>
        </div>

        {loading ? (
          <div className="loading-recetas">
            <i className="fas fa-spinner fa-spin"></i> Cargando recetas...
          </div>
        ) : recetas.length === 0 ? (
          <div className="empty-recetas">
            <i className="fas fa-prescription-bottle-alt"></i>
            <h3>Sin recetas</h3>
            <p>Aún no tienes recetas médicas. Estas se generan cuando un médico te atiende.</p>
          </div>
        ) : (
          recetas.map((r) => (
            <div key={r.Orden_Receta} className="receta-card">
              <h3><i className="fas fa-receipt"></i> {r.Orden_Receta}</h3>
              <div className="receta-meta">
                <span><i className="fas fa-calendar"></i> {new Date(r.fecha_emision).toLocaleDateString()}</span>
                <span><i className="fas fa-user-md"></i> Dr. {r.medico_nombre}</span>
                <span><i className="fas fa-pills"></i> {r.total_medicamentos} medicamento(s)</span>
              </div>
              <div className="receta-medicamentos">
                <h4>Medicamentos recetados</h4>
                {r.medicamentos.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Medicamento</th>
                        <th>Dosis</th>
                        <th>Cada (hrs)</th>
                        <th>Duración (días)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.medicamentos.map((m, i) => (
                        <tr key={i}>
                          <td><strong>{m.nombre}</strong></td>
                          <td>{m.dosis}</td>
                          <td>{m.frecuencia}</td>
                          <td>{m.duracion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "#999", fontStyle: "italic" }}>Sin detalle de medicamentos</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
