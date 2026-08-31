-- Atomic financial operations and query indexes for Doryc.
create index if not exists idx_card_purchases_card_date on public.credit_card_purchases(credit_card_id, purchase_date desc);
create index if not exists idx_card_payments_card_date on public.credit_card_payments(credit_card_id, payment_date desc);
create index if not exists idx_loan_payments_loan_date on public.personal_loan_payments(personal_loan_id, payment_date desc);
create index if not exists idx_bank_loans_user_due on public.bank_loans(user_id, active, next_due_date);
alter table public.transactions add column if not exists recurring_payment_id uuid references public.recurring_payments(id) on delete set null;
create index if not exists idx_transactions_recurring on public.transactions(user_id, recurring_payment_id, created_at desc);
create table if not exists public.bank_loan_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  bank_loan_id uuid not null references public.bank_loans(id) on delete cascade, account_id uuid not null references public.accounts(id) on delete restrict,
  amount_cents integer not null check(amount_cents>0), payment_date date not null, due_date date not null, created_at timestamptz not null default now()
);
alter table public.bank_loan_payments enable row level security;
drop policy if exists "Users manage own bank loan payments" on public.bank_loan_payments;
create policy "Users manage own bank loan payments" on public.bank_loan_payments for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant select,insert,update,delete on public.bank_loan_payments to authenticated;
create index if not exists idx_bank_loan_payments_cycle on public.bank_loan_payments(user_id,bank_loan_id,due_date);

create or replace function public.doryc_add_months_clamped(p_date date,p_months integer)
returns date language sql immutable as $$
  select (date_trunc('month',p_date)+(p_months||' months')::interval+(least(extract(day from p_date),extract(day from date_trunc('month',p_date)+(p_months+1||' months')::interval-interval '1 day'))::integer-1)*interval '1 day')::date;
$$;

create or replace function public.doryc_card_first_due(p_purchase date,p_statement_day integer,p_payment_day integer)
returns date language plpgsql immutable as $$
declare v_close date; v_month date;
begin
  if p_statement_day is null or p_payment_day is null then return p_purchase; end if;
  v_month:=date_trunc('month',p_purchase)::date+case when extract(day from p_purchase)>p_statement_day then interval '1 month' else interval '0 month' end;
  v_close:=(v_month+(least(p_statement_day,extract(day from date_trunc('month',v_month)+interval '1 month-1 day'))::integer-1)*interval '1 day')::date;
  v_month:=date_trunc('month',v_close)::date+case when p_payment_day<=extract(day from v_close) then interval '1 month' else interval '0 month' end;
  return (v_month+(least(p_payment_day,extract(day from date_trunc('month',v_month)+interval '1 month-1 day'))::integer-1)*interval '1 day')::date;
end; $$;

create or replace function public.doryc_account_balance_cents(p_account_id uuid)
returns bigint language sql stable security invoker set search_path = public as $$
  select a.starting_balance_cents::bigint
    + coalesce((select sum(case when t.type='income' and t.to_account_id=a.id then t.amount_cents when t.type='expense' and t.from_account_id=a.id then -t.amount_cents when t.type='transfer' and t.to_account_id=a.id then t.amount_cents when t.type='transfer' and t.from_account_id=a.id then -t.amount_cents else 0 end) from transactions t where t.user_id=auth.uid() and (t.from_account_id=a.id or t.to_account_id=a.id)),0)
    + coalesce((select sum(case when l.direction='i_owe' then 1 else -1 end*(l.amount_cents-coalesce((select sum(ap.amount_cents) from personal_loan_payments ap where ap.personal_loan_id=l.id and ap.entry_type='advance'),0))) from personal_loans l where l.user_id=auth.uid() and l.account_id=a.id),0)
    + coalesce((select sum(case when p.entry_type='advance' then case when l.direction='i_owe' then p.amount_cents else -p.amount_cents end else case when l.direction='i_owe' then -p.amount_cents else p.amount_cents end end) from personal_loan_payments p join personal_loans l on l.id=p.personal_loan_id where p.user_id=auth.uid() and p.account_id=a.id),0)
  from accounts a where a.id=p_account_id and a.user_id=auth.uid() and a.active;
$$;

create or replace function public.doryc_pay_credit_card(p_card_id uuid,p_account_id uuid,p_amount_cents integer,p_payment_date date,p_note text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare v_statement integer;
begin
  if p_amount_cents <= 0 or coalesce(doryc_account_balance_cents(p_account_id),0) < p_amount_cents then raise exception 'Insufficient funds'; end if;
  select current_statement_cents into v_statement from credit_cards where id=p_card_id and user_id=auth.uid() for update;
  if not found then raise exception 'Card not found'; end if;
  insert into credit_card_payments(user_id,credit_card_id,from_account_id,amount_cents,payment_date,note) values(auth.uid(),p_card_id,p_account_id,p_amount_cents,p_payment_date,p_note);
  update credit_cards set current_statement_cents=greatest(0,v_statement-p_amount_cents) where id=p_card_id;
  update credit_card_purchases p set installments_paid=p.installments_paid+1 from credit_cards c where c.id=p_card_id and p.credit_card_id=c.id and p.active and p.installment_months>1 and p.installments_paid<p.installment_months and doryc_add_months_clamped(doryc_card_first_due(p.purchase_date,c.statement_day,c.payment_day),p.installments_paid)<=p_payment_date;
  insert into transactions(user_id,type,description,amount_cents,transaction_date,from_account_id,category,payment_method) values(auth.uid(),'expense',coalesce(nullif(p_note,''),'Credit card payment'),p_amount_cents,p_payment_date,p_account_id,'Credit card','Bank Transfer');
end; $$;

create or replace function public.doryc_pay_bank_loan(p_loan_id uuid,p_account_id uuid,p_amount_cents integer,p_payment_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare v_loan bank_loans%rowtype; v_paid integer; v_cycle_paid bigint; v_full boolean; v_next date;
begin
  if p_amount_cents <= 0 or coalesce(doryc_account_balance_cents(p_account_id),0) < p_amount_cents then raise exception 'Insufficient funds'; end if;
  select * into v_loan from bank_loans where id=p_loan_id and user_id=auth.uid() for update;
  if not found then raise exception 'Loan not found'; end if;
  v_paid:=least(p_amount_cents,v_loan.outstanding_balance_cents);
  insert into bank_loan_payments(user_id,bank_loan_id,account_id,amount_cents,payment_date,due_date) values(auth.uid(),p_loan_id,p_account_id,v_paid,p_payment_date,v_loan.next_due_date);
  select coalesce(sum(amount_cents),0) into v_cycle_paid from bank_loan_payments where user_id=auth.uid() and bank_loan_id=p_loan_id and due_date=v_loan.next_due_date;
  v_full:=v_cycle_paid>=least(v_loan.installment_cents,v_loan.outstanding_balance_cents);
  v_next:=case when v_full then (date_trunc('month',v_loan.next_due_date)+interval '1 month'+(least(extract(day from v_loan.next_due_date),extract(day from date_trunc('month',v_loan.next_due_date)+interval '2 months-1 day'))::integer-1)*interval '1 day')::date else v_loan.next_due_date end;
  update bank_loans set outstanding_balance_cents=greatest(0,v_loan.outstanding_balance_cents-v_paid),paid_installments=case when v_full then least(v_loan.total_installments,v_loan.paid_installments+1) else v_loan.paid_installments end,next_due_date=v_next,pay_from_account_id=p_account_id where id=p_loan_id;
  insert into transactions(user_id,type,description,amount_cents,transaction_date,from_account_id,category,payment_method) values(auth.uid(),'expense',v_loan.name||' installment',v_paid,p_payment_date,p_account_id,'Loan','Automatic Debit');
end; $$;

create or replace function public.doryc_pay_personal_loan(p_loan_id uuid,p_account_id uuid,p_amount_cents integer,p_payment_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare v_loan personal_loans%rowtype; v_paid integer;
begin
  select * into v_loan from personal_loans where id=p_loan_id and user_id=auth.uid() for update;
  if not found or p_amount_cents<=0 or v_loan.paid_cents+p_amount_cents>v_loan.amount_cents then raise exception 'Invalid payment'; end if;
  if v_loan.direction='i_owe' and coalesce(doryc_account_balance_cents(p_account_id),0)<p_amount_cents then raise exception 'Insufficient funds'; end if;
  insert into personal_loan_payments(user_id,personal_loan_id,account_id,amount_cents,payment_date) values(auth.uid(),p_loan_id,p_account_id,p_amount_cents,p_payment_date);
  v_paid:=v_loan.paid_cents+p_amount_cents;
  update personal_loans set paid_cents=v_paid,status=case when v_paid>=amount_cents then 'settled' else 'open' end where id=p_loan_id;
end; $$;

create or replace function public.doryc_record_recurring(p_recurring_id uuid,p_payment_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare v_payment recurring_payments%rowtype; v_flow text; v_next date; v_salary boolean;
begin
  select * into v_payment from recurring_payments where id=p_recurring_id and user_id=auth.uid() and active for update;
  if not found then raise exception 'Recurring payment not found'; end if;
  v_flow:=case when v_payment.payment_method='Recurring Income' then 'income' else 'expense' end;
  if v_flow='expense' and coalesce(doryc_account_balance_cents(v_payment.pay_from_account_id),0)<v_payment.amount_cents then raise exception 'Insufficient funds'; end if;
  insert into transactions(user_id,type,description,amount_cents,transaction_date,from_account_id,to_account_id,category,payment_method,recurring_payment_id) values(auth.uid(),v_flow,v_payment.name,v_payment.amount_cents,p_payment_date,case when v_flow='expense' then v_payment.pay_from_account_id end,case when v_flow='income' then v_payment.pay_from_account_id end,coalesce(v_payment.category,'Subscriptions'),v_payment.payment_method,v_payment.id);
  v_salary:=v_flow='income' and (v_payment.category='Salary' or v_payment.name~*'(salary|sueldo)');
  v_next:=case when v_payment.frequency='Weekly' then v_payment.next_due_date+7 when v_payment.frequency='Yearly' then (v_payment.next_due_date+interval '1 year')::date when v_salary then (date_trunc('month',v_payment.next_due_date)+interval '2 months-1 day')::date else (date_trunc('month',v_payment.next_due_date)+interval '1 month'+(least(extract(day from v_payment.next_due_date),extract(day from date_trunc('month',v_payment.next_due_date)+interval '2 months-1 day'))::integer-1)*interval '1 day')::date end;
  update recurring_payments set paid_this_cycle=true,next_due_date=v_next where id=v_payment.id;
end; $$;

create or replace function public.doryc_undo_recurring(p_recurring_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_payment recurring_payments%rowtype; v_previous date; v_salary boolean; v_tx uuid;
begin
  select * into v_payment from recurring_payments where id=p_recurring_id and user_id=auth.uid() for update;
  if not found then raise exception 'Recurring payment not found'; end if;
  select id into v_tx from transactions where user_id=auth.uid() and recurring_payment_id=v_payment.id order by created_at desc limit 1;
  if v_tx is null then raise exception 'Recurring transaction not found'; end if;
  delete from transactions where id=v_tx;
  v_salary:=v_payment.payment_method='Recurring Income' and (v_payment.category='Salary' or v_payment.name~*'(salary|sueldo)');
  v_previous:=case when v_payment.frequency='Weekly' then v_payment.next_due_date-7 when v_payment.frequency='Yearly' then (v_payment.next_due_date-interval '1 year')::date when v_salary then (date_trunc('month',v_payment.next_due_date)-interval '1 day')::date else (v_payment.next_due_date-interval '1 month')::date end;
  update recurring_payments set paid_this_cycle=false,next_due_date=v_previous where id=v_payment.id;
end; $$;

grant execute on function public.doryc_account_balance_cents(uuid) to authenticated;
grant execute on function public.doryc_pay_credit_card(uuid,uuid,integer,date,text) to authenticated;
grant execute on function public.doryc_pay_bank_loan(uuid,uuid,integer,date) to authenticated;
grant execute on function public.doryc_pay_personal_loan(uuid,uuid,integer,date) to authenticated;
grant execute on function public.doryc_record_recurring(uuid,date) to authenticated;
grant execute on function public.doryc_undo_recurring(uuid) to authenticated;
