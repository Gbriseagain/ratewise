import { useMemo, useState } from "react";
import PropertyCard, { CardSkeletons } from "../components/PropertyCard";
import SearchBox, { matches } from "../components/SearchBox";
import { CRITERION, QUICK_FILTERS } from "../lib/criteria";
import { looksLikePostcodeStart, normalisePostcode } from "../lib/address";
import { go, link } from "../lib/router";
import { avg, fmt, overall } from "../lib/stats";

export default function Search({ properties, loading, error, route }) {
  const [q, setQ] = useState(route.query.get("q") || "");
  const [rank, setRank] = useState(route.query.get("rank") || "");
  const [sort, setSort] = useState("score");
  const [boxKey, setBoxKey] = useState(0);

  const results = useMemo(() => {
    const list = properties.filter((p) => matches(p, q));
    return [...list].sort((a, b) => {
      if (rank) return avg(b.reviews, rank) - avg(a.reviews, rank);
      if (sort === "reviews") return b.reviews.length - a.reviews.length;
      if (sort === "newest") return new Date(b.created_at) - new Date(a.created_at);
      return overall(b.reviews) - overall(a.reviews);
    });
  }, [properties, q, rank, sort]);

  const setRankFilter = (key) => {
    const next = rank === key ? "" : key;
    setRank(next);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (next) params.set("rank", next);
    window.history.replaceState(null, "", `#/search${params.toString() ? `?${params}` : ""}`);
  };

  const trimmed = q.trim();
  const postcode = normalisePostcode(trimmed);
  const outward = looksLikePostcodeStart(trimmed) ? trimmed.toUpperCase().split(/\s+/)[0] : "";

  return (
    <main className="page">
      <div className="wrap">
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", marginBottom: 18 }}>Search homes</h1>
        <SearchBox key={boxKey} properties={properties} initial={q} onSearch={setQ} autoFocus={!q && !rank} />

        <div className="chips scroll" style={{ marginTop: 16 }} aria-label="Rank by">
          {QUICK_FILTERS.map((f) => (
            <button type="button" key={f.key} className={`chip${rank === f.key ? " on" : ""}`} aria-pressed={rank === f.key}
              onClick={() => setRankFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {!loading && !error && results.length > 0 && (
          <div className="spread" style={{ margin: "22px 0 14px" }}>
            <p className="muted small">
              {results.length} {results.length === 1 ? "home" : "homes"}{trimmed ? ` matching "${trimmed}"` : ""}
              {rank ? `, best for ${CRITERION[rank].label.toLowerCase()} first` : ""}
            </p>
            {!rank && (
              <label className="row small muted">
                Sort by
                <select className="input" style={{ minHeight: 38, width: "auto", padding: "6px 10px" }} value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="score">Highest score</option>
                  <option value="reviews">Most reviews</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            )}
          </div>
        )}

        {loading && <div style={{ marginTop: 22 }}><CardSkeletons count={4} /></div>}
        {error && <p className="note bad" style={{ marginTop: 22 }}>{error}</p>}

        {!loading && !error && results.length > 0 && (
          <div className="cards">
            {results.map((p) => (
              <PropertyCard key={p.id} property={p}
                highlight={rank ? `${CRITERION[rank].label} ${fmt(avg(p.reviews, rank))}` : null} />
            ))}
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="panel empty" style={{ marginTop: 22 }}>
            <h3>{trimmed ? `No reviews for "${trimmed}" yet` : "No reviews yet"}</h3>
            <p>
              {outward && postcode
                ? `Nobody has reviewed this exact postcode yet. Try just ${outward} to see homes nearby.`
                : trimmed
                  ? "Try a postcode instead, for example N4 or BS1, or check the spelling."
                  : "Be the first to put a home on the map."}
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              {outward && postcode && <button type="button" className="btn btn-ghost" onClick={() => { setQ(outward); setBoxKey((k) => k + 1); }}>Search {outward}</button>}
              <button type="button" className="btn btn-primary" onClick={() => go(postcode ? `/review?postcode=${encodeURIComponent(postcode)}` : "/review")}>
                Review a home you lived in
              </button>
            </div>
          </div>
        )}

        <p className="small muted" style={{ marginTop: 28 }}>
          Checking a home before a viewing? Look up its energy certificate on <a href="https://www.gov.uk/find-energy-certificate" target="_blank" rel="noopener noreferrer">GOV.UK</a> and
          mobile coverage on <a href="https://www.ofcom.org.uk/mobile-coverage-checker" target="_blank" rel="noopener noreferrer">Ofcom</a>. <a href={link("/about")}>How Hindsight works</a>.
        </p>
      </div>
    </main>
  );
}
