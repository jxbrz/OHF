create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  review_date date not null unique,
  title text not null,
  summary text not null,
  body text not null,
  snapshot_id uuid references public.portfolio_snapshots (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  model text,
  raw_json jsonb
);

create index if not exists idx_daily_reviews_review_date on public.daily_reviews (review_date desc);
create index if not exists idx_daily_reviews_generated_at on public.daily_reviews (generated_at desc);

alter table public.daily_reviews enable row level security;

drop policy if exists "daily_reviews_select_authenticated" on public.daily_reviews;
create policy "daily_reviews_select_authenticated"
on public.daily_reviews
for select
to authenticated
using (true);

drop policy if exists "daily_reviews_admin_insert" on public.daily_reviews;
create policy "daily_reviews_admin_insert"
on public.daily_reviews
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "daily_reviews_admin_update" on public.daily_reviews;
create policy "daily_reviews_admin_update"
on public.daily_reviews
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "daily_reviews_admin_delete" on public.daily_reviews;
create policy "daily_reviews_admin_delete"
on public.daily_reviews
for delete
to authenticated
using (public.is_admin());
