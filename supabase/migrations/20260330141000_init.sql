create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_username text;
begin
  derived_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, 'user'), '@', 1) || '-' || substr(new.id::text, 1, 8)
  );

  insert into public.profiles (id, username, role)
  values (new.id, derived_username, 'viewer')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fund_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null check (type in ('DEPOSIT', 'WITHDRAWAL', 'MANUAL_ADJUSTMENT', 'FEE')),
  date timestamptz not null,
  amount numeric(18, 6) not null,
  unit_price_at_time numeric(18, 8) not null check (unit_price_at_time > 0),
  units_amount numeric(18, 8) not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    case
      when type in ('DEPOSIT', 'WITHDRAWAL', 'FEE') then amount >= 0 and units_amount >= 0
      when type = 'MANUAL_ADJUSTMENT' then true
      else false
    end
  )
);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  total_account_value numeric(18, 6) not null,
  available_cash numeric(18, 6),
  unrealized_pnl numeric(18, 6),
  realized_pnl numeric(18, 6),
  total_units numeric(18, 8) not null check (total_units >= 0),
  unit_price numeric(18, 8) not null check (unit_price >= 0),
  raw_json jsonb
);

create table if not exists public.holding_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_snapshot_id uuid not null references public.portfolio_snapshots (id) on delete cascade,
  symbol text not null,
  instrument_name text,
  quantity numeric(18, 8),
  average_open numeric(18, 8),
  current_price numeric(18, 8),
  market_value numeric(18, 6),
  pnl numeric(18, 6),
  allocation_pct numeric(9, 6)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_is_active on public.members (is_active);
create index if not exists idx_fund_transactions_date on public.fund_transactions (date desc);
create index if not exists idx_fund_transactions_member_date on public.fund_transactions (member_id, date desc);
create index if not exists idx_fund_transactions_type on public.fund_transactions (type);
create index if not exists idx_portfolio_snapshots_captured_at on public.portfolio_snapshots (captured_at desc);
create index if not exists idx_holding_snapshots_snapshot on public.holding_snapshots (portfolio_snapshot_id);
create index if not exists idx_holding_snapshots_symbol on public.holding_snapshots (symbol);
create unique index if not exists idx_holding_snapshots_snapshot_symbol
  on public.holding_snapshots (portfolio_snapshot_id, symbol);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

drop trigger if exists set_members_updated_at on public.members;
create trigger set_members_updated_at
before update on public.members
for each row execute function public.set_updated_at();

drop trigger if exists set_fund_transactions_updated_at on public.fund_transactions;
create trigger set_fund_transactions_updated_at
before update on public.fund_transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.fund_transactions enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.holding_snapshots enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members_select_authenticated" on public.members;
create policy "members_select_authenticated"
on public.members
for select
to authenticated
using (true);

drop policy if exists "members_admin_insert" on public.members;
create policy "members_admin_insert"
on public.members
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "members_admin_update" on public.members;
create policy "members_admin_update"
on public.members
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members_admin_delete" on public.members;
create policy "members_admin_delete"
on public.members
for delete
to authenticated
using (public.is_admin());

drop policy if exists "fund_transactions_select_authenticated" on public.fund_transactions;
create policy "fund_transactions_select_authenticated"
on public.fund_transactions
for select
to authenticated
using (true);

drop policy if exists "fund_transactions_admin_insert" on public.fund_transactions;
create policy "fund_transactions_admin_insert"
on public.fund_transactions
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "fund_transactions_admin_update" on public.fund_transactions;
create policy "fund_transactions_admin_update"
on public.fund_transactions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "fund_transactions_admin_delete" on public.fund_transactions;
create policy "fund_transactions_admin_delete"
on public.fund_transactions
for delete
to authenticated
using (public.is_admin());

drop policy if exists "portfolio_snapshots_select_authenticated" on public.portfolio_snapshots;
create policy "portfolio_snapshots_select_authenticated"
on public.portfolio_snapshots
for select
to authenticated
using (true);

drop policy if exists "holding_snapshots_select_authenticated" on public.holding_snapshots;
create policy "holding_snapshots_select_authenticated"
on public.holding_snapshots
for select
to authenticated
using (true);

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "app_settings_admin_insert" on public.app_settings;
create policy "app_settings_admin_insert"
on public.app_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "app_settings_admin_update" on public.app_settings;
create policy "app_settings_admin_update"
on public.app_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "app_settings_admin_delete" on public.app_settings;
create policy "app_settings_admin_delete"
on public.app_settings
for delete
to authenticated
using (public.is_admin());

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (public.is_admin());

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;
