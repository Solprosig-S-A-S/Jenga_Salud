-- Ejecutar DESPUÉS de jenga.sql en Supabase > SQL Editor.
begin;
create table if not exists public.jenga_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.jenga_admins enable row level security;
revoke all on public.jenga_admins from public, anon, authenticated;

create or replace function public.jenga_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.jenga_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.jenga_is_admin() from public, anon;
grant execute on function public.jenga_is_admin() to authenticated;

drop policy if exists jenga_admin_read_answers on public.jenga_answers;
create policy jenga_admin_read_answers on public.jenga_answers
for select to authenticated using ((select public.jenga_is_admin()));
grant select on public.jenga_answers to authenticated;

create or replace function public.jenga_answers_snapshot()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.jenga_is_admin() then raise exception 'Acceso no autorizado.'; end if;
  return coalesce((select max(id) from public.jenga_answers),0);
end;
$$;
revoke all on function public.jenga_answers_snapshot() from public, anon;
grant execute on function public.jenga_answers_snapshot() to authenticated;
commit;
notify pgrst, 'reload schema';

-- Tras crear las cuentas en Authentication > Users, autoriza sus UUID:
-- insert into public.jenga_admins(user_id) values ('UUID-DE-LA-CUENTA');
-- Para revocar acceso: delete from public.jenga_admins where user_id='UUID-DE-LA-CUENTA';
