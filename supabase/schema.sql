create extension if not exists pgcrypto;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payment_reminders boolean not null default false,
  monthly_expense_report boolean not null default false,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('payment_reminder', 'monthly_expense_report')),
  delivery_key text not null,
  provider_id text,
  sent_at timestamptz not null default now(),
  unique(user_id, email_type, delivery_key)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bank text not null,
  account_type text not null,
  starting_balance_cents integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income', 'transfer')),
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  transaction_date date not null,
  budget_month date,
  from_account_id uuid references public.accounts(id) on delete restrict,
  to_account_id uuid references public.accounts(id) on delete restrict,
  category text,
  payment_method text,
  created_at timestamptz not null default now(),
  check (
    (type = 'expense' and from_account_id is not null and to_account_id is null) or
    (type = 'income' and from_account_id is null and to_account_id is not null) or
    (type = 'transfer' and from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id)
  )
);

create table if not exists public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount_cents integer not null check (amount_cents > 0),
  frequency text not null default 'Monthly',
  next_due_date date not null,
  pay_from_account_id uuid not null references public.accounts(id) on delete restrict,
  category text,
  payment_method text,
  active boolean not null default true,
  paid_this_cycle boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bank text not null,
  credit_limit_cents integer not null check (credit_limit_cents > 0),
  opening_used_cents integer not null default 0 check (opening_used_cents >= 0),
  current_statement_cents integer not null default 0 check (current_statement_cents >= 0),
  annual_effective_rate numeric(7,4) not null default 16.77,
  payment_day integer check (payment_day between 1 and 31),
  network text not null default 'Visa' check (network in ('Visa', 'Mastercard', 'Discover', 'Amex', 'Other')),
  pay_from_account_id uuid references public.accounts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.credit_cards add column if not exists network text not null default 'Visa';
alter table public.credit_cards add column if not exists pay_from_account_id uuid references public.accounts(id) on delete set null;
alter table public.credit_cards add column if not exists statement_day integer;

create table if not exists public.credit_card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  purchase_date date not null,
  category text,
  installment_months integer not null default 1 check (installment_months between 1 and 36),
  with_interest boolean not null default false,
  installments_paid integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.credit_card_purchases add column if not exists installments_paid integer not null default 0;
alter table public.credit_card_purchases add column if not exists active boolean not null default true;

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

create table if not exists public.personal_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('i_owe', 'owed_to_me')),
  person_name text not null,
  amount_cents integer not null check (amount_cents > 0),
  due_date date,
  note text,
  status text not null default 'open' check (status in ('open', 'settled')),
  account_id uuid references public.accounts(id) on delete set null,
  paid_cents integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.personal_loans add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.personal_loans add column if not exists paid_cents integer not null default 0;

create table if not exists public.personal_loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  personal_loan_id uuid not null references public.personal_loans(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  payment_date date not null,
  entry_type text not null default 'payment' check (entry_type in ('payment', 'advance')),
  created_at timestamptz not null default now()
);
alter table public.personal_loan_payments add column if not exists entry_type text not null default 'payment';

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_accounts_user_active on public.accounts(user_id, active);
create index if not exists idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index if not exists idx_transactions_user_from on public.transactions(user_id, from_account_id);
create index if not exists idx_transactions_user_to on public.transactions(user_id, to_account_id);
create index if not exists idx_recurring_user_due on public.recurring_payments(user_id, active, next_due_date);
create index if not exists idx_credit_cards_user_active on public.credit_cards(user_id, active);
create index if not exists idx_card_purchases_user_date on public.credit_card_purchases(user_id, purchase_date desc);
create index if not exists idx_personal_loans_user_status on public.personal_loans(user_id, status, due_date);
create index if not exists idx_card_payments_user_date on public.credit_card_payments(user_id, payment_date desc);
create index if not exists idx_loan_payments_user_date on public.personal_loan_payments(user_id, payment_date desc);

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_payments enable row level security;
alter table public.credit_cards enable row level security;
alter table public.credit_card_purchases enable row level security;
alter table public.personal_loans enable row level security;
alter table public.credit_card_payments enable row level security;
alter table public.personal_loan_payments enable row level security;
alter table public.user_preferences enable row level security;
alter table public.bank_loans enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_deliveries enable row level security;

drop policy if exists "Users manage own accounts" on public.accounts;
create policy "Users manage own accounts" on public.accounts
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own recurring payments" on public.recurring_payments;
create policy "Users manage own recurring payments" on public.recurring_payments
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own credit cards" on public.credit_cards;
create policy "Users manage own credit cards" on public.credit_cards
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own credit card purchases" on public.credit_card_purchases;
create policy "Users manage own credit card purchases" on public.credit_card_purchases
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own personal loans" on public.personal_loans;
create policy "Users manage own personal loans" on public.personal_loans
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own credit card payments" on public.credit_card_payments;
create policy "Users manage own credit card payments" on public.credit_card_payments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own personal loan payments" on public.personal_loan_payments;
create policy "Users manage own personal loan payments" on public.personal_loan_payments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences" on public.user_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own bank loans" on public.bank_loans;
create policy "Users manage own bank loans" on public.bank_loans for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage notification preferences" on public.notification_preferences;
create policy "Users manage notification preferences" on public.notification_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users view own email deliveries" on public.email_deliveries;
create policy "Users view own email deliveries" on public.email_deliveries for select to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.recurring_payments to authenticated;
grant select, insert, update, delete on public.credit_cards to authenticated;
grant select, insert, update, delete on public.credit_card_purchases to authenticated;
grant select, insert, update, delete on public.personal_loans to authenticated;
grant select, insert, update, delete on public.credit_card_payments to authenticated;
grant select, insert, update, delete on public.personal_loan_payments to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.bank_loans to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.email_deliveries to authenticated;
