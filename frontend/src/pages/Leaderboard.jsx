import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const RANK_STYLES = {
  1: { background: "rgba(249,168,37,0.18)", borderLeft: "3px solid #f9a825" },
  2: { background: "rgba(189,189,189,0.18)", borderLeft: "3px solid #bdbdbd" },
  3: { background: "rgba(188,119,54,0.18)",  borderLeft: "3px solid #bc7736" },
};

const RANK_ICONS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function Leaderboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt] = useState(() => new Date());

  useEffect(() => {
    api.get("/api/leaderboard")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-2">
        <h1>Leaderboard</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/")}>
          ← Back to Boxes
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted">No players yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rank} style={RANK_STYLES[row.rank] || {}}>
                  <td>
                    <strong>{RANK_ICONS[row.rank] || `#${row.rank}`}</strong>
                  </td>
                  <td>{row.display_name}</td>
                  <td>{row.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted mt-2" style={{ fontSize: "0.8rem" }}>
        Last updated: {fetchedAt.toLocaleTimeString()} — cached for 60s
      </p>
    </div>
  );
}
