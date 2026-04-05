import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function Wallet() {
  const { refreshUser } = useAuth();
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const [b, t] = await Promise.all([
      api.get("/payments/balance"),
      api.get("/payments/transactions"),
    ]);
    setBalance(b.data.balance);
    setTransactions(t.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDeposit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const { data } = await api.post("/payments/deposit", { amount: parseInt(amount) });
      setBalance(data.deposit);
      setSuccess(`Deposited ${amount} coins successfully!`);
      setAmount("");
      await Promise.all([fetchData(), refreshUser()]);
    } catch (err) {
      setError(err.response?.data?.error || "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Wallet</h1>

      <div className="alert alert-info mb-2" style={{ fontSize: "1.1rem" }}>
        Current Balance: <strong>{balance ?? "…"} coins</strong>
      </div>

      <div style={{ maxWidth: 400, marginBottom: "2rem" }}>
        <h2>Deposit Coins</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleDeposit}>
          <div className="form-group">
            <label>Amount</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 100"
              required
            />
          </div>
          <button className="btn btn-success" disabled={loading}>
            {loading ? "Processing…" : "Deposit"}
          </button>
        </form>
      </div>

      <h2>Transaction History</h2>
      {transactions.length === 0 ? (
        <p className="text-muted">No transactions yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Box</th>
                <th>Item Won</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const date = tx.created_at
                  ? new Date(tx.created_at).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" })
                  : "—";
                const isDeposit = tx.status === "deposit";
                return (
                  <tr key={tx.id}>
                    <td className="text-muted" style={{ whiteSpace: "nowrap" }}>{date}</td>
                    <td>
                      <span style={{ color: isDeposit ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
                        {isDeposit ? "▲ Deposit" : "▼ Purchase"}
                      </span>
                    </td>
                    <td style={{ color: isDeposit ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
                      {isDeposit ? "+" : "-"}{tx.amount} coins
                    </td>
                    <td>{tx.box_name || "—"}</td>
                    <td>{tx.item_name || "—"}</td>
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
