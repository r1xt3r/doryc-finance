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

alter table public.notification_preferences enable row level security;
alter table public.email_deliveries enable row level security;

drop policy if exists "Users manage notification preferences" on public.notification_preferences;
create policy "Users manage notification preferences" on public.notification_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view own email deliveries" on public.email_deliveries;
create policy "Users view own email deliveries" on public.email_deliveries
  for select to authenticated using (auth.uid() = user_id);

grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.email_deliveries to authenticated;
