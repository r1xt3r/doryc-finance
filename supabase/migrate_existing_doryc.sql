-- Safe, repeatable migration for an existing Doryc database.
-- It preserves all current accounts, transactions, cards and personal IOUs.

begin;

alter table public.credit_cards
  add column if not exists network text not null default 'Visa',
  add column if not exists pay_from_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists statement_day integer,
  add column if not exists active boolean not null default true;

alter table public.credit_card_purchases
  add column if not exists installments_paid integer not null default 0,
  add column if not exists active boolean not null default true;

alter table public.personal_loans
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists paid_cents integer not null default 0;

create table if not exists public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  from_account_id uuid not null references public.accounts(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  payment_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  personal_loan_id uuid not null references public.personal_loans(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  payment_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_payments_user_date on public.credit_card_payments(user_id, payment_date desc);
create index if not exists idx_loan_payments_user_date on public.personal_loan_payments(user_id, payment_date desc);
create index if not exists idx_personal_loans_user_status on public.personal_loans(user_id, status, due_date);

alter table public.credit_card_payments enable row level security;
alter table public.personal_loan_payments enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "Users manage own credit card payments" on public.credit_card_payments;
create policy "Users manage own credit card payments" on public.credit_card_payments
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own personal loan payments" on public.personal_loan_payments;
create policy "Users manage own personal loan payments" on public.personal_loan_payments
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences" on public.user_preferences
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.credit_card_payments to authenticated;
grant select, insert, update, delete on public.personal_loan_payments to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

commit;

notify pgrst, 'reload schema';
