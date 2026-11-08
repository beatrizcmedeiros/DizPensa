-- Ajustes apontados pelo verificador de segurança do Supabase.
-- Por padrão o Postgres libera EXECUTE de funções para PUBLIC (todo mundo,
-- inclusive quem não fez login). Aqui só usuários logados podem chamar.

alter function public.generate_invite_code() set search_path = public;

revoke execute on function public.generate_invite_code() from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;

-- is_member é usada pelas regras de permissão (RLS) das tabelas.
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
