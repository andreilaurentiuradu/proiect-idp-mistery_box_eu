import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const RARITY_STYLES = {
  common:    { background: "#9e9e9e", color: "#fff" },
  rare:      { background: "#1565c0", color: "#fff" },
  epic:      { background: "#6a1b9a", color: "#fff" },
  legendary: { background: "#f9a825", color: "#000" },
};

function RarityBadge({ rarity }) {
  const style = RARITY_STYLES[rarity] || RARITY_STYLES.common;
  return (
    <span style={{
      ...style,
      padding: "0.15rem 0.45rem",
      borderRadius: "999px",
      fontSize: "0.68rem",
      fontWeight: 600,
      textTransform: "uppercase",
      marginLeft: "0.4rem",
      verticalAlign: "middle",
    }}>
      {rarity === "legendary" ? `✨ ${rarity}` : rarity}
    </span>
  );
}

export default function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [box, setBox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/boxes/${id}`)
      .then((r) => setBox(r.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handlePull = async (count = 1) => {
    setError("");
    setResults([]);
    setPulling(true);
    try {
      if (count === 1) {
        const { data } = await api.post(`/api/boxes/${id}/pull`);
        setResults([data.item]);
      } else {
        const { data } = await api.post(`/api/boxes/${id}/pull-multi`, { count });
        setResults(data.items);
      }
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
  const canAfford = (n) => (user?.deposit ?? 0) >= box.cost * n;
  const hasStock = box.items.length > 0;

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

      {results.length > 0 && (
        <div className="alert alert-success">
          🎉 {results.length === 1 ? (
            <>You got: <strong>{results[0].name}</strong> ({results[0].points} pts)</>
          ) : (
            <>
              You got {results.length} items:
              <ul style={{ margin: "0.5rem 0 0 1.2rem" }}>
                {results.map((item, i) => (
                  <li key={i}><strong>{item.name}</strong> ({item.points} pts)</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="flex gap-1 mb-2 wrap">
        {[1, 3, 5, 10].map((n) => (
          <button
            key={n}
            className={n === 1 ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => handlePull(n)}
            disabled={pulling || !canAfford(n) || !hasStock}
          >
            {pulling ? "Opening…" : `Open ×${n} (${box.cost * n} coins)`}
          </button>
        ))}
      </div>

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
                    <td>
                      <strong>{item.item_name}</strong>
                      {item.rarity && <RarityBadge rarity={item.rarity} />}
                    </td>
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
