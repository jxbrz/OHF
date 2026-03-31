create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into public.app_settings (key, value)
values
  ('auto_market_close_sync_enabled', '{"value": true}'::jsonb),
  ('market_close_sync_market', '{"value": "US"}'::jsonb),
  ('market_close_sync_timezone', '{"value": "America/New_York"}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
