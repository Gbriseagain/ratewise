import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/ui";
import { adminAction, adminEvidence, adminOverview } from "../lib/api";
import { link, setAddress } from "../lib/router";
import { useSeo } from "../lib/seo";
import { displayAddress, monthLabel, propertyPath } from "../lib/stats";
import { sizeLabel } from "../lib/proof";

// Owner-only page. Opened with a private link: /admin#k=YOUR-KEY
// The key is remembered on this device so the plain /admin address works after.

const KEY_STORE = "hindsight-admin-key";
const PROOF = { council_tax: "Council tax", utility: "Bills in their name", electoral: "Electoral roll" };
const REASON = {
  false: "False statements of fact", personal: "Names or exposes a private person", offensive: "Abusive or offensive",
  not_tenant: "Writer did not live there", other: "Something else",
};
const ACTION = {
  approve: "Approved", reject: "Rejected", escalate: "Hid it and asked you", flag: "Left it up and asked you",
  dismiss: "Closed the report", hide_review: "Hid the review",
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
const homeLink = (x) => link(propertyPath({ ...x, id: x.property_id }));

function Card({ children }) {
  return <div className="panel admin-card">{children}</div>;
}

function ProofCard({ pr, adminKey, act, isBusy }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { if (file && file.url) URL.revokeObjectURL(file.url); }, [file]);

  const show = async () => {
    setLoading(true); setError("");
    try {
      const ev = await adminEvidence(adminKey, pr.id);
      const bytes = Uint8Array.from(atob(ev.data.replace(/\s/g, "")), (c) => c.charCodeAt(0));
      setFile({ mime: ev.mime, url: URL.createObjectURL(new Blob([bytes], { type: ev.mime })) });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <p className="tiny muted">Sent {when(pr.evidence_uploaded_at)} for <a href={homeLink(pr)}>{place(pr)}</a></p>
      <h3 style={{ marginTop: 8 }}>{pr.author_name}</h3>
      <p className="small muted" style={{ marginTop: 4 }}>
        Lived there {monthLabel(pr.moved_in)} to {monthLabel(pr.moved_out)}. Said: {PROOF[pr.verify_method] || "not given"}.
        {" "}{pr.mime === "application/pdf" ? "PDF" : "Photo"}, {sizeLabel(pr.bytes)}.
      </p>
      <p className="small" style={{ marginTop: 8 }}>
        Check the name matches <strong>{pr.author_name}</strong> and the address matches <strong>{place(pr)}</strong>.
      </p>
      {!file && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} disabled={loading} onClick={show}>
          {loading ? "Opening" : "Show proof"}
        </button>
      )}
      {error && <p className="note bad" style={{ marginTop: 10 }}>{error}</p>}
      {file && (file.mime === "application/pdf"
        ? (
          <>
            <iframe className="proof-frame" src={file.url} title={`Proof from ${pr.author_name}`} />
            <p className="tiny" style={{ marginTop: 6 }}><a href={file.url} target="_blank" rel="noopener noreferrer">Open the PDF in a new tab</a></p>
          </>
        )
        : <img className="proof-view" src={file.url} alt={`Proof of address from ${pr.author_name}`} />)}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={isBusy("evidence", pr.id, "accept")}
          onClick={() => act("evidence", pr.id, "accept", "Verified. The file has been deleted.")}>Verify</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("evidence", pr.id, "reject")}
          onClick={() => act("evidence", pr.id, "reject", "Not verified. The file has been deleted.", "Not enough proof? The file will be deleted.")}>Not enough proof</button>
      </div>
    </Card>
  );
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

  const needsYou = data
    ? data.pending_reviews.length + data.proofs.length
      + data.pending_replies.filter((r) => r.needs_owner).length + data.open_reports.filter((r) => r.needs_owner).length
    : 0;

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
              {data.counts.published_reviews} published reviews of {data.counts.homes} homes ({data.counts.verified_reviews} verified),
              {" "}{data.counts.published_replies} published replies.
              {data.counts.not_yet_checked > 0 && ` ${data.counts.not_yet_checked} new, Claude checks them twice a day.`}
            </p>
            <p className={`note ${needsYou ? "info" : ""}`} style={{ marginTop: 14 }}>
              {needsYou ? `${needsYou} ${needsYou === 1 ? "thing needs" : "things need"} you. Everything else has been handled.` : "Nothing needs you right now."}
            </p>

            <section className="section">
              <h2>Reviews for you to decide ({data.pending_reviews.length})</h2>
              {data.pending_reviews.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Nothing waiting.</p>}
              {data.pending_reviews.map((r) => {
                const live = r.status === "published";
                return (
                  <Card key={r.id}>
                    <p className="tiny muted">{when(r.created_at)} at <a href={homeLink(r)}>{place(r)}</a></p>
                    <p className="note info" style={{ margin: "10px 0" }}>
                      {r.checked_by === "claude" && r.decision_note
                        ? <>{live ? "Live. " : "Hidden. "}Claude: {r.decision_note}</>
                        : <>Held automatically because it mentions {r.moderation_note || "something to check"}. Claude looks at it on the next check, or decide now.</>}
                    </p>
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
                        onClick={() => act("review", r.id, "publish", live ? "Kept live." : "Review published.")}>{live ? "Keep it live" : "Publish"}</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("review", r.id, "hide")}
                        onClick={() => act("review", r.id, "hide", "Review hidden.", "Hide this review? It will not be shown.")}>{live ? "Hide it" : "Reject"}</button>
                    </div>
                  </Card>
                );
              })}
            </section>

            <section className="section">
              <h2>Proof to check ({data.proofs.length})</h2>
              <p className="small muted" style={{ marginTop: 6 }}>
                Look for the reviewer's name and the address on a council tax bill, utility bill or poll card.
                The file is deleted as soon as you choose.
              </p>
              {data.proofs.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Nothing waiting.</p>}
              {data.proofs.map((pr) => <ProofCard key={pr.id} pr={pr} adminKey={key} act={act} isBusy={isBusy} />)}
            </section>

            <section className="section">
              <h2>Landlord and agent replies ({data.pending_replies.length})</h2>
              {data.pending_replies.length === 0 && <p className="muted" style={{ marginTop: 8 }}>Nothing waiting.</p>}
              {data.pending_replies.map((rp) => (
                <Card key={rp.id}>
                  <p className="tiny muted">{when(rp.created_at)} at <a href={homeLink(rp)}>{place(rp)}</a></p>
                  {rp.needs_owner && rp.decision_note && <p className="note info" style={{ margin: "10px 0" }}>Claude: {rp.decision_note}</p>}
                  <p className="small" style={{ marginTop: 8 }}>Replying to “{rp.review_summary}” by {rp.review_author}</p>
                  <h3 style={{ marginTop: 10 }}>{rp.responder_name} <span className="muted small">({rp.responder_role})</span></h3>
                  <p className="small muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{rp.body}</p>
                  <p className="tiny muted" style={{ marginTop: 10 }}>Email: {rp.contact_email}.</p>
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
              <p className="small muted" style={{ marginTop: 6 }}>Decide within 48 hours. If a report says a review is untrue, contact the reviewer where you can, or keep it hidden.</p>
              {data.open_reports.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No open reports.</p>}
              {data.open_reports.map((rep) => {
                const hidden = rep.review_status === "hidden";
                return (
                  <Card key={rep.id}>
                    <p className="tiny muted">{when(rep.created_at)} at <a href={homeLink(rep)}>{place(rep)}</a></p>
                    {rep.needs_owner && rep.decision_note && (
                      <p className="note info" style={{ margin: "10px 0" }}>
                        {hidden ? "Claude hid the review while you decide. " : "Claude left the review up and asked you. "}{rep.decision_note}
                      </p>
                    )}
                    <h3 style={{ marginTop: 8 }}>{REASON[rep.reason] || rep.reason}</h3>
                    {rep.details && <p className="small muted" style={{ marginTop: 6, whiteSpace: "pre-line" }}>{rep.details}</p>}
                    <p className="small" style={{ marginTop: 8 }}>About “{rep.review_summary}” by {rep.review_author} ({hidden ? "hidden" : "live"})</p>
                    <p className="tiny muted" style={{ marginTop: 6 }}>Reporter email: {rep.contact_email || "not given"}</p>
                    <div className="row" style={{ marginTop: 12 }}>
                      {hidden ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" disabled={isBusy("report", rep.id, "restore")}
                            onClick={() => act("report", rep.id, "restore", "Review back up. Report closed.", "Put the review back up and close this report?")}>Put the review back</button>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("report", rep.id, "hide_review")}
                            onClick={() => act("report", rep.id, "hide_review", "Review stays hidden. Report closed.")}>Keep it hidden</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" disabled={isBusy("report", rep.id, "hide_review")}
                            onClick={() => act("report", rep.id, "hide_review", "Review hidden. Report closed.", "Hide the review and close this report?")}>Hide the review</button>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("report", rep.id, "dismiss")}
                            onClick={() => act("report", rep.id, "dismiss", "Report closed. The review stays up.")}>Keep it up</button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </section>

            <section className="section">
              <h2>What Claude decided</h2>
              <p className="small muted" style={{ marginTop: 6 }}>The latest decisions from the twice-daily checks. You can undo any of them.</p>
              {data.recent_decisions.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No decisions yet.</p>}
              {data.recent_decisions.map((d) => (
                <Card key={d.id}>
                  <p className="tiny muted">
                    {when(d.created_at)}{d.property_id ? <> at <a href={homeLink(d)}>{place(d)}</a></> : null}
                  </p>
                  <p style={{ marginTop: 4, color: "var(--strong)" }}>
                    {d.item_type === "reply" ? `Reply from ${d.responder_name}` : d.item_type === "report" ? "Report" : "Review"}: {ACTION[d.action] || d.action}
                  </p>
                  {d.review_summary && <p className="small muted" style={{ marginTop: 2 }}>“{d.review_summary}”</p>}
                  {d.reason && <p className="small" style={{ marginTop: 6 }}>{d.reason}</p>}
                  {d.item_type === "review" && d.review_id && (
                    <div className="row" style={{ marginTop: 10 }}>
                      {d.review_status === "hidden"
                        ? <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("review", d.review_id, "publish")}
                            onClick={() => act("review", d.review_id, "publish", "Review published.", "Publish this review?")}>Publish anyway</button>
                        : <button type="button" className="btn-quiet small" disabled={isBusy("review", d.review_id, "hide")}
                            onClick={() => act("review", d.review_id, "hide", "Review hidden.", "Hide this review from the site?")}>Hide it</button>}
                    </div>
                  )}
                  {d.item_type === "reply" && d.reply_status === "published" && (
                    <div className="row" style={{ marginTop: 10 }}>
                      <button type="button" className="btn-quiet small" disabled={isBusy("reply", d.item_id, "reject")}
                        onClick={() => act("reply", d.item_id, "reject", "Reply removed.", "Remove this reply from the site?")}>Remove reply</button>
                    </div>
                  )}
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
                      <p className="tiny muted">{when(r.created_at)} at <a href={homeLink(r)}>{place(r)}</a></p>
                      <p style={{ marginTop: 4, color: "var(--strong)" }}>{r.summary}</p>
                      <p className="tiny muted" style={{ marginTop: 4 }}>
                        By {r.author_name}. Proof offered: {PROOF[r.verify_method] || "none"}. Email: {r.contact_email || "not given"}.
                        {r.evidence_status === "waiting" ? " Proof uploaded, see above." : ""}
                        {r.report_count > 0 ? ` Reported ${r.report_count} times.` : ""}
                      </p>
                    </div>
                    {r.verified && <span className="tag good">Verified</span>}
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isBusy("review", r.id, r.verified ? "unverify" : "verify")}
                      onClick={() => act("review", r.id, r.verified ? "unverify" : "verify", r.verified ? "Verified badge removed." : "Marked as verified.",
                        r.verified ? null : "Only mark as verified if you have seen proof this person lived there. Continue?")}>
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
