alter table public.fund_transactions
  add column if not exists counterparty_member_id uuid references public.members (id),
  add column if not exists transfer_group_id uuid;

alter table public.fund_transactions
  drop constraint if exists fund_transactions_type_check,
  drop constraint if exists fund_transactions_check,
  drop constraint if exists fund_transactions_amount_sign_check,
  drop constraint if exists fund_transactions_transfer_shape_check;

alter table public.fund_transactions
  add constraint fund_transactions_type_check
    check (type in ('DEPOSIT', 'WITHDRAWAL', 'MANUAL_ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE')),
  add constraint fund_transactions_amount_sign_check
    check (
      case
        when type in ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE') then amount >= 0 and units_amount >= 0
        when type = 'MANUAL_ADJUSTMENT' then true
        else false
      end
    ),
  add constraint fund_transactions_transfer_shape_check
    check (
      case
        when type in ('TRANSFER_IN', 'TRANSFER_OUT')
          then counterparty_member_id is not null
            and transfer_group_id is not null
            and counterparty_member_id <> member_id
        else counterparty_member_id is null
          and transfer_group_id is null
      end
    );

create index if not exists idx_fund_transactions_transfer_group
  on public.fund_transactions (transfer_group_id);

create index if not exists idx_fund_transactions_counterparty
  on public.fund_transactions (counterparty_member_id);

create unique index if not exists idx_fund_transactions_transfer_group_member
  on public.fund_transactions (transfer_group_id, member_id)
  where transfer_group_id is not null;
