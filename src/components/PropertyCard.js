import { MiniMeter, ScoreRing } from "./ui";
import { link } from "../lib/router";
import { bestAndWorst, displayAddress, groupSummary, overall } from "../lib/stats";

export default function PropertyCard({ property, highlight }) {
  const reviews = property.reviews || [];
  const score = overall(reviews);
  const { best, worst } = bestAndWorst(reviews);
  const n = reviews.length;
  return (
    <a className="pcard" href={link(`/property/${property.id}`)}>
      <div className="pcard-top">
        <div style={{ minWidth: 0 }}>
          <h3>{displayAddress(property)}</h3>
          <p className="muted small">{[property.area, property.city, property.postcode].filter(Boolean).join(", ")}</p>
        </div>
        <ScoreRing score={score} size={56} stroke={5} />
      </div>
      <MiniMeter rows={groupSummary(reviews)} />
      <div className="row">
        {property.property_type && <span className="tag">{property.property_type}</span>}
        <span className="tag">{n} {n === 1 ? "review" : "reviews"}</span>
        {highlight && <span className="tag amber">{highlight}</span>}
      </div>
      {best && worst && best.key !== worst.key && (
        <div className="row tiny">
          {best.score >= 3.5 && <span className="tag good">{best.icon} {best.label}</span>}
          {worst.score <= 2.5 && <span className="tag bad">{worst.icon} {worst.label}</span>}
        </div>
      )}
    </a>
  );
}

export function CardSkeletons({ count = 3 }) {
  return (
    <div className="cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 210 }} />
      ))}
    </div>
  );
}
