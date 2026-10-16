// Free UK address finder.
//
// 1. postcodes.io (free, open government data) checks the postcode and
//    gives the town, ward and map position.
// 2. OpenStreetMap, through the Overpass API (free, open data), lists
//    house numbers mapped at that postcode and the streets around it.
// 3. Homes already reviewed on Hindsight at that postcode come first.
//
// Royal Mail's full address list (PAF) is paid. If you ever buy access,
// swap findAddresses() for that provider and keep the same return shape.

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const POSTCODE_RE = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;

export function normalisePostcode(raw) {
  const clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!POSTCODE_RE.test(clean)) return null;
  return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
}

export function looksLikePostcodeStart(raw) {
  return /^[A-Za-z]{1,2}[0-9][A-Za-z0-9]?(\s*[0-9][A-Za-z]{0,2})?$/.test(String(raw || "").trim());
}

function tidyTown(result) {
  if (result.region === "London") return "London";
  let d = result.admin_district || result.region || "";
  d = d.replace(/^City of\s+/i, "").replace(/,\s*City of$/i, "").replace(/,\s*County of$/i, "");
  return d;
}

async function withTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupPostcode(raw) {
  const postcode = normalisePostcode(raw);
  if (!postcode) throw new Error("That does not look like a full UK postcode, for example N4 5PH.");
  let res;
  try {
    res = await withTimeout(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(" ", ""))}`);
  } catch {
    throw new Error("Could not check the postcode. You can still type the address yourself.");
  }
  if (res.status === 404) throw new Error("We could not find that postcode. Check it and try again.");
  if (!res.ok) throw new Error("Could not check the postcode. You can still type the address yourself.");
  const { result } = await res.json();
  return {
    postcode: result.postcode,
    outcode: result.outcode,
    town: tidyTown(result),
    area: result.admin_ward || "",
    country: result.country || "",
    lat: result.latitude,
    lon: result.longitude,
  };
}

// Centre point for a postcode district such as N4 or BS1.
export async function lookupOutcode(raw) {
  const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?$/.test(code)) throw new Error("Not a postcode district.");
  const res = await withTimeout(`https://api.postcodes.io/outcodes/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("We could not find that postcode area.");
  const { result } = await res.json();
  if (!result || result.latitude == null) throw new Error("We could not find that postcode area.");
  return { label: result.outcode, lat: result.latitude, lon: result.longitude };
}

const collator = new Intl.Collator("en-GB", { numeric: true, sensitivity: "base" });

// Returns { addresses: [{ label, flat, line, town }], streets: [name] }.
export async function findAddresses({ postcode, lat, lon }) {
  const around = lat && lon ? `way(around:160,${lat},${lon})["highway"]["name"]["highway"!~"^(footway|cycleway|path|track|steps|bridleway|corridor|platform|proposed|construction)$"];out tags 60;` : "";
  const query = `[out:json][timeout:15];(nwr["addr:postcode"="${postcode}"]["addr:housenumber"];nwr["addr:postcode"="${postcode}"]["addr:housename"];);out tags 300;${around}`;
  const body = new URLSearchParams({ data: query });

  let json = null;
  for (const url of OVERPASS) {
    try {
      const res = await withTimeout(url, { method: "POST", body }, 14000);
      if (res.ok) { json = await res.json(); break; }
    } catch {
      // try the next server
    }
  }
  if (!json) return { addresses: [], streets: [], failed: true };

  const seen = new Set();
  const addresses = [];
  const streets = new Set();

  for (const el of json.elements || []) {
    const t = el.tags || {};
    if (t.highway && t.name) { streets.add(t.name); continue; }
    const number = t["addr:housenumber"] || "";
    const name = t["addr:housename"] || "";
    const street = t["addr:street"] || t["addr:place"] || "";
    const flat = t["addr:unit"] ? `Flat ${t["addr:unit"]}` : "";
    const line = [name, [number, street].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (!line) continue;
    const label = [flat, line].filter(Boolean).join(", ");
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (street) streets.add(street);
    addresses.push({ label, flat, line, town: t["addr:city"] || "" });
  }

  addresses.sort((a, b) => collator.compare(a.line, b.line));
  return { addresses, streets: [...streets].sort(collator.compare) };
}
