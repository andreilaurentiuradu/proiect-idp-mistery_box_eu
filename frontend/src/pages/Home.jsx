import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/boxes")
      .then((r) => setBoxes(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-2">
        <h1>Mystery Boxes</h1>
        <div className="alert alert-info" style={{ margin: 0, padding: "0.4rem 1rem" }}>
          Balance: <strong>{user?.deposit ?? "…"} coins</strong>
        </div>
      </div>

      {boxes.length === 0 ? (
        <p className="text-muted">No boxes available yet.</p>
      ) : (
        <div className="grid">
          {boxes.map((box) => (
            <div key={box.id} className="card" onClick={() => navigate(`/boxes/${box.id}`)}>
              <div className="card-title">{box.name}</div>
              <div className="card-desc">{box.description || "No description"}</div>
              <div className="card-cost">💰 {box.cost} coins</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
