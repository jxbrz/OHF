insert into public.app_settings (key, value)
values
  ('fund_base_currency', '{"value": "GBP"}'::jsonb),
  ('broker_account_currency', '{"value": "USD"}'::jsonb)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
