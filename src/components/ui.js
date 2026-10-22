import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bandColour, fmt } from "../lib/stats";

// ---------- Icons (inline, no icon library needed) ----------
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4.35-4.35",
  pen: "M4 20h4L19 9l-4-4L4 16zm9-13 4 4",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-11v6m0-9.5v.5",
  share: "M12 3v12m0-12L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  check: "M5 12.5 10 17l9-10",
  back: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  close: "M6 6l12 12M18 6 6 18",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  chevron: "M6 9l6 6 6-6",
  upload: "M12 16V4m0 0L8 8m4-4 4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
  shield: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zm-3 9 2 2 4-4",
};

export function Icon({ name, size = 20, stroke = 2, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#E9A84C" />
      <path d="M17 44V29L32 16l15 13v15z" fill="#0B1A2E" />
      <rect x="29" y="33" width="6" height="11" fill="#E9A84C" />
    </svg>
  );
}

// ---------- Score ring ----------
export function ScoreRing({ score, size = 64, stroke = 6, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(score || 0));
    return () => cancelAnimationFrame(t);
  }, [score]);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label || `Score ${fmt(score)} out of 5`}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke={bandColour(score)} strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * shown) / 5} />
      </svg>
      <span className="ring-label" style={{ fontSize: size * 0.3 }}>{fmt(score)}</span>
    </div>
  );
}

// ---------- EPC-style arrow bar ----------
export function MeterBar({ score }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(score ? (score / 5) * 100 : 0));
    return () => cancelAnimationFrame(t);
  }, [score]);
  return (
    <div className="meter-track">
      <div className="meter-bar" style={{ width: `${w}%`, background: bandColour(score) }} />
    </div>
  );
}

export function MiniMeter({ rows }) {
  return (
    <div className="mini-meter">
      {rows.map((r) => (
        <div className="mini-row" key={r.label}>
          <span>{r.label}</span>
          <MeterBar score={r.score} />
          <b>{fmt(r.score)}</b>
        </div>
      ))}
    </div>
  );
}

// ---------- Chips ----------
export function ChoiceChips({ options, value, onChange, multi = false, exclusive = [] }) {
  const selected = multi ? value || [] : value;
  const toggle = (opt) => {
    buzz();
    if (!multi) return onChange(selected === opt ? "" : opt);
    if (exclusive.includes(opt)) return onChange(selected.includes(opt) ? [] : [opt]);
    const base = selected.filter((s) => !exclusive.includes(s));
    onChange(base.includes(opt) ? base.filter((s) => s !== opt) : [...base, opt]);
  };
  return (
    <div className="chips" role={multi ? "group" : "radiogroup"}>
      {options.map((opt) => {
        const on = multi ? selected.includes(opt) : selected === opt;
        return (
          <button type="button" key={opt} className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(opt)}>
            {on && <Icon name="check" size={14} stroke={3} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Haptics (Android supports this, iPhone ignores it) ----------
export function buzz(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // not supported
  }
}

// ---------- Toasts ----------
const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMsg({ text, id: Date.now() });
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status" key={msg.id}>{msg.text}</div>}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// ---------- Bottom sheet / dialog ----------
export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  // Rendered at the end of the page so it always sits above everything else.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <h3>{title}</h3>
          <button type="button" className="btn-quiet" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------- Share ----------
export async function shareLink({ title, text, url }, toast) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`.trim());
    toast("Link copied. Paste it into WhatsApp, text or email.");
  } catch {
    toast(url);
  }
}
