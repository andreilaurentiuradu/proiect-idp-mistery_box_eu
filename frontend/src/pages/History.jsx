import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      padding: "0.15rem 0.5rem",
      borderRadius: "999px",
      fontSize: "0.7rem",
      fontWeight: 600,
      textTransform: "uppercase",
      marginLeft: "0.4rem",
    }}>
      {rarity === "legendary" ? `✨ ${rarity}` : rarity}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function History() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/history")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-2">
        <h1>Box Opening History</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")}>
          ← Back
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted">No box opens yet. Open some boxes!</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Box</th>
                <th>Item Won</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  style={row.points > 50 ? { background: "rgba(249,168,37,0.12)", borderLeft: "3px solid #f9a825" } : {}}
                >
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(row.created_at)}</td>
                  <td>{row.box_name || "—"}</td>
                  <td>
                    {row.item_name || "—"}
                    {row.rarity && <RarityBadge rarity={row.rarity} />}
                  </td>
                  <td>{row.points ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
