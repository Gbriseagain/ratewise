-- =====================================================================
-- Hindsight database setup (full schema, safe to run more than once)
--
-- The live database was built from this file. It contains no secrets:
-- the admin key is stored only as a hash, inserted separately.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- One row per home that has been reviewed.
create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  flat_number   text,
  address_line  text not null,
  city          text not null,
  postcode      text not null,
  area          text,
  property_type text,
  latitude      double precision,
  longitude     double precision,
  -- Normalised keys stop the same home being listed twice.
  postcode_key  text generated always as (upper(regexp_replace(postcode, '\s', '', 'g'))) stored,
  address_key   text generated always as (
                  lower(regexp_replace(coalesce(flat_number, '') || address_line, '[^a-zA-Z0-9]', '', 'g'))
                ) stored,
  constraint properties_unique_address unique (postcode_key, address_key)
);
create index if not exists properties_postcode_key_idx on public.properties (postcode_key);

-- One row per tenant review. Only 'published' rows are visible to the public.
-- Reviews waiting for moderation are stored as 'hidden' with
-- review_private.moderation_status = 'pending'.
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  created_at    timestamptz not null default now(),
  author_name   text not null,
  moved_in      text not null,   -- YYYY-MM
  moved_out     text not null,   -- YYYY-MM
  summary       text not null,
  body          text not null,
  scores        jsonb not null,  -- { criterion: 1..5 }
  explanations  jsonb not null default '{}'::jsonb,
  details       jsonb not null default '{}'::jsonb,
  verified      boolean not null default false,
  status        text not null default 'published' check (status in ('published', 'hidden')),
  report_count  integer not null default 0
);
create index if not exists reviews_property_id_idx on public.reviews (property_id);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

-- Private details about each review. Never readable from the website.
create table if not exists public.review_private (
  review_id     uuid primary key references public.reviews (id) on delete cascade,
  created_at    timestamptz not null default now(),
  verify_method text,
  contact_email text
);
alter table public.review_private add column if not exists moderation_status text not null default 'approved'
  check (moderation_status in ('pending', 'approved', 'rejected'));
alter table public.review_private add column if not exists moderation_note text;
alter table public.review_private add column if not exists terms_accepted_at timestamptz;
-- Moderation by the reviewer (Claude) and the owner.
alter table public.review_private add column if not exists needs_owner boolean not null default false;
alter table public.review_private add column if not exists decision_note text;
alter table public.review_private add column if not exists checked_at timestamptz;
alter table public.review_private add column if not exists checked_by text;
-- Proof of address: a one-off upload code, and where the check has got to.
alter table public.review_private add column if not exists evidence_token uuid;
alter table public.review_private add column if not exists evidence_status text not null default 'none'
  check (evidence_status in ('none', 'waiting', 'accepted', 'rejected', 'expired'));
alter table public.review_private add column if not exists evidence_uploaded_at timestamptz;

-- Complaints about reviews (the notice-and-takedown log).
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  review_id     uuid not null references public.reviews (id) on delete cascade,
  reason        text not null,
  details       text,
  contact_email text,
  status        text not null default 'open' check (status in ('open', 'actioned', 'rejected'))
);
alter table public.reports add column if not exists needs_owner boolean not null default false;
alter table public.reports add column if not exists decision_note text;
alter table public.reports add column if not exists checked_at timestamptz;

-- Right of reply: landlords and agents respond to a review. Approved by the owner.
create table if not exists public.review_replies (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid not null references public.reviews (id) on delete cascade,
  created_at     timestamptz not null default now(),
  responder_name text not null,
  responder_role text not null check (responder_role in ('Landlord', 'Letting agent', 'Management company')),
  body           text not null,
  status         text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  published_at   timestamptz
);
create index if not exists review_replies_review_id_idx on public.review_replies (review_id);

create table if not exists public.reply_private (
  reply_id          uuid primary key references public.review_replies (id) on delete cascade,
  created_at        timestamptz not null default now(),
  contact_email     text not null,
  terms_accepted_at timestamptz not null default now()
);
alter table public.reply_private add column if not exists needs_owner boolean not null default false;
alter table public.reply_private add column if not exists decision_note text;
alter table public.reply_private add column if not exists checked_at timestamptz;

-- Admin access: only a SHA-256 hash of the admin key is stored.
create table if not exists public.admin_keys (
  key_hash   text primary key,
  created_at timestamptz not null default now(),
  label      text
);

-- Private schema: the website cannot reach anything in it.
create schema if not exists hs_private;

-- Proof of address uploaded by reviewers. The file is erased (data set to
-- zero bytes) as soon as it has been checked, and after 30 days at most.
create table if not exists hs_private.evidence (
  review_id  uuid primary key references public.reviews (id) on delete cascade,
  created_at timestamptz not null default now(),
  mime       text not null,
  data       bytea not null
);

-- Every moderation decision, by the reviewer (Claude) or the owner.
create table if not exists hs_private.moderation_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor      text not null check (actor in ('claude', 'owner')),
  item_type  text not null check (item_type in ('review', 'reply', 'report', 'proof')),
  item_id    uuid not null,
  action     text not null,
  reason     text
);
create index if not exists moderation_log_created_idx on hs_private.moderation_log (created_at desc);

-- ---------------------------------------------------------------------
-- 2. Security: who can read and write what
-- ---------------------------------------------------------------------

alter table public.properties     enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_private enable row level security;
alter table public.reports        enable row level security;
alter table public.review_replies enable row level security;
alter table public.reply_private  enable row level security;
alter table public.admin_keys     enable row level security;
alter table hs_private.evidence    enable row level security;
alter table hs_private.moderation_log enable row level security;

drop policy if exists "Public can read properties" on public.properties;
create policy "Public can read properties"
  on public.properties for select to anon, authenticated using (true);

drop policy if exists "Public can read published reviews" on public.reviews;
create policy "Public can read published reviews"
  on public.reviews for select to anon, authenticated using (status = 'published');

drop policy if exists "Public can read published replies" on public.review_replies;
create policy "Public can read published replies"
  on public.review_replies for select to anon, authenticated using (status = 'published');

-- No policies on review_private, reports, reply_private or admin_keys:
-- the website can never read them. Writes only happen through the
-- functions below, which check everything first.

grant usage on schema public to anon, authenticated;
revoke all on public.properties, public.reviews, public.review_private, public.reports,
              public.review_replies, public.reply_private, public.admin_keys from anon, authenticated;
grant select on public.properties, public.reviews, public.review_replies to anon, authenticated;

-- Helpers live in a schema the website cannot reach.
create schema if not exists hs_private;

-- Returns the reasons a piece of text needs a human check before going live.
create or replace function hs_private.moderation_flags(t text)
returns text[]
language sql
immutable
as $$
  select array_remove(array[
    case when t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then 'an email address' end,
    case when regexp_replace(t, '[\s().-]', '', 'g') ~ '(\+44|0044|0)[1-9][0-9]{8,9}' then 'a phone number' end,
    case when t ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|co\.uk|org\.uk|org|net|io)\M)' then 'a web link' end,
    case when t ~* '\m(fuck\w*|shit|shits|shitty|shite|bullshit|cunts?|wank\w*|bastards?|bitch\w*|twats?|pricks?|slags?|whores?|nigger\w*|nigga\w*|paki|faggots?|retard(s|ed)?|spastic|rape|raped|raping|rapists?)\M'
         then 'strong language' end,
    case when t ~* '\m(fraud\w*|criminals?|thief|thieves|stole|steal|steals|stealing|scam|scams|scammed|scammers?|liars?|corrupt\w*|crooks?|illegal\w*)\M'
         then 'a serious allegation' end,
    case when t ~ '\m(Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+' then 'a person''s name' end
  ], null);
$$;

create or replace function hs_private.is_admin(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key is not null and length(p_key) >= 32 and exists (
    select 1 from admin_keys where key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Submitting a review (all checks happen here, on the server)
-- ---------------------------------------------------------------------

create or replace function public.submit_review_v2(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys constant text[] := array[
    'landlord','maintenance','rent_fairness','value',
    'security','energy','epc_reality','windows','damp','heating','light','water','smell','space','pests','cleanliness',
    'noise','neighbours','safety','parking','mobile_signal'
  ];
  k          text;
  v_raw      text;
  v_score    int;
  v_expl     text;
  v_scores   jsonb := '{}'::jsonb;
  v_expls    jsonb := '{}'::jsonb;
  v_details  jsonb := coalesce(payload -> 'details', '{}'::jsonb);
  v_postcode text  := upper(regexp_replace(coalesce(payload ->> 'postcode', ''), '\s+', '', 'g'));
  v_address  text  := btrim(coalesce(payload ->> 'address_line', ''));
  v_flat     text  := nullif(btrim(coalesce(payload ->> 'flat_number', '')), '');
  v_city     text  := btrim(coalesce(payload ->> 'city', ''));
  v_author   text  := btrim(coalesce(payload ->> 'author_name', ''));
  v_in       text  := btrim(coalesce(payload ->> 'moved_in', ''));
  v_out      text  := btrim(coalesce(payload ->> 'moved_out', ''));
  v_summary  text  := btrim(coalesce(payload ->> 'summary', ''));
  v_body     text  := btrim(coalesce(payload ->> 'body', ''));
  v_method   text  := nullif(btrim(coalesce(payload ->> 'verify_method', '')), '');
  v_email    text  := nullif(lower(btrim(coalesce(payload ->> 'contact_email', ''))), '');
  v_flags    text[];
  v_pending  boolean;
  v_lat      double precision;
  v_lon      double precision;
  v_property uuid;
  v_review   uuid;
  v_token    uuid  := gen_random_uuid();
begin
  -- Bots fill in hidden fields; people do not.
  if coalesce(payload ->> 'website', '') <> '' then
    raise exception 'Submission rejected.';
  end if;
  if coalesce(payload ->> 'agreed_terms', '') <> 'true' then
    raise exception 'Please agree to the terms of use.';
  end if;
  if coalesce(payload ->> 'lived_there', '') <> 'true' then
    raise exception 'Please confirm you lived at this address. If you cannot see that question, refresh the page.';
  end if;
  -- Flood protection: no more than 60 reviews an hour across the whole site.
  if (select count(*) from reviews where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many reviews are coming in right now. Try again in an hour.';
  end if;

  if v_postcode !~ '^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$' then
    raise exception 'Enter a valid UK postcode.';
  end if;
  v_postcode := left(v_postcode, length(v_postcode) - 3) || ' ' || right(v_postcode, 3);

  if length(v_address) < 3 or length(v_address) > 120 then
    raise exception 'Enter the house number and street.';
  end if;
  if v_flat is not null and length(v_flat) > 40 then
    raise exception 'The flat number is too long.';
  end if;
  if length(v_city) < 2 or length(v_city) > 60 then
    raise exception 'Enter the town or city.';
  end if;
  if length(v_author) < 1 or length(v_author) > 40 then
    raise exception 'Enter your name or initials (up to 40 characters).';
  end if;
  if v_in !~ '^\d{4}-(0[1-9]|1[0-2])$' or v_out !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Enter the month you moved in and the month you moved out.';
  end if;
  if v_out < v_in then
    raise exception 'Your move-out date is before your move-in date.';
  end if;
  if v_out > to_char(now(), 'YYYY-MM') then
    raise exception 'Reviews open once you have moved out.';
  end if;
  if length(v_summary) < 3 or length(v_summary) > 140 then
    raise exception 'Your one-line summary needs to be between 3 and 140 characters.';
  end if;
  if length(v_body) < 30 or length(v_body) > 5000 then
    raise exception 'Your review needs to be between 30 and 5,000 characters.';
  end if;
  if v_method is not null and v_method not in ('council_tax', 'utility', 'electoral') then
    raise exception 'Choose how you can show you lived there.';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'That email address does not look right.';
  end if;
  if jsonb_typeof(v_details) <> 'object' or length(v_details::text) > 8000 then
    raise exception 'The property details could not be read.';
  end if;

  foreach k in array v_keys loop
    v_raw := payload -> 'scores' ->> k;
    if v_raw is null or v_raw !~ '^[1-5]$' then
      raise exception 'Every question needs a score from 1 to 5 (missing: %).', k;
    end if;
    v_score := v_raw::int;
    v_expl  := btrim(coalesce(payload -> 'explanations' ->> k, ''));
    if v_score <= 2 and length(v_expl) < 5 then
      raise exception 'Scores of 1 or 2 need a short explanation (%).', k;
    end if;
    v_scores := v_scores || jsonb_build_object(k, v_score);
    if v_expl <> '' then
      v_expls := v_expls || jsonb_build_object(k, left(v_expl, 600));
    end if;
  end loop;

  -- Anything that could identify people, abuse or defame waits for a human check.
  v_flags := hs_private.moderation_flags(
    v_author || ' ' || v_summary || ' ' || v_body || ' ' || v_expls::text || ' ' || v_details::text
  );
  v_pending := cardinality(v_flags) > 0;

  begin
    v_lat := nullif(payload ->> 'latitude', '')::double precision;
    v_lon := nullif(payload ->> 'longitude', '')::double precision;
  exception when others then
    v_lat := null; v_lon := null;
  end;

  insert into properties (flat_number, address_line, city, postcode, area, property_type, latitude, longitude)
  values (
    v_flat, v_address, v_city, v_postcode,
    nullif(left(btrim(coalesce(payload ->> 'area', '')), 80), ''),
    nullif(left(btrim(coalesce(payload ->> 'property_type', '')), 40), ''),
    v_lat, v_lon
  )
  on conflict on constraint properties_unique_address do update
    set property_type = coalesce(properties.property_type, excluded.property_type),
        area          = coalesce(properties.area, excluded.area),
        latitude      = coalesce(properties.latitude, excluded.latitude),
        longitude     = coalesce(properties.longitude, excluded.longitude)
  returning id into v_property;

  -- Stop accidental double submissions of the same review.
  if exists (
    select 1 from reviews
    where property_id = v_property and author_name = v_author and summary = v_summary
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'This review has already been sent.';
  end if;

  insert into reviews (property_id, author_name, moved_in, moved_out, summary, body, scores, explanations, details, status)
  values (v_property, v_author, v_in, v_out, v_summary, v_body, v_scores, v_expls, v_details,
          case when v_pending then 'hidden' else 'published' end)
  returning id into v_review;

  insert into review_private (review_id, verify_method, contact_email, moderation_status, moderation_note, terms_accepted_at, evidence_token)
  values (v_review, v_method, v_email,
          case when v_pending then 'pending' else 'approved' end,
          nullif(array_to_string(v_flags, ', '), ''), now(), v_token);

  return jsonb_build_object(
    'property_id', v_property,
    'review_id', v_review,
    'status', case when v_pending then 'pending' else 'published' end,
    'reasons', to_jsonb(v_flags),
    -- Lets this reviewer, and nobody else, upload proof of address.
    'evidence_token', v_token
  );
end;
$$;

-- The first version of the site called this. It now goes through the same checks.
create or replace function public.submit_review(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(payload ->> 'agreed_terms', '') <> 'true' then
    raise exception 'Hindsight has been updated. Refresh the page and try again.';
  end if;
  return (public.submit_review_v2(payload) ->> 'property_id')::uuid;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Reporting a review
-- ---------------------------------------------------------------------

create or replace function public.report_review(p_review_id uuid, p_reason text, p_details text default null, p_email text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if p_reason not in ('false', 'personal', 'offensive', 'not_tenant', 'other') then
    raise exception 'Choose a reason for the report.';
  end if;
  if not exists (select 1 from reviews where id = p_review_id and status = 'published') then
    raise exception 'That review could not be found.';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'That email address does not look right.';
  end if;
  if (select count(*) from reports where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Too many reports right now. Try again later.';
  end if;

  insert into reports (review_id, reason, details, contact_email)
  values (p_review_id, p_reason, nullif(left(btrim(coalesce(p_details, '')), 2000), ''), v_email);

  update reviews set report_count = report_count + 1 where id = p_review_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Right of reply (always checked by the owner before it goes live)
-- ---------------------------------------------------------------------

create or replace function public.submit_reply(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review uuid;
  v_name   text := btrim(coalesce(payload ->> 'responder_name', ''));
  v_role   text := btrim(coalesce(payload ->> 'responder_role', ''));
  v_body   text := btrim(coalesce(payload ->> 'body', ''));
  v_email  text := lower(btrim(coalesce(payload ->> 'contact_email', '')));
  v_reply  uuid;
begin
  if coalesce(payload ->> 'website', '') <> '' then
    raise exception 'Submission rejected.';
  end if;
  begin
    v_review := (payload ->> 'review_id')::uuid;
  exception when others then
    raise exception 'That review could not be found.';
  end;
  if not exists (select 1 from reviews where id = v_review and status = 'published') then
    raise exception 'That review could not be found.';
  end if;
  if coalesce(payload ->> 'agreed_terms', '') <> 'true' then
    raise exception 'Please agree to the terms of use.';
  end if;
  if coalesce(payload ->> 'authorised', '') <> 'true' then
    raise exception 'Please confirm you are the landlord or agent, or authorised to reply for them.';
  end if;
  if v_role not in ('Landlord', 'Letting agent', 'Management company') then
    raise exception 'Choose who you are replying as.';
  end if;
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter your name or company name (up to 80 characters).';
  end if;
  if length(v_body) < 20 or length(v_body) > 1500 then
    raise exception 'Your reply needs to be between 20 and 1,500 characters.';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter an email address so we can confirm who you are.';
  end if;
  if (select count(*) from review_replies where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many replies right now. Try again later.';
  end if;
  if exists (
    select 1 from review_replies rr join reply_private rp on rp.reply_id = rr.id
    where rr.review_id = v_review and rp.contact_email = v_email and rr.created_at > now() - interval '1 day'
  ) then
    raise exception 'You have already sent a reply to this review. We will be in touch by email.';
  end if;

  insert into review_replies (review_id, responder_name, responder_role, body)
  values (v_review, v_name, v_role, v_body)
  returning id into v_reply;

  insert into reply_private (reply_id, contact_email) values (v_reply, v_email);

  return jsonb_build_object('reply_id', v_reply, 'status', 'pending');
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Proof of address (uploaded by the reviewer, seen only by the owner)
-- ---------------------------------------------------------------------

-- Proof nobody checked within 30 days is erased.
create or replace function hs_private.purge_old_evidence()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update review_private set evidence_status = 'expired'
   where evidence_status = 'waiting'
     and review_id in (select review_id from hs_private.evidence where created_at < now() - interval '30 days');
  update hs_private.evidence set data = ''::bytea
   where created_at < now() - interval '30 days' and length(data) > 0;
end;
$$;

-- Called by the website straight after a review is published, or later from
-- the same device. Only works with the upload code returned to the reviewer.
create or replace function public.add_evidence(p_review_id uuid, p_token uuid, p_mime text, p_data text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   uuid;
  v_status  text;
  v_created timestamptz;
  v_bytes   bytea;
begin
  select rp.evidence_token, rp.evidence_status, r.created_at
    into v_token, v_status, v_created
    from review_private rp
    join reviews r on r.id = rp.review_id
   where rp.review_id = p_review_id;
  if v_token is null or p_token is null or v_token <> p_token then
    raise exception 'This upload link is not valid. Use the contact page and we will help.';
  end if;
  if v_created < now() - interval '30 days' then
    raise exception 'Proof can be added for 30 days after a review. Use the contact page and we will help.';
  end if;
  if v_status = 'accepted' then
    raise exception 'This review is already verified.';
  end if;
  if p_mime is null or p_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'Use a photo or a PDF.';
  end if;
  begin
    v_bytes := decode(regexp_replace(coalesce(p_data, ''), '\s', '', 'g'), 'base64');
  exception when others then
    raise exception 'The file could not be read. Try another photo.';
  end;
  if length(v_bytes) < 500 then
    raise exception 'The file could not be read. Try another photo.';
  end if;
  if length(v_bytes) > 3145728 then
    raise exception 'The file is too large. Use a photo, or a PDF under 3 MB.';
  end if;
  -- The file must really be the type it claims to be.
  if not (
       (p_mime = 'image/jpeg' and substring(v_bytes from 1 for 3) = '\xffd8ff'::bytea)
    or (p_mime = 'image/png' and substring(v_bytes from 1 for 8) = '\x89504e470d0a1a0a'::bytea)
    or (p_mime = 'image/webp' and substring(v_bytes from 1 for 4) = '\x52494646'::bytea
                              and substring(v_bytes from 9 for 4) = '\x57454250'::bytea)
    or (p_mime = 'application/pdf' and substring(v_bytes from 1 for 5) = '\x255044462d'::bytea)
  ) then
    raise exception 'That file type is not supported. Use a photo or a PDF.';
  end if;
  if (select count(*) from hs_private.evidence where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many uploads right now. Try again in an hour.';
  end if;

  perform hs_private.purge_old_evidence();

  insert into hs_private.evidence (review_id, mime, data) values (p_review_id, p_mime, v_bytes)
  on conflict (review_id) do update set mime = excluded.mime, data = excluded.data, created_at = now();
  update review_private set evidence_status = 'waiting', evidence_uploaded_at = now() where review_id = p_review_id;

  return jsonb_build_object('status', 'waiting');
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Moderation decisions (shared by the owner and the reviewer)
-- ---------------------------------------------------------------------

create or replace function hs_private.record_decision(p_actor text, p_type text, p_id uuid, p_action text, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into hs_private.moderation_log (actor, item_type, item_id, action, reason)
  values (p_actor, p_type, p_id, p_action, nullif(left(btrim(coalesce(p_reason, '')), 500), ''));
$$;

-- approve: live. reject: hidden for good. escalate: hidden until the owner decides.
-- flag: stays as it is, the owner is asked to look. verify / unverify: the badge.
create or replace function hs_private.set_review(p_review_id uuid, p_action text, p_reason text, p_actor text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  if not exists (select 1 from reviews where id = p_review_id) then
    raise exception 'Review not found.';
  end if;
  insert into review_private (review_id) values (p_review_id) on conflict (review_id) do nothing;

  if p_action = 'approve' then
    update reviews set status = 'published' where id = p_review_id;
    update review_private set moderation_status = 'approved', needs_owner = false where review_id = p_review_id;
  elsif p_action = 'reject' then
    update reviews set status = 'hidden' where id = p_review_id;
    update review_private set moderation_status = 'rejected', needs_owner = false where review_id = p_review_id;
  elsif p_action = 'escalate' then
    update reviews set status = 'hidden' where id = p_review_id;
    update review_private set moderation_status = 'pending', needs_owner = true where review_id = p_review_id;
  elsif p_action = 'flag' then
    update review_private set needs_owner = true where review_id = p_review_id;
  elsif p_action = 'verify' then
    update reviews set verified = true where id = p_review_id;
  elsif p_action = 'unverify' then
    update reviews set verified = false where id = p_review_id;
  else
    raise exception 'Unknown action: %', p_action;
  end if;

  if p_action in ('approve', 'reject', 'escalate', 'flag') then
    update review_private
       set checked_at = now(), checked_by = p_actor,
           decision_note = case when p_actor = 'claude' then v_note else decision_note end
     where review_id = p_review_id;
  end if;
  perform hs_private.record_decision(p_actor, 'review', p_review_id, p_action, v_note);
  return p_action;
end;
$$;

-- approve: live under the review. reject: never shown. escalate: waits for the owner.
create or replace function hs_private.set_reply(p_reply_id uuid, p_action text, p_reason text, p_actor text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  if not exists (select 1 from review_replies where id = p_reply_id) then
    raise exception 'Reply not found.';
  end if;
  if p_action = 'approve' then
    update review_replies set status = 'published', published_at = now() where id = p_reply_id;
    update reply_private set needs_owner = false where reply_id = p_reply_id;
  elsif p_action = 'reject' then
    update review_replies set status = 'rejected', published_at = null where id = p_reply_id;
    update reply_private set needs_owner = false where reply_id = p_reply_id;
  elsif p_action = 'escalate' then
    update reply_private set needs_owner = true where reply_id = p_reply_id;
  else
    raise exception 'Unknown action: %', p_action;
  end if;
  update reply_private
     set checked_at = now(),
         decision_note = case when p_actor = 'claude' then v_note else decision_note end
   where reply_id = p_reply_id;
  perform hs_private.record_decision(p_actor, 'reply', p_reply_id, p_action, v_note);
  return p_action;
end;
$$;

-- dismiss: report closed, review stays up. hide_review: review hidden, report closed.
-- escalate: review hidden while the owner decides. flag: review stays up, owner asked.
-- restore (owner): review back up, report closed.
create or replace function hs_private.set_report(p_report_id uuid, p_action text, p_reason text, p_actor text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note   text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  v_review uuid;
begin
  select review_id into v_review from reports where id = p_report_id;
  if v_review is null then
    raise exception 'Report not found.';
  end if;
  if p_action = 'dismiss' then
    update reports set status = 'rejected', needs_owner = false where id = p_report_id;
  elsif p_action = 'hide_review' then
    perform hs_private.set_review(v_review, 'reject', coalesce(v_note, 'Hidden after a report.'), p_actor);
    update reports set status = 'actioned', needs_owner = false where id = p_report_id;
  elsif p_action = 'escalate' then
    update reviews set status = 'hidden' where id = v_review;
    update reports set needs_owner = true where id = p_report_id;
  elsif p_action = 'flag' then
    update reports set needs_owner = true where id = p_report_id;
  elsif p_action = 'restore' then
    perform hs_private.set_review(v_review, 'approve', coalesce(v_note, 'Put back after a report.'), p_actor);
    update reports set status = 'rejected', needs_owner = false where id = p_report_id;
  elsif p_action in ('actioned', 'rejected') then
    update reports set status = p_action, needs_owner = false where id = p_report_id;
  else
    raise exception 'Unknown action: %', p_action;
  end if;
  update reports
     set checked_at = now(),
         decision_note = case when p_actor = 'claude' then v_note else decision_note end
   where id = p_report_id;
  perform hs_private.record_decision(p_actor, 'report', p_report_id, p_action, v_note);
  return p_action;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. The reviewer (Claude, on a schedule, through the database connection)
--    These live in hs_private, so the website can never call them.
-- ---------------------------------------------------------------------

-- Everything that has not been looked at yet. Contains no email addresses.
create or replace function hs_private.review_queue()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'new_reviews', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
        select r.id, r.created_at, r.status, coalesce(rp.moderation_status, 'approved') as moderation_status,
               rp.moderation_note as automatic_flags, rp.verify_method,
               r.author_name, r.moved_in, r.moved_out, r.summary, r.body, r.scores, r.explanations,
               r.details ->> 'deposit_issues' as deposit_issues, r.details ->> 'crime_types' as crime_types,
               p.flat_number, p.address_line, p.city, p.postcode, p.property_type,
               (select count(*) from reviews o where o.property_id = r.property_id and o.id <> r.id) as other_reviews_of_this_home,
               (select count(*) from reviews o where o.property_id = r.property_id and o.id <> r.id
                  and lower(o.author_name) = lower(r.author_name)) as same_name_reviews_of_this_home
        from reviews r
        join properties p on p.id = r.property_id
        left join review_private rp on rp.review_id = r.id
        where rp.checked_at is null and coalesce(rp.moderation_status, 'approved') <> 'rejected'
        order by r.created_at
        limit 40
      ) x),
    'pending_replies', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
        select rr.id, rr.created_at, rr.responder_name, rr.responder_role, rr.body,
               r.author_name as review_author, r.summary as review_summary, r.body as review_body,
               p.flat_number, p.address_line, p.postcode
        from review_replies rr
        join reviews r on r.id = rr.review_id
        join properties p on p.id = r.property_id
        left join reply_private rpp on rpp.reply_id = rr.id
        where rr.status = 'pending' and rpp.checked_at is null
        order by rr.created_at
        limit 40
      ) x),
    'open_reports', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
        select rep.id, rep.created_at, rep.reason, rep.details,
               r.id as review_id, r.status as review_status, r.author_name as review_author,
               r.summary as review_summary, r.body as review_body, r.explanations as review_explanations,
               p.flat_number, p.address_line, p.postcode,
               (select count(*) from reports o where o.review_id = rep.review_id) as reports_on_this_review
        from reports rep
        join reviews r on r.id = rep.review_id
        join properties p on p.id = r.property_id
        where rep.status = 'open' and rep.checked_at is null
        order by rep.created_at
        limit 40
      ) x),
    'proofs_waiting', (select count(*) from review_private where evidence_status = 'waiting'),
    'waiting_for_owner', jsonb_build_object(
      'reviews', (select count(*) from review_private where needs_owner),
      'replies', (select count(*) from review_replies rr join reply_private rpp on rpp.reply_id = rr.id
                   where rr.status = 'pending' and rpp.needs_owner),
      'reports', (select count(*) from reports where status = 'open' and needs_owner)
    )
  );
$$;

create or replace function hs_private.decide_review(p_review_id uuid, p_action text, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action is null or p_action not in ('approve', 'reject', 'escalate', 'flag') then
    raise exception 'Use approve, reject, escalate or flag.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Give a one-sentence reason.';
  end if;
  if exists (select 1 from review_private where review_id = p_review_id and checked_by = 'owner') then
    raise exception 'The owner has already decided this review.';
  end if;
  return hs_private.set_review(p_review_id, p_action, p_reason, 'claude');
end;
$$;

create or replace function hs_private.decide_reply(p_reply_id uuid, p_action text, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action is null or p_action not in ('approve', 'reject', 'escalate') then
    raise exception 'Use approve, reject or escalate.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Give a one-sentence reason.';
  end if;
  if not exists (select 1 from review_replies where id = p_reply_id and status = 'pending') then
    raise exception 'That reply has already been decided.';
  end if;
  return hs_private.set_reply(p_reply_id, p_action, p_reason, 'claude');
end;
$$;

create or replace function hs_private.decide_report(p_report_id uuid, p_action text, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action is null or p_action not in ('dismiss', 'hide_review', 'escalate', 'flag') then
    raise exception 'Use dismiss, hide_review, escalate or flag.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Give a one-sentence reason.';
  end if;
  if not exists (select 1 from reports where id = p_report_id and status = 'open') then
    raise exception 'That report has already been decided.';
  end if;
  return hs_private.set_report(p_report_id, p_action, p_reason, 'claude');
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Admin page (owner only, protected by the admin key)
-- ---------------------------------------------------------------------

create or replace function public.admin_overview(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hs_private.is_admin(p_key) then
    raise exception 'That admin link is not valid.';
  end if;
  perform hs_private.purge_old_evidence();

  return jsonb_build_object(
    -- Held reviews, and anything the reviewer wants the owner to look at.
    'pending_reviews', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
        select r.id, r.created_at, r.status, r.author_name, r.summary, r.body, r.explanations, r.moved_in, r.moved_out,
               p.id as property_id, p.flat_number, p.address_line, p.city, p.postcode,
               rp.moderation_note, rp.verify_method, rp.contact_email,
               rp.needs_owner, rp.decision_note, rp.checked_by
        from reviews r
        join properties p on p.id = r.property_id
        join review_private rp on rp.review_id = r.id
        where (r.status = 'hidden' and rp.moderation_status = 'pending') or rp.needs_owner
      ) x),
    'proofs', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.evidence_uploaded_at), '[]'::jsonb) from (
        select r.id, r.author_name, r.summary, r.moved_in, r.moved_out, r.verified, r.status,
               rp.verify_method, rp.evidence_uploaded_at, e.mime, length(e.data) as bytes,
               p.id as property_id, p.flat_number, p.address_line, p.city, p.postcode
        from review_private rp
        join hs_private.evidence e on e.review_id = rp.review_id
        join reviews r on r.id = rp.review_id
        join properties p on p.id = r.property_id
        where rp.evidence_status = 'waiting' and length(e.data) > 0
      ) x),
    'pending_replies', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
        select rr.id, rr.created_at, rr.responder_name, rr.responder_role, rr.body,
               r.id as review_id, r.summary as review_summary, r.author_name as review_author,
               p.id as property_id, p.flat_number, p.address_line, p.postcode,
               rpp.contact_email, coalesce(rpp.needs_owner, false) as needs_owner, rpp.decision_note
        from review_replies rr
        join reviews r on r.id = rr.review_id
        join properties p on p.id = r.property_id
        left join reply_private rpp on rpp.reply_id = rr.id
        where rr.status = 'pending'
      ) x),
    'open_reports', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from (
        select rep.id, rep.created_at, rep.reason, rep.details, rep.contact_email, rep.needs_owner, rep.decision_note,
               r.id as review_id, r.summary as review_summary, r.author_name as review_author, r.status as review_status,
               p.id as property_id, p.flat_number, p.address_line, p.postcode
        from reports rep
        join reviews r on r.id = rep.review_id
        join properties p on p.id = r.property_id
        where rep.status = 'open'
      ) x),
    -- What the reviewer decided, so the owner can see it and undo it.
    'recent_decisions', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select l.id, l.created_at, l.item_type, l.item_id, l.action, l.reason,
               coalesce(r1.id, r2.id, r3.id) as review_id,
               coalesce(r1.summary, r2.summary, r3.summary) as review_summary,
               coalesce(r1.status, r2.status, r3.status) as review_status,
               rr.responder_name, rr.status as reply_status,
               p.id as property_id, p.flat_number, p.address_line, p.postcode
        from hs_private.moderation_log l
        left join reviews r1 on l.item_type = 'review' and r1.id = l.item_id
        left join review_replies rr on l.item_type = 'reply' and rr.id = l.item_id
        left join reviews r2 on r2.id = rr.review_id
        left join reports rep on l.item_type = 'report' and rep.id = l.item_id
        left join reviews r3 on r3.id = rep.review_id
        left join properties p on p.id = coalesce(r1.property_id, r2.property_id, r3.property_id)
        where l.actor = 'claude'
        order by l.created_at desc
        limit 30
      ) x),
    'recent_reviews', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select r.id, r.created_at, r.author_name, r.summary, r.verified, r.report_count,
               p.id as property_id, p.flat_number, p.address_line, p.postcode,
               rp.verify_method, rp.contact_email, coalesce(rp.evidence_status, 'none') as evidence_status
        from reviews r
        join properties p on p.id = r.property_id
        left join review_private rp on rp.review_id = r.id
        where r.status = 'published'
        order by r.created_at desc
        limit 30
      ) x),
    'counts', jsonb_build_object(
      'published_reviews', (select count(*) from reviews where status = 'published'),
      'homes', (select count(distinct property_id) from reviews where status = 'published'),
      'published_replies', (select count(*) from review_replies where status = 'published'),
      'verified_reviews', (select count(*) from reviews where status = 'published' and verified),
      'not_yet_checked', (select count(*) from reviews r left join review_private rp on rp.review_id = r.id
                           where rp.checked_at is null and coalesce(rp.moderation_status, 'approved') <> 'rejected')
    )
  );
end;
$$;

create or replace function public.admin_review_action(p_key text, p_review_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hs_private.is_admin(p_key) then
    raise exception 'That admin link is not valid.';
  end if;
  if p_action not in ('publish', 'hide', 'verify', 'unverify') then
    raise exception 'Unknown action.';
  end if;
  perform hs_private.set_review(p_review_id,
    case p_action when 'publish' then 'approve' when 'hide' then 'reject' else p_action end, null, 'owner');
end;
$$;

create or replace function public.admin_reply_action(p_key text, p_reply_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hs_private.is_admin(p_key) then
    raise exception 'That admin link is not valid.';
  end if;
  if p_action not in ('publish', 'reject') then
    raise exception 'Unknown action.';
  end if;
  perform hs_private.set_reply(p_reply_id, case p_action when 'publish' then 'approve' else 'reject' end, null, 'owner');
end;
$$;

create or replace function public.admin_report_action(p_key text, p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hs_private.is_admin(p_key) then
    raise exception 'That admin link is not valid.';
  end if;
  if p_action not in ('dismiss', 'hide_review', 'restore', 'actioned', 'rejected') then
    raise exception 'Unknown action.';
  end if;
  perform hs_private.set_report(p_report_id, p_action, null, 'owner');
end;
$$;

-- Shows one uploaded proof to the owner.
create or replace function public.admin_evidence(p_key text, p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not hs_private.is_admin(p_key) then
    raise exception 'That admin link is not valid.';
  end if;
  select jsonb_build_object('mime', e.mime, 'data', encode(e.data, 'base64'))
    into v from hs_private.evidence e where e.review_id = p_review_id and length(e.data) > 0;
  if v is null then
    raise exception 'That proof has already been checked and deleted.';
  end if;
  return v;
end;
$$;

-- accept: the review gets the Verified tenant badge. reject: not enough proof.
-- Either way the file is erased straight away.
create or replace function public.admin_evidence_action(p_key text, p_review_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not hs_private.is_admin(p_key) then
    raise exception 'That admin link is not valid.';
  end if;
  if p_action = 'accept' then
    update reviews set verified = true where id = p_review_id;
    update review_private set evidence_status = 'accepted' where review_id = p_review_id;
  elsif p_action = 'reject' then
    update review_private set evidence_status = 'rejected' where review_id = p_review_id;
  else
    raise exception 'Unknown action.';
  end if;
  update hs_private.evidence set data = ''::bytea where review_id = p_review_id;
  perform hs_private.record_decision('owner', 'proof', p_review_id, p_action, null);
end;
$$;

grant execute on function public.submit_review_v2(jsonb) to anon, authenticated;
grant execute on function public.submit_review(jsonb) to anon, authenticated;
grant execute on function public.report_review(uuid, text, text, text) to anon, authenticated;
grant execute on function public.submit_reply(jsonb) to anon, authenticated;
grant execute on function public.add_evidence(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.admin_overview(text) to anon, authenticated;
grant execute on function public.admin_review_action(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_reply_action(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_report_action(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_evidence(text, uuid) to anon, authenticated;
grant execute on function public.admin_evidence_action(text, uuid, text) to anon, authenticated;

-- Done.
