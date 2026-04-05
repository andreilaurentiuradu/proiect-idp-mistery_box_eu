import { useEffect, useState } from "react";
import api from "../api";

export default function CreatorPanel() {
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New item form
  const [itemName, setItemName] = useState("");
  const [itemPoints, setItemPoints] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  // New box form
  const [boxName, setBoxName] = useState("");
  const [boxCost, setBoxCost] = useState("");
  const [boxDesc, setBoxDesc] = useState("");

  // Add item to box form
  const [selBox, setSelBox] = useState("");
  const [selItem, setSelItem] = useState("");
  const [prob, setProb] = useState("");
  const [stock, setStock] = useState("");

  // Add stock form
  const [stockBox, setStockBox] = useState("");
  const [stockItem, setStockItem] = useState("");
  const [stockAmount, setStockAmount] = useState("");

  const refresh = () =>
    Promise.all([api.get("/api/items"), api.get("/api/boxes")]).then(
      ([ir, br]) => { setItems(ir.data); setBoxes(br.data); }
    );

  useEffect(() => { refresh(); }, []);

  const notify = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
  };

  const createItem = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/items", { name: itemName, points: parseInt(itemPoints || 0), description: itemDesc });
      notify("Item created!");
      setItemName(""); setItemPoints(""); setItemDesc("");
      refresh();
    } catch (err) { notify(err.response?.data?.error || "Failed", true); }
  };

  const createBox = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/boxes", { name: boxName, cost: parseInt(boxCost), description: boxDesc });
      notify("Box created!");
      setBoxName(""); setBoxCost(""); setBoxDesc("");
      refresh();
    } catch (err) { notify(err.response?.data?.error || "Failed", true); }
  };

  const addItemToBox = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/boxes/${selBox}/items`, {
        item_id: selItem,
        pull_probability: parseInt(prob),
        stock: parseInt(stock || 0),
      });
      notify("Item added to box!");
      setSelBox(""); setSelItem(""); setProb(""); setStock("");
    } catch (err) { notify(err.response?.data?.error || "Failed", true); }
  };

  const addStock = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/api/boxes/${stockBox}/items/${stockItem}/stock`, { amount: parseInt(stockAmount) });
      notify("Stock updated!");
      setStockBox(""); setStockItem(""); setStockAmount("");
    } catch (err) { notify(err.response?.data?.error || "Failed", true); }
  };

  return (
    <div className="page">
      <h1>Creator Panel</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>

        {/* Create Item */}
        <div className="card" style={{ cursor: "default" }}>
          <h2>Create Item</h2>
          <form onSubmit={createItem}>
            <div className="form-group">
              <label>Name</label>
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Points</label>
              <input type="number" min="0" value={itemPoints} onChange={(e) => setItemPoints(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
            </div>
            <button className="btn btn-primary">Create Item</button>
          </form>
        </div>

        {/* Create Box */}
        <div className="card" style={{ cursor: "default" }}>
          <h2>Create Box</h2>
          <form onSubmit={createBox}>
            <div className="form-group">
              <label>Name</label>
              <input value={boxName} onChange={(e) => setBoxName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Cost (coins)</label>
              <input type="number" min="1" value={boxCost} onChange={(e) => setBoxCost(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input value={boxDesc} onChange={(e) => setBoxDesc(e.target.value)} />
            </div>
            <button className="btn btn-primary">Create Box</button>
          </form>
        </div>

        {/* Add item to box */}
        <div className="card" style={{ cursor: "default" }}>
          <h2>Add Item to Box</h2>
          <form onSubmit={addItemToBox}>
            <div className="form-group">
              <label>Box</label>
              <select value={selBox} onChange={(e) => setSelBox(e.target.value)} required>
                <option value="">Select box…</option>
                {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Item</label>
              <select value={selItem} onChange={(e) => setSelItem(e.target.value)} required>
                <option value="">Select item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Pull Probability (weight)</label>
              <input type="number" min="1" value={prob} onChange={(e) => setProb(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Initial Stock</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <button className="btn btn-primary">Add to Box</button>
          </form>
        </div>

        {/* Add stock */}
        <div className="card" style={{ cursor: "default" }}>
          <h2>Add Stock to Box-Item</h2>
          <form onSubmit={addStock}>
            <div className="form-group">
              <label>Box</label>
              <select value={stockBox} onChange={(e) => setStockBox(e.target.value)} required>
                <option value="">Select box…</option>
                {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Item</label>
              <select value={stockItem} onChange={(e) => setStockItem(e.target.value)} required>
                <option value="">Select item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount to Add</label>
              <input type="number" min="1" value={stockAmount} onChange={(e) => setStockAmount(e.target.value)} required />
            </div>
            <button className="btn btn-success">Add Stock</button>
          </form>
        </div>

      </div>

      {/* Items list */}
      <h2 className="mt-3">Existing Items ({items.length})</h2>
      <div className="table-wrap mb-2">
        <table>
          <thead><tr><th>Name</th><th>Points</th><th>Description</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.points}</td><td className="text-muted">{i.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Boxes list */}
      <h2>Existing Boxes ({boxes.length})</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Cost</th><th>Description</th></tr></thead>
          <tbody>
            {boxes.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td><td>{b.cost} coins</td><td className="text-muted">{b.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
