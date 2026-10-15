-- =====================================================================
-- Hindsight database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.
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
  explanations  jsonb not null default '{}'::jsonb,  -- required for scores of 3 or below
  details       jsonb not null default '{}'::jsonb,  -- set-up, deposit, energy upgrades
  verified      boolean not null default false,      -- you set this after checking proof
  status        text not null default 'published' check (status in ('published', 'hidden')),
  report_count  integer not null default 0
);

create index if not exists reviews_property_id_idx on public.reviews (property_id);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);

-- Private verification details. Never readable from the website.
create table if not exists public.review_private (
  review_id     uuid primary key references public.reviews (id) on delete cascade,
  created_at    timestamptz not null default now(),
  verify_method text,
  contact_email text
);

-- Reports and complaints about reviews (your notice-and-takedown log).
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  review_id     uuid not null references public.reviews (id) on delete cascade,
  reason        text not null,
  details       text,
  contact_email text,
  status        text not null default 'open' check (status in ('open', 'actioned', 'rejected'))
);

-- ---------------------------------------------------------------------
-- 2. Security: who can read and write what
-- ---------------------------------------------------------------------

alter table public.properties     enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_private enable row level security;
alter table public.reports        enable row level security;

drop policy if exists "Public can read properties" on public.properties;
create policy "Public can read properties"
  on public.properties for select to anon, authenticated
  using (true);

drop policy if exists "Public can read published reviews" on public.reviews;
create policy "Public can read published reviews"
  on public.reviews for select to anon, authenticated
  using (status = 'published');

-- No policies on review_private or reports: the website cannot read them.
-- You see them in Supabase > Table Editor.

grant usage on schema public to anon, authenticated;
revoke all on public.properties, public.reviews, public.review_private, public.reports from anon, authenticated;
grant select on public.properties, public.reviews to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Submitting a review (all checks happen here, on the server)
-- ---------------------------------------------------------------------

create or replace function public.submit_review(payload jsonb)
returns uuid
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
  v_lat      double precision;
  v_lon      double precision;
  v_property uuid;
  v_review   uuid;
begin
  -- Bots fill in hidden fields; people do not.
  if coalesce(payload ->> 'website', '') <> '' then
    raise exception 'Submission rejected.';
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
    if v_score <= 3 and length(v_expl) < 5 then
      raise exception 'Scores of 3 or below need a short explanation (%).', k;
    end if;
    v_scores := v_scores || jsonb_build_object(k, v_score);
    if v_expl <> '' then
      v_expls := v_expls || jsonb_build_object(k, left(v_expl, 600));
    end if;
  end loop;

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
    raise exception 'This review has already been published.';
  end if;

  insert into reviews (property_id, author_name, moved_in, moved_out, summary, body, scores, explanations, details)
  values (v_property, v_author, v_in, v_out, v_summary, v_body, v_scores, v_expls, v_details)
  returning id into v_review;

  if v_method is not null or v_email is not null then
    insert into review_private (review_id, verify_method, contact_email)
    values (v_review, v_method, v_email);
  end if;

  return v_property;
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

revoke all on function public.submit_review(jsonb) from public;
revoke all on function public.report_review(uuid, text, text, text) from public;
grant execute on function public.submit_review(jsonb) to anon, authenticated;
grant execute on function public.report_review(uuid, text, text, text) to anon, authenticated;

-- Done. You should see "Success. No rows returned".
