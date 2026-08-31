-- Launch-readiness operations. Apply once in the Supabase SQL editor.
create or replace function public.doryc_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.doryc_delete_my_account() from public, anon;
grant execute on function public.doryc_delete_my_account() to authenticated;
