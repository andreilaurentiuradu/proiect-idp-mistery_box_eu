import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [box, setBox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/boxes/${id}`)
      .then((r) => setBox(r.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handlePull = async () => {
    setError("");
    setResult(null);
    setPulling(true);
    try {
      const { data } = await api.post(`/api/boxes/${id}/pull`);
      setResult(data);
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.error || "Pull failed");
    } finally {
      setPulling(false);
    }
  };

  if (loading) return <div className="spinner" />;
  if (!box) return null;

  const totalProb = box.items.reduce((s, i) => s + i.pull_probability, 0);

  return (
    <div className="page">
      <button className="btn btn-secondary btn-sm mb-2" onClick={() => navigate("/")}>
        ← Back
      </button>
      <h1>{box.name}</h1>
      {box.description && <p className="text-muted mb-2">{box.description}</p>}

      <div className="flex items-center gap-2 mb-2">
        <span>Cost: <strong style={{ color: "#a78bfa" }}>{box.cost} coins</strong></span>
        <span className="text-muted">|</span>
        <span>Your balance: <strong>{user?.deposit ?? "…"} coins</strong></span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="alert alert-success">
          🎉 You got: <strong>{result.item.name}</strong> ({result.item.points} pts)
          {result.item.description && <> — {result.item.description}</>}
        </div>
      )}

      <button
        className="btn btn-primary mb-2"
        onClick={handlePull}
        disabled={pulling || (user?.deposit ?? 0) < box.cost || box.items.length === 0}
      >
        {pulling ? "Opening…" : `Open Box (${box.cost} coins)`}
      </button>

      <h2>Contents</h2>
      {box.items.length === 0 ? (
        <p className="text-muted">This box is empty.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Points</th>
                <th>Stock</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              {box.items.map((item) => {
                const pct = totalProb > 0 ? ((item.pull_probability / totalProb) * 100).toFixed(1) : 0;
                return (
                  <tr key={item.id}>
                    <td><strong>{item.item_name}</strong></td>
                    <td className="text-muted">{item.description || "—"}</td>
                    <td>{item.points}</td>
                    <td>{item.stock}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <div className="prob-bar-bg">
                          <div className="prob-bar" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
