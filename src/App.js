import { useState, useEffect, useCallback } from "react";

// ============================================================
// RATEWISE - Unfiltered Tenant Reviews for UK Rentals
// v3: Referral prompts, working search, postcode lookup,
// flat number, updated verification, About page edits
// ============================================================

function useTheme() {
  const [mode, setMode] = useState("system");
  const [resolved, setResolved] = useState("dark");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolved(mode === "system" ? (mq.matches ? "dark" : "light") : mode);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mode]);
  useEffect(() => { document.documentElement.setAttribute("data-theme", resolved); }, [resolved]);
  return { mode, setMode, resolved };
}

// --- CRITERIA ---
const CRITERIA_META = {
  landlord: { label: "Landlord Responsiveness", icon: "👤", desc: "How quickly and effectively does the landlord or agent handle requests?", group: "management" },
  maintenance: { label: "Maintenance Speed", icon: "🔧", desc: "How fast are repairs and reported issues actually resolved?", group: "management" },
  rent_fairness: { label: "Rent Fairness & Increases", icon: "💷", desc: "Was the rent fair? Were there inconsiderate increases during your tenancy?", group: "management" },
  value: { label: "Value for Money", icon: "🏷️", desc: "Overall, is the rent worth what you actually get?", group: "management" },
  security: { label: "Locks & Security", icon: "🔒", desc: "Quality of door locks, window locks, entry systems, and overall security.", group: "property" },
  energy: { label: "Energy Efficiency", icon: "⚡", desc: "Insulation quality, glazing, and how much your energy bills actually cost.", group: "property" },
  epc_reality: { label: "EPC vs Reality", icon: "🌡️", desc: "Does the official EPC rating match your lived experience? (Cold floors, draughty rooms, actual bills vs the certificate.)", group: "property" },
  windows: { label: "Windows & Insulation", icon: "🪟", desc: "Condition of windows, double/single glazing, draught-proofing, wall and loft insulation.", group: "property" },
  damp: { label: "Damp & Mould", icon: "💧", desc: "Any signs of damp, condensation, or mould growth anywhere.", group: "property" },
  heating: { label: "Heating Quality", icon: "🔥", desc: "Does the heating actually keep the place warm throughout winter?", group: "property" },
  light: { label: "Natural Light", icon: "☀️", desc: "How well-lit are the rooms during the day?", group: "property" },
  water: { label: "Water Pressure", icon: "🚿", desc: "Consistent, strong water flow in kitchen and bathroom.", group: "property" },
  smell: { label: "Air Quality & Smell", icon: "🌿", desc: "Freshness of air, lingering odours, ventilation quality.", group: "property" },
  space: { label: "Space & Room Sizes", icon: "📐", desc: "Are the rooms a decent size? Enough storage?", group: "property" },
  pests: { label: "Pest Free", icon: "🐛", desc: "Any issues with mice, insects, foxes in bins, or other pests.", group: "property" },
  cleanliness: { label: "Cleanliness at Move-in", icon: "✨", desc: "How clean was the property when you moved in?", group: "property" },
  noise: { label: "Noise Levels", icon: "🔇", desc: "From neighbours, street, building systems, or the property itself.", group: "area" },
  neighbours: { label: "Neighbours", icon: "🏘️", desc: "Were your neighbours considerate? Any anti-social behaviour?", group: "area" },
  safety: { label: "Neighbourhood Safety", icon: "🛡️", desc: "How safe does the area feel day and night?", group: "area" },
  parking: { label: "Parking Availability", icon: "🅿️", desc: "Reliable parking? Permit required? Street parking competition?", group: "area" },
  mobile_signal: { label: "Mobile & Internet Signal", icon: "📶", desc: "Mobile signal strength inside the property across networks.", group: "area" },
};
const CRITERIA_KEYS = Object.keys(CRITERIA_META);
const CRITERIA_GROUPS = {
  management: { label: "Landlord & Management", icon: "🏢" },
  property: { label: "The Property", icon: "🏠" },
  area: { label: "Area & Surroundings", icon: "📍" },
};

const INFO_FIELDS = {
  heating_type: { label: "Heating type", type: "select", options: ["Gas central heating", "Electric heating", "Storage heaters", "Heat pump", "Communal heating", "Other", "Unknown"] },
  furnished: { label: "Furnished?", type: "select", options: ["Unfurnished", "Part-furnished", "Fully furnished"] },
  furniture_condition: { label: "Furniture condition (if furnished)", type: "select", options: ["N/A", "Excellent", "Good", "Acceptable", "Poor", "Broken or damaged"], showIf: (i) => i.furnished && i.furnished !== "Unfurnished" },
  white_goods: { label: "White goods provided?", type: "select", options: ["None", "Some (e.g. oven only)", "Full set (oven, fridge, washing machine)"] },
  white_goods_condition: { label: "White goods condition", type: "select", options: ["N/A", "New or nearly new", "Good working order", "Old but functional", "Faulty or unreliable"], showIf: (i) => i.white_goods && i.white_goods !== "None" },
  water_billing: { label: "Water billing", type: "select", options: ["Water meter", "Fixed rate", "Included in rent", "Not sure"] },
  repairs_managed_by: { label: "Who manages repairs?", type: "select", options: ["Landlord directly", "Letting agent", "Management company", "Mixed or unclear"] },
  decorating_rules: { label: "Decorating allowed?", type: "select", options: ["Free to decorate", "Minor changes only (e.g. picture hooks)", "Nothing allowed", "Never asked"] },
  guest_policy: { label: "Restrictions on guests staying long-term?", type: "select", options: ["No restrictions", "Informal restrictions", "Strict rules in contract", "Not sure"] },
  flood_risk: { label: "Any flooding or flood risk?", type: "select", options: ["No issues", "Minor risk (e.g. nearby river)", "Experienced flooding", "Basement or ground floor flooding"] },
  crime_types: { label: "If crime was an issue, what type?", type: "text", placeholder: "e.g. bike theft, car break-ins, antisocial behaviour" },
  deposit_returned: { label: "Did you get your full deposit back?", type: "select", options: ["Yes, full deposit", "Partial return", "No, nothing returned", "Still waiting", "N/A"] },
  deposit_issues: { label: "Excuses given to withhold deposit?", type: "text", placeholder: "e.g. cleaning charges, wear and tear disputes", showIf: (i) => i.deposit_returned === "Partial return" || i.deposit_returned === "No, nothing returned" },
  left_clean: { label: "Did you leave the property clean?", type: "select", options: ["Yes, professionally cleaned", "Yes, cleaned thoroughly myself", "Reasonably clean", "Could have been better"] },
};

// --- DEMO DATA ---
const DEMO_PROPERTIES = [
  {
    id: "1", address: "14 Pemberton Road", flatNumber: "", city: "London", postcode: "N4 5PH", area: "Finsbury Park", type: "2-bed flat",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop",
    reviews: [{
      id: "r1", author: "Sarah M.", date: "2025-11-02", lived: "Jan 2024 - Oct 2025", verified: true,
      summary: "Decent flat, nightmare landlord.",
      text: "The flat itself is fine. Good natural light, reasonable size for London. But the landlord took 3 weeks to fix a broken boiler in January. Damp appeared in the bathroom ceiling after 6 months and was never properly addressed.",
      scores: { landlord: 2, energy: 3, epc_reality: 3, damp: 2, noise: 3, light: 4, water: 3, heating: 2, pests: 5, smell: 4, safety: 4, value: 3, maintenance: 1, windows: 3, security: 3, cleanliness: 3, neighbours: 4, parking: 2, mobile_signal: 4, space: 3, rent_fairness: 3 },
      explanations: { landlord: "Took 3 weeks to fix the boiler in January.", maintenance: "Reported a leak twice before anything happened.", damp: "Black mould in bathroom ceiling after 6 months.", heating: "Boiler broke twice in one winter.", parking: "Permit only, still circle for 20 minutes.", rent_fairness: "Went up 8% with zero improvements.", cleanliness: "Not professionally cleaned.", windows: "Single glazed in bedroom.", energy: "Single glazed bedroom means higher bills.", epc_reality: "EPC says C but winter bills suggest otherwise.", noise: "Some street noise at night.", value: "Overpriced given maintenance issues.", security: "Standard Yale locks.", space: "Decent for London but storage limited." },
      info: { heating_type: "Gas central heating", furnished: "Part-furnished", furniture_condition: "Acceptable", white_goods: "Full set (oven, fridge, washing machine)", white_goods_condition: "Old but functional", water_billing: "Water meter", repairs_managed_by: "Landlord directly", decorating_rules: "Nothing allowed", guest_policy: "No restrictions", flood_risk: "No issues", deposit_returned: "Partial return", deposit_issues: "Charged 200 for cleaning despite leaving it clean.", left_clean: "Yes, cleaned thoroughly myself", crime_types: "" }
    }, {
      id: "r2", author: "James K.", date: "2025-06-15", lived: "Mar 2023 - Dec 2023", verified: true,
      summary: "Great location, average flat.",
      text: "Location is brilliant for transport. The flat gets cold in winter though. No pest issues. Neighbourhood feels safe.",
      scores: { landlord: 3, energy: 2, epc_reality: 2, damp: 3, noise: 3, light: 4, water: 4, heating: 2, pests: 5, smell: 4, safety: 5, value: 4, maintenance: 3, windows: 2, security: 3, cleanliness: 4, neighbours: 4, parking: 2, mobile_signal: 4, space: 3, rent_fairness: 4 },
      explanations: { landlord: "Responsive enough but nothing proactive.", energy: "Single glazed bedroom, heating always on.", epc_reality: "EPC says C, felt like E in winter. Freezing floors.", heating: "Boiler cannot keep up with heat loss.", windows: "Single glazed in bedroom, condensation daily.", damp: "Minor condensation, no serious mould.", noise: "Street noise through single glazed window.", security: "Yale lock only. No chain.", parking: "Permit zone, still no guarantee.", maintenance: "Week to fix the shower.", space: "Adequate for couple, tight with furniture." },
      info: { heating_type: "Gas central heating", furnished: "Unfurnished", white_goods: "Some (e.g. oven only)", white_goods_condition: "Good working order", water_billing: "Water meter", repairs_managed_by: "Letting agent", decorating_rules: "Minor changes only (e.g. picture hooks)", guest_policy: "No restrictions", flood_risk: "No issues", deposit_returned: "Yes, full deposit", left_clean: "Yes, cleaned thoroughly myself", crime_types: "" }
    }]
  },
  {
    id: "2", address: "7 Castle Street", flatNumber: "", city: "Manchester", postcode: "M3 4LZ", area: "Deansgate", type: "1-bed apartment",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop",
    reviews: [{
      id: "r3", author: "Priya D.", date: "2026-01-20", lived: "Aug 2024 - Jan 2026", verified: true,
      summary: "Genuinely excellent. Would recommend.",
      text: "One of the best rentals I have had. Landlord is responsive, same-day for urgent issues. EPC rating B and it genuinely feels like it. Double glazed, warm floors, reasonable bills.",
      scores: { landlord: 5, energy: 5, epc_reality: 5, damp: 5, noise: 4, light: 4, water: 3, heating: 5, pests: 5, smell: 5, safety: 4, value: 4, maintenance: 5, windows: 5, security: 5, cleanliness: 5, neighbours: 4, parking: 4, mobile_signal: 4, space: 4, rent_fairness: 4 },
      explanations: { water: "Top floor, pressure drops when others use water." },
      info: { heating_type: "Gas central heating", furnished: "Fully furnished", furniture_condition: "Excellent", white_goods: "Full set (oven, fridge, washing machine)", white_goods_condition: "New or nearly new", water_billing: "Water meter", repairs_managed_by: "Management company", decorating_rules: "Minor changes only (e.g. picture hooks)", guest_policy: "No restrictions", flood_risk: "No issues", deposit_returned: "Yes, full deposit", left_clean: "Yes, professionally cleaned", crime_types: "" }
    }]
  },
  {
    id: "3", address: "22 Elm Grove", flatNumber: "", city: "Brighton", postcode: "BN2 3ES", area: "Hanover", type: "3-bed terraced house",
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=400&fit=crop",
    reviews: [{
      id: "r4", author: "Tom H.", date: "2025-09-10", lived: "Sep 2023 - Aug 2025", verified: true,
      summary: "Loved the house, hated the damp.",
      text: "Beautiful period property with character. Three good bedrooms. Garden is a bonus. But damp is serious. Energy bills brutal. EPC says D but it performs like an F.",
      scores: { landlord: 3, energy: 1, epc_reality: 1, damp: 1, noise: 4, light: 5, water: 4, heating: 2, pests: 3, smell: 2, safety: 5, value: 3, maintenance: 3, windows: 1, security: 3, cleanliness: 3, neighbours: 5, parking: 4, mobile_signal: 3, space: 5, rent_fairness: 3 },
      explanations: { landlord: "Willing but ineffective. Damp fix failed twice.", energy: "No loft insulation, single glazed sash windows.", epc_reality: "Certificate says D, reality is F. Floors freezing in winter.", damp: "Black mould in two bedrooms every winter.", heating: "Boiler works but heat escapes faster than it heats.", windows: "Original sash windows, single glazed, draughty.", pests: "Mice in kitchen first winter.", smell: "Damp smell Nov to March.", security: "Basic locks, no deadbolt on back door.", cleanliness: "Dust everywhere at move-in.", rent_fairness: "Fair for Brighton but not for winter reality.", maintenance: "Repairs attempted but rarely effective.", mobile_signal: "Three drops out in kitchen. EE fine.", value: "Looks great on paper but running costs kill it." },
      info: { heating_type: "Gas central heating", furnished: "Unfurnished", white_goods: "Some (e.g. oven only)", white_goods_condition: "Old but functional", water_billing: "Fixed rate", repairs_managed_by: "Landlord directly", decorating_rules: "Free to decorate", guest_policy: "No restrictions", flood_risk: "Minor risk (e.g. nearby river)", deposit_returned: "Partial return", deposit_issues: "Deducted for garden maintenance despite no clause.", left_clean: "Yes, professionally cleaned", crime_types: "" }
    }]
  },
  {
    id: "4", address: "The Maltings", flatNumber: "Flat 9", city: "Bristol", postcode: "BS1 6WS", area: "Harbourside", type: "Studio flat",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop",
    reviews: [{
      id: "r7", author: "Chloe R.", date: "2026-02-14", lived: "Apr 2025 - Feb 2026", verified: true,
      summary: "Perfect starter flat. One noise issue.",
      text: "Small but well designed. Everything works. Management company is efficient. New build, energy efficient. Only gripe is noise from the flat above.",
      scores: { landlord: 4, energy: 5, epc_reality: 5, damp: 5, noise: 2, light: 3, water: 4, heating: 5, pests: 5, smell: 5, safety: 5, value: 4, maintenance: 4, windows: 5, security: 5, cleanliness: 5, neighbours: 3, parking: 3, mobile_signal: 5, space: 3, rent_fairness: 4 },
      explanations: { noise: "Thin ceilings. Hear footsteps, music, conversations every evening.", light: "North-facing. Needs lights on by 3pm in winter.", neighbours: "Upstairs neighbour plays music most evenings.", parking: "Allocated space costs extra. Street parking competitive.", space: "Studio. Fine for one, no room for guests." },
      info: { heating_type: "Communal heating", furnished: "Fully furnished", furniture_condition: "Good", white_goods: "Full set (oven, fridge, washing machine)", white_goods_condition: "New or nearly new", water_billing: "Included in rent", repairs_managed_by: "Management company", decorating_rules: "Nothing allowed", guest_policy: "Informal restrictions", flood_risk: "No issues", deposit_returned: "Yes, full deposit", left_clean: "Yes, cleaned thoroughly myself", crime_types: "" }
    }]
  },
  {
    id: "5", address: "31 Victoria Terrace", flatNumber: "", city: "Edinburgh", postcode: "EH1 2JL", area: "Old Town", type: "1-bed flat",
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&h=400&fit=crop",
    reviews: [{
      id: "r8", author: "Fiona G.", date: "2025-12-01", lived: "Jun 2024 - Nov 2025", verified: true,
      summary: "Festival month is unbearable. Rest of year is great.",
      text: "Lovely flat 11 months of the year. August is chaos. Outside festival season it is a dream. Beautiful views, well maintained, responsive landlord.",
      scores: { landlord: 5, energy: 3, epc_reality: 3, damp: 4, noise: 2, light: 4, water: 4, heating: 3, pests: 5, smell: 4, safety: 3, value: 3, maintenance: 5, windows: 3, security: 4, cleanliness: 4, neighbours: 4, parking: 1, mobile_signal: 4, space: 4, rent_fairness: 3 },
      explanations: { noise: "August festival: noise until 3am every night for a full month.", energy: "Old tenement. Decent but not modern insulation.", epc_reality: "EPC says C. About right most of the year.", heating: "Adequate but building loses heat through old walls.", windows: "Sash windows, some draughts.", safety: "Festival brings pickpockets. Otherwise very safe.", parking: "Forget it. Even residents parking is a fight.", value: "High rent but premium location.", rent_fairness: "Up 6% this year, no improvements." },
      info: { heating_type: "Gas central heating", furnished: "Part-furnished", furniture_condition: "Good", white_goods: "Full set (oven, fridge, washing machine)", white_goods_condition: "Good working order", water_billing: "Water meter", repairs_managed_by: "Landlord directly", decorating_rules: "Minor changes only (e.g. picture hooks)", guest_policy: "No restrictions", flood_risk: "No issues", deposit_returned: "Yes, full deposit", left_clean: "Yes, professionally cleaned", crime_types: "Pickpocketing during festival" }
    }]
  },
  {
    id: "6", address: "4 Dock Road", flatNumber: "", city: "Liverpool", postcode: "L3 4BB", area: "Baltic Triangle", type: "2-bed apartment",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=400&fit=crop",
    reviews: [{
      id: "r9", author: "Dan W.", date: "2025-08-19", lived: "Feb 2024 - Jul 2025", verified: true,
      summary: "Avoid. Landlord is absent.",
      text: "Reported a roof leak three times over five months. Nothing happened. Letting agent is a wall. Damp spread into the bedroom. Had to withhold rent to get any response.",
      scores: { landlord: 1, energy: 3, epc_reality: 3, damp: 1, noise: 3, light: 3, water: 3, heating: 3, pests: 4, smell: 2, safety: 3, value: 2, maintenance: 1, windows: 3, security: 3, cleanliness: 2, neighbours: 3, parking: 4, mobile_signal: 4, space: 4, rent_fairness: 2 },
      explanations: { landlord: "Roof leak reported three times, five months, zero response.", maintenance: "Five months for a roof leak. Had to escalate to council.", damp: "From roof leak. Black mould by month three.", smell: "Damp took over the bedroom.", value: "Not worth it when half the flat is unusable.", cleanliness: "Grease on surfaces, hair in bathroom at move-in.", safety: "Fine by day, rough edges at night near bars.", rent_fairness: "10% increase attempted despite unresolved damp.", noise: "Bar noise on weekends, manageable.", energy: "Adequate for newer build.", epc_reality: "EPC about right, no bill surprises.", heating: "Works fine.", windows: "Double glazed throughout.", security: "Standard multi-lock. Buzzer system.", neighbours: "Mostly quiet." },
      info: { heating_type: "Gas central heating", furnished: "Unfurnished", white_goods: "Some (e.g. oven only)", white_goods_condition: "Old but functional", water_billing: "Water meter", repairs_managed_by: "Letting agent", decorating_rules: "Nothing allowed", guest_policy: "Strict rules in contract", flood_risk: "No issues", deposit_returned: "No, nothing returned", deposit_issues: "Claimed damp was our fault despite reporting from month one.", left_clean: "Yes, cleaned thoroughly myself", crime_types: "Car break-ins" }
    }]
  }
];

// --- HELPERS ---
function avgScore(reviews, key) {
  const valid = reviews.filter(r => r.scores[key] !== undefined);
  return valid.length ? valid.reduce((s, r) => s + r.scores[key], 0) / valid.length : 0;
}
function overallAvg(reviews) {
  return reviews.length ? reviews.reduce((s, r) => {
    const v = Object.values(r.scores);
    return s + v.reduce((a, b) => a + b, 0) / v.length;
  }, 0) / reviews.length : 0;
}
function scoreColour(score) {
  if (score >= 4) return "var(--c-good)";
  if (score >= 3) return "var(--c-ok)";
  if (score >= 2) return "var(--c-warn)";
  return "var(--c-bad)";
}
function Stars({ score, size = 16 }) {
  const full = Math.floor(score), half = score - full >= 0.3, empty = 5 - full - (half ? 1 : 0);
  return (
    <span style={{ display: "inline-flex", gap: 1, fontSize: size }}>
      {Array(full).fill(0).map((_, i) => <span key={`f${i}`} style={{ color: "var(--c-amber)" }}>★</span>)}
      {half && <span style={{ color: "var(--c-amber)", opacity: 0.5 }}>★</span>}
      {Array(Math.max(0, empty)).fill(0).map((_, i) => <span key={`e${i}`} style={{ color: "var(--c-muted)" }}>★</span>)}
    </span>
  );
}
function ScoreBar({ score, label, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 15, width: 22, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--c-text-sec)", width: 170, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 7, background: "var(--c-surface)", borderRadius: 4, overflow: "hidden", minWidth: 60 }}>
        <div style={{ width: `${(score/5)*100}%`, height: "100%", background: scoreColour(score), borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: scoreColour(score), width: 28, textAlign: "right", flexShrink: 0 }}>{score.toFixed(1)}</span>
    </div>
  );
}
function Badge({ children, variant = "neutral" }) {
  const s = {
    good: { background: "var(--c-good-bg)", color: "var(--c-good)", border: "1px solid var(--c-good-border)" },
    bad: { background: "var(--c-bad-bg)", color: "var(--c-bad)", border: "1px solid var(--c-bad-border)" },
    neutral: { background: "var(--c-surface)", color: "var(--c-text-sec)", border: "1px solid var(--c-border)" },
    amber: { background: "var(--c-amber-bg)", color: "var(--c-amber)", border: "1px solid var(--c-amber-border)" },
    info: { background: "var(--c-info-bg)", color: "var(--c-info)", border: "1px solid var(--c-info-border)" }
  };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 10px", borderRadius: 6, fontWeight: 500, ...(s[variant]||s.neutral) }}>{children}</span>;
}

// --- Postcode Lookup Hook ---
function usePostcodeLookup() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const lookup = async (postcode) => {
    const clean = postcode.replace(/\s/g, "").toUpperCase();
    if (clean.length < 5) { setError("Enter a full UK postcode."); setResults(null); return; }
    setLoading(true); setError(""); setResults(null);
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
      const data = await res.json();
      if (data.status === 200 && data.result) {
        setResults({
          postcode: data.result.postcode,
          area: data.result.admin_ward || "",
          city: data.result.admin_district || "",
          region: data.result.region || data.result.country || "",
          valid: true
        });
      } else {
        setError("Postcode not found. Check and try again.");
      }
    } catch {
      setError("Could not verify postcode. You can still enter your address manually.");
    }
    setLoading(false);
  };
  return { lookup, loading, results, error, setResults, setError };
}

// Helper to get display address
function displayAddress(p) {
  const flat = p.flatNumber ? `${p.flatNumber}, ` : "";
  return `${flat}${p.address}`;
}

// --- CSS ---
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Outfit:wght@300;400;500;600;700&display=swap');
  :root,[data-theme="dark"]{--c-bg:#0B1A2E;--c-bg-alt:#091525;--c-surface:#152238;--c-surface-hover:#1A2942;--c-card:#132035;--c-text:#E2E8F0;--c-text-sec:#8899AA;--c-text-bright:#F1F5F9;--c-amber:#E9A84C;--c-amber-bg:rgba(233,168,76,.12);--c-amber-border:rgba(233,168,76,.25);--c-accent:#4DA375;--c-accent-bg:rgba(77,163,117,.1);--c-good:#4DA375;--c-good-bg:rgba(77,163,117,.12);--c-good-border:rgba(77,163,117,.25);--c-ok:#E9A84C;--c-warn:#D4763A;--c-bad:#D45555;--c-bad-bg:rgba(212,85,85,.1);--c-bad-border:rgba(212,85,85,.25);--c-info:#5B9BD5;--c-info-bg:rgba(91,155,213,.1);--c-info-border:rgba(91,155,213,.25);--c-muted:#2D3E55;--c-border:#1E3050;--c-input-bg:#0F1E33;--c-input-border:#1E3050;--font-display:'Source Serif 4',Georgia,serif;--font-body:'Outfit',-apple-system,sans-serif;--max-w:1120px;--radius:12px;--nav-bg:rgba(11,26,46,.88)}
  [data-theme="light"]{--c-bg:#F0F2F7;--c-bg-alt:#E6E9F0;--c-surface:#DDE1EA;--c-surface-hover:#D0D5E0;--c-card:#FFFFFF;--c-text:#0B1A2E;--c-text-sec:#4A5875;--c-text-bright:#0B1A2E;--c-amber:#C4880F;--c-amber-bg:rgba(196,136,15,.1);--c-amber-border:rgba(196,136,15,.2);--c-accent:#1B6B42;--c-accent-bg:rgba(27,107,66,.06);--c-good:#1B6B42;--c-good-bg:rgba(27,107,66,.08);--c-good-border:rgba(27,107,66,.18);--c-ok:#B8860B;--c-warn:#C4652A;--c-bad:#B83333;--c-bad-bg:rgba(184,51,51,.06);--c-bad-border:rgba(184,51,51,.15);--c-info:#2E6BA4;--c-info-bg:rgba(46,107,164,.06);--c-info-border:rgba(46,107,164,.15);--c-muted:#C8CDD8;--c-border:#D0D5E0;--c-input-bg:#FFFFFF;--c-input-border:#C8CDD8;--nav-bg:rgba(240,242,247,.88)}
  *{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}
  body{font-family:var(--font-body);color:var(--c-text);background:var(--c-bg);line-height:1.6;-webkit-font-smoothing:antialiased;transition:background .3s,color .3s}
  ::selection{background:var(--c-amber-bg);color:var(--c-text-bright)}a{color:inherit;text-decoration:none}
  .container{max-width:var(--max-w);margin:0 auto;padding:0 24px}input,select,textarea{font-family:var(--font-body)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp .5s ease forwards;opacity:0}.fade-up-d1{animation-delay:.1s}.fade-up-d2{animation-delay:.2s}.fade-up-d3{animation-delay:.3s}
  .input-field{width:100%;border:1px solid var(--c-input-border);border-radius:8px;padding:12px 14px;font-size:15px;outline:none;background:var(--c-input-bg);color:var(--c-text);transition:border-color .2s}
  .input-field:focus{border-color:var(--c-accent)}.input-field::placeholder{color:var(--c-text-sec);opacity:.6}
  .btn-primary{background:var(--c-accent);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:opacity .2s}
  .btn-primary:hover{opacity:.9}.btn-primary:disabled{opacity:.4;cursor:not-allowed}
  .btn-secondary{background:none;border:1px solid var(--c-border);color:var(--c-text);padding:10px 24px;border-radius:8px;cursor:pointer;font-family:var(--font-body);font-weight:500;font-size:14px;transition:background .2s}
  .btn-secondary:hover{background:var(--c-surface)}
  @media(max-width:640px){.nav-desktop-link{display:none!important}.nav-mobile-btn{display:block!important}}
  @media(min-width:641px){.nav-mobile-menu{display:none!important}}
`;

// --- THEME TOGGLE ---
function ThemeToggle({ mode, setMode }) {
  return (
    <div style={{ display: "flex", background: "var(--c-surface)", borderRadius: 8, padding: 2, gap: 2 }}>
      {[{ v: "system", l: "Auto" },{ v: "light", l: "☀" },{ v: "dark", l: "☾" }].map(o => (
        <button key={o.v} onClick={() => setMode(o.v)} style={{
          background: mode === o.v ? "var(--c-accent)" : "transparent", color: mode === o.v ? "#fff" : "var(--c-text-sec)",
          border: "none", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          fontFamily: "var(--font-body)", transition: "all .2s", minWidth: 32
        }}>{o.l}</button>
      ))}
    </div>
  );
}

// --- NAV ---
function Nav({ page, setPage, themeMode, setThemeMode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  const links = [{ key: "home", label: "Home" },{ key: "search", label: "Search" },{ key: "review", label: "Leave a Review" },{ key: "about", label: "About" }];
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: scrolled ? "var(--nav-bg)" : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: scrolled ? "1px solid var(--c-border)" : "1px solid transparent", transition: "all .3s" }}>
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <button onClick={() => { setPage({ name: "home" }); setMenuOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <span style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--c-amber)" }}>RateWise</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {links.map(l => (
            <button key={l.key} onClick={() => { setPage({ name: l.key }); setMenuOpen(false); }} className="nav-desktop-link"
              style={{ background: page.name === l.key ? "var(--c-accent)" : "none", color: page.name === l.key ? "#fff" : "var(--c-text-sec)", border: "none", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font-body)", transition: "all .2s" }}>{l.label}</button>
          ))}
          <div className="nav-desktop-link" style={{ marginLeft: 8 }}><ThemeToggle mode={themeMode} setMode={setThemeMode} /></div>
        </div>
        <button className="nav-mobile-btn" onClick={() => setMenuOpen(!menuOpen)} style={{ display: "none", background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 4, color: "var(--c-text)" }}>{menuOpen ? "✕" : "☰"}</button>
      </div>
      {menuOpen && (
        <div className="nav-mobile-menu" style={{ background: "var(--c-bg)", padding: "12px 24px 20px", borderBottom: "1px solid var(--c-border)" }}>
          {links.map(l => (
            <button key={l.key} onClick={() => { setPage({ name: l.key }); setMenuOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: page.name === l.key ? "var(--c-accent-bg)" : "none", color: "var(--c-text)", border: "none", padding: "12px 16px", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 500, fontFamily: "var(--font-body)", marginBottom: 4 }}>{l.label}</button>
          ))}
          <div style={{ padding: "12px 16px" }}><ThemeToggle mode={themeMode} setMode={setThemeMode} /></div>
        </div>
      )}
    </nav>
  );
}

// --- PROPERTY CARD ---
function PropertyCard({ property, onClick }) {
  const avg = overallAvg(property.reviews);
  const worstKey = CRITERIA_KEYS.reduce((w, k) => avgScore(property.reviews, k) < avgScore(property.reviews, w) ? k : w, CRITERIA_KEYS[0]);
  const bestKey = CRITERIA_KEYS.reduce((b, k) => avgScore(property.reviews, k) > avgScore(property.reviews, b) ? k : b, CRITERIA_KEYS[0]);
  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", overflow: "hidden", cursor: "pointer", transition: "transform .2s, box-shadow .2s", fontFamily: "var(--font-body)", color: "var(--c-text)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.2)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ height: 180, background: `url(${property.image}) center/cover`, position: "relative" }}>
        <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,.65)", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{property.type}</span>
      </div>
      <div style={{ padding: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 4, color: "var(--c-text-bright)" }}>{displayAddress(property)}</h3>
        <p style={{ color: "var(--c-text-sec)", fontSize: 14, marginBottom: 12 }}>{property.area}, {property.city} &middot; {property.postcode}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Stars score={avg} size={14} /><span style={{ fontWeight: 600, fontSize: 14 }}>{avg.toFixed(1)}</span>
          <span style={{ color: "var(--c-text-sec)", fontSize: 13 }}>({property.reviews.length} review{property.reviews.length !== 1 ? "s" : ""})</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge variant="good">{CRITERIA_META[bestKey].icon} Best: {CRITERIA_META[bestKey].label}</Badge>
          <Badge variant="bad">⚠ {CRITERIA_META[worstKey].label}</Badge>
        </div>
      </div>
    </button>
  );
}

// --- SHARE / REFERRAL COMPONENT ---
function SharePrompt({ compact = false }) {
  const [copied, setCopied] = useState(false);
  const shareText = "I just reviewed my old rental on RateWise. If you have rented anywhere in the UK, leave a review too - it helps the next tenant avoid nasty surprises. Check it out:";
  const shareUrl = "https://ratewise.co.uk";

  const copyLink = () => {
    try { navigator.clipboard.writeText(`${shareText} ${shareUrl}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  if (compact) return (
    <div style={{ background: "var(--c-amber-bg)", border: "1px solid var(--c-amber-border)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
      <p style={{ fontSize: 15, color: "var(--c-amber)", fontWeight: 600, marginBottom: 8 }}>Know someone who has rented in the UK?</p>
      <p style={{ fontSize: 13, color: "var(--c-text-sec)", marginBottom: 14, lineHeight: 1.6 }}>
        Send them this site. Every review from a real tenant makes the data better for everyone searching for their next home.
      </p>
      <button onClick={copyLink} className="btn-primary" style={{ background: "var(--c-amber)", fontSize: 13, padding: "8px 20px" }}>
        {copied ? "Copied!" : "Copy share link"}
      </button>
    </div>
  );

  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 32, textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <p style={{ fontSize: 36, marginBottom: 12 }}>📣</p>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 8, color: "var(--c-text-bright)" }}>Tell your family and friends</h3>
      <p style={{ fontSize: 15, color: "var(--c-text-sec)", lineHeight: 1.7, marginBottom: 6 }}>
        Know anyone who has rented a flat or house in the UK? Ask them to leave a review of where they lived. The more reviews we have, the better the data is for everyone looking for their next home.
      </p>
      <p style={{ fontSize: 14, color: "var(--c-text-sec)", lineHeight: 1.7, marginBottom: 20 }}>
        Looking for a place to rent? Search for it here first and see what previous tenants actually thought.
      </p>
      <button onClick={copyLink} className="btn-primary" style={{ background: "var(--c-amber)", fontSize: 15, padding: "12px 28px" }}>
        {copied ? "Copied to clipboard!" : "Copy share message"}
      </button>
    </div>
  );
}

// --- HOME PAGE ---
function HomePage({ setPage, properties }) {
  const [query, setQuery] = useState("");
  const totalReviews = properties.reduce((s, p) => s + p.reviews.length, 0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) setPage({ name: "search", query: query.trim() });
  };

  return (
    <div>
      <section style={{ minHeight: "88vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.035, backgroundImage: "radial-gradient(circle at 2px 2px, var(--c-text) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div style={{ maxWidth: 720, position: "relative" }}>
          <p className="fade-up" style={{ color: "var(--c-amber)", fontWeight: 600, fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Unfiltered reviews from real tenants</p>
          <h1 className="fade-up fade-up-d1" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.15, marginBottom: 20, color: "var(--c-text-bright)" }}>Know what you are<br />renting before you sign.</h1>
          <p className="fade-up fade-up-d2" style={{ color: "var(--c-text-sec)", fontSize: 18, maxWidth: 540, margin: "0 auto 36px", lineHeight: 1.7 }}>
            Search any UK rental property and see what previous tenants actually thought. Damp, landlords, noise, energy bills, deposits, security. The stuff that matters.
          </p>
          <form onSubmit={handleSearch} className="fade-up fade-up-d3" style={{ display: "flex", gap: 8, maxWidth: 540, margin: "0 auto", background: "var(--c-card)", borderRadius: 14, padding: 6, border: "1px solid var(--c-border)", boxShadow: "0 4px 24px rgba(0,0,0,.15)" }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by postcode, address, or city..."
              style={{ flex: 1, border: "none", outline: "none", padding: "12px 16px", fontSize: 15, fontFamily: "var(--font-body)", background: "transparent", borderRadius: 10, minWidth: 0, color: "var(--c-text)" }} />
            <button type="submit" className="btn-primary" style={{ whiteSpace: "nowrap" }}>Search</button>
          </form>
        </div>
      </section>

      <section style={{ background: "var(--c-surface)", padding: "32px 24px", borderTop: "1px solid var(--c-border)", borderBottom: "1px solid var(--c-border)" }}>
        <div className="container" style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap", textAlign: "center" }}>
          {[{ n: properties.length, l: "Properties reviewed" },{ n: totalReviews, l: "Tenant reviews" },{ n: CRITERIA_KEYS.length, l: "Criteria rated" }].map((s, i) => (
            <div key={i}><div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--c-amber)" }}>{s.n}</div><div style={{ color: "var(--c-text-sec)", fontSize: 14 }}>{s.l}</div></div>
          ))}
        </div>
      </section>

      <section style={{ padding: "80px 24px" }}>
        <div className="container">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 32, textAlign: "center", marginBottom: 48, color: "var(--c-text-bright)" }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {[
              { s: "01", t: "Search a property", d: "Enter a postcode, address, or city. We show every reviewed property that matches." },
              { s: "02", t: "Read the full picture", d: `Scores across ${CRITERIA_KEYS.length} criteria including damp, EPC vs reality, deposit issues, security, and more.` },
              { s: "03", t: "Make an informed choice", d: "Compare strengths and weaknesses. Know exactly what you are signing up for." },
              { s: "04", t: "Leave your own review", d: "Moved out? Verify your address and share your experience." }
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 24 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 36, color: "var(--c-amber)", display: "block", marginBottom: 10 }}>{s.s}</span>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: "var(--c-text-bright)" }}>{s.t}</h3>
                <p style={{ color: "var(--c-text-sec)", fontSize: 14, lineHeight: 1.7 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "0 24px 60px" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--c-text-bright)" }}>Recently reviewed</h2>
            <button onClick={() => setPage({ name: "search" })} className="btn-secondary">View all &rarr;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
            {properties.slice(0, 3).map(p => <PropertyCard key={p.id} property={p} onClick={() => setPage({ name: "property", id: p.id })} />)}
          </div>
        </div>
      </section>

      {/* Referral / Share section */}
      <section style={{ padding: "0 24px 60px" }}>
        <div className="container"><SharePrompt /></div>
      </section>

      <section style={{ padding: "0 24px 80px" }}>
        <div className="container" style={{ background: "var(--c-surface)", borderRadius: "var(--radius)", padding: "48px 40px", textAlign: "center", border: "1px solid var(--c-border)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 12, color: "var(--c-text-bright)" }}>Recently moved out?</h2>
          <p style={{ color: "var(--c-text-sec)", marginBottom: 24, maxWidth: 460, margin: "0 auto 24px", lineHeight: 1.7 }}>Your unfiltered review helps the next tenant avoid nasty surprises.</p>
          <button onClick={() => setPage({ name: "review" })} className="btn-primary" style={{ fontSize: 16, padding: "14px 32px" }}>Leave a Review</button>
        </div>
      </section>
    </div>
  );
}

// --- SEARCH PAGE ---
function SearchPage({ setPage, properties, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [sortBy, setSortBy] = useState("rating");
  const [filterCriteria, setFilterCriteria] = useState("");
  const [filterGroup, setFilterGroup] = useState("");

  const filtered = properties.filter(p => {
    const q = query.toLowerCase().replace(/\s/g, "");
    if (!q) return true;
    const searchable = `${p.flatNumber} ${p.address} ${p.city} ${p.postcode} ${p.area} ${p.type}`.toLowerCase().replace(/\s/g, "");
    return searchable.includes(q);
  });

  const displayCriteria = filterGroup ? CRITERIA_KEYS.filter(k => CRITERIA_META[k].group === filterGroup) : CRITERIA_KEYS;
  const sorted = [...filtered].sort((a, b) => {
    if (filterCriteria) return avgScore(b.reviews, filterCriteria) - avgScore(a.reviews, filterCriteria);
    if (sortBy === "reviews") return b.reviews.length - a.reviews.length;
    return overallAvg(b.reviews) - overallAvg(a.reviews);
  });

  // Check if query looks like a postcode
  const isPostcodeLike = query.replace(/\s/g, "").length >= 2 && /^[A-Za-z]{1,2}[0-9]/.test(query.trim());

  return (
    <div style={{ paddingTop: 88, minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: 20, paddingBottom: 80 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, marginBottom: 24, color: "var(--c-text-bright)" }}>Search properties</h1>
        <div style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 20, marginBottom: 24 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} className="input-field" placeholder="Postcode, address, city, or property type..." style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field" style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}>
              <option value="rating">Sort: Overall Rating</option><option value="reviews">Sort: Most Reviews</option>
            </select>
            <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setFilterCriteria(""); }} className="input-field" style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}>
              <option value="">Group: All</option>
              {Object.entries(CRITERIA_GROUPS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <select value={filterCriteria} onChange={e => setFilterCriteria(e.target.value)} className="input-field" style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}>
              <option value="">Criteria: All</option>
              {displayCriteria.map(k => <option key={k} value={k}>{CRITERIA_META[k].icon} {CRITERIA_META[k].label}</option>)}
            </select>
          </div>
        </div>

        {sorted.length > 0 && (
          <>
            <p style={{ color: "var(--c-text-sec)", fontSize: 14, marginBottom: 20 }}>{sorted.length} propert{sorted.length === 1 ? "y" : "ies"} found{query ? ` for "${query}"` : ""}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {sorted.map(p => (
                <div key={p.id}>
                  <PropertyCard property={p} onClick={() => setPage({ name: "property", id: p.id })} />
                  {filterCriteria && (
                    <div style={{ background: "var(--c-card)", margin: "-8px 12px 0", padding: "10px 16px", borderRadius: "0 0 10px 10px", border: "1px solid var(--c-border)", borderTop: "none", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                      <span>{CRITERIA_META[filterCriteria].icon} {CRITERIA_META[filterCriteria].label}</span>
                      <span style={{ fontWeight: 600, color: scoreColour(avgScore(p.reviews, filterCriteria)) }}>{avgScore(p.reviews, filterCriteria).toFixed(1)} / 5</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🔍</p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 8, color: "var(--c-text-bright)" }}>No reviews found for this property yet</h3>
            <p style={{ color: "var(--c-text-sec)", marginBottom: 8, maxWidth: 460, margin: "0 auto 8px", lineHeight: 1.7 }}>
              We do not have any reviews matching "{query}" yet. This property has not been reviewed on RateWise.
            </p>
            {isPostcodeLike && (
              <p style={{ color: "var(--c-text-sec)", fontSize: 14, marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
                Try searching with just the first part of the postcode (e.g. "{query.trim().split(/\s/)[0]}") to see nearby reviewed properties.
              </p>
            )}
            {!isPostcodeLike && (
              <p style={{ color: "var(--c-text-sec)", fontSize: 14, marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
                Try searching by postcode instead. For example: "N4", "M3", "BS1", or a full postcode like "N4 5PH".
              </p>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setQuery("")} className="btn-primary">Clear search</button>
              <button onClick={() => setPage({ name: "review" })} className="btn-secondary">Be the first to review it</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- PROPERTY DETAIL (same as before but with share prompt) ---
function PropertyPage({ setPage, property }) {
  const [showGroup, setShowGroup] = useState("all");
  if (!property) return (
    <div style={{ paddingTop: 120, textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--font-display)", color: "var(--c-text-bright)" }}>Property not found</h2>
      <button onClick={() => setPage({ name: "search" })} className="btn-primary" style={{ marginTop: 16 }}>Back to search</button>
    </div>
  );
  const avg = overallAvg(property.reviews);
  const displayKeys = showGroup === "all" ? CRITERIA_KEYS : CRITERIA_KEYS.filter(k => CRITERIA_META[k].group === showGroup);
  const latestReview = property.reviews[0];
  const hasInfo = latestReview && latestReview.info;
  const pill = (label, key) => <button onClick={() => setShowGroup(key)} style={{ border: "none", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: "var(--font-body)", transition: "all .2s", background: showGroup === key ? "var(--c-accent)" : "var(--c-surface)", color: showGroup === key ? "#fff" : "var(--c-text-sec)" }}>{label}</button>;

  return (
    <div style={{ paddingTop: 80, minHeight: "100vh" }}>
      <div style={{ height: 260, background: `url(${property.image}) center/cover`, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 30%, rgba(11,26,46,.85))" }} />
        <div className="container" style={{ position: "relative", height: "100%", display: "flex", alignItems: "flex-end", paddingBottom: 24 }}>
          <div>
            <Badge variant="amber">{property.type}</Badge>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 4vw, 36px)", color: "#fff", marginTop: 8 }}>{displayAddress(property)}</h1>
            <p style={{ color: "rgba(255,255,255,.75)", fontSize: 15 }}>{property.area}, {property.city} &middot; {property.postcode}</p>
          </div>
        </div>
      </div>
      <div className="container" style={{ paddingTop: 32, paddingBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24, marginBottom: 32 }}>
          <div style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: scoreColour(avg), color: "#fff", fontFamily: "var(--font-display)", fontSize: 26 }}>{avg.toFixed(1)}</div>
              <div><Stars score={avg} size={18} /><p style={{ color: "var(--c-text-sec)", fontSize: 14, marginTop: 4 }}>{property.reviews.length} review{property.reviews.length !== 1 ? "s" : ""}</p></div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {pill("All", "all")}
              {Object.entries(CRITERIA_GROUPS).map(([k, v]) => pill(`${v.icon} ${v.label}`, k))}
            </div>
            {displayKeys.map(k => <ScoreBar key={k} score={avgScore(property.reviews, k)} label={CRITERIA_META[k].label} icon={CRITERIA_META[k].icon} />)}
          </div>
          <div>
            <div style={{ background: "var(--c-good-bg)", border: "1px solid var(--c-good-border)", borderRadius: "var(--radius)", padding: 22, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--c-good)", marginBottom: 10 }}>Strengths</h3>
              {CRITERIA_KEYS.filter(k => avgScore(property.reviews, k) >= 4).length === 0 ? <p style={{ color: "var(--c-text-sec)", fontSize: 14 }}>No criteria scored 4+.</p> :
                CRITERIA_KEYS.filter(k => avgScore(property.reviews, k) >= 4).map(k => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14 }}><span>{CRITERIA_META[k].icon}</span><span>{CRITERIA_META[k].label}</span><span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--c-good)" }}>{avgScore(property.reviews, k).toFixed(1)}</span></div>
                ))}
            </div>
            <div style={{ background: "var(--c-bad-bg)", border: "1px solid var(--c-bad-border)", borderRadius: "var(--radius)", padding: 22, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--c-bad)", marginBottom: 10 }}>Watch out for</h3>
              {CRITERIA_KEYS.filter(k => avgScore(property.reviews, k) <= 2.5).length === 0 ? <p style={{ color: "var(--c-text-sec)", fontSize: 14 }}>No major red flags.</p> :
                CRITERIA_KEYS.filter(k => avgScore(property.reviews, k) <= 2.5).map(k => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 14 }}><span>{CRITERIA_META[k].icon}</span><span>{CRITERIA_META[k].label}</span><span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--c-bad)" }}>{avgScore(property.reviews, k).toFixed(1)}</span></div>
                ))}
            </div>
            {hasInfo && (
              <div style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 22 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: "var(--c-text-bright)" }}>Property Details</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {Object.entries(INFO_FIELDS).map(([key, field]) => {
                    if (field.showIf && !field.showIf(latestReview.info)) return null;
                    const val = latestReview.info[key]; if (!val || val === "N/A") return null;
                    return <div key={key} style={{ fontSize: 13 }}><span style={{ color: "var(--c-text-sec)" }}>{field.label}</span><br /><span style={{ fontWeight: 500 }}>{val}</span></div>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, marginBottom: 20, color: "var(--c-text-bright)" }}>Tenant Reviews</h2>
        {property.reviews.map(r => {
          const rAvg = Object.values(r.scores).reduce((a, b) => a + b, 0) / Object.values(r.scores).length;
          const lowScores = CRITERIA_KEYS.filter(k => r.scores[k] !== undefined && r.scores[k] <= 3 && r.explanations && r.explanations[k]);
          return (
            <div key={r.id} style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 24, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--c-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{r.author.charAt(0)}</div>
                  <div><span style={{ fontWeight: 600, fontSize: 15, color: "var(--c-text-bright)" }}>{r.author} {r.verified && <span style={{ color: "var(--c-accent)", fontSize: 12, marginLeft: 4 }}>✓ Verified</span>}</span><p style={{ color: "var(--c-text-sec)", fontSize: 12 }}>Lived here: {r.lived}</p></div>
                </div>
                <div style={{ textAlign: "right" }}><Stars score={rAvg} size={13} /><p style={{ color: "var(--c-text-sec)", fontSize: 12, marginTop: 2 }}>{new Date(r.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p></div>
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--c-text-bright)" }}>{r.summary}</h4>
              <p style={{ color: "var(--c-text-sec)", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{r.text}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: lowScores.length > 0 ? 16 : 0 }}>
                {CRITERIA_KEYS.map(k => r.scores[k] === undefined ? null : <Badge key={k} variant={r.scores[k] >= 4 ? "good" : r.scores[k] <= 2 ? "bad" : "neutral"}>{CRITERIA_META[k].icon} {r.scores[k]}/5</Badge>)}
              </div>
              {lowScores.length > 0 && (
                <div style={{ background: "var(--c-surface)", borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--c-text-sec)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 10 }}>Why these scored low</p>
                  {lowScores.map(k => <div key={k} style={{ marginBottom: 8, fontSize: 13 }}><span style={{ color: scoreColour(r.scores[k]), fontWeight: 600 }}>{CRITERIA_META[k].icon} {CRITERIA_META[k].label} ({r.scores[k]}/5):</span> <span style={{ color: "var(--c-text-sec)" }}>{r.explanations[k]}</span></div>)}
                </div>
              )}
              {r.info && r.info.deposit_returned && r.info.deposit_returned !== "N/A" && (
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--c-text-sec)", background: "var(--c-surface)", borderRadius: 8, padding: 12 }}>
                  <strong style={{ color: "var(--c-text-bright)" }}>Deposit:</strong> {r.info.deposit_returned}
                  {r.info.deposit_issues && <span> &ndash; {r.info.deposit_issues}</span>}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage({ name: "review", prefill: property })} className="btn-primary" style={{ fontSize: 16, padding: "14px 32px" }}>Review this property</button>
          <button onClick={() => setPage({ name: "search" })} className="btn-secondary">Back to search</button>
        </div>
        <div style={{ marginTop: 24 }}><SharePrompt compact /></div>
        <div style={{ marginTop: 20, textAlign: "center", background: "var(--c-info-bg)", border: "1px solid var(--c-info-border)", borderRadius: "var(--radius)", padding: 20 }}>
          <p style={{ fontSize: 14, color: "var(--c-info)" }}>📶 Check mobile coverage: <a href="https://www.ofcom.org.uk/mobile-coverage-checker" target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-info)", fontWeight: 600, textDecoration: "underline" }}>Ofcom Coverage Checker</a></p>
        </div>
      </div>
    </div>
  );
}

// --- REVIEW PAGE ---
function ReviewPage({ properties, onSubmit, prefill }) {
  const [step, setStep] = useState(0);
  const [postcodeLookupVal, setPostcodeLookupVal] = useState("");
  const { lookup, loading: pcLoading, results: pcResults, error: pcError, setResults: setPcResults } = usePostcodeLookup();
  const [address, setAddress] = useState(prefill ? prefill.address : "");
  const [flatNumber, setFlatNumber] = useState(prefill ? (prefill.flatNumber || "") : "");
  const [city, setCity] = useState(prefill ? prefill.city : "");
  const [postcode, setPostcode] = useState(prefill ? prefill.postcode : "");
  const [propertyType, setPropertyType] = useState(prefill ? prefill.type : "");
  const [author, setAuthor] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [moveOut, setMoveOut] = useState("");
  const [verifyConfirm, setVerifyConfirm] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState("");
  const [info, setInfo] = useState(Object.fromEntries(Object.keys(INFO_FIELDS).map(k => [k, ""])));
  const [scores, setScores] = useState(Object.fromEntries(CRITERIA_KEYS.map(k => [k, 0])));
  const [explanations, setExplanations] = useState(Object.fromEntries(CRITERIA_KEYS.map(k => [k, ""])));
  const [summary, setSummary] = useState("");
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const setScore = (key, val) => setScores(prev => ({ ...prev, [key]: val }));
  const setExplanation = (key, val) => setExplanations(prev => ({ ...prev, [key]: val }));
  const setInfoField = (key, val) => setInfo(prev => ({ ...prev, [key]: val }));

  const handlePostcodeLookup = () => {
    if (postcodeLookupVal.trim()) lookup(postcodeLookupVal.trim());
  };

  // Auto-fill from postcode lookup
  useEffect(() => {
    if (pcResults && pcResults.valid) {
      setPostcode(pcResults.postcode);
      setCity(pcResults.city);
    }
  }, [pcResults]);

  const steps = [
    { title: "Property Details", subtitle: "Start by entering your postcode to find your address." },
    { title: "Verify Your Address", subtitle: "Confirm you actually lived at this property." },
    { title: "Property Information", subtitle: "Tell us about the property setup." },
    { title: "Rate: The Property", subtitle: "Score 1 (terrible) to 5 (excellent). Scores of 3 or below need an explanation." },
    { title: "Rate: Area & Surroundings", subtitle: "How was the neighbourhood?" },
    { title: "Rate: Landlord & Management", subtitle: "How was the landlord, agent, or management company?" },
    { title: "Your Written Review", subtitle: "Sum it up for the next tenant." }
  ];
  const groupMap = { 3: "property", 4: "area", 5: "management" };

  const canProceed = (s) => {
    if (s === 0) return address && city && postcode && author && moveIn && moveOut;
    if (s === 1) return verifyConfirm && verifyMethod;
    if (s === 2) return true;
    if (s >= 3 && s <= 5) {
      return CRITERIA_KEYS.filter(k => CRITERIA_META[k].group === groupMap[s]).every(k => {
        if (scores[k] === 0) return false;
        if (scores[k] <= 3 && !explanations[k].trim()) return false;
        return true;
      });
    }
    if (s === 6) return summary.trim() && text.trim();
    return true;
  };

  const handleSubmit = () => {
    const cleanExp = {};
    CRITERIA_KEYS.forEach(k => { if (explanations[k].trim()) cleanExp[k] = explanations[k].trim(); });
    onSubmit({
      address, flatNumber, city, postcode, type: propertyType || "Property",
      review: {
        author, lived: `${moveIn} - ${moveOut}`, summary, text, scores, explanations: cleanExp, info,
        date: new Date().toISOString().split("T")[0], id: `r-${Date.now()}`, verified: true
      }
    });
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ paddingTop: 100, minHeight: "80vh" }}>
      <div className="container" style={{ maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--c-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 16px" }}>✓</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 12, color: "var(--c-text-bright)" }}>Review submitted</h2>
          <p style={{ color: "var(--c-text-sec)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>Your verified review is now live. You are helping the next tenant make a better decision.</p>
        </div>
        <SharePrompt />
      </div>
    </div>
  );

  const renderScoring = (groupKey) => (
    <div style={{ display: "grid", gap: 14 }}>
      {CRITERIA_KEYS.filter(k => CRITERIA_META[k].group === groupKey).map(k => (
        <div key={k} style={{ background: "var(--c-surface)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>{CRITERIA_META[k].icon}</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-text-bright)" }}>{CRITERIA_META[k].label}</span>
          </div>
          <p style={{ color: "var(--c-text-sec)", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{CRITERIA_META[k].desc}</p>
          <div style={{ display: "flex", gap: 6 }}>
            {[1,2,3,4,5].map(v => (
              <button key={v} onClick={() => setScore(k, v)} style={{
                width: 42, height: 42, borderRadius: 8, border: "none", cursor: "pointer",
                background: scores[k] === v ? (v <= 2 ? "var(--c-bad)" : v === 3 ? "var(--c-ok)" : "var(--c-accent)") : "var(--c-card)",
                color: scores[k] === v ? "#fff" : "var(--c-text)", fontWeight: 600, fontSize: 14, fontFamily: "var(--font-body)", transition: "all .15s"
              }}>{v}</button>
            ))}
          </div>
          {scores[k] > 0 && scores[k] <= 3 && (
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--c-bad)", display: "block", marginBottom: 4 }}>⚠ Score is {scores[k]}/5 - please explain why:</label>
              <textarea value={explanations[k]} onChange={e => setExplanation(k, e.target.value)} placeholder={`What was wrong with ${CRITERIA_META[k].label.toLowerCase()}?`} className="input-field" rows={2} style={{ resize: "vertical", lineHeight: 1.6, fontSize: 13 }} />
              {!explanations[k].trim() && <p style={{ fontSize: 11, color: "var(--c-bad)", marginTop: 4 }}>Required for scores of 3 or below.</p>}
            </div>
          )}
        </div>
      ))}
      {groupKey === "area" && (
        <div style={{ background: "var(--c-info-bg)", border: "1px solid var(--c-info-border)", borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 13, color: "var(--c-info)" }}>📶 Check signal: <a href="https://www.ofcom.org.uk/mobile-coverage-checker" target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-info)", fontWeight: 600, textDecoration: "underline" }}>Ofcom Coverage Checker</a></p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ paddingTop: 88, minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: 700, paddingTop: 20, paddingBottom: 80 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, marginBottom: 8, color: "var(--c-text-bright)" }}>Leave a review</h1>
        <p style={{ color: "var(--c-text-sec)", marginBottom: 28 }}>Moved out? Verify your address and share your honest experience.</p>
        <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 2, background: i <= step ? "var(--c-accent)" : "var(--c-muted)", transition: "background .3s" }} />
              <p style={{ fontSize: 9, color: i <= step ? "var(--c-accent)" : "var(--c-text-sec)", marginTop: 4, fontWeight: 500 }}>{i + 1}</p>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 28 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 4, color: "var(--c-text-bright)" }}>{steps[step].title}</h2>
          <p style={{ color: "var(--c-text-sec)", fontSize: 14, marginBottom: 24 }}>{steps[step].subtitle}</p>

          {step === 0 && (
            <div style={{ display: "grid", gap: 14 }}>
              {/* Postcode lookup */}
              <div style={{ background: "var(--c-surface)", borderRadius: 10, padding: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Find your address by postcode</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={postcodeLookupVal} onChange={e => setPostcodeLookupVal(e.target.value.toUpperCase())}
                    placeholder="e.g. N4 5PH" className="input-field" style={{ flex: 1 }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handlePostcodeLookup(); } }} />
                  <button onClick={handlePostcodeLookup} className="btn-primary" style={{ padding: "10px 20px", whiteSpace: "nowrap" }} disabled={pcLoading}>
                    {pcLoading ? "Looking up..." : "Find"}
                  </button>
                </div>
                {pcError && <p style={{ fontSize: 12, color: "var(--c-bad)", marginTop: 6 }}>{pcError}</p>}
                {pcResults && pcResults.valid && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "var(--c-good)" }}>
                    ✓ Valid postcode: {pcResults.postcode} - {pcResults.city}{pcResults.area ? `, ${pcResults.area}` : ""}
                  </div>
                )}
                <p style={{ fontSize: 11, color: "var(--c-text-sec)", marginTop: 8 }}>
                  This validates your postcode and fills in the city automatically. For full address auto-complete in production, this would integrate with a service like getAddress.io or Ideal Postcodes (Royal Mail PAF data).
                </p>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Postcode</label>
                <input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="e.g. N4 5PH" className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Street address (house name or number and street)</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 14 Pemberton Road" className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Flat / unit number (if applicable)</label>
                <input value={flatNumber} onChange={e => setFlatNumber(e.target.value)} placeholder="e.g. Flat 9, Unit 3A" className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>City / town</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. London" className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Property type</label>
                <input value={propertyType} onChange={e => setPropertyType(e.target.value)} placeholder="e.g. 2-bed flat, studio, 3-bed house" className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Your name or initials</label>
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="e.g. Sarah M." className="input-field" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Move-in date</label>
                  <input value={moveIn} onChange={e => setMoveIn(e.target.value)} placeholder="e.g. Jan 2024" className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Move-out date</label>
                  <input value={moveOut} onChange={e => setMoveOut(e.target.value)} placeholder="e.g. Oct 2025" className="input-field" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ background: "var(--c-info-bg)", border: "1px solid var(--c-info-border)", borderRadius: 10, padding: 18 }}>
                <p style={{ fontSize: 14, color: "var(--c-info)", lineHeight: 1.7 }}>
                  We ask reviewers to confirm they lived at the property. This protects against fake reviews. Select how we can verify your tenancy. Verification happens on our end and is never shown publicly.
                </p>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>How can we verify you lived here?</label>
                <select value={verifyMethod} onChange={e => setVerifyMethod(e.target.value)} className="input-field">
                  <option value="">Select verification method...</option>
                  <option value="council_tax">I was registered for council tax at this address</option>
                  <option value="utility">I have utility bills in my name for this address</option>
                  <option value="electoral">I was on the electoral roll at this address</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--c-surface)", borderRadius: 10, padding: 16, cursor: "pointer" }} onClick={() => setVerifyConfirm(!verifyConfirm)}>
                <div style={{ width: 22, height: 22, borderRadius: 4, border: verifyConfirm ? "none" : "2px solid var(--c-muted)", background: verifyConfirm ? "var(--c-accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {verifyConfirm && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                </div>
                <p style={{ fontSize: 14, color: "var(--c-text)", lineHeight: 1.6 }}>
                  I confirm that I lived at <strong>{flatNumber ? `${flatNumber}, ` : ""}{address || "[address]"}, {postcode || "[postcode]"}</strong> from <strong>{moveIn || "[move-in]"}</strong> to <strong>{moveOut || "[move-out]"}</strong> and that this review is based on my genuine experience as a tenant.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: 14 }}>
              {Object.entries(INFO_FIELDS).map(([key, field]) => {
                if (field.showIf && !field.showIf(info)) return null;
                return (
                  <div key={key}>
                    <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>{field.label}</label>
                    {field.type === "select" ? (
                      <select value={info[key]} onChange={e => setInfoField(key, e.target.value)} className="input-field">
                        <option value="">Select...</option>{field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={info[key]} onChange={e => setInfoField(key, e.target.value)} placeholder={field.placeholder || ""} className="input-field" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && renderScoring("property")}
          {step === 4 && renderScoring("area")}
          {step === 5 && renderScoring("management")}

          {step === 6 && (
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>One-line summary</label>
                <input value={summary} onChange={e => setSummary(e.target.value)} placeholder="e.g. Great flat, terrible landlord." className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--c-text-bright)" }}>Full review</label>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Be specific. What was good? What was bad? What would you want to know if you were the next tenant?" rows={8} className="input-field" style={{ resize: "vertical", lineHeight: 1.7 }} />
              </div>
              <div style={{ background: "var(--c-surface)", borderRadius: 10, padding: 16 }}>
                <p style={{ fontSize: 13, color: "var(--c-text-sec)", lineHeight: 1.6 }}>Your review will be publicly visible. Do not include personal information about your landlord beyond their role. Stick to facts and your experience.</p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            {step > 0 ? <button onClick={() => setStep(step - 1)} className="btn-secondary">Back</button> : <div />}
            {step < 6 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary" disabled={!canProceed(step)}>Continue</button>
            ) : (
              <button onClick={handleSubmit} className="btn-primary" disabled={!canProceed(step)}>Submit Review</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- ABOUT PAGE ---
function AboutPage({ setPage }) {
  return (
    <div style={{ paddingTop: 88, minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: 720, paddingTop: 40, paddingBottom: 80 }}>
        <h1 className="fade-up" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 44px)", marginBottom: 20, color: "var(--c-text-bright)" }}>Renting in the UK is a gamble. We are fixing that.</h1>
        <div className="fade-up fade-up-d1" style={{ color: "var(--c-text-sec)", fontSize: 16, lineHeight: 1.8 }}>
          <p style={{ marginBottom: 20 }}>Every year, thousands of tenants sign leases for properties they know almost nothing about. Rightmove shows you staged photos. Letting agents show you the place on its best day. Nobody tells you about the black mould behind the wardrobe, the boiler that dies every February, or the landlord who takes six weeks to return a call.</p>
          <p style={{ marginBottom: 20 }}>RateWise exists to change that. We are a free, independent platform where verified previous tenants leave honest, structured reviews covering {CRITERIA_KEYS.length} specific criteria that actually matter when you live somewhere.</p>

          <div style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 24, margin: "28px 0" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 16, color: "var(--c-text-bright)" }}>What we rate ({CRITERIA_KEYS.length} criteria)</h2>
            {Object.entries(CRITERIA_GROUPS).map(([gk, gv]) => (
              <div key={gk} style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--c-amber)", marginBottom: 8 }}>{gv.icon} {gv.label}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                  {CRITERIA_KEYS.filter(k => CRITERIA_META[k].group === gk).map(k => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}><span>{CRITERIA_META[k].icon}</span><span>{CRITERIA_META[k].label}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: "var(--radius)", padding: 24, margin: "28px 0" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 12, color: "var(--c-text-bright)" }}>We also collect</h2>
            <p style={{ fontSize: 14 }}>Beyond scores, every review captures: heating type, furnished status and furniture condition, white goods, water billing type, who manages repairs, decorating rules, guest policies, flood risk, crime types, full deposit return experience, and whether the reviewer left the property clean.</p>
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 12, color: "var(--c-text-bright)" }}>Verified reviews</h2>
          <p style={{ marginBottom: 20 }}>We ask every reviewer to confirm they lived at the property and provide a verification method (council tax registration, utility bills, or electoral roll). We are building towards automated verification through official records. This means reviews you read here are from people who actually lived in the property.</p>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 12, color: "var(--c-text-bright)" }}>Our principles</h2>
          <p style={{ marginBottom: 12 }}><strong style={{ color: "var(--c-text-bright)" }}>Reviews only after moving out.</strong> Removes landlord retaliation fear.</p>
          <p style={{ marginBottom: 12 }}><strong style={{ color: "var(--c-text-bright)" }}>Low scores must be explained.</strong> Any rating of 3 or below requires a written explanation.</p>
          <p style={{ marginBottom: 12 }}><strong style={{ color: "var(--c-text-bright)" }}>Verified tenants.</strong> Every reviewer confirms residency through an official method.</p>
          <p style={{ marginBottom: 12 }}><strong style={{ color: "var(--c-text-bright)" }}>Structured data, not just vibes.</strong> {CRITERIA_KEYS.length} scored criteria plus detailed property information.</p>
          <p style={{ marginBottom: 28 }}><strong style={{ color: "var(--c-text-bright)" }}>Free and independent.</strong> No landlord pays to be listed. No letting agency sponsors us.</p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
            <button onClick={() => setPage({ name: "review" })} className="btn-primary" style={{ fontSize: 16, padding: "14px 32px" }}>Leave a Review</button>
            <button onClick={() => setPage({ name: "search" })} className="btn-secondary">Search Properties</button>
          </div>

          <SharePrompt compact />
        </div>
      </div>
    </div>
  );
}

// --- FOOTER ---
function Footer({ setPage }) {
  return (
    <footer style={{ background: "var(--c-surface)", borderTop: "1px solid var(--c-border)", padding: "40px 24px" }}>
      <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
        <div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--c-amber)" }}>RateWise</span>
          <p style={{ color: "var(--c-text-sec)", fontSize: 13, marginTop: 6, maxWidth: 300 }}>Unfiltered tenant reviews for UK rental properties.</p>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[{ key: "home", label: "Home" },{ key: "search", label: "Search" },{ key: "review", label: "Leave a Review" },{ key: "about", label: "About" }].map(p => (
            <button key={p.key} onClick={() => setPage({ name: p.key })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-sec)", fontSize: 14, fontFamily: "var(--font-body)" }}>{p.label}</button>
          ))}
        </div>
        <a href="https://www.ofcom.org.uk/mobile-coverage-checker" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--c-text-sec)", textDecoration: "underline" }}>Ofcom Coverage Checker</a>
      </div>
      <div className="container" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--c-border)" }}>
        <p style={{ color: "var(--c-muted)", fontSize: 12, textAlign: "center" }}>RateWise 2026. Built for tenants, by tenants.</p>
      </div>
    </footer>
  );
}

// --- APP ---
export default function App() {
  const { mode, setMode } = useTheme();
  const [page, setPage] = useState({ name: "home" });
  const [properties, setProperties] = useState(DEMO_PROPERTIES);
  const navigate = useCallback((p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const handleReviewSubmit = useCallback((data) => {
    setProperties(prev => {
      const match = prev.find(p => p.postcode.replace(/\s/g,"").toLowerCase() === data.postcode.replace(/\s/g,"").toLowerCase() && p.address.toLowerCase() === data.address.toLowerCase());
      if (match) return prev.map(p => p.id === match.id ? { ...p, reviews: [data.review, ...p.reviews] } : p);
      return [{ id: `p-${Date.now()}`, address: data.address, flatNumber: data.flatNumber || "", city: data.city, postcode: data.postcode, area: "", type: data.type, image: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=600&h=400&fit=crop", reviews: [data.review] }, ...prev];
    });
  }, []);
  const currentProperty = page.name === "property" ? properties.find(p => p.id === page.id) : null;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Nav page={page} setPage={navigate} themeMode={mode} setThemeMode={setMode} />
      {page.name === "home" && <HomePage setPage={navigate} properties={properties} />}
      {page.name === "search" && <SearchPage setPage={navigate} properties={properties} initialQuery={page.query || ""} />}
      {page.name === "property" && <PropertyPage setPage={navigate} property={currentProperty} />}
      {page.name === "review" && <ReviewPage properties={properties} onSubmit={handleReviewSubmit} prefill={page.prefill} />}
      {page.name === "about" && <AboutPage setPage={navigate} />}
      <Footer setPage={navigate} />
    </>
  );
}
