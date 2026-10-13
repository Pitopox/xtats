-- =========================================================================
-- XTATS · migración 004 · endurecimiento
--
-- 1. add_friend: máximo 20 intentos por hora. Los códigos de invitación
--    tienen 5 caracteres hexadecimales (~1 millón de combinaciones), así que
--    sin límite alguien podría probar códigos al azar hasta "hacerse amigo"
--    de desconocidos y ver su perfil, récords y foto.
-- 2. avatar_url: solo puede apuntar a la foto propia del bucket "avatars".
--    Antes aceptaba cualquier URL, que tus amigos cargaban al ver tu perfil.
--
-- add_friend ahora devuelve null si el código no existe (la app lo trata como error).
-- No borra datos. Se puede ejecutar más de una vez.
-- =========================================================================

-- ---------- 1. Límite de intentos para agregar amigos ----------
create table if not exists private.friend_attempts (
  user_id uuid not null references auth.users on delete cascade,
  at timestamptz not null default now()
);
create index if not exists friend_attempts_user_at_idx on private.friend_attempts (user_id, at);
revoke all on private.friend_attempts from public, anon, authenticated;

create or replace function public.add_friend(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  -- Cuenta todos los intentos, válidos o no, de la última hora
  delete from private.friend_attempts where user_id = auth.uid() and at < now() - interval '1 hour';
  if (select count(*) from private.friend_attempts where user_id = auth.uid()) >= 20 then
    raise exception 'rate_limited';
  end if;
  insert into private.friend_attempts (user_id) values (auth.uid());

  select id into fid from public.profiles where invite_code = upper(trim(code));
  -- Código inválido: devuelve null en vez de lanzar un error, porque un error
  -- desharía también el registro del intento y el límite no contaría los fallos.
  if fid is null or fid = auth.uid() then return null; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), fid) on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (fid, auth.uid()) on conflict do nothing;
  return fid;
end;
$$;
revoke all on function public.add_friend(text) from public, anon;
grant execute on function public.add_friend(text) to authenticated;

-- ---------- 2. La foto de perfil solo puede ser la propia ----------
alter table public.profiles drop constraint if exists profiles_avatar_url_own;
alter table public.profiles add constraint profiles_avatar_url_own check (
  avatar_url is null
  or avatar_url like '%/storage/v1/object/public/avatars/' || id::text || '/avatar.jpg%'
) not valid;
