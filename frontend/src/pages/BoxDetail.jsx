import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function boxTier(cost) {
  if (cost <= 100) return "starter";
  if (cost <= 300) return "adventure";
  if (cost <= 800) return "epic";
  return "legendary";
}
function boxEmoji(cost) {
  if (cost <= 100) return "📦";
  if (cost <= 300) return "🎁";
  if (cost <= 800) return "💎";
  return "👑";
}

const ITEM_EMOJIS = {
  common: "🔵", rare: "🟣", epic: "🌟", legendary: "✨",
};

function RarityBadge({ rarity }) {
  return (
    <span className={`rarity-badge rarity-${rarity}`}>
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
  const [shaking, setShaking] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/api/boxes/${id}`)
      .then((r) => setBox(r.data))
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handlePull = useCallback(async (count = 1) => {
    if (pulling) return;
    setError("");
    setResults([]);
    setPulling(true);
    setShaking(true);
    setTimeout(() => setShaking(false), 600);

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
  }, [id, pulling, refreshUser]);

  if (loading) return <div className="spinner" />;
  if (!box) return null;

  const tier = boxTier(box.cost);
  const emoji = boxEmoji(box.cost);
  const totalProb = box.items.reduce((s, i) => s + i.pull_probability, 0);
  const canAfford = (n) => (user?.deposit ?? 0) >= box.cost * n;
  const hasStock = box.items.length > 0;

  const OPEN_BTNS = [
    { n: 1,  cls: "open-btn-x1",  label: "Open ×1" },
    { n: 3,  cls: "open-btn-x3",  label: "Open ×3" },
    { n: 5,  cls: "open-btn-x5",  label: "Open ×5" },
    { n: 10, cls: "open-btn-x10", label: "Open ×10" },
  ];

  return (
    <div className="page">
      <button className="btn btn-secondary btn-sm mb-2" onClick={() => navigate("/")}>
        ← Back
      </button>

      {/* Hero section */}
      <div className={`tier-${tier}`}>
        <div className="box-detail-hero">
          {/* Animated box */}
          <div
            className={`box-visual${shaking ? " is-opening" : ""}`}
            onClick={() => canAfford(1) && hasStock && handlePull(1)}
            title="Click to open!"
          >
            {emoji}
          </div>

          <div style={{ textAlign: "center" }}>
            <div className="box-detail-title">{box.name}</div>
            {box.description && <div className="box-detail-desc mt-1">{box.description}</div>}
          </div>

          <div className="box-detail-meta">
            <span>Cost: <strong style={{ color: "#a78bfa" }}>{box.cost} coins</strong></span>
            <span style={{ color: "#333" }}>|</span>
            <span>Balance: <strong style={{ color: "#86efac" }}>{user?.deposit ?? "…"} coins</strong></span>
          </div>

          {/* Open buttons */}
          <div className="open-btns">
            {OPEN_BTNS.map(({ n, cls, label }) => (
              <button
                key={n}
                className={`open-btn ${cls}`}
                onClick={() => handlePull(n)}
                disabled={pulling || !canAfford(n) || !hasStock}
              >
                <span className="open-count">{pulling && n === 1 ? "🎲" : label}</span>
                <span className="open-cost">{box.cost * n} coins</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
            🎉 {results.length === 1 ? "You got!" : `You got ${results.length} items!`}
          </h2>
          <div className="results-grid">
            {results.map((item, i) => (
              <div
                key={i}
                className={`result-card rarity-${item.rarity || "common"}`}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className="rc-emoji">{ITEM_EMOJIS[item.rarity] || "🔵"}</div>
                {item.rarity && (
                  <div style={{ marginBottom: "0.35rem" }}>
                    <RarityBadge rarity={item.rarity} />
                  </div>
                )}
                <div className="rc-name">{item.name}</div>
                {item.description && (
                  <div style={{ fontSize: "0.72rem", color: "#666", marginTop: "0.2rem", marginBottom: "0.3rem" }}>
                    {item.description}
                  </div>
                )}
                <div className="rc-points">✦ {item.points} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contents */}
      <h2>Box Contents</h2>
      {box.items.length === 0 ? (
        <p className="text-muted">This box is empty.</p>
      ) : (
        <div className="contents-grid">
          {box.items.map((item) => {
            const pct = totalProb > 0 ? ((item.pull_probability / totalProb) * 100).toFixed(1) : 0;
            return (
              <div key={item.id} className="content-item-card">
                <div className="ci-header">
                  <span className="ci-name">{item.item_name}</span>
                  {item.rarity && <RarityBadge rarity={item.rarity} />}
                </div>
                <div className="ci-desc">{item.description || "No description"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <div className="prob-bar-bg" style={{ flex: 1 }}>
                    <div className="prob-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#888", whiteSpace: "nowrap" }}>{pct}%</span>
                </div>
                <div className="ci-footer">
                  <span className="ci-pts">✦ {item.points} pts</span>
                  <span className="ci-stock">📦 stock: {item.stock}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
