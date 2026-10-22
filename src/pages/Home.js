import Meter from "../components/Meter";
import PropertyCard, { CardSkeletons } from "../components/PropertyCard";
import SearchBox from "../components/SearchBox";
import { Icon, ScoreRing, shareLink, useToast } from "../components/ui";
import { SITE_URL } from "../config";
import { QUICK_FILTERS } from "../lib/criteria";
import { link } from "../lib/router";
import { displayAddress, overall, propertyPath } from "../lib/stats";

const PREVIEW_KEYS = ["damp", "heating", "epc_reality", "noise", "landlord", "maintenance"];

export function ShareInvite() {
  const toast = useToast();
  const url = SITE_URL;
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
              <a className="chip" href={link("/search?view=map")}><Icon name="pin" size={14} /> See the map</a>
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

          {latest ? (
            <a className="panel" href={link(propertyPath(latest))}
              style={{ textDecoration: "none", display: "block", boxShadow: "var(--shadow)" }}>
              <div className="spread" style={{ marginBottom: 18 }}>
                <div>
                  <span className="tag amber">Latest review</span>
                  <h3 style={{ marginTop: 10 }}>{displayAddress(latest)}</h3>
                  <p className="muted small">{[latest.area, latest.city].filter(Boolean).join(", ")}</p>
                </div>
                <ScoreRing score={overall(latest.reviews)} size={64} />
              </div>
              <Meter reviews={latest.reviews} keys={PREVIEW_KEYS} />
              <p className="small" style={{ marginTop: 16, color: "var(--amber-text)", fontWeight: 600 }}>Open the full report</p>
            </a>
          ) : (
            <a className="panel" href={link("/review")}
              style={{ textDecoration: "none", display: "block", boxShadow: "var(--shadow)" }}>
              <span className="tag amber">Be the first</span>
              <h3 style={{ marginTop: 10 }}>Reviews appear here as tenants write them</h3>
              <p className="muted small" style={{ marginTop: 8 }}>
                Every review on Hindsight is written by someone who rented the home. Review the last place you lived and it shows here first.
              </p>
              <p className="small" style={{ marginTop: 16, color: "var(--amber-text)", fontWeight: 600 }}>Leave a review</p>
            </a>
          )}
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
