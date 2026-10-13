/**
 * XTATS · conexión con Supabase.
 * Si VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY no están definidas,
 * `remote.enabled` es false y la app funciona en modo demo (todo local).
 *
 * Tablas y funciones: supabase/schema.sql y supabase/migrations/*.sql
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const enabled = !!(url && key);

/**
 * El cliente de Supabase (~60 KB comprimido) se carga aparte y solo cuando hace falta,
 * así la app se dibuja sin esperarlo. En modo demo nunca se descarga.
 */
let clientPromise = null;
const db = () => (clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(url, key)));

const AVATARS = ["👧🏻", "🧑🏽", "👩🏼", "🧑🏻", "👩🏽", "🧑🏾", "👱🏼", "🧑🏼"];
const GRADIENTS = ["from-pink-200 to-violet-100", "from-sky-100 to-pink-100", "from-amber-50 to-pink-200", "from-slate-200 to-pink-100", "from-rose-100 to-orange-50"];
const pickBy = (arr, id) => arr[[...id].reduce((a, c) => (a + c.charCodeAt(0)) % 997, 0) % arr.length];
const PROFILE_COLUMNS = "id, name, invite_code, score, avatar_url";
const SIGNED_TTL_S = 3600;
/** Caché de URLs firmadas: ruta → { url, until } (se renuevan 5 min antes de vencer). */
const signedUrls = new Map();

/** Lanza un error legible si Supabase respondió con error. */
function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Persona en el formato que usa la app (emoji de respaldo, foto y puntaje social). */
const toPerson = (p) => ({ id: p.id, name: p.name, avatar: pickBy(AVATARS, p.id), gradient: pickBy(GRADIENTS, p.id), photo: p.avatar_url || null, xscore: p.score != null ? Number(p.score) : null });

export const remote = {
  enabled,

  /* ---------- Sesión ---------- */
  async getSession() {
    if (!enabled) return null;
    const supabase = await db();
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onAuthChange(cb) {
    if (!enabled) return () => {};
    let unsubscribe = () => {};
    let active = true;
    db().then((supabase) => {
      if (!active) return;
      const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  },
  /** provider: "google" | "facebook" (Meta). Redirige y vuelve a la app. */
  async signIn(provider) {
    const supabase = await db();
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(check);
  },
  async signOut() {
    signedUrls.clear();
    const supabase = await db();
    return supabase.auth.signOut();
  },

  /* ---------- Perfil ---------- */
  async getProfile(userId) {
    const supabase = await db();
    return check(await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle());
  },
  async createProfile(userId, name) {
    const supabase = await db();
    return check(await supabase.from("profiles").insert({ id: userId, name, age_verified: true }).select(PROFILE_COLUMNS).single());
  },
  /** Sube la foto (JPEG ya recortado) y guarda su dirección pública en el perfil. */
  async uploadAvatar(userId, blob) {
    const supabase = await db();
    const path = `${userId}/avatar.jpg`;
    check(await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" }));
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    check(await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId));
    return avatarUrl;
  },
  async removeAvatar(userId) {
    const supabase = await db();
    await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
    check(await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId));
  },

  /* ---------- Amigos ---------- */
  async addFriend(code) {
    const supabase = await db();
    const friendId = check(await supabase.rpc("add_friend", { code }));
    if (!friendId) throw new Error("invalid_code"); // desde la migración 004 un código inválido devuelve null
    return friendId;
  },
  /** Amigos con sus récords, su reto del día, su foto y su puntaje social. */
  async loadFriends(userId, day) {
    const supabase = await db();
    const links = check(await supabase.from("friendships").select("friend_id").eq("user_id", userId));
    const ids = links.map((l) => l.friend_id);
    if (!ids.length) return [];
    const [profiles, records, dailies] = await Promise.all([
      supabase.from("profiles").select("id, name, score, avatar_url").in("id", ids).then(check),
      supabase.from("records").select("user_id, mode, ms").in("user_id", ids).then(check),
      supabase.from("daily_results").select("user_id, score").eq("day", day).in("user_id", ids).then(check),
    ]);
    return profiles.map((p) => {
      const rec = { speedrun: null, climb: null, survival: null };
      records.filter((r) => r.user_id === p.id).forEach((r) => (rec[r.mode] = r.ms));
      const d = dailies.find((x) => x.user_id === p.id);
      return { ...toPerson(p), records: rec, score: d ? Number(d.score) : null };
    });
  },

  /** Mis propios récords y mi reto del día guardados en el servidor. */
  async loadMine(userId, day) {
    const supabase = await db();
    const [records, daily] = await Promise.all([
      supabase.from("records").select("mode, ms").eq("user_id", userId).then(check),
      supabase.from("daily_results").select("score, grid").eq("user_id", userId).eq("day", day).maybeSingle().then(check),
    ]);
    return { records, daily };
  },

  /* ---------- Grupos de amigos (etiquetas) ---------- */
  async loadGroups() {
    const supabase = await db();
    const rows = check(await supabase.from("friend_groups").select("id, name, friend_group_members(friend_id)").order("created_at"));
    return rows.map((g) => ({ id: g.id, name: g.name, members: (g.friend_group_members ?? []).map((m) => m.friend_id) }));
  },
  async createGroup(userId, name) {
    const supabase = await db();
    return check(await supabase.from("friend_groups").insert({ owner: userId, name: name.trim() }).select("id").single());
  },
  async deleteGroup(groupId) {
    const supabase = await db();
    check(await supabase.from("friend_groups").delete().eq("id", groupId));
  },
  async setGroupMember(groupId, friendId, on) {
    const supabase = await db();
    if (on) {
      const { error } = await supabase.from("friend_group_members").insert({ group_id: groupId, friend_id: friendId });
      if (error && error.code !== "23505") throw error;
    } else {
      check(await supabase.from("friend_group_members").delete().eq("group_id", groupId).eq("friend_id", friendId));
    }
  },

  /* ---------- Desafíos ---------- */
  /**
   * Cierra los vencidos y trae enviados y recibidos, con las personas y las
   * publicaciones que puedo ver (las mías siempre; las de mis retos, al terminar el plazo).
   */
  async loadChallenges(userId) {
    const supabase = await db();
    await supabase.rpc("settle_challenges");
    const challenges = check(await supabase.from("challenges").select("id, sender, title, details, deadline, created_at").order("created_at", { ascending: false }).limit(60));
    if (!challenges.length) return { received: [], sent: [], people: {} };
    const ids = challenges.map((c) => c.id);
    const [targets, posts] = await Promise.all([
      supabase.from("challenge_targets").select("challenge_id, recipient, status, accepted_at, stars, rated_at, shared_at, score_before, score_after, updated_at").in("challenge_id", ids).then(check),
      supabase.from("challenge_posts").select("id, challenge_id, author, body, photo_path, created_at").in("challenge_id", ids).order("created_at").then(check),
    ]);
    // Fotos en bucket privado: URLs firmadas por 1 hora. Se reutilizan entre refrescos
    // para que las imágenes no se vuelvan a descargar (ni parpadeen) cada 30 s.
    const now = Date.now();
    const missing = [...new Set(posts.filter((p) => p.photo_path).map((p) => p.photo_path))].filter((path) => !(signedUrls.get(path)?.until > now));
    if (missing.length) {
      const { data } = await supabase.storage.from("challenge-posts").createSignedUrls(missing, SIGNED_TTL_S);
      (data ?? []).forEach((d) => d.signedUrl && signedUrls.set(d.path, { url: d.signedUrl, until: now + (SIGNED_TTL_S - 300) * 1000 }));
    }
    const postsOf = (cid, author) => posts.filter((p) => p.challenge_id === cid && p.author === author).map((p) => ({ ...p, photo: p.photo_path ? signedUrls.get(p.photo_path)?.url ?? null : null }));
    const pids = [...new Set([...challenges.map((c) => c.sender), ...targets.map((t) => t.recipient)])];
    const profiles = check(await supabase.from("profiles").select("id, name, score, avatar_url").in("id", pids));
    const people = Object.fromEntries(profiles.map((p) => [p.id, toPerson(p)]));
    return {
      received: challenges
        .filter((c) => c.sender !== userId)
        .map((c) => {
          const mine = targets.find((t) => t.challenge_id === c.id && t.recipient === userId);
          return mine && { ...c, mine: { ...mine, posts: postsOf(c.id, userId) } };
        })
        .filter(Boolean),
      sent: challenges
        .filter((c) => c.sender === userId)
        .map((c) => ({ ...c, targets: targets.filter((t) => t.challenge_id === c.id).map((t) => ({ ...t, posts: postsOf(c.id, t.recipient) })) })),
      people,
    };
  },
  async createChallenge(title, details, hours, recipients) {
    const supabase = await db();
    return check(await supabase.rpc("create_challenge", { p_title: title, p_details: details, p_hours: hours, p_recipients: recipients }));
  },
  async respondChallenge(challengeId, accept) {
    const supabase = await db();
    return check(await supabase.rpc("respond_challenge", { p_challenge: challengeId, p_accept: accept }));
  },
  /** Publicación de prueba para el reto: texto y/o foto (JPEG ya comprimido). */
  async addChallengePost(challengeId, userId, body, blob) {
    const supabase = await db();
    let path = null;
    if (blob) {
      path = `${challengeId}/${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
      check(await supabase.storage.from("challenge-posts").upload(path, blob, { contentType: "image/jpeg" }));
    }
    try {
      return check(await supabase.rpc("add_challenge_post", { p_challenge: challengeId, p_body: body || null, p_photo_path: path }));
    } catch (err) {
      if (path) await supabase.storage.from("challenge-posts").remove([path]);
      throw err;
    }
  },
  async deleteChallengePost(post) {
    const supabase = await db();
    check(await supabase.from("challenge_posts").delete().eq("id", post.id));
    if (post.photo_path) {
      signedUrls.delete(post.photo_path);
      await supabase.storage.from("challenge-posts").remove([post.photo_path]);
    }
  },
  /** Quien retó pone de 1 a 5 estrellas cuando terminó el plazo. Devuelve el nuevo puntaje. */
  async rateChallenge(challengeId, recipientId, stars) {
    const supabase = await db();
    return check(await supabase.rpc("rate_challenge", { p_challenge: challengeId, p_recipient: recipientId, p_stars: stars }));
  },
  async shareChallenge(challengeId) {
    const supabase = await db();
    return check(await supabase.rpc("share_challenge_result", { p_challenge: challengeId }));
  },
  /** Resultados compartidos por mí y mis amigos. */
  async loadShares() {
    const supabase = await db();
    const rows = check(await supabase.rpc("friend_shares"));
    return rows.map((r) => ({ ...r, person: toPerson({ id: r.recipient, name: r.recipient_name, avatar_url: r.recipient_avatar, score: r.score_after }) }));
  },

  /* ---------- Juego ---------- */
  async submitRecord(mode, ms) {
    const supabase = await db();
    return check(await supabase.rpc("submit_record", { p_mode: mode, p_ms: Math.round(ms) }));
  },
  async submitDaily(userId, day, score, grid) {
    const supabase = await db();
    const { error } = await supabase.from("daily_results").insert({ user_id: userId, day, score, grid });
    if (error && error.code !== "23505") throw error; // 23505 = ya estaba guardado
  },
  async report(userId, target, reason = "post") {
    const supabase = await db();
    return check(await supabase.from("reports").insert({ reporter: userId, target, reason }));
  },
};
