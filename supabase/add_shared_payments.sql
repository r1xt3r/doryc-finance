alter table public.recurring_payments
  add column if not exists shared_members jsonb not null default '[]'::jsonb;

create table if not exists public.shared_payment_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_payment_id uuid not null references public.recurring_payments(id) on delete cascade,
  participant_name text not null,
  amount_cents integer not null check (amount_cents > 0),
  cycle_month date not null,
  received_account_id uuid not null references public.accounts(id) on delete restrict,
  received_date date not null,
  created_at timestamptz not null default now(),
  unique (recurring_payment_id, participant_name, cycle_month)
);

alter table public.shared_payment_contributions enable row level security;
drop policy if exists "Users manage shared contributions" on public.shared_payment_contributions;
create policy "Users manage shared contributions" on public.shared_payment_contributions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.shared_payment_contributions to authenticated;
