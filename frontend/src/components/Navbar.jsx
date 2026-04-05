import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav>
      <div className="nav-inner">
        <Link to="/" className="brand">🎁 MysteryBox</Link>
        <div className="nav-links">
          <Link to="/">Boxes</Link>
          <Link to="/inventory">Inventory</Link>
          <Link to="/wallet">Wallet</Link>
          {(user?.role === "creator" || user?.role === "admin") && (
            <Link to="/creator">Creator</Link>
          )}
          {user?.role === "admin" && <Link to="/admin">Admin</Link>}
          <span className="badge">{user?.role}</span>
          <span className="text-muted">{user?.mail}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
