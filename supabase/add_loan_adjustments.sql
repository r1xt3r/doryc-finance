begin;

alter table public.personal_loan_payments
  add column if not exists entry_type text not null default 'payment';

commit;

notify pgrst, 'reload schema';
