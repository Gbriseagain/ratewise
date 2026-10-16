// Hindsight sitemap: lists every page Google should index, including each
// reviewed home. Served at https://hindsight-reviews.netlify.app/sitemap.xml
// through a Netlify rewrite. Deployed as a Supabase Edge Function (no JWT).

const SITE = "https://hindsight-reviews.netlify.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://epzhgdblwtnejufmdykb.supabase.co";
// Public, read-only key (the same one the website uses).
const KEY = "sb_publishable_n2EL3kGm9WhxQ5I5ELYO5w_nbSIcEpC";

const STATIC_PAGES = ["", "search", "review", "about", "terms", "privacy", "contact"];

// Must match propertyPath() in src/lib/stats.js.
function slug(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Row = {
  id: string;
  flat_number: string | null;
  address_line: string;
  postcode: string;
  reviews: { created_at: string }[];
};

Deno.serve(async () => {
  let rows: Row[] = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,flat_number,address_line,postcode,reviews!inner(created_at)&order=created_at.desc&limit=5000`,
      { headers: { apikey: KEY } },
    );
    if (res.ok) rows = await res.json();
  } catch (_e) {
    rows = [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = STATIC_PAGES.map(
    (p) => `<url><loc>${SITE}/${p}</loc><lastmod>${today}</lastmod></url>`,
  );
  for (const r of rows) {
    const latest = r.reviews.map((x) => x.created_at).sort().pop() ?? today;
    const path = `/property/${r.id}/${slug([r.flat_number, r.address_line, r.postcode])}`;
    urls.push(`<url><loc>${SITE}${path}</loc><lastmod>${latest.slice(0, 10)}</lastmod></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
