import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import PropertyCard, { CardSkeletons } from "../components/PropertyCard";
import SearchBox, { matches } from "../components/SearchBox";
import { Icon } from "../components/ui";
import { CRITERION, QUICK_FILTERS } from "../lib/criteria";
import { looksLikePostcodeStart, lookupOutcode, lookupPostcode, normalisePostcode } from "../lib/address";
import { go, link, setAddress } from "../lib/router";
import { avg, fmt, milesBetween, overall } from "../lib/stats";

const HomesMap = lazy(() => import("../components/HomesMap"));
const NEARBY_MILES = 3;

function addressFor({ q, rank, view }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (rank) params.set("rank", rank);
  if (view === "map") params.set("view", "map");
  const s = params.toString();
  return `/search${s ? `?${s}` : ""}`;
}

export default function Search({ properties, loading, error, route }) {
  const [q, setQ] = useState(route.query.get("q") || "");
  const [rank, setRank] = useState(route.query.get("rank") || "");
  const [view, setView] = useState(route.query.get("view") === "map" ? "map" : "list");
  const [sort, setSort] = useState("score");
  const [boxKey, setBoxKey] = useState(0);
  const [centre, setCentre] = useState(null);
  const [locating, setLocating] = useState("");

  const trimmed = q.trim();
  const postcode = normalisePostcode(trimmed);
  const outward = looksLikePostcodeStart(trimmed) ? trimmed.toUpperCase().split(/\s+/)[0] : "";

  useEffect(() => { setAddress(addressFor({ q: trimmed, rank, view })); }, [trimmed, rank, view]);

  // In map view, a postcode or district becomes the centre of the search.
  useEffect(() => {
    if (view !== "map") return undefined;
    let live = true;
    // Wait for typing to pause before moving the map.
    const timer = setTimeout(() => {
      if (postcode) {
        lookupPostcode(postcode)
          .then((r) => live && setCentre({ lat: r.lat, lon: r.lon, zoom: 14, label: r.postcode }))
          .catch(() => live && setCentre(null));
      } else if (outward && /^[A-Z]{1,2}[0-9][A-Z0-9]?$/.test(outward) && trimmed.toUpperCase() === outward) {
        lookupOutcode(outward)
          .then((r) => live && setCentre({ lat: r.lat, lon: r.lon, zoom: 13, label: r.label }))
          .catch(() => live && setCentre(null));
      } else {
        setCentre((c) => (c && c.label === "your location" ? c : null));
      }
    }, 450);
    return () => { live = false; clearTimeout(timer); };
  }, [view, postcode, outward, trimmed]);

  const results = useMemo(() => {
    const list = properties.filter((p) => matches(p, q));
    return [...list].sort((a, b) => {
      if (rank) return avg(b.reviews, rank) - avg(a.reviews, rank);
      if (sort === "reviews") return b.reviews.length - a.reviews.length;
      if (sort === "newest") return new Date(b.created_at) - new Date(a.created_at);
      return overall(b.reviews) - overall(a.reviews);
    });
  }, [properties, q, rank, sort]);

  // Distance from the map centre, nearest first.
  const nearby = useMemo(() => {
    if (!centre) return [];
    return properties
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({ p, miles: milesBetween(centre.lat, centre.lon, p.latitude, p.longitude) }))
      .sort((a, b) => a.miles - b.miles);
  }, [properties, centre]);
  const within = nearby.filter((x) => x.miles <= NEARBY_MILES);

  const toggleRank = (key) => setRank((r) => (r === key ? "" : key));

  const nearMe = () => {
    if (!navigator.geolocation) { setLocating("Your browser cannot share your location."); return; }
    setLocating("Finding you");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating("");
        setView("map");
        setCentre({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 14, label: "your location" });
      },
      () => setLocating("Location was not shared. Search a postcode instead."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const mapHomes = centre ? nearby.map((x) => x.p) : results;

  return (
    <main className="page">
      <div className="wrap">
        <div className="spread" style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)" }}>Search homes</h1>
          <div className="seg" role="tablist" aria-label="Show results as">
            <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
            <button type="button" role="tab" aria-selected={view === "map"} className={view === "map" ? "on" : ""} onClick={() => setView("map")}>Map</button>
          </div>
        </div>
        <SearchBox key={boxKey} properties={properties} initial={q} onSearch={(v) => { setQ(v); if (centre && centre.label === "your location") setCentre(null); }} autoFocus={!q && !rank && view === "list"} />

        <div className="chips scroll" style={{ marginTop: 16 }} aria-label="Rank by">
          <button type="button" className="chip" onClick={nearMe}><Icon name="pin" size={14} /> Near me</button>
          {QUICK_FILTERS.map((f) => (
            <button type="button" key={f.key} className={`chip${rank === f.key ? " on" : ""}`} aria-pressed={rank === f.key}
              onClick={() => toggleRank(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        {locating && <p className="small muted" style={{ marginTop: 10 }}>{locating}</p>}

        {loading && <div style={{ marginTop: 22 }}><CardSkeletons count={4} /></div>}
        {error && <p className="note bad" style={{ marginTop: 22 }}>{error}</p>}

        {!loading && !error && view === "map" && (
          <section style={{ marginTop: 20 }}>
            <Suspense fallback={<div className="skeleton map" />}>
              <HomesMap properties={mapHomes} centre={centre} label={centre ? centre.label : ""} />
            </Suspense>
            <p className="small muted" style={{ marginTop: 10 }}>
              {centre
                ? within.length
                  ? `${within.length} reviewed ${within.length === 1 ? "home" : "homes"} within ${NEARBY_MILES} miles of ${centre.label}.`
                  : nearby.length
                    ? `No reviewed homes within ${NEARBY_MILES} miles of ${centre.label} yet. These are the nearest.`
                    : "No reviewed homes with a map position yet."
                : trimmed
                  ? `${mapHomes.filter((p) => p.latitude != null).length} matching homes on the map. Search a postcode to see what is nearby.`
                  : "Every reviewed home. Search a postcode, or use Near me, to zoom in."}
            </p>
            {centre && nearby.length > 0 && (
              <div className="cards" style={{ marginTop: 14 }}>
                {(within.length ? within : nearby.slice(0, 6)).map(({ p, miles }) => (
                  <PropertyCard key={p.id} property={p} highlight={`${miles < 0.1 ? "Under 0.1" : miles.toFixed(1)} miles away`} />
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && !error && view === "list" && results.length > 0 && (
          <>
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
            <div className="cards">
              {results.map((p) => (
                <PropertyCard key={p.id} property={p}
                  highlight={rank ? `${CRITERION[rank].label} ${fmt(avg(p.reviews, rank))}` : null} />
              ))}
            </div>
          </>
        )}

        {!loading && !error && view === "list" && results.length === 0 && (
          <div className="panel empty" style={{ marginTop: 22 }}>
            <h3>{trimmed ? `No reviews for "${trimmed}" yet` : "No reviews yet"}</h3>
            <p>
              {outward && postcode
                ? `Nobody has reviewed this exact postcode yet. See what is nearby on the map, or try just ${outward}.`
                : trimmed
                  ? "Try a postcode instead, for example N4 or BS1, or check the spelling."
                  : "Be the first to put a home on the map."}
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              {postcode && <button type="button" className="btn btn-ghost" onClick={() => setView("map")}>Show nearby on the map</button>}
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
