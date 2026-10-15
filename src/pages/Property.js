import { useCallback, useEffect, useMemo, useState } from "react";
import Meter from "../components/Meter";
import { Icon, ScoreRing, Sheet, shareLink, useToast } from "../components/ui";
import { fetchProperty, reportReview } from "../lib/api";
import { sendForm } from "../lib/notify";
import { CRITERIA, DETAILS, GROUPS, REPORT_REASONS } from "../lib/criteria";
import { go, link } from "../lib/router";
import { avg, displayAddress, fmt, monthLabel, overall, reviewAvg } from "../lib/stats";

function ReportSheet({ review, propertyLabel, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await reportReview(review.id, reason, details, email);
      sendForm("review-report", { review_id: review.id, property: propertyLabel, reason, details, email, subject: `Hindsight: review reported at ${propertyLabel}` }).catch(() => {});
      toast("Report sent. We review every report within 48 hours.");
      onClose();
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  };
  return (
    <Sheet title="Report this review" onClose={onClose}>
      <div className="stack">
        <p className="small muted">Tell us what is wrong. Landlords and agents can use this to dispute a review.</p>
        <div className="addr-list" style={{ maxHeight: "none" }}>
          {REPORT_REASONS.map((r) => (
            <button type="button" key={r.value} className={`addr-item${reason === r.value ? " on" : ""}`} onClick={() => setReason(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Details (optional)</span>
          <textarea className="input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
        </label>
        <label className="field">
          <span>Your email (optional)</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="So we can reply" />
          <small>Only used to respond to this report. Never shown on the site.</small>
        </label>
        <button type="button" className="btn btn-primary btn-block" disabled={!reason || busy} onClick={send}>
          {busy ? "Sending" : "Send report"}
        </button>
      </div>
    </Sheet>
  );
}

function ReviewItem({ review, onReport }) {
  const low = CRITERIA.filter((c) => review.scores[c.key] <= 3 && review.explanations && review.explanations[c.key]);
  const d = review.details || {};
  return (
    <article className="review">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <div className="avatar" aria-hidden="true">{(review.author_name || "?").charAt(0).toUpperCase()}</div>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <strong style={{ color: "var(--strong)" }}>{review.author_name}</strong>
              {review.verified
                ? <span className="tag good"><Icon name="check" size={12} stroke={3} /> Verified tenant</span>
                : <span className="tag">Not yet verified</span>}
            </div>
            <p className="tiny muted">Lived here {monthLabel(review.moved_in)} to {monthLabel(review.moved_out)}</p>
          </div>
        </div>
        <ScoreRing score={reviewAvg(review)} size={44} stroke={4} />
      </div>
      <h3 style={{ marginTop: 14 }}>{review.summary}</h3>
      <p className="muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{review.body}</p>
      {low.length > 0 && (
        <div className="why">
          {low.map((c) => (
            <div key={c.key}>
              <strong style={{ color: `var(--s${review.scores[c.key]})` }}>{c.label} {review.scores[c.key]}/5.</strong>{" "}
              <span className="muted">{review.explanations[c.key]}</span>
            </div>
          ))}
        </div>
      )}
      {d.deposit_returned && (
        <p className="small" style={{ marginTop: 12 }}>
          <strong style={{ color: "var(--strong)" }}>Deposit:</strong>{" "}
          <span className="muted">{d.deposit_returned}{d.deposit_issues ? `. ${d.deposit_issues}` : ""}</span>
        </p>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <span className="tiny muted">Posted {new Date(review.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        <button type="button" className="btn-quiet tiny row" style={{ gap: 4, minHeight: 32 }} onClick={() => onReport(review)}>
          <Icon name="flag" size={14} /> Report
        </button>
      </div>
    </article>
  );
}

function tally(reviews, key) {
  const counts = {};
  reviews.forEach((r) => {
    const v = r.details && r.details[key];
    if (Array.isArray(v)) v.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
    else if (v) counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export default function Property({ id }) {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, property: null, error: null });
  const [group, setGroup] = useState("all");
  const [reporting, setReporting] = useState(null);
  const closeReport = useCallback(() => setReporting(null), []);

  useEffect(() => {
    let live = true;
    setState({ loading: true, property: null, error: null });
    fetchProperty(id)
      .then((property) => live && setState({ loading: false, property, error: null }))
      .catch((e) => live && setState({ loading: false, property: null, error: e.message }));
    return () => { live = false; };
  }, [id]);

  const property = state.property;
  const reviews = useMemo(() => (property ? property.reviews || [] : []), [property]);

  if (state.loading) {
    return <main className="page"><div className="wrap stack"><div className="skeleton" style={{ height: 160 }} /><div className="skeleton" style={{ height: 420 }} /></div></main>;
  }
  if (state.error || !property || reviews.length === 0) {
    return (
      <main className="page"><div className="wrap">
        <div className="panel empty">
          <h3>{state.error ? "This report could not load" : "This home has no published reviews"}</h3>
          <p>{state.error || "It may have been removed after a report."}</p>
          <a className="btn btn-primary" href={link("/search")}>Back to search</a>
        </div>
      </div></main>
    );
  }

  const score = overall(reviews);
  const keys = group === "all" ? null : CRITERIA.filter((c) => c.group === group).map((c) => c.key);
  const strengths = CRITERIA.filter((c) => avg(reviews, c.key) >= 4);
  const warnings = CRITERIA.filter((c) => avg(reviews, c.key) <= 2.5);
  const deposits = reviews.filter((r) => r.details && r.details.deposit_returned);
  const fullBack = deposits.filter((r) => r.details.deposit_returned === "All of it").length;
  const works = tally(reviews, "retrofit_works").filter(([w]) => w !== "None" && w !== "Not sure");
  const difference = tally(reviews, "retrofit_difference");
  const epcBands = tally(reviews, "epc_band").filter(([b]) => b !== "Not sure");
  const latest = reviews[0].details || {};
  const facts = DETAILS.filter((f) => f.type === "one" && f.key !== "epc_band" && f.key !== "deposit_returned" && latest[f.key]);
  const title = displayAddress(property);
  const url = `${window.location.origin}/#/property/${property.id}`;

  return (
    <main className="page">
      <div className="wrap">
        <a className="btn-quiet row small" href={link("/search")} style={{ gap: 4, paddingLeft: 0, display: "inline-flex", minHeight: 36 }}>
          <Icon name="back" size={16} /> Search
        </a>

        <section className="panel" style={{ marginTop: 8 }}>
          <div className="spread" style={{ alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              {property.property_type && <span className="tag amber">{property.property_type}</span>}
              <h1 style={{ fontSize: "clamp(1.7rem, 4.4vw, 2.6rem)", marginTop: 10 }}>{title}</h1>
              <p className="muted loc">
                <Icon name="pin" size={16} /> <span>{[property.area, property.city, property.postcode].filter(Boolean).join(", ")}</span>
              </p>
            </div>
            <div className="row" style={{ gap: 14 }}>
              <ScoreRing score={score} size={92} stroke={8} />
              <p className="small muted" style={{ maxWidth: "12ch" }}>
                Average from {reviews.length} {reviews.length === 1 ? "tenant" : "tenants"}
              </p>
            </div>
          </div>
          <div className="row" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-primary" onClick={() => go(`/review?property=${property.id}`)}>
              <Icon name="pen" size={18} /> Review this home
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => shareLink({ title, text: `Tenant reviews for ${title}, ${property.postcode} on Hindsight.`, url }, toast)}>
              <Icon name="share" size={18} /> Share
            </button>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 18, marginTop: 18, alignItems: "start" }}>
          <section className="panel">
            <div className="spread" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.3rem" }}>Scores</h2>
              <div className="seg" role="tablist" aria-label="Show scores for">
                <button type="button" role="tab" aria-selected={group === "all"} className={group === "all" ? "on" : ""} onClick={() => setGroup("all")}>All</button>
                {Object.entries(GROUPS).map(([k, g]) => (
                  <button type="button" role="tab" key={k} aria-selected={group === k} className={group === k ? "on" : ""} onClick={() => setGroup(k)}>{g.short}</button>
                ))}
              </div>
            </div>
            <p className="tiny muted" style={{ marginBottom: 12 }}>Tap a score to read what tenants said.</p>
            <Meter key={group} reviews={reviews} keys={keys} expandable />
          </section>

          <div className="stack" style={{ marginTop: 0 }}>
            {(strengths.length > 0 || warnings.length > 0) && (
              <section className="panel">
                {warnings.length > 0 && (
                  <>
                    <h3>Watch out for</h3>
                    <div className="chips" style={{ margin: "10px 0 16px" }}>
                      {warnings.map((c) => <span key={c.key} className="tag bad">{c.icon} {c.label} {fmt(avg(reviews, c.key))}</span>)}
                    </div>
                  </>
                )}
                {strengths.length > 0 && (
                  <>
                    <h3>Strengths</h3>
                    <div className="chips" style={{ marginTop: 10 }}>
                      {strengths.map((c) => <span key={c.key} className="tag good">{c.icon} {c.label} {fmt(avg(reviews, c.key))}</span>)}
                    </div>
                  </>
                )}
              </section>
            )}

            {deposits.length > 0 && (
              <section className="panel">
                <h3>Deposits</h3>
                <p className="muted" style={{ marginTop: 6 }}>
                  <strong style={{ color: "var(--strong)", fontFamily: "var(--serif)", fontSize: "1.3rem" }}>{fullBack} of {deposits.length}</strong>{" "}
                  {deposits.length === 1 ? "tenant" : "tenants"} got the full deposit back.
                </p>
              </section>
            )}

            {(epcBands.length > 0 || works.length > 0) && (
              <section className="panel">
                <h3>Energy</h3>
                {epcBands.length > 0 && (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Certificate rating reported: <strong style={{ color: "var(--strong)" }}>{epcBands.map(([b]) => b).join(", ")}</strong>.
                    Tenants scored the certificate against real life at <strong style={{ color: "var(--strong)" }}>{fmt(avg(reviews, "epc_reality"))} out of 5</strong>.
                  </p>
                )}
                {works.length > 0 && (
                  <>
                    <p className="small" style={{ marginTop: 12, color: "var(--strong)", fontWeight: 500 }}>Upgrades tenants saw done</p>
                    <div className="chips" style={{ marginTop: 8 }}>
                      {works.map(([w, n]) => <span key={w} className="tag info">{w}{n > 1 ? ` (${n})` : ""}</span>)}
                    </div>
                    {difference.length > 0 && (
                      <p className="small muted" style={{ marginTop: 10 }}>
                        Effect: {difference.map(([d, n]) => `${d.toLowerCase()} (${n})`).join(", ")}.
                      </p>
                    )}
                  </>
                )}
                <p className="tiny muted" style={{ marginTop: 12 }}>
                  Check the official certificate on <a href="https://www.gov.uk/find-energy-certificate" target="_blank" rel="noopener noreferrer">GOV.UK</a>.
                </p>
              </section>
            )}

            {facts.length > 0 && (
              <section className="panel">
                <h3>Set-up, from the latest review</h3>
                <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginTop: 12 }}>
                  {facts.map((f) => (
                    <div key={f.key}>
                      <dt className="tiny muted">{f.label}</dt>
                      <dd className="small" style={{ color: "var(--strong)" }}>{latest[f.key]}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <p className="small muted">
              Mobile signal scored {fmt(avg(reviews, "mobile_signal"))}.{" "}
              <a href="https://www.ofcom.org.uk/mobile-coverage-checker" target="_blank" rel="noopener noreferrer">Check coverage on Ofcom</a>.
            </p>
          </div>
        </div>

        <section className="section">
          <h2>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</h2>
          <div style={{ marginTop: 8 }}>
            {reviews.map((r) => <ReviewItem key={r.id} review={r} onReport={setReporting} />)}
          </div>
        </section>
      </div>
      {reporting && <ReportSheet review={reporting} propertyLabel={`${displayAddress(property)}, ${property.postcode}`} onClose={closeReport} />}
    </main>
  );
}
