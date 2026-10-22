import { useState } from "react";
import { MeterBar } from "./ui";
import { CRITERIA } from "../lib/criteria";
import { avg, fmt, monthLabel } from "../lib/stats";

// The Hindsight meter: one EPC-style arrow per criterion.
// When full reviews are passed in, rows with tenant comments can be opened.
// Only words tenants wrote are shown here, nothing written by the site.
export default function Meter({ reviews, keys, expandable = false }) {
  const [open, setOpen] = useState(null);
  const rows = CRITERIA.filter((c) => !keys || keys.includes(c.key));

  return (
    <div className="meter">
      {rows.map((c) => {
        const score = avg(reviews, c.key);
        const said = expandable
          ? reviews.filter((r) => r.explanations && (r.explanations[c.key] || "").trim())
          : [];
        const canOpen = said.length > 0;
        const isOpen = canOpen && open === c.key;
        const Row = canOpen ? "button" : "div";
        return (
          <div key={c.key} style={{ display: "contents" }}>
            <Row
              type={canOpen ? "button" : undefined}
              className={`meter-row${canOpen ? " tappable" : ""}`}
              aria-expanded={canOpen ? isOpen : undefined}
              aria-label={canOpen ? `${c.label}, ${fmt(score)} out of 5. ${said.length} tenant ${said.length === 1 ? "comment" : "comments"}` : undefined}
              onClick={canOpen ? () => setOpen(isOpen ? null : c.key) : undefined}
            >
              <span className="meter-label">
                <span aria-hidden="true">{c.icon}</span>
                <span>{c.label}</span>
                {canOpen && <span className="said-count" aria-hidden="true">{said.length}</span>}
              </span>
              <MeterBar score={score} />
              <span className="meter-value">{fmt(score)}</span>
            </Row>
            {isOpen && (
              <div className="meter-more">
                {said.map((r) => (
                  <blockquote key={r.id}>
                    {r.explanations[c.key]}
                    <cite>{r.author_name}, scored {r.scores[c.key]} of 5, moved out {monthLabel(r.moved_out)}</cite>
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// True when any tenant left a comment on any of these criteria.
export function hasComments(reviews, keys) {
  return CRITERIA.some((c) => (!keys || keys.includes(c.key))
    && reviews.some((r) => r.explanations && (r.explanations[c.key] || "").trim()));
}
