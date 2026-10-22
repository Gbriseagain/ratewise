// Reviews written on this device, so the writer can add proof later.
// Holds only the review id and its one-off upload code. Nothing else.

const KEY = "hindsight-my-reviews";
const KEEP_DAYS = 30;

function readAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.token && r.at > cutoff) : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-20))); } catch { /* storage unavailable */ }
}

export function rememberReview(id, token) {
  if (!id || !token) return;
  writeAll([...readAll().filter((r) => r.id !== id), { id, token, at: Date.now(), proof: "none" }]);
}

export function myReview(id) {
  return readAll().find((r) => r.id === id) || null;
}

export function markProofSent(id) {
  writeAll(readAll().map((r) => (r.id === id ? { ...r, proof: "sent" } : r)));
}
