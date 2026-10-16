import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/ui";
import { adminAction, adminOverview } from "../lib/api";
import { link, setAddress } from "../lib/router";
import { useSeo } from "../lib/seo";
import { displayAddress, propertyPath } from "../lib/stats";

// Owner-only page. Opened with a private link: /admin#k=YOUR-KEY
// The key is remembered on this device so the plain /admin address works after.

const KEY_STORE = "hindsight-admin-key";
const PROOF = { council_tax: "Council tax", utility: "Bills in their name", electoral: "Electoral roll" };
const REASON = {
  false: "False statements of fact", personal: "Names or exposes a private person", offensive: "Abusive or offensive",
  not_tenant: "Writer did not live there", other: "Something else",
};

function readKey() {
  const m = window.location.hash.match(/k=([A-Za-z0-9_-]+)/);
  if (m) {
    try { localStorage.setItem(KEY_STORE, m[1]); } catch { /* storage unavailable */ }
    setAddress("/admin");
    return m[1];
  }
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}

const when = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const place = (x) => `${displayAddress(x)}, ${x.postcode}`;

function Card({ children }) {
  return <div className="panel admin-card">{children}</div>;
}

export default function Admin() {
  useSeo({ title: "Admin | Hindsight", noindex: true });
  const toast = useToast();
  const [key, setKey] = useState(readKey);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    if (!key) return;
    setError("");
    adminOverview(key).then(setData).catch((e) => setError(e.message));
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const act = async (kind, id, action, done, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(`${kind}-${id}-${action}`);
    try {
      await adminAction(kind, key, id, action);
      toast(done);
      load();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy("");
    }
  };
  const isBusy = (kind, id, action) => busy === `${kind}-${id}-${action}`;

  const signOut = () => {
    try { localStorage.removeItem(KEY_STORE); } catch { /* storage unavailable */ }
    setKey(""); setData(null);
  };

  if (!key) {
    return (
      <main className="page"><div className="wrap flow">
        <div className="panel empty">
          <h3>This page is for the site owner</h3>
          <p>Open it with your private admin link.</p>
          <a className="btn btn-primary" href={link("/")}>Back to Hindsight</a>
        </div>
      </div></main>
    );
  }

  return (
    <main className="page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="spread">
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)" }}>Admin</h1>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
            <button type="button" className="btn-quiet small" onClick={signOut}>Sign out on this device</button>
          </div>
        </div>
        {error && <p className="note bad" style={{ marginTop: 16 }}>{error}</p>}
        {!data && !error && <div className="skeleton" style={{ height: 240, marginTop: 20 }} />}

        {data && (
          <>
            <p className="muted" style={{ marginTop: 8 }}>
              {data.counts.published_reviews} published reviews of {data.counts.homes} homes, {data.counts.published_replies} published replies.
            </p>

            <section className="section">
              <h2>Waiting for approval ({data.pending_reviews.length})</h2>
              {data.pending_reviews.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Nothing waiting.</p>}
              {data.pending_reviews.map((r) => (
                <Card key={r.id}>
                  <p className="tiny muted">{when(r.created_at)} at <a href={link(propertyPath({ ...r, id: r.property_id }))}>{place(r)}</a></p>
                  <p className="note info" style={{ margin: "10px 0" }}>Held because it mentions {r.moderation_note}.</p>
                  <h3>{r.summary}</h3>
                  <p className="small muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{r.body}</p>
                  {r.explanations && Object.keys(r.explanations).length > 0 && (
                    <div className="why small">
                      {Object.entries(r.explanations).map(([k, v]) => <div key={k}><strong>{k.replace(/_/g, " ")}:</strong> <span className="muted">{v}</span></div>)}
                    </div>
                  )}
                  <p className="tiny muted" style={{ marginTop: 10 }}>
                    By {r.author_name}. Proof offered: {PROOF[r.verify_method] || "none"}. Email: {r.contact_email || "not given"}.
                  </p>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={isBusy("review", r.id, "publish")}
                      onClick={() => act("review", r.id, "publish", "Review published.")}>Publish</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("review", r.id, "hide")}
                      onClick={() => act("review", r.id, "hide", "Review rejected.", "Reject this review? It will stay hidden.")}>Reject</button>
                  </div>
                </Card>
              ))}
            </section>

            <section className="section">
              <h2>Landlord and agent replies ({data.pending_replies.length})</h2>
              {data.pending_replies.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Nothing waiting.</p>}
              {data.pending_replies.map((rp) => (
                <Card key={rp.id}>
                  <p className="tiny muted">{when(rp.created_at)} at <a href={link(propertyPath({ ...rp, id: rp.property_id }))}>{place(rp)}</a></p>
                  <p className="small" style={{ marginTop: 8 }}>Replying to “{rp.review_summary}” by {rp.review_author}</p>
                  <h3 style={{ marginTop: 10 }}>{rp.responder_name} <span className="muted small">({rp.responder_role})</span></h3>
                  <p className="small muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{rp.body}</p>
                  <p className="tiny muted" style={{ marginTop: 10 }}>Email: {rp.contact_email}. Check they are connected to the property before publishing.</p>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={isBusy("reply", rp.id, "publish")}
                      onClick={() => act("reply", rp.id, "publish", "Reply published.")}>Publish</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("reply", rp.id, "reject")}
                      onClick={() => act("reply", rp.id, "reject", "Reply rejected.", "Reject this reply?")}>Reject</button>
                  </div>
                </Card>
              ))}
            </section>

            <section className="section">
              <h2>Reports ({data.open_reports.length})</h2>
              <p className="small muted" style={{ marginTop: 6 }}>Act within 48 hours. If a report says a review is untrue, contact the reviewer where you can, or hide it.</p>
              {data.open_reports.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No open reports.</p>}
              {data.open_reports.map((rep) => (
                <Card key={rep.id}>
                  <p className="tiny muted">{when(rep.created_at)} at <a href={link(propertyPath({ ...rep, id: rep.property_id }))}>{place(rep)}</a></p>
                  <h3 style={{ marginTop: 8 }}>{REASON[rep.reason] || rep.reason}</h3>
                  {rep.details && <p className="small muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{rep.details}</p>}
                  <p className="small" style={{ marginTop: 8 }}>About “{rep.review_summary}” by {rep.review_author} ({rep.review_status})</p>
                  <p className="tiny muted" style={{ marginTop: 6 }}>Reporter email: {rep.contact_email || "not given"}</p>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={isBusy("report", rep.id, "actioned")}
                      onClick={async () => {
                        if (!window.confirm("Hide the review and close this report?")) return;
                        await act("review", rep.review_id, "hide", "Review hidden.");
                        await act("report", rep.id, "actioned", "Report closed.");
                      }}>Hide the review</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("report", rep.id, "rejected")}
                      onClick={() => act("report", rep.id, "rejected", "Report closed. The review stays up.")}>Keep it up</button>
                  </div>
                </Card>
              ))}
            </section>

            <section className="section">
              <h2>Recent reviews</h2>
              {data.recent_reviews.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No published reviews yet.</p>}
              {data.recent_reviews.map((r) => (
                <Card key={r.id}>
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="tiny muted">{when(r.created_at)} at <a href={link(propertyPath({ ...r, id: r.property_id }))}>{place(r)}</a></p>
                      <p style={{ marginTop: 4, color: "var(--strong)" }}>{r.summary}</p>
                      <p className="tiny muted" style={{ marginTop: 4 }}>
                        By {r.author_name}. Proof offered: {PROOF[r.verify_method] || "none"}. Email: {r.contact_email || "not given"}.
                        {r.report_count > 0 ? ` Reported ${r.report_count} times.` : ""}
                      </p>
                    </div>
                    {r.verified && <span className="tag good">Verified</span>}
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("review", r.id, r.verified ? "unverify" : "verify")}
                      onClick={() => act("review", r.id, r.verified ? "unverify" : "verify", r.verified ? "Verified badge removed." : "Marked as verified.")}>
                      {r.verified ? "Remove verified badge" : "Mark as verified"}
                    </button>
                    <button type="button" className="btn-quiet small" disabled={isBusy("review", r.id, "hide")}
                      onClick={() => act("review", r.id, "hide", "Review hidden.", "Hide this review from the site?")}>Hide</button>
                  </div>
                </Card>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
