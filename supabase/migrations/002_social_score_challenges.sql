-- =========================================================================
-- XTATS · migración 002
-- Puntaje social persistente, foto de perfil, grupos de amigos con
-- etiquetas y desafíos personalizados con plazo.
--
-- Reglas del desafío:
--   · Solo se puede retar a amigos. Máximo 10 desafíos enviados por día.
--   · El puntaje SOLO cambia si la persona acepta el desafío.
--     Rechazarlo o dejarlo vencer sin aceptar no tiene efecto.
--   · Aceptado y cumplido (confirmado por quien retó, o sin respuesta al
--     vencer el plazo): 5★ de quien retó.
--   · Aceptado y no cumplido a tiempo, o rechazado por quien retó: 1★.
--   · Las estrellas se aplican con el mismo algoritmo XTATS de la app.
-- =========================================================================

-- ---------- Perfil: puntaje social y foto ----------
alter table public.profiles
  add column if not exists score numeric(4, 2) not null default 4.10 check (score between 0.1 and 5),
  add column if not exists score_weight numeric(6, 1) not null default 12,
  add column if not exists avatar_url text check (char_length(avatar_url) <= 500);

-- Nadie puede escribirse el puntaje: solo se pueden tocar estas columnas
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, name, age_verified) on public.profiles to authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;

-- ---------- Motor XTATS en SQL (idéntico a calculateXtatsScore) ----------
create or replace function private.xtats_rate(p_user uuid, p_stars int, p_rater_score numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  cur numeric;
  w numeric;
  inf numeric;
  ns numeric;
begin
  select score, least(score_weight, 20) into cur, w from public.profiles where id = p_user for update;
  if cur is null then return null; end if;
  inf := case when p_rater_score >= 4.5 then 2.5
              when p_rater_score >= 3.5 then 1.2
              when p_rater_score >= 2.0 then 0.5
              else 0 end;
  if p_stars <= 2 then inf := inf * 1.5; end if;
  if inf = 0 then return cur; end if;
  ns := greatest(0.1, least(5.0, (cur * w + p_stars * inf) / (w + inf)));
  update public.profiles set score = round(ns, 2), score_weight = round(w + inf, 1) where id = p_user;
  return round(ns, 2);
end;
$$;
revoke all on function private.xtats_rate(uuid, int, numeric) from public, anon, authenticated;

-- ---------- Grupos de amigos (etiquetas privadas de cada persona) ----------
create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 24),
  created_at timestamptz not null default now(),
  unique (owner, name)
);
create table if not exists public.friend_group_members (
  group_id uuid not null references public.friend_groups on delete cascade,
  friend_id uuid not null references public.profiles on delete cascade,
  primary key (group_id, friend_id)
);
create index if not exists friend_groups_owner_idx on public.friend_groups (owner);
create index if not exists friend_group_members_friend_idx on public.friend_group_members (friend_id);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;

create or replace function private.owns_group(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friend_groups where id = gid and owner = auth.uid());
$$;

create policy "mis grupos: ver" on public.friend_groups for select to authenticated using (owner = (select auth.uid()));
create policy "mis grupos: crear" on public.friend_groups for insert to authenticated with check (owner = (select auth.uid()));
create policy "mis grupos: renombrar" on public.friend_groups for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "mis grupos: borrar" on public.friend_groups for delete to authenticated using (owner = (select auth.uid()));

create policy "miembros: ver" on public.friend_group_members for select to authenticated using (private.owns_group(group_id));
create policy "miembros: agregar amigo" on public.friend_group_members for insert to authenticated
  with check (private.owns_group(group_id) and private.is_friend(friend_id));
create policy "miembros: quitar" on public.friend_group_members for delete to authenticated using (private.owns_group(group_id));

-- ---------- Desafíos ----------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 80),
  details text check (char_length(details) <= 280),
  deadline timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.challenge_targets (
  challenge_id uuid not null references public.challenges on delete cascade,
  recipient uuid not null references public.profiles on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'claimed', 'completed', 'failed', 'expired')),
  score_before numeric(4, 2),
  score_after numeric(4, 2),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, recipient)
);
create index if not exists challenges_sender_idx on public.challenges (sender);
create index if not exists challenges_deadline_idx on public.challenges (deadline);
create index if not exists challenge_targets_recipient_idx on public.challenge_targets (recipient);

alter table public.challenges enable row level security;
alter table public.challenge_targets enable row level security;

-- Ayudantes sin RLS para evitar políticas recursivas entre ambas tablas
create or replace function private.is_challenge_sender(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges where id = cid and sender = auth.uid());
$$;
create or replace function private.is_challenge_recipient(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenge_targets where challenge_id = cid and recipient = auth.uid());
$$;

create policy "desafíos: enviados o recibidos" on public.challenges for select to authenticated
  using (sender = (select auth.uid()) or private.is_challenge_recipient(id));
create policy "destinatarios: los míos o de mis desafíos" on public.challenge_targets for select to authenticated
  using (recipient = (select auth.uid()) or private.is_challenge_sender(challenge_id));

grant usage on schema private to authenticated;
grant execute on function private.owns_group(uuid), private.is_challenge_sender(uuid), private.is_challenge_recipient(uuid) to authenticated;
revoke all on function private.owns_group(uuid), private.is_challenge_sender(uuid), private.is_challenge_recipient(uuid) from public, anon;

-- Crear un desafío para uno o varios amigos
create or replace function public.create_challenge(p_title text, p_details text, p_hours int, p_recipients uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  n int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_hours not in (1, 6, 24, 72, 168) then raise exception 'invalid_deadline'; end if;
  select count(distinct r) into n from unnest(p_recipients) r;
  if n < 1 or n > 20 then raise exception 'invalid_recipients'; end if;
  if exists (
    select 1 from unnest(p_recipients) r
    where r = uid or not exists (select 1 from public.friendships f where f.user_id = uid and f.friend_id = r)
  ) then raise exception 'not_friends'; end if;
  if (select count(*) from public.challenges where sender = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited';
  end if;
  insert into public.challenges (sender, title, details, deadline)
    values (uid, trim(p_title), nullif(trim(coalesce(p_details, '')), ''), now() + make_interval(hours => p_hours))
    returning id into cid;
  insert into public.challenge_targets (challenge_id, recipient)
    select distinct cid, r from unnest(p_recipients) r;
  return cid;
end;
$$;

-- La persona retada acepta o rechaza (rechazar no afecta su puntaje)
create or replace function public.respond_challenge(p_challenge uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.challenge_targets t set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now()
  from public.challenges c
  where t.challenge_id = p_challenge and c.id = t.challenge_id and t.recipient = auth.uid()
    and t.status = 'pending' and c.deadline > now();
  if not found then raise exception 'invalid_state'; end if;
end;
$$;

-- La persona retada avisa que lo cumplió (queda esperando confirmación)
create or replace function public.claim_challenge(p_challenge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.challenge_targets t set status = 'claimed', updated_at = now()
  from public.challenges c
  where t.challenge_id = p_challenge and c.id = t.challenge_id and t.recipient = auth.uid()
    and t.status = 'accepted' and c.deadline > now();
  if not found then raise exception 'invalid_state'; end if;
end;
$$;

-- Aplica el resultado: 5★ si se cumplió, 1★ si no, desde el puntaje de quien retó
create or replace function private.finish_target(p_challenge uuid, p_recipient uuid, p_success boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  rater numeric;
  before numeric;
  after numeric;
begin
  select p.score into rater from public.challenges c join public.profiles p on p.id = c.sender where c.id = p_challenge;
  select score into before from public.profiles where id = p_recipient;
  after := private.xtats_rate(p_recipient, case when p_success then 5 else 1 end, rater);
  update public.challenge_targets
    set status = case when p_success then 'completed' else 'failed' end, score_before = before, score_after = after, updated_at = now()
    where challenge_id = p_challenge and recipient = p_recipient;
end;
$$;
revoke all on function private.finish_target(uuid, uuid, boolean) from public, anon, authenticated;

-- Quien retó confirma o rechaza lo que la persona dice haber cumplido
create or replace function public.resolve_challenge(p_challenge uuid, p_recipient uuid, p_success boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.challenge_targets t join public.challenges c on c.id = t.challenge_id
    where t.challenge_id = p_challenge and t.recipient = p_recipient and c.sender = auth.uid() and t.status = 'claimed'
    for update of t
  ) then raise exception 'invalid_state'; end if;
  perform private.finish_target(p_challenge, p_recipient, p_success);
end;
$$;

-- Cierra los desafíos vencidos en los que participa quien llama
create or replace function public.settle_challenges()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  if auth.uid() is null then return 0; end if;
  for r in
    select t.challenge_id, t.recipient, t.status
    from public.challenge_targets t join public.challenges c on c.id = t.challenge_id
    where c.deadline <= now() and t.status in ('pending', 'accepted', 'claimed')
      and (c.sender = auth.uid() or t.recipient = auth.uid())
    order by c.deadline
    limit 100
    for update of t skip locked
  loop
    if r.status = 'pending' then
      update public.challenge_targets set status = 'expired', updated_at = now()
        where challenge_id = r.challenge_id and recipient = r.recipient;
    else
      -- aceptado sin cumplir: falla · avisado como cumplido sin revisión: se da por bueno
      perform private.finish_target(r.challenge_id, r.recipient, r.status = 'claimed');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.create_challenge(text, text, int, uuid[]) from public, anon;
revoke all on function public.respond_challenge(uuid, boolean) from public, anon;
revoke all on function public.claim_challenge(uuid) from public, anon;
revoke all on function public.resolve_challenge(uuid, uuid, boolean) from public, anon;
revoke all on function public.settle_challenges() from public, anon;
grant execute on function public.create_challenge(text, text, int, uuid[]) to authenticated;
grant execute on function public.respond_challenge(uuid, boolean) to authenticated;
grant execute on function public.claim_challenge(uuid) to authenticated;
grant execute on function public.resolve_challenge(uuid, uuid, boolean) to authenticated;
grant execute on function public.settle_challenges() to authenticated;

-- ---------- Fotos de perfil (Supabase Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatar: ver el mío" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar: subir el mío" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar: reemplazar el mío" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar: borrar el mío" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
