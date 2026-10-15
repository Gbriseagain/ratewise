import { useState } from "react";
import { MeterBar } from "./ui";
import { CRITERIA } from "../lib/criteria";
import { avg, fmt, monthLabel } from "../lib/stats";

// The Hindsight meter: one EPC-style arrow per criterion.
// When full reviews are passed in, tapping a row opens what tenants said.
export default function Meter({ reviews, keys, expandable = false }) {
  const [open, setOpen] = useState(null);
  const rows = CRITERIA.filter((c) => !keys || keys.includes(c.key));

  return (
    <div className="meter">
      {rows.map((c) => {
        const score = avg(reviews, c.key);
        const said = expandable
          ? reviews.filter((r) => r.explanations && r.explanations[c.key])
          : [];
        const isOpen = open === c.key;
        const Row = expandable ? "button" : "div";
        return (
          <div key={c.key} style={{ display: "contents" }}>
            <Row
              type={expandable ? "button" : undefined}
              className={`meter-row${expandable ? " tappable" : ""}`}
              aria-expanded={expandable ? isOpen : undefined}
              onClick={expandable ? () => setOpen(isOpen ? null : c.key) : undefined}
            >
              <span className="meter-label">
                <span aria-hidden="true">{c.icon}</span>
                <span>{c.label}</span>
              </span>
              <MeterBar score={score} />
              <span className="meter-value">{fmt(score)}</span>
            </Row>
            {isOpen && (
              <div className="meter-more">
                {said.length === 0 ? (
                  <p className="small muted">Nobody added a comment on this. Comments are required for scores of 3 or below.</p>
                ) : (
                  said.map((r) => (
                    <blockquote key={r.id}>
                      {r.explanations[c.key]}
                      <cite>{r.author_name}, scored {r.scores[c.key]} of 5, moved out {monthLabel(r.moved_out)}</cite>
                    </blockquote>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
