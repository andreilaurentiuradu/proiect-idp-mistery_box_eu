import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const ROLES = ["user", "creator", "admin"];

export default function AdminPanel() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchUsers = () =>
    api.get("/auth/users")
      .then((r) => setUsers(r.data))
      .finally(() => setLoading(false));

  useEffect(() => { fetchUsers(); }, []);

  const changeRole = async (userId, role) => {
    setError("");
    setSuccess("");
    try {
      await api.put(`/auth/users/${userId}/role`, { role });
      setSuccess("Role updated.");
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update role");
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="page">
      <h1>Admin Panel — User Management</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Deposit</th>
              <th>Score</th>
              <th>Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.mail}</td>
                <td>
                  <span className="badge">{u.role}</span>
                </td>
                <td>{u.deposit}</td>
                <td>{u.score}</td>
                <td>
                  {u.id !== me?.id ? (
                    <div className="flex gap-1 wrap">
                      {ROLES.filter((r) => r !== u.role).map((r) => (
                        <button
                          key={r}
                          className={`btn btn-sm ${r === "admin" ? "btn-danger" : r === "creator" ? "btn-primary" : "btn-secondary"}`}
                          onClick={() => changeRole(u.id, r)}
                        >
                          → {r}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">You</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
