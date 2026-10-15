import Meter from "../components/Meter";
import PropertyCard, { CardSkeletons } from "../components/PropertyCard";
import SearchBox from "../components/SearchBox";
import { ScoreRing, shareLink, useToast } from "../components/ui";
import { QUICK_FILTERS } from "../lib/criteria";
import { link } from "../lib/router";
import { displayAddress, overall } from "../lib/stats";

const PREVIEW_KEYS = ["damp", "heating", "epc_reality", "noise", "landlord", "maintenance"];

// Shown only until the first real review exists. Clearly labelled as an example.
const EXAMPLE = [
  { id: "x1", scores: { damp: 2, heating: 2, epc_reality: 1, noise: 4, landlord: 3, maintenance: 2 } },
  { id: "x2", scores: { damp: 1, heating: 3, epc_reality: 2, noise: 4, landlord: 2, maintenance: 1 } },
];

export function ShareInvite() {
  const toast = useToast();
  const url = window.location.origin;
  return (
    <section className="section panel">
      <h2>Ask the people you know</h2>
      <p className="muted" style={{ margin: "10px 0 18px" }}>
        Every friend or family member who has rented in the UK has at least one home they can review.
        Send them Hindsight. The more homes on here, the fewer people sign for a place with mould behind the wardrobe.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => shareLink({
        title: "Hindsight",
        text: "Rented anywhere in the UK? Review the places you've lived on Hindsight, and check a home before you sign for it.",
        url,
      }, toast)}>
        Share Hindsight
      </button>
    </section>
  );
}

export default function Home({ properties, loading, error }) {
  const latest = properties[0];
  const previewReviews = latest ? latest.reviews : EXAMPLE;
  const reviewCount = properties.reduce((s, p) => s + p.reviews.length, 0);

  return (
    <main className="page">
      <div className="wrap">
        <section className="hero">
          <div>
            <p className="hero-kicker">Unfiltered reviews from real tenants</p>
            <h1>Know what you are renting before you sign.</h1>
            <p className="hero-lede">
              Damp, heating, the landlord, the deposit. Previous tenants score 21 things the listing photos never show.
            </p>
            <SearchBox properties={properties} />
            <div className="chips scroll" style={{ marginTop: 16 }}>
              {QUICK_FILTERS.map((f) => (
                <a key={f.key} className="chip" href={link(`/search?rank=${f.key}`)}>{f.label}</a>
              ))}
            </div>
            {!loading && !error && (
              <p className="hero-count">
                {reviewCount > 0
                  ? <><strong>{properties.length}</strong> {properties.length === 1 ? "home" : "homes"} and <strong>{reviewCount}</strong> {reviewCount === 1 ? "review" : "reviews"} so far.</>
                  : "No reviews yet. The first one could be yours."}
              </p>
            )}
          </div>

          <a className="panel" href={latest ? link(`/property/${latest.id}`) : link("/review")}
            style={{ textDecoration: "none", display: "block", boxShadow: "var(--shadow)" }}>
            <div className="spread" style={{ marginBottom: 18 }}>
              <div>
                <span className={`tag ${latest ? "amber" : "info"}`}>{latest ? "Latest review" : "Example report"}</span>
                <h3 style={{ marginTop: 10 }}>{latest ? displayAddress(latest) : "2-bed flat, Bristol"}</h3>
                <p className="muted small">
                  {latest ? [latest.area, latest.city].filter(Boolean).join(", ") : "How a report reads once tenants have scored a home"}
                </p>
              </div>
              <ScoreRing score={overall(previewReviews)} size={64} />
            </div>
            <Meter reviews={previewReviews} keys={PREVIEW_KEYS} />
            <p className="small" style={{ marginTop: 16, color: "var(--amber-text)", fontWeight: 600 }}>
              {latest ? "Open the full report" : "Leave the first real review"}
            </p>
          </a>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Recently reviewed</h2>
            {properties.length > 3 && <a className="btn btn-ghost btn-sm" href={link("/search")}>See all</a>}
          </div>
          {loading && <CardSkeletons />}
          {error && <p className="note bad">{error}</p>}
          {!loading && !error && properties.length === 0 && (
            <div className="panel empty">
              <h3>Nothing here yet</h3>
              <p>Hindsight is new. Review the last place you rented and it will appear here for everyone searching that postcode.</p>
              <a className="btn btn-primary" href={link("/review")}>Leave a review</a>
            </div>
          )}
          {!loading && properties.length > 0 && (
            <div className="cards rail">
              {properties.slice(0, 8).map((p) => <PropertyCard key={p.id} property={p} />)}
            </div>
          )}
        </section>

        <section className="section">
          <h2 style={{ marginBottom: 18 }}>How it works</h2>
          <ol className="steps">
            <li><span className="step-num">1</span><strong>Search the postcode</strong><span className="muted">Before a viewing, look up the street or the exact address.</span></li>
            <li><span className="step-num">2</span><strong>Read the scores</strong><span className="muted">Tap any score to see what tenants actually said about it.</span></li>
            <li><span className="step-num">3</span><strong>Pay it forward</strong><span className="muted">When you move out, review the place in about five minutes.</span></li>
          </ol>
        </section>

        <ShareInvite />
      </div>
    </main>
  );
}
