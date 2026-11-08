-- Quem criou a casa (owner) pode remover outros membros.
create or replace function public.is_owner(p_household uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

create policy members_delete_by_owner on public.household_members
  for delete using (public.is_owner(household_id) and user_id <> auth.uid());
