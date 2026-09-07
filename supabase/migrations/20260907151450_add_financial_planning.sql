create table if not exists public.monthly_budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, month date not null, category text not null, limit_cents integer not null check (limit_cents > 0), mode text not null default 'balanced' check (mode in ('comfortable','balanced','saving','custom')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, month, category));
create table if not exists public.savings_goals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, target_cents integer not null check (target_cents > 0), saved_cents integer not null default 0 check (saved_cents >= 0), target_date date, account_id uuid references public.accounts(id) on delete set null, color text not null default '#b49cff', active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.custom_categories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, icon text not null default '•', color text not null default '#b49cff', kind text not null default 'expense' check(kind in ('expense','income')), created_at timestamptz not null default now(), unique(user_id, name, kind));
create table if not exists public.category_rules (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, match_text text not null, category text not null, created_at timestamptz not null default now(), unique(user_id, match_text));
create table if not exists public.cash_reconciliations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, account_id uuid not null references public.accounts(id) on delete cascade, expected_cents integer not null, counted_cents integer not null, difference_cents integer not null, reconciled_at timestamptz not null default now());
create table if not exists public.financial_audit_log (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, action text not null, entity_type text not null, entity_id uuid, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.financial_plans (user_id uuid primary key references auth.users(id) on delete cascade, strategy text not null default 'prioritize_savings' check(strategy in ('prioritize_savings','balanced','flexible','custom')), monthly_income_cents integer not null check(monthly_income_cents >= 0), personal_allowance_cents integer not null default 0 check(personal_allowance_cents >= 0), surplus_destination text not null default 'savings' check(surplus_destination in ('savings','goals','available','split')), savings_account_id uuid references public.accounts(id) on delete set null, include_credit_estimate boolean not null default true, savings_role_confirmed boolean not null default false, updated_at timestamptz not null default now());
create table if not exists public.account_roles (user_id uuid not null references auth.users(id) on delete cascade, account_id uuid primary key references public.accounts(id) on delete cascade, role text not null check(role in ('available','savings','emergency','goal')), confirmed_at timestamptz not null default now());

create index if not exists idx_budgets_user_month on public.monthly_budgets(user_id, month);
create index if not exists idx_goals_user_active on public.savings_goals(user_id, active);
create index if not exists idx_rules_user on public.category_rules(user_id);
create index if not exists idx_cash_reconciliations_user on public.cash_reconciliations(user_id, reconciled_at desc);
create index if not exists idx_audit_user_date on public.financial_audit_log(user_id, created_at desc);

alter table public.monthly_budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.custom_categories enable row level security;
alter table public.category_rules enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.financial_audit_log enable row level security;
alter table public.financial_plans enable row level security;
alter table public.account_roles enable row level security;

drop policy if exists "Users manage own budgets" on public.monthly_budgets;
create policy "Users manage own budgets" on public.monthly_budgets for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own goals" on public.savings_goals;
create policy "Users manage own goals" on public.savings_goals for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own categories" on public.custom_categories;
create policy "Users manage own categories" on public.custom_categories for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own category rules" on public.category_rules;
create policy "Users manage own category rules" on public.category_rules for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own cash reconciliations" on public.cash_reconciliations;
create policy "Users manage own cash reconciliations" on public.cash_reconciliations for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users read own audit log" on public.financial_audit_log;
create policy "Users read own audit log" on public.financial_audit_log for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users insert own audit log" on public.financial_audit_log;
create policy "Users insert own audit log" on public.financial_audit_log for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own financial plan" on public.financial_plans;
create policy "Users manage own financial plan" on public.financial_plans for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own account roles" on public.account_roles;
create policy "Users manage own account roles" on public.account_roles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

grant select, insert, update, delete on public.monthly_budgets, public.savings_goals, public.custom_categories, public.category_rules, public.cash_reconciliations, public.financial_plans, public.account_roles to authenticated;
grant select, insert on public.financial_audit_log to authenticated;
