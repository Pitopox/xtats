-- =========================================================================
-- XTATS · migración 003
-- Retos con publicaciones, estrellas de quien retó y resultados compartidos.
--
-- Flujo nuevo:
--   1. La persona retada acepta (o rechaza: sin efecto).
--   2. Mientras corre el plazo sube publicaciones (texto y/o foto) al reto.
--   3. Al terminar el plazo, quien retó ve esas publicaciones y pone de 1 a 5★.
--      Las estrellas se aplican con el algoritmo XTATS (private.xtats_rate).
--   4. Si quien retó no califica en 3 días, el reto se cierra sin cambiar
--      el puntaje.
--   5. Ya calificado, la persona retada puede compartir el resultado con sus
--      amigos dentro de la app (y como imagen hacia afuera, desde el cliente).
--
-- Estados (se reutiliza el check existente):
--   pending · accepted · declined · completed (= calificado, ver `stars`)
--   expired (sin efecto: no se aceptó a tiempo, o aceptado y sin calificar;
--            se distinguen por accepted_at).
--   claimed / failed quedan sin uso.
-- =========================================================================

alter table public.challenge_targets
  add column if not exists accepted_at timestamptz,
  add column if not exists stars smallint check (stars between 1 and 5),
  add column if not exists rated_at timestamptz,
  add column if not exists shared_at timestamptz;

-- ---------- Ayudantes (por texto, para usarlos también con rutas de Storage) ----------
create or replace function private.challenge_closed_for_sender(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges where id = cid and sender = auth.uid() and deadline <= now());
$$;
create or replace function private.can_post(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.challenge_targets t join public.challenges c on c.id = t.challenge_id
    where c.id::text = cid and t.recipient = auth.uid() and t.status = 'accepted' and c.deadline > now()
  );
$$;
create or replace function private.sender_can_see(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenges where id::text = cid and sender = auth.uid() and deadline <= now());
$$;
revoke all on function private.challenge_closed_for_sender(uuid), private.can_post(text), private.sender_can_see(text) from public, anon;
grant execute on function private.challenge_closed_for_sender(uuid), private.can_post(text), private.sender_can_see(text) to authenticated;

-- ---------- Publicaciones del reto ----------
create table if not exists public.challenge_posts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null,
  author uuid not null,
  body text check (char_length(body) <= 280),
  photo_path text check (char_length(photo_path) <= 300),
  created_at timestamptz not null default now(),
  foreign key (challenge_id, author) references public.challenge_targets (challenge_id, recipient) on delete cascade,
  check (coalesce(char_length(trim(body)), 0) > 0 or photo_path is not null)
);
create index if not exists challenge_posts_challenge_idx on public.challenge_posts (challenge_id, author);
create index if not exists challenge_posts_author_idx on public.challenge_posts (author);
alter table public.challenge_posts enable row level security;

-- La autora siempre ve las suyas; quien retó las ve recién cuando termina el plazo
create policy "publicaciones: mías o de mi reto terminado" on public.challenge_posts for select to authenticated
  using (author = (select auth.uid()) or private.challenge_closed_for_sender(challenge_id));
create policy "publicaciones: borrar la mía mientras corre el plazo" on public.challenge_posts for delete to authenticated
  using (author = (select auth.uid()) and private.can_post(challenge_id::text));
-- Se crean solo con add_challenge_post (valida plazo, estado y límite)
revoke insert, update on public.challenge_posts from authenticated, anon;

create or replace function public.add_challenge_post(p_challenge uuid, p_body text, p_photo_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pid uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not private.can_post(p_challenge::text) then raise exception 'invalid_state'; end if;
  if p_photo_path is not null and p_photo_path not like p_challenge::text || '/' || uid::text || '/%' then
    raise exception 'invalid_photo';
  end if;
  if (select count(*) from public.challenge_posts where challenge_id = p_challenge and author = uid) >= 10 then
    raise exception 'too_many_posts';
  end if;
  insert into public.challenge_posts (challenge_id, author, body, photo_path)
    values (p_challenge, uid, nullif(trim(coalesce(p_body, '')), ''), p_photo_path)
    returning id into pid;
  return pid;
end;
$$;

-- ---------- Aceptar guarda la fecha (para distinguir "sin calificar") ----------
create or replace function public.respond_challenge(p_challenge uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.challenge_targets t
    set status = case when p_accept then 'accepted' else 'declined' end,
        accepted_at = case when p_accept then now() else null end,
        updated_at = now()
  from public.challenges c
  where t.challenge_id = p_challenge and c.id = t.challenge_id and t.recipient = auth.uid()
    and t.status = 'pending' and c.deadline > now();
  if not found then raise exception 'invalid_state'; end if;
end;
$$;

-- ---------- El flujo anterior (avisar / confirmar) queda desactivado ----------
create or replace function public.claim_challenge(p_challenge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'deprecated';
end;
$$;
create or replace function public.resolve_challenge(p_challenge uuid, p_recipient uuid, p_success boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  raise exception 'deprecated';
end;
$$;
revoke execute on function public.claim_challenge(uuid), public.resolve_challenge(uuid, uuid, boolean) from authenticated;

-- ---------- Quien retó pone las estrellas al terminar el plazo ----------
create or replace function public.rate_challenge(p_challenge uuid, p_recipient uuid, p_stars int)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  rater numeric;
  before numeric;
  after numeric;
begin
  if p_stars not between 1 and 5 then raise exception 'invalid_stars'; end if;
  perform 1 from public.challenge_targets t join public.challenges c on c.id = t.challenge_id
    where t.challenge_id = p_challenge and t.recipient = p_recipient and c.sender = auth.uid()
      and t.status = 'accepted' and c.deadline <= now() and c.deadline + interval '3 days' > now()
    for update of t;
  if not found then raise exception 'invalid_state'; end if;
  select score into rater from public.profiles where id = auth.uid();
  select score into before from public.profiles where id = p_recipient;
  after := private.xtats_rate(p_recipient, p_stars, rater);
  update public.challenge_targets
    set status = 'completed', stars = p_stars, rated_at = now(),
        score_before = before, score_after = after, updated_at = now()
    where challenge_id = p_challenge and recipient = p_recipient;
  return after;
end;
$$;

-- ---------- Cierre de vencidos: ya no hay estrellas automáticas ----------
create or replace function public.settle_challenges()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  m int := 0;
begin
  if auth.uid() is null then return 0; end if;
  -- sin aceptar a tiempo
  update public.challenge_targets t set status = 'expired', updated_at = now()
    from public.challenges c
    where c.id = t.challenge_id and t.status = 'pending' and c.deadline <= now()
      and (c.sender = auth.uid() or t.recipient = auth.uid());
  get diagnostics n = row_count;
  -- aceptados que quien retó no calificó en 3 días: sin efecto
  update public.challenge_targets t set status = 'expired', updated_at = now()
    from public.challenges c
    where c.id = t.challenge_id and t.status in ('accepted', 'claimed') and c.deadline + interval '3 days' <= now()
      and (c.sender = auth.uid() or t.recipient = auth.uid());
  get diagnostics m = row_count;
  return n + m;
end;
$$;

-- ---------- Compartir el resultado con amigos dentro de la app ----------
create or replace function public.share_challenge_result(p_challenge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.challenge_targets set shared_at = coalesce(shared_at, now())
    where challenge_id = p_challenge and recipient = auth.uid() and status = 'completed';
  if not found then raise exception 'invalid_state'; end if;
end;
$$;

-- Resultados compartidos por mí y por mis amigos (sin exponer ids ajenos)
create or replace function public.friend_shares()
returns table (
  challenge_id uuid, recipient uuid, recipient_name text, recipient_avatar text,
  sender_name text, title text, stars smallint, score_after numeric, shared_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select t.challenge_id, t.recipient, r.name, r.avatar_url, s.name, c.title, t.stars, t.score_after, t.shared_at
  from public.challenge_targets t
  join public.challenges c on c.id = t.challenge_id
  join public.profiles r on r.id = t.recipient
  join public.profiles s on s.id = c.sender
  where t.shared_at is not null and t.status = 'completed'
    and (t.recipient = auth.uid()
         or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = t.recipient))
  order by t.shared_at desc
  limit 30;
$$;

revoke all on function public.add_challenge_post(uuid, text, text) from public, anon;
revoke all on function public.rate_challenge(uuid, uuid, int) from public, anon;
revoke all on function public.share_challenge_result(uuid) from public, anon;
revoke all on function public.friend_shares() from public, anon;
grant execute on function public.add_challenge_post(uuid, text, text) to authenticated;
grant execute on function public.rate_challenge(uuid, uuid, int) to authenticated;
grant execute on function public.share_challenge_result(uuid) to authenticated;
grant execute on function public.friend_shares() to authenticated;

-- ---------- Fotos de las publicaciones (bucket privado, URLs firmadas) ----------
-- Ruta: <id del reto>/<id de la autora>/<archivo>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-posts', 'challenge-posts', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "reto foto: subir la mía mientras corre el plazo" on storage.objects for insert to authenticated
  with check (bucket_id = 'challenge-posts'
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and private.can_post((storage.foldername(name))[1]));
create policy "reto foto: ver la mía o la de mi reto terminado" on storage.objects for select to authenticated
  using (bucket_id = 'challenge-posts'
         and ((storage.foldername(name))[2] = (select auth.uid())::text
              or private.sender_can_see((storage.foldername(name))[1])));
create policy "reto foto: borrar la mía" on storage.objects for delete to authenticated
  using (bucket_id = 'challenge-posts' and (storage.foldername(name))[2] = (select auth.uid())::text);
