// Public settings for Hindsight.
// The publishable key is designed to sit in browser code. Never put the
// Supabase secret (service role) key in this file.

export const SUPABASE_URL = "https://epzhgdblwtnejufmdykb.supabase.co";
export const SUPABASE_KEY = "sb_publishable_n2EL3kGm9WhxQ5I5ELYO5w_nbSIcEpC";

// The site's public address, used for links Google and sharing apps read.
export const SITE_URL = "https://hindsight-reviews.netlify.app";

// Contact messages, review alerts and reports are emailed through Netlify
// Forms. The destination address lives only in the Netlify dashboard, never
// here, because this code is public.

export const SITE_NAME = "Hindsight";
