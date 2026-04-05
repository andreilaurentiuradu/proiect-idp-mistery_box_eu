import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";

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

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem",
      background: "#052e16", color: "#86efac",
      border: "1px solid #14532d", borderRadius: "0.5rem",
      padding: "0.75rem 1.25rem", fontSize: "0.9rem",
      zIndex: 1000, maxWidth: "320px",
    }}>
      {message}
    </div>
  );
}

export default function Inventory() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState({});
  const [toast, setToast] = useState(null);
  const toastIdRef = useRef(0);

  useEffect(() => {
    api.get("/api/inventory")
      .then((r) => setItems(r.data))
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
          Balance: <strong>{user?.deposit ?? "…"} coins</strong>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted">Your inventory is empty. Open some boxes!</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Points</th>
                <th>From Box</th>
                <th>Count</th>
                <th>Sell</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {row.rarity && <RarityBadge rarity={row.rarity} />}
                  </td>
                  <td className="text-muted">{row.description || "—"}</td>
                  <td>{row.points}</td>
                  <td>{row.box_name || "—"}</td>
                  <td>×{row.count}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={selling[row.id]}
                      onClick={() => handleSell(row)}
                    >
                      {selling[row.id] ? "…" : `Sell (${Math.max(1, Math.floor(row.points / 2))} coins)`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
