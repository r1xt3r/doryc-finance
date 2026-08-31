begin;

create table if not exists public.bank_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank text not null,
  name text not null,
  original_amount_cents integer not null check (original_amount_cents > 0),
  outstanding_balance_cents integer not null check (outstanding_balance_cents >= 0),
  installment_cents integer not null check (installment_cents > 0),
  next_due_date date not null,
  payment_day integer not null check (payment_day between 1 and 31),
  total_installments integer not null check (total_installments > 0),
  paid_installments integer not null default 0 check (paid_installments >= 0),
  annual_rate numeric(7,4),
  pay_from_account_id uuid references public.accounts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bank_loans enable row level security;
drop policy if exists "Users manage own bank loans" on public.bank_loans;
create policy "Users manage own bank loans" on public.bank_loans
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.bank_loans to authenticated;

commit;
notify pgrst, 'reload schema';
