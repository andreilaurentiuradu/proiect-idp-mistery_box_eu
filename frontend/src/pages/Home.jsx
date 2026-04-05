import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);

  // form state mirrors URL params
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [minCost, setMinCost] = useState(searchParams.get("min_cost") || "");
  const [maxCost, setMaxCost] = useState(searchParams.get("max_cost") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "");

  const isFiltered = !!(searchParams.get("search") || searchParams.get("min_cost") ||
                        searchParams.get("max_cost") || searchParams.get("sort"));

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (searchParams.get("search"))   params.search   = searchParams.get("search");
    if (searchParams.get("min_cost")) params.min_cost = searchParams.get("min_cost");
    if (searchParams.get("max_cost")) params.max_cost = searchParams.get("max_cost");
    if (searchParams.get("sort"))     params.sort     = searchParams.get("sort");

    api.get("/api/boxes", { params })
      .then((r) => setBoxes(r.data))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const handleFilter = (e) => {
    e.preventDefault();
    const p = {};
    if (search.trim())   p.search   = search.trim();
    if (minCost.trim())  p.min_cost = minCost.trim();
    if (maxCost.trim())  p.max_cost = maxCost.trim();
    if (sort)            p.sort     = sort;
    setSearchParams(p);
  };

  const handleClear = () => {
    setSearch(""); setMinCost(""); setMaxCost(""); setSort("");
    setSearchParams({});
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-2">
        <h1>Mystery Boxes</h1>
        <div className="alert alert-info" style={{ margin: 0, padding: "0.4rem 1rem" }}>
          Balance: <strong>{user?.deposit ?? "…"} coins</strong>
        </div>
      </div>

      {/* Filter form */}
      <form
        onSubmit={handleFilter}
        style={{
          background: "#1a1a2e",
          border: "1px solid #2a2a4a",
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "2 1 180px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "#aaa", marginBottom: "0.25rem" }}>
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            style={{
              width: "100%", background: "#12122a", border: "1px solid #2a2a4a",
              borderRadius: "0.4rem", padding: "0.45rem 0.7rem", color: "#e2e2e2", fontSize: "0.9rem",
            }}
          />
        </div>

        <div style={{ flex: "1 1 100px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "#aaa", marginBottom: "0.25rem" }}>
            Min price
          </label>
          <input
            type="number" min="0" value={minCost}
            onChange={(e) => setMinCost(e.target.value)}
            placeholder="0"
            style={{
              width: "100%", background: "#12122a", border: "1px solid #2a2a4a",
              borderRadius: "0.4rem", padding: "0.45rem 0.7rem", color: "#e2e2e2", fontSize: "0.9rem",
            }}
          />
        </div>

        <div style={{ flex: "1 1 100px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "#aaa", marginBottom: "0.25rem" }}>
            Max price
          </label>
          <input
            type="number" min="0" value={maxCost}
            onChange={(e) => setMaxCost(e.target.value)}
            placeholder="∞"
            style={{
              width: "100%", background: "#12122a", border: "1px solid #2a2a4a",
              borderRadius: "0.4rem", padding: "0.45rem 0.7rem", color: "#e2e2e2", fontSize: "0.9rem",
            }}
          />
        </div>

        <div style={{ flex: "1 1 140px" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "#aaa", marginBottom: "0.25rem" }}>
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              width: "100%", background: "#12122a", border: "1px solid #2a2a4a",
              borderRadius: "0.4rem", padding: "0.45rem 0.7rem", color: "#e2e2e2", fontSize: "0.9rem",
            }}
          >
            <option value="">Default</option>
            <option value="cheapest">Cheapest first</option>
            <option value="expensive">Most expensive</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        <div className="flex gap-1" style={{ alignSelf: "flex-end" }}>
          <button type="submit" className="btn btn-primary">Filter</button>
          <button type="button" className="btn btn-secondary" onClick={handleClear}>Clear</button>
        </div>
      </form>

      {isFiltered && !loading && (
        <p className="text-muted mb-2">
          Showing {boxes.length} result{boxes.length !== 1 ? "s" : ""}
          {searchParams.get("search") ? ` for "${searchParams.get("search")}"` : ""}
        </p>
      )}

      {loading ? (
        <div className="spinner" />
      ) : boxes.length === 0 ? (
        <p className="text-muted">No boxes match your filters.</p>
      ) : (
        <div className="grid">
          {boxes.map((box) => (
            <div key={box.id} className="card" onClick={() => navigate(`/boxes/${box.id}`)}>
              <div className="card-title">{box.name}</div>
              <div className="card-desc">{box.description || "No description"}</div>
              <div className="card-cost">💰 {box.cost} coins</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
