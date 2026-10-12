-- =========================================================================
-- XTATS · esquema de Supabase
-- Pégalo completo en Supabase → SQL Editor → New query → Run.
-- Seguridad: cada tabla tiene Row Level Security. Cada persona solo ve su
-- perfil y el de sus amigos; los récords se guardan con una función que
-- conserva siempre el mejor tiempo.
-- =========================================================================

-- Perfil público mínimo. No guardamos la fecha de nacimiento: solo que la
-- persona confirmó tener 13 años o más.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  age_verified boolean not null default false,
  invite_code text unique not null default ('XT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5))),
  created_at timestamptz not null default now()
);

-- Amistad simétrica: al usar un código se crean las dos filas.
create table if not exists public.friendships (
  user_id uuid not null references public.profiles on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- Mejor marca por modo (milisegundos).
create table if not exists public.records (
  user_id uuid not null references public.profiles on delete cascade,
  mode text not null check (mode in ('speedrun', 'climb', 'survival')),
  ms integer not null check (ms > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

-- Un resultado de reto diario por persona y día.
create table if not exists public.daily_results (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  score numeric(3, 2) not null check (score between 0.1 and 5),
  grid text not null check (char_length(grid) <= 32),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Reportes de contenido (solo se escriben; se revisan desde el panel).
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references public.profiles on delete set null,
  target text not null check (char_length(target) <= 120),
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.records enable row level security;
alter table public.daily_results enable row level security;
alter table public.reports enable row level security;

-- ¿La persona `other` es amiga de quien consulta?
-- Vive en un esquema privado: la usan los permisos, pero no queda expuesta en la API.
create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.is_friend(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_id = auth.uid() and friend_id = other);
$$;

-- profiles
drop policy if exists "perfil propio o de amigos" on public.profiles;
create policy "perfil propio o de amigos" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_friend(id));
drop policy if exists "crear perfil propio" on public.profiles;
create policy "crear perfil propio" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists "editar perfil propio" on public.profiles;
create policy "editar perfil propio" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- friendships: se leen y borran las propias; se crean solo con add_friend()
drop policy if exists "ver mis amistades" on public.friendships;
create policy "ver mis amistades" on public.friendships for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "borrar mis amistades" on public.friendships;
create policy "borrar mis amistades" on public.friendships for delete to authenticated
  using (user_id = (select auth.uid()));

-- records: se leen los propios y los de amigos; se escriben con submit_record()
drop policy if exists "récords propios o de amigos" on public.records;
create policy "récords propios o de amigos" on public.records for select to authenticated
  using (user_id = (select auth.uid()) or private.is_friend(user_id));

-- daily_results
drop policy if exists "retos propios o de amigos" on public.daily_results;
create policy "retos propios o de amigos" on public.daily_results for select to authenticated
  using (user_id = (select auth.uid()) or private.is_friend(user_id));
drop policy if exists "guardar mi reto" on public.daily_results;
create policy "guardar mi reto" on public.daily_results for insert to authenticated
  with check (user_id = (select auth.uid()));

-- reports
drop policy if exists "reportar" on public.reports;
create policy "reportar" on public.reports for insert to authenticated
  with check (reporter = (select auth.uid()));

-- Agregar amigo con su código de invitación
create or replace function public.add_friend(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into fid from public.profiles where invite_code = upper(trim(code));
  if fid is null or fid = auth.uid() then raise exception 'invalid_code'; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), fid) on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (fid, auth.uid()) on conflict do nothing;
  return fid;
end;
$$;

-- Guardar una marca conservando la mejor (menor tiempo, o mayor en supervivencia)
create or replace function public.submit_record(p_mode text, p_ms integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_mode not in ('speedrun', 'climb', 'survival') or p_ms <= 0 or p_ms > 3600000 then
    raise exception 'invalid_record';
  end if;
  insert into public.records (user_id, mode, ms) values (auth.uid(), p_mode, p_ms)
  on conflict (user_id, mode) do update
    set ms = case when p_mode = 'survival' then greatest(public.records.ms, excluded.ms)
                  else least(public.records.ms, excluded.ms) end,
        updated_at = now();
end;
$$;

revoke all on function public.add_friend(text) from public, anon;
revoke all on function public.submit_record(text, integer) from public, anon;
revoke all on function private.is_friend(uuid) from public, anon;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.submit_record(text, integer) to authenticated;
grant execute on function private.is_friend(uuid) to authenticated;

-- Índices para las claves foráneas (recomendación de rendimiento de Supabase)
create index if not exists friendships_friend_id_idx on public.friendships (friend_id);
create index if not exists reports_reporter_idx on public.reports (reporter);
