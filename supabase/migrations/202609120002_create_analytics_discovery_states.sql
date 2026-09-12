-- Canonical Analytics V2 discovery snapshots and normalized ordered membership.
alter table public.analytics_events
  add column tracking_version integer,
  add column source_surface text,
  add column source_discovery_state_id text,
  add column source_position integer,
  add column source_search_id text,
  add column last_discovery_state_id text;

create index analytics_events_source_discovery_idx
  on public.analytics_events (source_discovery_state_id, occurred_at)
  where source_discovery_state_id is not null and source_discovery_state_id <> '';
create index analytics_events_source_search_idx
  on public.analytics_events (source_search_id, occurred_at)
  where source_search_id is not null and source_search_id <> '';

create table public.analytics_discovery_states (
  discovery_state_id text primary key,
  occurred_at timestamptz not null,
  anonymous_session_id text not null,
  anonymous_journey_id text not null,
  surface_type text not null check (length(surface_type) > 0),
  page_path text not null,
  search_id text,
  query text,
  category text,
  subcategory text,
  product_type text,
  sort_value text,
  price_min_eur numeric,
  price_max_eur numeric,
  gift_recipient text,
  gift_occasion text,
  active_filters jsonb,
  result_count integer not null check (result_count >= 0),
  tracking_version integer not null default 2 check (tracking_version = 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (price_min_eur is null or price_min_eur >= 0),
  check (price_max_eur is null or price_max_eur >= 0),
  check (price_min_eur is null or price_max_eur is null or price_min_eur <= price_max_eur)
);

create table public.analytics_discovery_results (
  id bigint generated always as identity primary key,
  discovery_state_id text not null references public.analytics_discovery_states(discovery_state_id) on delete cascade,
  entity_type text not null check (entity_type in ('product', 'brand')),
  product_id text,
  brand_id text,
  position integer not null check (position >= 1),
  check (
    (entity_type = 'product' and product_id is not null and product_id <> '') or
    (entity_type = 'brand' and brand_id is not null and brand_id <> '' and product_id is null)
  ),
  unique (discovery_state_id, position),
  unique (discovery_state_id, entity_type, product_id, brand_id)
);

create index analytics_discovery_states_occurred_at_idx on public.analytics_discovery_states (occurred_at desc);
create index analytics_discovery_states_session_idx on public.analytics_discovery_states (anonymous_session_id, occurred_at);
create index analytics_discovery_states_journey_idx on public.analytics_discovery_states (anonymous_journey_id, occurred_at);
create index analytics_discovery_states_search_idx on public.analytics_discovery_states (search_id, occurred_at) where search_id is not null and search_id <> '';
create index analytics_discovery_states_surface_idx on public.analytics_discovery_states (surface_type, occurred_at desc);
create index analytics_discovery_states_taxonomy_idx on public.analytics_discovery_states (category, subcategory, product_type, occurred_at desc);
create index analytics_discovery_results_state_idx on public.analytics_discovery_results (discovery_state_id);
create index analytics_discovery_results_product_idx on public.analytics_discovery_results (product_id) where product_id is not null;
create index analytics_discovery_results_brand_idx on public.analytics_discovery_results (brand_id) where brand_id is not null;
create index analytics_discovery_results_state_position_idx on public.analytics_discovery_results (discovery_state_id, position);

alter table public.analytics_discovery_states enable row level security;
alter table public.analytics_discovery_results enable row level security;
revoke all on table public.analytics_discovery_states, public.analytics_discovery_results from anon, authenticated;
revoke all on sequence public.analytics_discovery_results_id_seq from anon, authenticated;
grant all on table public.analytics_discovery_states, public.analytics_discovery_results to service_role;
grant usage, select on sequence public.analytics_discovery_results_id_seq to service_role;

-- A function call is one PostgreSQL transaction: either the snapshot and every
-- member are stored, or the whole call rolls back. Count mismatches are rejected.
create or replace function public.insert_analytics_discovery_state(p_state jsonb, p_results jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_count integer := (p_state->>'result_count')::integer;
  actual_count integer := jsonb_array_length(p_results);
begin
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Discovery results must be an array';
  end if;
  if expected_count <> actual_count then
    raise exception 'Discovery result count mismatch: expected %, received %', expected_count, actual_count;
  end if;

  insert into public.analytics_discovery_states (
    discovery_state_id, occurred_at, anonymous_session_id, anonymous_journey_id,
    surface_type, page_path, search_id, query, category, subcategory,
    product_type, sort_value, price_min_eur, price_max_eur, gift_recipient,
    gift_occasion, active_filters, result_count, tracking_version, metadata
  ) values (
    p_state->>'discovery_state_id', (p_state->>'occurred_at')::timestamptz,
    p_state->>'anonymous_session_id', p_state->>'anonymous_journey_id',
    p_state->>'surface_type', p_state->>'page_path', nullif(p_state->>'search_id', ''),
    nullif(p_state->>'query', ''), nullif(p_state->>'category', ''),
    nullif(p_state->>'subcategory', ''), nullif(p_state->>'product_type', ''),
    nullif(p_state->>'sort_value', ''), nullif(p_state->>'price_min_eur', '')::numeric,
    nullif(p_state->>'price_max_eur', '')::numeric, nullif(p_state->>'gift_recipient', ''),
    nullif(p_state->>'gift_occasion', ''), p_state->'active_filters', expected_count,
    2, coalesce(p_state->'metadata', '{}'::jsonb)
  );

  insert into public.analytics_discovery_results (
    discovery_state_id, entity_type, product_id, brand_id, position
  )
  select
    p_state->>'discovery_state_id', item->>'entity_type',
    nullif(item->>'product_id', ''), nullif(item->>'brand_id', ''),
    (item->>'position')::integer
  from jsonb_array_elements(p_results) item;
end;
$$;

revoke all on function public.insert_analytics_discovery_state(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.insert_analytics_discovery_state(jsonb, jsonb) to service_role;
