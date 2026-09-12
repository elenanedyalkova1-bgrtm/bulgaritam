-- Raw first-party analytics storage. Operational catalogue data remains in Baserow.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_id text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  event_name text not null,

  anonymous_session_id text,
  anonymous_journey_id text,
  sequence_number integer,

  page_path text,
  page_title text,
  page_type text,
  language text,
  device_type text,

  product_id text,
  product_slug text,
  product_name text,
  brand_id text,
  brand_slug text,
  brand_name text,

  category text,
  subcategory text,
  product_type text,

  search_id text,
  search_term text,
  search_results_count integer,
  discovery_state_id text,
  search_revision integer,

  collection_id text,
  source_context text,
  list_context text,
  list_name text,
  position integer,

  destination_domain text,

  landing_page text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  acquisition_channel text,

  gift_recipient text,
  gift_occasion text,

  metadata jsonb not null default '{}'::jsonb,
  legacy_baserow_row_id bigint,

  constraint analytics_events_event_name_nonempty
    check (length(event_name) > 0),
  constraint analytics_events_search_count_nonnegative
    check (search_results_count is null or search_results_count >= 0)
);

create unique index analytics_events_event_id_uidx
  on public.analytics_events (event_id);

create unique index analytics_events_baserow_row_uidx
  on public.analytics_events (legacy_baserow_row_id);

create index analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);

create index analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at desc);

create index analytics_events_product_time_idx
  on public.analytics_events (product_id, occurred_at desc)
  where product_id is not null and product_id <> '';

create index analytics_events_brand_time_idx
  on public.analytics_events (brand_id, occurred_at desc)
  where brand_id is not null and brand_id <> '';

create index analytics_events_session_time_idx
  on public.analytics_events (anonymous_session_id, occurred_at)
  where anonymous_session_id is not null and anonymous_session_id <> '';

create index analytics_events_journey_time_idx
  on public.analytics_events (anonymous_journey_id, occurred_at)
  where anonymous_journey_id is not null and anonymous_journey_id <> '';

create index analytics_events_search_id_idx
  on public.analytics_events (search_id, occurred_at)
  where search_id is not null and search_id <> '';

create index analytics_events_discovery_state_idx
  on public.analytics_events (discovery_state_id, occurred_at)
  where discovery_state_id is not null and discovery_state_id <> '';

alter table public.analytics_events enable row level security;

-- No browser-accessible policy is created. Only the server-side service role can
-- access raw analytics. Explicit revokes defend against future default grants.
revoke all on table public.analytics_events from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated;
grant all on table public.analytics_events to service_role;
grant usage, select on sequence public.analytics_events_id_seq to service_role;
