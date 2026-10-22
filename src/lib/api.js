import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PROPERTY_FIELDS = "id, created_at, flat_number, address_line, city, postcode, area, property_type, latitude, longitude";
const REPLY_FIELDS = "id, created_at, responder_name, responder_role, body, published_at";
const REVIEW_FIELDS = `id, created_at, author_name, moved_in, moved_out, summary, body, scores, explanations, details, verified, review_replies(${REPLY_FIELDS})`;

// Turns database errors into something a person can act on.
function friendly(error) {
  if (!error) return null;
  const code = error.code || "";
  if (code === "PGRST205" || code === "42P01" || /does not exist|schema cache/i.test(error.message || "")) {
    return new Error("The review database is not available right now. Try again in a few minutes.");
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
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return null;
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

// Returns { property_id, review_id, status: "published" | "pending", reasons: [], evidence_token }.
export async function submitReview(payload) {
  const { data, error } = await supabase.rpc("submit_review_v2", { payload });
  if (error) throw friendly(error);
  return data;
}

// Sends proof of address prepared by prepareProof() in lib/proof.js.
export async function addEvidence(reviewId, token, proof) {
  const { data, error } = await supabase.rpc("add_evidence", {
    p_review_id: reviewId, p_token: token, p_mime: proof.mime, p_data: proof.base64,
  });
  if (error) throw friendly(error);
  return data;
}

export async function submitReply(payload) {
  const { data, error } = await supabase.rpc("submit_reply", { payload });
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

// ---------- Owner tools (need the private admin key) ----------

export async function adminOverview(key) {
  const { data, error } = await supabase.rpc("admin_overview", { p_key: key });
  if (error) throw friendly(error);
  return data;
}

// Returns { mime, data } where data is base64.
export async function adminEvidence(key, reviewId) {
  const { data, error } = await supabase.rpc("admin_evidence", { p_key: key, p_review_id: reviewId });
  if (error) throw friendly(error);
  return data;
}

export async function adminAction(kind, key, id, action) {
  const fn = {
    review: "admin_review_action", reply: "admin_reply_action", report: "admin_report_action", evidence: "admin_evidence_action",
  }[kind];
  const idParam = { review: "p_review_id", reply: "p_reply_id", report: "p_report_id", evidence: "p_review_id" }[kind];
  const { error } = await supabase.rpc(fn, { p_key: key, [idParam]: id, p_action: action });
  if (error) throw friendly(error);
}
