import { useMemo, useRef, useState } from "react";
import { Icon } from "./ui";
import { go } from "../lib/router";
import { displayAddress } from "../lib/stats";

// Search box with live suggestions from homes already on Hindsight.
export function matches(property, query) {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return true;
  const hay = [property.flat_number, property.address_line, property.city, property.postcode, property.area, property.property_type]
    .filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "");
  return hay.includes(q);
}

export default function SearchBox({ properties = [], initial = "", autoFocus = false, onSearch, placeholder }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef(null);

  const suggestions = useMemo(() => {
    if (q.trim().length < 2) return [];
    return properties.filter((p) => matches(p, q)).slice(0, 5);
  }, [q, properties]);

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && suggestions[active]) return go(`/property/${suggestions[active].id}`);
    setOpen(false);
    if (onSearch) onSearch(q.trim());
    else go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const onKeyDown = (e) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="searchbox">
      <form onSubmit={submit} role="search">
        <Icon name="search" />
        <label className="sr-only" htmlFor="site-search">Search by postcode, street or town</label>
        <input id="site-search" value={q} autoFocus={autoFocus} autoComplete="off"
          placeholder={placeholder || "Postcode, street or town"}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); if (onSearch) onSearch(e.target.value); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
          onKeyDown={onKeyDown} />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {open && suggestions.length > 0 && (
        <div className="suggest" role="listbox">
          {suggestions.map((p, i) => (
            <button type="button" key={p.id} role="option" aria-selected={i === active} className={i === active ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/property/${p.id}`)}>
              <span>{displayAddress(p)}</span>
              <span className="muted small">{p.postcode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
