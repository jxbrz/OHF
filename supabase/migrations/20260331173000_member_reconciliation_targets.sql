create table if not exists public.member_reconciliation_targets (
  member_id uuid primary key references public.members (id) on delete cascade,
  as_of_date timestamptz not null default now(),
  target_units numeric(18, 8) not null,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_member_reconciliation_targets_as_of_date
  on public.member_reconciliation_targets (as_of_date desc);

drop trigger if exists set_member_reconciliation_targets_updated_at on public.member_reconciliation_targets;
create trigger set_member_reconciliation_targets_updated_at
before update on public.member_reconciliation_targets
for each row execute function public.set_updated_at();

alter table public.member_reconciliation_targets enable row level security;

drop policy if exists "member_reconciliation_targets_select_authenticated" on public.member_reconciliation_targets;
create policy "member_reconciliation_targets_select_authenticated"
on public.member_reconciliation_targets
for select
to authenticated
using (true);

drop policy if exists "member_reconciliation_targets_admin_insert" on public.member_reconciliation_targets;
create policy "member_reconciliation_targets_admin_insert"
on public.member_reconciliation_targets
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "member_reconciliation_targets_admin_update" on public.member_reconciliation_targets;
create policy "member_reconciliation_targets_admin_update"
on public.member_reconciliation_targets
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "member_reconciliation_targets_admin_delete" on public.member_reconciliation_targets;
create policy "member_reconciliation_targets_admin_delete"
on public.member_reconciliation_targets
for delete
to authenticated
using (public.is_admin());
