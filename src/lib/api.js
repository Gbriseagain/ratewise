import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PROPERTY_FIELDS = "id, created_at, flat_number, address_line, city, postcode, area, property_type, latitude, longitude";
const REVIEW_FIELDS = "id, created_at, author_name, moved_in, moved_out, summary, body, scores, explanations, details, verified";

// Turns database errors into something a person can act on.
function friendly(error) {
  if (!error) return null;
  const code = error.code || "";
  if (code === "PGRST205" || code === "42P01" || /does not exist|schema cache/i.test(error.message || "")) {
    return new Error("The review database is not switched on yet. Run the setup file in Supabase.");
  }
  if (/fetch|network/i.test(error.message || "")) {
    return new Error("No connection. Check your internet and try again.");
  }
  return new Error(error.message || "Something went wrong. Try again.");
}

// Every property that has at least one published review, newest first.
export async function fetchProperties() {
  const { data, error } = await supabase
    .from("properties")
    .select(`${PROPERTY_FIELDS}, reviews(id, created_at, scores, details)`)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw friendly(error);
  return (data || []).filter((p) => p.reviews && p.reviews.length);
}

export async function fetchProperty(id) {
  const { data, error } = await supabase
    .from("properties")
    .select(`${PROPERTY_FIELDS}, reviews(${REVIEW_FIELDS})`)
    .eq("id", id)
    .order("created_at", { referencedTable: "reviews", ascending: false })
    .maybeSingle();
  if (error) throw friendly(error);
  return data;
}

export async function fetchPropertiesAtPostcode(postcode) {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_FIELDS)
    .eq("postcode", postcode)
    .limit(100);
  if (error) return [];
  return data || [];
}

export async function submitReview(payload) {
  const { data, error } = await supabase.rpc("submit_review", { payload });
  if (error) throw friendly(error);
  return data;
}

export async function reportReview(reviewId, reason, details, email) {
  const { error } = await supabase.rpc("report_review", {
    p_review_id: reviewId,
    p_reason: reason,
    p_details: details || null,
    p_email: email || null,
  });
  if (error) throw friendly(error);
}
