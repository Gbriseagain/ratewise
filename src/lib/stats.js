import { CRITERIA, CRITERIA_KEYS, GROUPS } from "./criteria";

// Average score for one criterion across reviews.
export function avg(reviews, key) {
  const vals = reviews.map((r) => r.scores && r.scores[key]).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// Average of a single review across all its scores.
export function reviewAvg(review) {
  const vals = CRITERIA_KEYS.map((k) => review.scores && review.scores[k]).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function overall(reviews) {
  if (!reviews || !reviews.length) return 0;
  return reviews.reduce((s, r) => s + reviewAvg(r), 0) / reviews.length;
}

export function groupAvg(reviews, group) {
  const keys = CRITERIA.filter((c) => c.group === group).map((c) => c.key);
  const vals = keys.map((k) => avg(reviews, k)).filter((v) => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function groupSummary(reviews) {
  return Object.keys(GROUPS).map((g) => ({ group: g, label: GROUPS[g].short, score: groupAvg(reviews, g) }));
}

export function bestAndWorst(reviews) {
  const ranked = CRITERIA.map((c) => ({ ...c, score: avg(reviews, c.key) })).filter((c) => c.score > 0);
  ranked.sort((a, b) => b.score - a.score);
  return { best: ranked[0], worst: ranked[ranked.length - 1] };
}

// Band 1..5 for colour, matching the EPC-style palette.
export function band(score) {
  if (!score) return 0;
  return Math.min(5, Math.max(1, Math.round(score)));
}

export function bandColour(score) {
  const b = band(score);
  return b ? `var(--s${b})` : "var(--line)";
}

export function fmt(score) {
  return score ? score.toFixed(1) : "-";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || "";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function displayAddress(p) {
  return [p.flat_number, p.address_line].filter(Boolean).join(", ");
}

// Readable page address, e.g. /property/abc123/14-pemberton-road-n4-5ph.
// Must match the slug in supabase/functions sitemap.
export function propertyPath(p) {
  const slug = [p.flat_number, p.address_line, p.postcode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `/property/${p.id}/${slug}`;
}

// Straight-line distance in miles between two points.
export function milesBetween(aLat, aLon, bLat, bLon) {
  const r = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
