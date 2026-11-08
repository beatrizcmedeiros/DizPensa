-- Esquema inicial do DizPensa.
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
-- Toda tabela de dados tem household_id: é por ele que o compartilhamento
-- entre pessoas da mesma casa funciona (permissões e sincronização).

create extension if not exists pgcrypto;

-- ============================================================
-- Casas e membros
-- ============================================================
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- ============================================================
-- Catálogo
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Produto genérico ("Arroz branco"), agrupa marcas diferentes.
-- unit_type: 'package' = conta por embalagem; 'weight' = conta em kg (carne, queijo...)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  unit_type text not null default 'package' check (unit_type in ('package', 'weight')),
  min_quantity double precision not null default 0,
  archived integer not null default 0,
  created_at timestamptz not null default now()
);

-- Marca + tamanho de um produto ("Tio João 5kg").
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  brand text,
  size_value double precision,
  size_unit text check (size_unit in ('g', 'kg', 'ml', 'L', 'un')),
  gtin text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Compras (notas fiscais ou lançamentos manuais)
-- ============================================================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'nfce')),
  access_key text,               -- chave de acesso da NFC-e (44 dígitos)
  store_name text,
  store_cnpj text,
  purchased_at timestamptz not null default now(),
  total double precision,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index purchases_access_key_uniq
  on public.purchases (household_id, access_key) where access_key is not null;

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  raw_description text,          -- descrição como veio na nota
  quantity double precision not null,
  unit text,
  unit_price double precision,
  total_price double precision,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Estoque
-- ============================================================
-- Cada entrada vira um lote. A baixa consome o lote mais antigo primeiro.
-- Quando o lote zera, finished_at é preenchido: a duração do produto é
-- finished_at - entered_at.
create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  purchase_item_id uuid references public.purchase_items(id) on delete set null,
  quantity_initial double precision not null,
  quantity_remaining double precision not null,
  entered_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Histórico de tudo que entrou e saiu.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  lot_id uuid references public.stock_lots(id) on delete set null,
  type text not null check (type in ('entrada', 'baixa', 'ajuste')),
  quantity double precision not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Lista de compras (usada na fase 4)
-- ============================================================
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  quantity double precision,
  checked integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Índices por casa (usados pelas permissões e pela sincronização)
create index on public.household_members (user_id);
create index on public.household_members (household_id);
create index on public.categories (household_id);
create index on public.products (household_id);
create index on public.product_variants (household_id);
create index on public.purchases (household_id);
create index on public.purchase_items (household_id);
create index on public.stock_lots (household_id);
create index on public.stock_movements (household_id);
create index on public.shopping_list_items (household_id);

-- ============================================================
-- Permissões (Row Level Security)
-- ============================================================
create or replace function public.is_member(p_household uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- Casas: só membros veem e renomeiam. Criar/entrar é feito pelas funções abaixo.
create policy households_select on public.households
  for select using (public.is_member(id));
create policy households_update on public.households
  for update using (public.is_member(id)) with check (public.is_member(id));

-- Membros: todos da casa veem; cada um pode sair (apagar o próprio vínculo).
create policy members_select on public.household_members
  for select using (public.is_member(household_id));
create policy members_update_self on public.household_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete_self on public.household_members
  for delete using (user_id = auth.uid());

-- Demais tabelas: qualquer membro da casa pode ler e escrever.
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'products', 'product_variants', 'purchases',
    'purchase_items', 'stock_lots', 'stock_movements', 'shopping_list_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.is_member(household_id))
         with check (public.is_member(household_id))',
      t || '_member_all', t
    );
  end loop;
end $$;

-- ============================================================
-- Funções chamadas pelo app (precisam de internet)
-- ============================================================
create or replace function public.generate_invite_code()
returns text
language sql
volatile
as $$
  -- 6 caracteres sem letras/números ambíguos (0/O, 1/I)
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), ''
  )
  from generate_series(1, 6);
$$;

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  insert into public.households (name, invite_code, created_by)
  values (p_name, v_code, auth.uid())
  returning id into v_id;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (v_id, auth.uid(), p_display_name, 'owner');

  insert into public.categories (household_id, name, icon, sort_order)
  select v_id, c.name, c.icon, c.ord
  from (values
    ('Hortifruti', 'nutrition', 1),
    ('Carnes e peixes', 'set_meal', 2),
    ('Frios e laticínios', 'egg', 3),
    ('Padaria', 'bakery_dining', 4),
    ('Mercearia', 'kitchen', 5),
    ('Bebidas', 'local_drink', 6),
    ('Congelados', 'ac_unit', 7),
    ('Limpeza', 'cleaning_services', 8),
    ('Higiene pessoal', 'soap', 9),
    ('Pets', 'pets', 10),
    ('Outros', 'category', 99)
  ) as c(name, icon, ord);

  return v_id;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_id from public.households
  where invite_code = upper(trim(p_code));

  if v_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (v_id, auth.uid(), p_display_name, 'member')
  on conflict (household_id, user_id) do nothing;

  return v_id;
end;
$$;

create or replace function public.regenerate_invite_code(p_household uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_member(p_household) then
    raise exception 'not a member';
  end if;

  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  update public.households set invite_code = v_code where id = p_household;
  return v_code;
end;
$$;

revoke execute on function public.create_household(text, text) from anon;
revoke execute on function public.join_household(text, text) from anon;
revoke execute on function public.regenerate_invite_code(uuid) from anon;

-- ============================================================
-- Publicação usada pelo PowerSync para replicar as tabelas
-- ============================================================
create publication powersync for table
  public.households,
  public.household_members,
  public.categories,
  public.products,
  public.product_variants,
  public.purchases,
  public.purchase_items,
  public.stock_lots,
  public.stock_movements,
  public.shopping_list_items;
