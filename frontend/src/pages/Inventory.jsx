import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";

function RarityBadge({ rarity }) {
  return (
    <span className={`rarity-badge rarity-${rarity}`}>
      {rarity === "legendary" ? `✨ ${rarity}` : rarity}
    </span>
  );
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem",
      background: "#052e16", color: "#86efac",
      border: "1px solid #14532d", borderRadius: "0.65rem",
      padding: "0.85rem 1.25rem", fontSize: "0.9rem",
      zIndex: 1000, maxWidth: "320px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      animation: "itemPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
    }}>
      💰 {message}
    </div>
  );
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };

export default function Inventory() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState({});
  const [toast, setToast] = useState(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    api.get("/api/inventory")
      .then((r) => {
        const sorted = [...r.data].sort((a, b) =>
          (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4)
        );
        setItems(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message: msg });
  };

  const handleSell = async (row) => {
    setSelling((s) => ({ ...s, [row.id]: true }));
    try {
      const body = row.box_id ? { box_id: row.box_id } : {};
      const { data } = await api.post(`/api/inventory/${row.item_id}/sell`, body);
      showToast(`Sold ${row.name} for ${data.sell_price} coins`);
      setItems((prev) =>
        prev
          .map((r) => r.id === row.id ? { ...r, count: r.count - 1 } : r)
          .filter((r) => r.count > 0)
      );
      await refreshUser();
    } catch (err) {
      showToast(err.response?.data?.error || "Sell failed");
    } finally {
      setSelling((s) => ({ ...s, [row.id]: false }));
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-2">
        <h1>My Inventory</h1>
        <div className="alert alert-info" style={{ margin: 0, padding: "0.4rem 1rem" }}>
          💰 <strong>{user?.deposit ?? "…"} coins</strong>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📭</div>
          <p className="text-muted">Your inventory is empty. Open some boxes!</p>
        </div>
      ) : (
        <>
          <p className="text-muted mb-2">{items.length} item type{items.length !== 1 ? "s" : ""} — sorted by rarity</p>
          <div className="inventory-grid">
            {items.map((row) => {
              const sellPrice = Math.max(1, Math.floor(row.points / 2));
              return (
                <div key={row.id} className={`inv-card rarity-${row.rarity || "common"}`}>
                  <div className="inv-card-body">
                    <div className="inv-card-rarity">
                      {row.rarity && <RarityBadge rarity={row.rarity} />}
                    </div>
                    <div className="inv-card-name">{row.name}</div>
                    <div className="inv-card-desc">{row.description || "No description"}</div>
                    <div className="inv-card-meta">
                      <span className="inv-card-pts">✦ {row.points} pts</span>
                      <span>{row.box_name ? `📦 ${row.box_name}` : "—"}</span>
                    </div>
                  </div>
                  <div className="inv-card-footer">
                    <span className="inv-card-count">×{row.count}</span>
                    <button
                      className="inv-card-sell"
                      disabled={selling[row.id]}
                      onClick={() => handleSell(row)}
                    >
                      {selling[row.id] ? "Selling…" : `Sell • ${sellPrice} 💰`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {toast && (
        <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
