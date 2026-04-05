import { useEffect, useState } from "react";
import api from "../api";

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/inventory")
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <h1>My Inventory</h1>
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
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong></td>
                  <td className="text-muted">{row.description || "—"}</td>
                  <td>{row.points}</td>
                  <td>{row.box_name || "—"}</td>
                  <td>×{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
