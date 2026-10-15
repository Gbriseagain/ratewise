import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChoiceChips, Icon, ScoreRing, buzz, shareLink, useToast } from "../components/ui";
import { fetchProperty, fetchPropertiesAtPostcode, submitReview } from "../lib/api";
import { findAddresses, lookupPostcode, normalisePostcode } from "../lib/address";
import {
  CRITERIA, CRITERION, DETAILS, GROUPS, PROPERTY_TYPES, RETROFIT, RETROFIT_WORKS, SCORE_WORDS, VERIFY_METHODS,
} from "../lib/criteria";
import { go, link } from "../lib/router";
import { displayAddress, monthLabel } from "../lib/stats";

const DRAFT_KEY = "hindsight-review-draft-v1";
const NOW_MONTH = new Date().toISOString().slice(0, 7);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const EMPTY = {
  postcode: "", town: "", area: "", lat: null, lon: null,
  flat_number: "", house: "", street: "", city: "", property_type: "",
  author_name: "", moved_in: "", moved_out: "",
  verify_method: "", contact_email: "", confirmed: false,
  details: {}, retrofit_works: [],
  scores: {}, explanations: {}, comment_open: {},
  summary: "", body: "", website: "",
};

const STEPS = [
  { id: "home", label: "The home" },
  { id: "tenancy", label: "Your tenancy" },
  { id: "proof", label: "Proof you lived there" },
  { id: "setup", label: "The set-up" },
  { id: "energy", label: "Energy upgrades" },
  ...CRITERIA.map((c) => ({ id: `rate:${c.key}`, key: c.key, label: GROUPS[c.group].label })),
  { id: "words", label: "In your words" },
  { id: "check", label: "Check and publish" },
];
const FIRST_RATE = STEPS.findIndex((s) => s.key);

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.draft ? parsed : null;
  } catch {
    return null;
  }
}
function saveDraft(draft, step) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step })); } catch { /* storage unavailable */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
}

const addressLine = (d) => [d.house, d.street].map((s) => s.trim()).filter(Boolean).join(" ");

// ---------- Month picker that works the same in every browser ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function MonthPicker({ label, value, onChange }) {
  const [y, m] = value ? value.split("-") : ["", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 1979 }, (_, i) => String(thisYear - i));
  // Partial picks are kept (e.g. "2024-") so each dropdown remembers its choice.
  const set = (ny, nm) => onChange(ny || nm ? `${ny || ""}-${nm || ""}` : "");
  return (
    <fieldset className="field" style={{ border: 0 }}>
      <span>{label}</span>
      <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <select className="input" aria-label={`${label} month`} value={m || ""} onChange={(e) => set(y, e.target.value)}>
          <option value="">Month</option>
          {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}
        </select>
        <select className="input" aria-label={`${label} year`} value={y || ""} onChange={(e) => set(e.target.value, m)}>
          <option value="">Year</option>
          {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
        </select>
      </div>
    </fieldset>
  );
}

// ---------- Step 1: find the home ----------
function FindHome({ draft, patch }) {
  const [input, setInput] = useState(draft.postcode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [found, setFound] = useState(null);
  const [mode, setMode] = useState(draft.street ? "form" : "pick");
  const autoRan = useRef(false);

  const run = useCallback(async (value) => {
    autoRan.current = true;
    setErr(""); setBusy(true); setFound(null);
    try {
      const pc = await lookupPostcode(value);
      patch({ postcode: pc.postcode, town: pc.town, area: pc.area, lat: pc.lat, lon: pc.lon, city: pc.town });
      setInput(pc.postcode);
      const [existing, osm] = await Promise.all([
        fetchPropertiesAtPostcode(pc.postcode),
        findAddresses({ postcode: pc.postcode, lat: pc.lat, lon: pc.lon }),
      ]);
      setFound({ existing, ...osm });
      setMode("pick");
    } catch (e) {
      setErr(e.message);
      const pc = normalisePostcode(value);
      if (pc) { patch({ postcode: pc }); setMode("form"); }
    } finally {
      setBusy(false);
    }
  }, [patch]);

  useEffect(() => {
    if (!autoRan.current && draft.postcode && !draft.street) run(draft.postcode);
  }, [draft.postcode, draft.street, run]);

  // An address filled in from elsewhere (a property page) opens the form.
  useEffect(() => {
    if (draft.street && !found) setMode("form");
  }, [draft.street, found]);

  const choose = (fields) => { buzz(); patch(fields); setMode("form"); };

  return (
    <div className="stack">
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); run(input); }}>
        <label className="sr-only" htmlFor="pc">Postcode</label>
        <input id="pc" className="input" value={input} placeholder="Postcode, for example N4 5PH" autoComplete="postal-code"
          onChange={(e) => setInput(e.target.value.toUpperCase())} />
        <button type="submit" className="btn btn-primary" disabled={busy || input.trim().length < 5}>
          {busy ? "Finding" : "Find"}
        </button>
      </form>
      {err && <p className="note bad">{err}</p>}

      {mode === "pick" && found && (
        <div>
          {found.existing.length > 0 && (
            <>
              <p className="addr-heading">Already on Hindsight</p>
              <div className="addr-list">
                {found.existing.map((p) => (
                  <button type="button" key={p.id} className="addr-item" onClick={() => choose({
                    flat_number: p.flat_number || "", house: "", street: p.address_line, city: p.city, property_type: p.property_type || draft.property_type,
                  })}>
                    <span>{displayAddress(p)}</span><span className="tag amber">Reviewed</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {found.addresses.length > 0 && (
            <>
              <p className="addr-heading">Addresses at {draft.postcode}</p>
              <div className="addr-list">
                {found.addresses.map((a) => (
                  <button type="button" key={a.label} className="addr-item" onClick={() => {
                    const [first, ...rest] = a.line.split(", ");
                    const hasNumber = /^\d/.test(a.line);
                    choose({
                      flat_number: a.flat, city: a.town || draft.town,
                      house: hasNumber ? a.line.split(" ")[0] : first,
                      street: hasNumber ? a.line.split(" ").slice(1).join(" ") : rest.join(", "),
                    });
                  }}>
                    <span>{a.label}</span><Icon name="next" size={16} />
                  </button>
                ))}
              </div>
            </>
          )}
          {found.addresses.length === 0 && found.streets.length > 0 && (
            <>
              <p className="addr-heading">Which street?</p>
              <div className="chips">
                {found.streets.map((s) => (
                  <button type="button" key={s} className="chip" onClick={() => choose({ street: s, house: "" })}>{s}</button>
                ))}
              </div>
            </>
          )}
          {found.failed && <p className="small muted" style={{ marginTop: 12 }}>The address list is busy right now. Type the address below.</p>}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setMode("form")}>
            My address is not listed
          </button>
          <p className="tiny muted" style={{ marginTop: 10 }}>Address suggestions © OpenStreetMap contributors.</p>
        </div>
      )}

      {mode === "form" && (
        <div className="stack">
          <div className="grid-2">
            <label className="field"><span>Flat or room (optional)</span>
              <input className="input" value={draft.flat_number} placeholder="Flat 9" onChange={(e) => patch({ flat_number: e.target.value })} /></label>
            <label className="field"><span>House number or name</span>
              <input className="input" value={draft.house} placeholder="14" autoFocus={!draft.house && !!draft.street} onChange={(e) => patch({ house: e.target.value })} /></label>
          </div>
          <label className="field"><span>Street</span>
            <input className="input" value={draft.street} placeholder="Pemberton Road" onChange={(e) => patch({ street: e.target.value })} /></label>
          <div className="grid-2">
            <label className="field"><span>Town or city</span>
              <input className="input" value={draft.city} onChange={(e) => patch({ city: e.target.value })} /></label>
            <label className="field"><span>Postcode</span>
              <input className="input" value={draft.postcode} onChange={(e) => patch({ postcode: e.target.value.toUpperCase() })} /></label>
          </div>
          <div className="qgroup">
            <p>What kind of home?</p>
            <ChoiceChips options={PROPERTY_TYPES} value={draft.property_type} onChange={(v) => patch({ property_type: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

function Questions({ fields, values, onChange }) {
  return fields.map((f) => {
    if (f.showIf && !f.showIf(values)) return null;
    return (
      <div className="qgroup" key={f.key}>
        <p>{f.label}</p>
        {f.type === "text" ? (
          <input className="input" value={values[f.key] || ""} placeholder={f.placeholder} maxLength={200}
            onChange={(e) => onChange(f.key, e.target.value)} />
        ) : (
          <ChoiceChips options={f.options} value={values[f.key] || ""} onChange={(v) => onChange(f.key, v)} />
        )}
        {f.link && <a className="tiny" href={f.link.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8 }}>{f.link.text}</a>}
      </div>
    );
  });
}

// ---------- One rating screen ----------
function RateStep({ c, draft, setScore, setExplanation, toggleComment }) {
  const score = draft.scores[c.key];
  const needs = score && score <= 3;
  const commentOpen = needs || draft.comment_open[c.key];
  return (
    <div>
      <p className="rate-group">{GROUPS[c.group].label}</p>
      <div className="rate-icon" aria-hidden="true">{c.icon}</div>
      <h2>{c.question}</h2>
      {c.hint && <p className="muted">{c.hint}</p>}
      {c.link && <a className="small" href={c.link.href} target="_blank" rel="noopener noreferrer">{c.link.text}</a>}
      <div className="rate-scale" role="radiogroup" aria-label={c.question}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button type="button" key={v} data-v={v} role="radio" aria-checked={score === v}
            className={`rate-btn${score === v ? " on" : ""}`}
            style={score === v ? { background: `var(--s${v})` } : undefined}
            onClick={() => setScore(c.key, v)}>
            <b>{v}</b><span>{SCORE_WORDS[v]}</span>
          </button>
        ))}
      </div>
      <div className="rate-hint"><span>1 is awful</span><span className="kbd">Press 1 to 5 on a keyboard</span><span>5 is great</span></div>
      {commentOpen ? (
        <div className="explain">
          <label className="field">
            <span style={needs ? undefined : { color: "var(--strong)" }}>
              {needs ? `You scored ${score}. What happened?` : "Anything to add? (optional)"}
            </span>
            <textarea className="input" rows={3} autoFocus maxLength={600} value={draft.explanations[c.key] || ""}
              placeholder={needs ? "Be specific: what, how often, and what the landlord did about it." : ""}
              onChange={(e) => setExplanation(c.key, e.target.value)} />
            {needs && <small>Required for scores of 3 or below, so the next tenant knows why.</small>}
          </label>
        </div>
      ) : score ? (
        <button type="button" className="btn-quiet small" style={{ marginTop: 12, paddingLeft: 0 }} onClick={() => toggleComment(c.key)}>
          Add a comment
        </button>
      ) : null}
    </div>
  );
}

// ---------- The whole flow ----------
export default function Review({ route, onPublished }) {
  const toast = useToast();
  const restored = useRef(null);
  if (restored.current === null) restored.current = loadDraft() || false;
  const [draft, setDraft] = useState(() => (restored.current ? { ...EMPTY, ...restored.current.draft } : { ...EMPTY }));
  const [step, setStep] = useState(() => (restored.current ? Math.min(restored.current.step || 0, STEPS.length - 1) : 0));
  const [dir, setDir] = useState("fwd");
  const [showRestored, setShowRestored] = useState(!!restored.current);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [done, setDone] = useState(null);
  const advanceTimer = useRef(null);
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; });

  const patch = useCallback((fields) => setDraft((d) => ({ ...d, ...fields })), []);

  // Prefill from a property page or a postcode search.
  const propertyId = route.query.get("property");
  const postcodeParam = route.query.get("postcode");
  useEffect(() => {
    if (propertyId) {
      fetchProperty(propertyId).then((p) => {
        if (!p) return;
        setDraft((d) => ({
          ...d, postcode: p.postcode, flat_number: p.flat_number || "", house: "", street: p.address_line,
          city: p.city, area: p.area || "", lat: p.latitude, lon: p.longitude, property_type: p.property_type || d.property_type,
        }));
        setShowRestored(false);
        setStep(0);
      }).catch(() => {});
    } else if (postcodeParam) {
      setDraft((d) => (d.street ? d : { ...d, postcode: normalisePostcode(postcodeParam) || "" }));
    }
  }, [propertyId, postcodeParam]);

  useEffect(() => {
    if (!done) saveDraft(draft, step);
  }, [draft, step, done]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const current = STEPS[step];

  const valid = useMemo(() => {
    const d = draft;
    switch (current.id) {
      case "home": return !!normalisePostcode(d.postcode) && addressLine(d).length >= 3 && d.city.trim().length >= 2;
      case "tenancy":
        return d.author_name.trim().length >= 1 && /^\d{4}-\d{2}$/.test(d.moved_in) && /^\d{4}-\d{2}$/.test(d.moved_out)
          && d.moved_out >= d.moved_in && d.moved_out <= NOW_MONTH;
      case "proof": return !!d.verify_method && d.confirmed && (!d.contact_email || EMAIL_RE.test(d.contact_email.trim()));
      case "words": return d.summary.trim().length >= 3 && d.body.trim().length >= 30;
      case "setup": case "energy": case "check": return true;
      default: {
        const s = d.scores[current.key];
        return !!s && (s > 3 || (d.explanations[current.key] || "").trim().length >= 5);
      }
    }
  }, [draft, current]);

  const move = useCallback((delta) => {
    clearTimeout(advanceTimer.current);
    setDir(delta > 0 ? "fwd" : "back");
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
    setShowRestored(false);
    window.scrollTo({ top: 0 });
  }, []);

  const setScore = useCallback((key, v) => {
    buzz(10);
    clearTimeout(advanceTimer.current);
    setDraft((d) => ({ ...d, scores: { ...d.scores, [key]: v } }));
    // Good scores move straight on; low scores wait for an explanation.
    if (v >= 4) {
      advanceTimer.current = setTimeout(() => {
        if (draftRef.current.comment_open[key]) return;
        setDir("fwd");
        setStep((s) => (STEPS[s].key === key ? Math.min(STEPS.length - 1, s + 1) : s));
        window.scrollTo({ top: 0 });
      }, 380);
    }
  }, []);
  const setExplanation = useCallback((key, text) => setDraft((d) => ({ ...d, explanations: { ...d.explanations, [key]: text } })), []);
  const toggleComment = useCallback((key) => {
    clearTimeout(advanceTimer.current);
    setDraft((d) => ({ ...d, comment_open: { ...d.comment_open, [key]: true } }));
  }, []);
  const setDetail = useCallback((key, value) => setDraft((d) => ({ ...d, details: { ...d.details, [key]: value } })), []);

  // Keyboard: 1 to 5 to rate, Enter to continue.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (current.key && /^[1-5]$/.test(e.key)) setScore(current.key, Number(e.key));
      if (e.key === "Enter" && valid && current.id !== "check") move(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, valid, setScore, move]);

  const publish = async () => {
    setSending(true); setSendError("");
    const worksDone = draft.retrofit_works.filter((w) => w !== "None" && w !== "Not sure").length > 0;
    const details = Object.fromEntries(Object.entries({
      ...draft.details,
      retrofit_works: draft.retrofit_works.length ? draft.retrofit_works : undefined,
      ...(worksDone ? {} : { retrofit_difference: undefined, retrofit_disruption: undefined, retrofit_rent: undefined }),
    }).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
    const explanations = Object.fromEntries(Object.entries(draft.explanations).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    try {
      const propertyIdOut = await submitReview({
        postcode: draft.postcode, flat_number: draft.flat_number.trim(), address_line: addressLine(draft), city: draft.city.trim(),
        area: draft.area, property_type: draft.property_type, latitude: draft.lat, longitude: draft.lon,
        author_name: draft.author_name.trim(), moved_in: draft.moved_in, moved_out: draft.moved_out,
        summary: draft.summary.trim(), body: draft.body.trim(), scores: draft.scores, explanations, details,
        verify_method: draft.verify_method, contact_email: draft.contact_email.trim(), website: draft.website,
      });
      clearDraft();
      setDone({ propertyId: propertyIdOut, title: [draft.flat_number.trim(), addressLine(draft)].filter(Boolean).join(", ") });
      if (onPublished) onPublished();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const startAgain = () => {
    clearDraft();
    setDraft({ ...EMPTY });
    setStep(0);
    setShowRestored(false);
  };

  if (done) {
    return (
      <main className="page"><div className="wrap flow" style={{ textAlign: "center" }}>
        <div className="done-burst"><Icon name="check" size={40} stroke={3} /></div>
        <h1 style={{ fontSize: "clamp(1.9rem, 5vw, 2.6rem)", margin: "0 auto" }}>Your review is live</h1>
        <p className="muted" style={{ margin: "12px auto 24px" }}>
          The next person looking at {done.title} will see it. If you added an email, we may contact you for a photo of a bill so we can mark it verified.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <a className="btn btn-primary" href={link(`/property/${done.propertyId}`)}>See your review</a>
          <button type="button" className="btn btn-ghost" onClick={() => shareLink({
            title: "Hindsight",
            text: "I just reviewed a place I rented on Hindsight. If you've rented in the UK, review yours too:",
            url: window.location.origin,
          }, toast)}>
            <Icon name="share" size={18} /> Ask friends to review theirs
          </button>
        </div>
        <button type="button" className="btn-quiet small" style={{ marginTop: 18 }} onClick={() => { setDone(null); startAgain(); }}>
          Review another home
        </button>
      </div></main>
    );
  }

  const rateIndex = current.key ? step - FIRST_RATE + 1 : 0;
  const pct = Math.round(((step + (valid ? 1 : 0)) / STEPS.length) * 100);
  const lowScores = CRITERIA.filter((c) => draft.scores[c.key] && draft.scores[c.key] <= 3);

  return (
    <main className="page">
      <div className="wrap flow">
        <div className="flow-top">
          <div className="progress" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
          <div className="flow-meta">
            <span>{current.key ? `Score ${rateIndex} of ${CRITERIA.length}` : current.label}</span>
            {step > 0 && <button type="button" className="btn-quiet small row" style={{ gap: 4, minHeight: 32, padding: 0 }} onClick={() => move(-1)}>
              <Icon name="back" size={14} /> Back
            </button>}
          </div>
        </div>

        {showRestored && (
          <div className="note info spread" style={{ marginBottom: 18 }}>
            <span>We kept your unfinished review on this device.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startAgain}>Start again</button>
          </div>
        )}

        <div className={`flow-card${dir === "back" ? " back" : ""}`} key={step}>
          {current.id === "home" && (
            <>
              <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 2.4rem)", marginBottom: 8 }}>Which home are you reviewing?</h1>
              <p className="muted" style={{ marginBottom: 20 }}>Start with the postcode. Reviews open once you have moved out.</p>
              <FindHome draft={draft} patch={patch} />
            </>
          )}

          {current.id === "tenancy" && (
            <div className="stack">
              <h2>When did you live there?</h2>
              <label className="field"><span>Your first name or initials</span>
                <input className="input" value={draft.author_name} maxLength={40} placeholder="Sarah M." autoComplete="given-name"
                  onChange={(e) => patch({ author_name: e.target.value })} />
                <small>Shown on your review. Avoid your full name if you prefer.</small>
              </label>
              <MonthPicker label="Moved in" value={draft.moved_in} onChange={(v) => patch({ moved_in: v })} />
              <MonthPicker label="Moved out" value={draft.moved_out} onChange={(v) => patch({ moved_out: v })} />
              {draft.moved_out && /^\d{4}-\d{2}$/.test(draft.moved_out) && draft.moved_out > NOW_MONTH && (
                <p className="note bad">Reviews open once you have moved out.</p>
              )}
              {/^\d{4}-\d{2}$/.test(draft.moved_in) && /^\d{4}-\d{2}$/.test(draft.moved_out) && draft.moved_out < draft.moved_in && (
                <p className="note bad">The move-out month is before the move-in month.</p>
              )}
            </div>
          )}

          {current.id === "proof" && (
            <div className="stack">
              <h2>Show you lived there</h2>
              <p className="muted">Reviews from real tenants are what make Hindsight useful. How could you prove you lived at this address?</p>
              <div className="addr-list" style={{ maxHeight: "none" }}>
                {VERIFY_METHODS.map((m) => (
                  <button type="button" key={m.value} className={`addr-item${draft.verify_method === m.value ? " on" : ""}`}
                    onClick={() => { buzz(); patch({ verify_method: m.value }); }}>
                    {m.label}{draft.verify_method === m.value && <Icon name="check" size={18} />}
                  </button>
                ))}
              </div>
              <label className="field"><span>Email for verification (optional)</span>
                <input className="input" type="email" value={draft.contact_email} autoComplete="email" placeholder="you@example.com"
                  onChange={(e) => patch({ contact_email: e.target.value })} />
                <small>We may email you once to ask for a photo of a bill or council tax letter, then mark your review verified. Never shown publicly.</small>
              </label>
              <button type="button" className={`check${draft.confirmed ? " on" : ""}`} aria-pressed={draft.confirmed}
                onClick={() => { buzz(); patch({ confirmed: !draft.confirmed }); }}>
                <span className="check-box">{draft.confirmed && <Icon name="check" size={14} stroke={3} />}</span>
                <span className="small">
                  I lived at <strong>{[draft.flat_number, addressLine(draft)].filter(Boolean).join(", ") || "this address"}, {draft.postcode}</strong> from{" "}
                  <strong>{monthLabel(draft.moved_in) || "move-in"}</strong> to <strong>{monthLabel(draft.moved_out) || "move-out"}</strong>,
                  and this review is my own honest experience.
                </span>
              </button>
            </div>
          )}

          {current.id === "setup" && (
            <div>
              <h2>The set-up</h2>
              <p className="muted" style={{ marginBottom: 20 }}>All optional. Tap what applies.</p>
              <Questions fields={DETAILS} values={draft.details} onChange={setDetail} />
            </div>
          )}

          {current.id === "energy" && (
            <div>
              <h2>Energy upgrades while you lived there</h2>
              <p className="muted" style={{ marginBottom: 20 }}>
                Landlords have to bring rented homes up to EPC C by October 2030, so a lot of homes are being upgraded.
                Tell the next tenant whether the work made a difference.
              </p>
              <div className="qgroup">
                <p>What was done?</p>
                <ChoiceChips multi options={[...RETROFIT_WORKS, "None", "Not sure"]} exclusive={["None", "Not sure"]}
                  value={draft.retrofit_works} onChange={(v) => patch({ retrofit_works: v })} />
              </div>
              {draft.retrofit_works.some((w) => w !== "None" && w !== "Not sure") && (
                <div style={{ marginTop: 22 }}>
                  <Questions fields={RETROFIT} values={draft.details} onChange={setDetail} />
                </div>
              )}
            </div>
          )}

          {current.key && (
            <RateStep c={CRITERION[current.key]} draft={draft} setScore={setScore} setExplanation={setExplanation} toggleComment={toggleComment} />
          )}

          {current.id === "words" && (
            <div className="stack">
              <h2>In your words</h2>
              <label className="field"><span>One line for the next tenant</span>
                <input className="input" value={draft.summary} maxLength={140} placeholder="Great flat, absent landlord."
                  onChange={(e) => patch({ summary: e.target.value })} />
                <small>{draft.summary.trim().length} of 140</small>
              </label>
              <label className="field"><span>Your review</span>
                <textarea className="input" rows={8} value={draft.body} maxLength={5000}
                  placeholder="What should someone know before they sign? What surprised you? How did the landlord handle problems?"
                  onChange={(e) => patch({ body: e.target.value })} />
                <small>{draft.body.trim().length < 30 ? `${30 - draft.body.trim().length} more characters needed` : `${draft.body.trim().length} characters`}</small>
              </label>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={draft.website}
                onChange={(e) => patch({ website: e.target.value })} style={{ position: "absolute", left: "-9999px" }} />
              <p className="note">Stick to what happened to you. Do not name private individuals or include phone numbers or home addresses.</p>
            </div>
          )}

          {current.id === "check" && (
            <div className="stack">
              <h2>Check and publish</h2>
              <div className="panel row" style={{ gap: 16, flexWrap: "nowrap" }}>
                <ScoreRing score={CRITERIA.reduce((s, c) => s + (draft.scores[c.key] || 0), 0) / CRITERIA.length} size={72} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ color: "var(--strong)" }}>{[draft.flat_number, addressLine(draft)].filter(Boolean).join(", ")}</strong>
                  <p className="small muted">{draft.city}, {draft.postcode}</p>
                  <p className="small muted">“{draft.summary}”</p>
                </div>
              </div>
              {lowScores.length > 0 && (
                <div className="panel panel-tight">
                  <p className="small" style={{ color: "var(--strong)", fontWeight: 500, marginBottom: 8 }}>Your lower scores</p>
                  <div className="why">
                    {lowScores.map((c) => (
                      <div key={c.key} className="spread" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                        <span className="small"><strong style={{ color: `var(--s${draft.scores[c.key]})` }}>{c.label} {draft.scores[c.key]}/5.</strong> <span className="muted">{draft.explanations[c.key]}</span></span>
                        <button type="button" className="btn-quiet tiny" onClick={() => { setDir("back"); setStep(STEPS.findIndex((s) => s.key === c.key)); }}>Edit</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="small muted">
                By publishing you confirm this is your own experience. It goes live straight away. Anyone can report a review, and we act on reports within 48 hours.
                See <a href={link("/privacy")}>privacy and complaints</a>.
              </p>
              {sendError && <p className="note bad">{sendError}</p>}
              <button type="button" className="btn btn-primary btn-block" disabled={sending} onClick={publish}>
                {sending ? "Publishing" : "Publish review"}
              </button>
            </div>
          )}
        </div>

        {current.id !== "check" && (
          <div className="flow-nav">
            {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => move(-1)}>Back</button> : <span />}
            <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => move(1)}>
              {current.key && !draft.scores[current.key] ? "Choose a score" : "Continue"}
            </button>
          </div>
        )}

        {step === 0 && (
          <p className="tiny muted" style={{ marginTop: 22 }}>
            About five minutes. Your progress saves on this device as you go. <button type="button" className="btn-quiet tiny" style={{ padding: 0, minHeight: 0 }} onClick={() => go("/about")}>Why we ask what we ask</button>
          </p>
        )}
      </div>
    </main>
  );
}
