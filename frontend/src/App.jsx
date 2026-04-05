import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import BoxDetail from "./pages/BoxDetail";
import Inventory from "./pages/Inventory";
import AdminPanel from "./pages/AdminPanel";
import CreatorPanel from "./pages/CreatorPanel";
import Wallet from "./pages/Wallet";
import History from "./pages/History";
import Leaderboard from "./pages/Leaderboard";

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/boxes/:id" element={<BoxDetail />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/history" element={<History />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Route>

        <Route element={<ProtectedRoute roles={["creator", "admin"]} />}>
          <Route path="/creator" element={<CreatorPanel />} />
        </Route>

        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </>
  );
}
