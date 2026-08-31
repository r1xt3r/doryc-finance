alter table public.transactions
  add column if not exists budget_month date;

update public.transactions
set budget_month = date_trunc('month', transaction_date)::date
where budget_month is null;

alter table public.transactions
  alter column budget_month set default date_trunc('month', current_date)::date;

create index if not exists idx_transactions_user_budget_month
  on public.transactions(user_id, budget_month, transaction_date desc);
