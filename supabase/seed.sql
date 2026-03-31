insert into public.app_settings (key, value)
values
  ('starting_unit_price', '{"value": 1.0}'::jsonb),
  ('etoro_use_mock', '{"value": false}'::jsonb),
  ('fund_base_currency', '{"value": "GBP"}'::jsonb),
  ('broker_account_currency', '{"value": "USD"}'::jsonb),
  ('auto_market_close_sync_enabled', '{"value": true}'::jsonb),
  ('market_close_sync_market', '{"value": "US"}'::jsonb),
  ('market_close_sync_timezone', '{"value": "America/New_York"}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
