import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { addEvidence } from "../lib/api";
import { markProofSent, myReview } from "../lib/mine";
import { PROOF_HELP, prepareProof, sizeLabel } from "../lib/proof";

// Choose a photo or PDF. The file is prepared on the device straight away,
// so problems show up before anything is sent.
export function ProofPicker({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      onChange(await prepareProof(file));
    } catch (err) {
      setError(err.message);
      onChange(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {value ? (
        <div className="proof-file">
          {value.mime.startsWith("image/")
            ? <img src={`data:${value.mime};base64,${value.base64}`} alt="Your proof of address" />
            : <span className="proof-pdf" aria-hidden="true">PDF</span>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="small proof-name">{value.name}</p>
            <p className="tiny muted">{sizeLabel(value.size)}, ready to send</p>
          </div>
          <button type="button" className="btn-quiet small" onClick={() => onChange(null)}>Remove</button>
        </div>
      ) : (
        <label className={`btn btn-ghost btn-sm proof-choose${busy ? " is-busy" : ""}`}>
          <Icon name="upload" size={16} /> {busy ? "Preparing" : "Choose a photo or PDF"}
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={pick} disabled={busy} />
        </label>
      )}
      {error && <p className="note bad" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}

// Sends proof for a review written on this device.
// With `initial`, the file chosen in the review form is sent straight away.
export function ProofSender({ reviewId, token, initial, compact = false }) {
  const [proof, setProof] = useState(initial || null);
  const [state, setState] = useState(() => {
    const mine = myReview(reviewId);
    return mine && mine.proof === "sent" ? "sent" : "idle";
  });
  const [error, setError] = useState("");
  const started = useRef(false);

  const send = useCallback(async (p) => {
    setState("sending"); setError("");
    try {
      await addEvidence(reviewId, token, p);
      markProofSent(reviewId);
      setState("sent");
    } catch (e) {
      setError(e.message);
      setState("error");
    }
  }, [reviewId, token]);

  useEffect(() => {
    if (initial && !started.current && state === "idle") {
      started.current = true;
      send(initial);
    }
  }, [initial, send, state]);

  if (state === "sent") {
    return (
      <div className="proof-box sent">
        <p className="proof-title"><Icon name="check" size={18} stroke={3} /> Proof received</p>
        <p className="small muted">
          Once we have checked it, your review gets the Verified tenant badge. The file is deleted as soon as it has been checked.
        </p>
      </div>
    );
  }

  return (
    <div className="proof-box">
      {!compact && <p className="proof-title"><Icon name="shield" size={18} /> Get the Verified tenant badge</p>}
      <p className="small muted">{PROOF_HELP}</p>
      <div style={{ marginTop: 12 }}>
        <ProofPicker value={proof} onChange={(p) => { setProof(p); setError(""); if (state === "error") setState("idle"); }} />
      </div>
      {error && <p className="note bad" style={{ marginTop: 10 }}>{error}</p>}
      {proof && (
        <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={state === "sending"} onClick={() => send(proof)}>
          {state === "sending" ? "Sending" : state === "error" ? "Try again" : "Send proof"}
        </button>
      )}
    </div>
  );
}
