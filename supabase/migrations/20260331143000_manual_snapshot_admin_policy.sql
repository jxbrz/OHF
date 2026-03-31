drop policy if exists "portfolio_snapshots_admin_insert" on public.portfolio_snapshots;
create policy "portfolio_snapshots_admin_insert"
on public.portfolio_snapshots
for insert
to authenticated
with check (public.is_admin());
