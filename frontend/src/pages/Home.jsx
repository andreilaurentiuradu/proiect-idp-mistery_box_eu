import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function boxTier(cost) {
  if (cost <= 100) return "starter";
  if (cost <= 300) return "adventure";
  if (cost <= 800) return "epic";
  return "legendary";
}

function boxEmoji(cost) {
  if (cost <= 100) return "📦";
  if (cost <= 300) return "🎁";
  if (cost <= 800) return "💎";
  return "👑";
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch]   = useState(searchParams.get("search")   || "");
  const [minCost, setMinCost] = useState(searchParams.get("min_cost") || "");
  const [maxCost, setMaxCost] = useState(searchParams.get("max_cost") || "");
  const [sort, setSort]       = useState(searchParams.get("sort")     || "");

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
    if (search.trim())  p.search   = search.trim();
    if (minCost.trim()) p.min_cost = minCost.trim();
    if (maxCost.trim()) p.max_cost = maxCost.trim();
    if (sort)           p.sort     = sort;
    setSearchParams(p);
  };

  const handleClear = () => {
    setSearch(""); setMinCost(""); setMaxCost(""); setSort("");
    setSearchParams({});
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1>Mystery Boxes</h1>
        <div className="alert alert-info" style={{ margin: 0, padding: "0.4rem 1rem" }}>
          💰 <strong>{user?.deposit ?? "…"} coins</strong>
        </div>
      </div>

      {/* Filter bar */}
      <form className="filter-bar" onSubmit={handleFilter}>
        <div style={{ flex: "2 1 180px" }}>
          <label>Search</label>
          <input className="filter-input" type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…" />
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <label>Min price</label>
          <input className="filter-input" type="number" min="0" value={minCost}
            onChange={(e) => setMinCost(e.target.value)} placeholder="0" />
        </div>
        <div style={{ flex: "1 1 90px" }}>
          <label>Max price</label>
          <input className="filter-input" type="number" min="0" value={maxCost}
            onChange={(e) => setMaxCost(e.target.value)} placeholder="∞" />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label>Sort</label>
          <select className="filter-input" value={sort} onChange={(e) => setSort(e.target.value)}>
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
        <div className="boxes-grid">
          {boxes.map((box) => {
            const tier = boxTier(box.cost);
            const emoji = boxEmoji(box.cost);
            const canOpen = (user?.deposit ?? 0) >= box.cost;
            return (
              <div
                key={box.id}
                className={`box-card tier-${tier}`}
                onClick={() => navigate(`/boxes/${box.id}`)}
              >
                <div className="box-card-banner">
                  <span style={{ position: "relative", zIndex: 1 }}>{emoji}</span>
                </div>
                <div className="box-card-body">
                  <div className="box-card-name">{box.name}</div>
                  <div className="box-card-desc">{box.description || "No description"}</div>
                  <div className="box-card-footer">
                    <span className="box-card-price">💰 {box.cost}</span>
                    <button
                      className="box-card-open-btn"
                      disabled={!canOpen}
                      onClick={(e) => { e.stopPropagation(); navigate(`/boxes/${box.id}`); }}
                    >
                      {canOpen ? "Open →" : "Need more coins"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
