/**
 * XTATS · conexión con Supabase.
 * Si VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY no están definidas,
 * `remote.enabled` es false y la app funciona en modo demo (todo local).
 *
 * Tablas y funciones: supabase/schema.sql y supabase/migrations/*.sql
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

const AVATARS = ["👧🏻", "🧑🏽", "👩🏼", "🧑🏻", "👩🏽", "🧑🏾", "👱🏼", "🧑🏼"];
const GRADIENTS = ["from-pink-200 to-violet-100", "from-sky-100 to-pink-100", "from-amber-50 to-pink-200", "from-slate-200 to-pink-100", "from-rose-100 to-orange-50"];
const pickBy = (arr, id) => arr[[...id].reduce((a, c) => (a + c.charCodeAt(0)) % 997, 0) % arr.length];
const PROFILE_COLUMNS = "id, name, invite_code, score, avatar_url";

/** Lanza un error legible si Supabase respondió con error. */
function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Persona en el formato que usa la app (emoji de respaldo, foto y puntaje social). */
const toPerson = (p) => ({ id: p.id, name: p.name, avatar: pickBy(AVATARS, p.id), gradient: pickBy(GRADIENTS, p.id), photo: p.avatar_url || null, xscore: p.score != null ? Number(p.score) : null });

export const remote = {
  enabled: !!supabase,

  /* ---------- Sesión ---------- */
  async getSession() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onAuthChange(cb) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },
  /** provider: "google" | "facebook" (Meta). Redirige y vuelve a la app. */
  signIn(provider) {
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(check);
  },
  signOut() {
    return supabase.auth.signOut();
  },

  /* ---------- Perfil ---------- */
  async getProfile(userId) {
    return check(await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle());
  },
  async createProfile(userId, name) {
    return check(await supabase.from("profiles").insert({ id: userId, name, age_verified: true }).select(PROFILE_COLUMNS).single());
  },
  /** Sube la foto (JPEG ya recortado) y guarda su dirección pública en el perfil. */
  async uploadAvatar(userId, blob) {
    const path = `${userId}/avatar.jpg`;
    check(await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" }));
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    check(await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId));
    return avatarUrl;
  },
  async removeAvatar(userId) {
    await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
    check(await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId));
  },

  /* ---------- Amigos ---------- */
  async addFriend(code) {
    return check(await supabase.rpc("add_friend", { code }));
  },
  /** Amigos con sus récords, su reto del día, su foto y su puntaje social. */
  async loadFriends(userId, day) {
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
    const [records, daily] = await Promise.all([
      supabase.from("records").select("mode, ms").eq("user_id", userId).then(check),
      supabase.from("daily_results").select("score, grid").eq("user_id", userId).eq("day", day).maybeSingle().then(check),
    ]);
    return { records, daily };
  },

  /* ---------- Grupos de amigos (etiquetas) ---------- */
  async loadGroups() {
    const rows = check(await supabase.from("friend_groups").select("id, name, friend_group_members(friend_id)").order("created_at"));
    return rows.map((g) => ({ id: g.id, name: g.name, members: (g.friend_group_members ?? []).map((m) => m.friend_id) }));
  },
  async createGroup(userId, name) {
    return check(await supabase.from("friend_groups").insert({ owner: userId, name: name.trim() }).select("id").single());
  },
  async deleteGroup(groupId) {
    check(await supabase.from("friend_groups").delete().eq("id", groupId));
  },
  async setGroupMember(groupId, friendId, on) {
    if (on) {
      const { error } = await supabase.from("friend_group_members").insert({ group_id: groupId, friend_id: friendId });
      if (error && error.code !== "23505") throw error;
    } else {
      check(await supabase.from("friend_group_members").delete().eq("group_id", groupId).eq("friend_id", friendId));
    }
  },

  /* ---------- Desafíos ---------- */
  /** Cierra los vencidos y trae enviados y recibidos con las personas involucradas. */
  async loadChallenges(userId) {
    await supabase.rpc("settle_challenges");
    const challenges = check(await supabase.from("challenges").select("id, sender, title, details, deadline, created_at").order("created_at", { ascending: false }).limit(60));
    if (!challenges.length) return { received: [], sent: [], people: {} };
    const targets = check(
      await supabase
        .from("challenge_targets")
        .select("challenge_id, recipient, status, score_before, score_after, updated_at")
        .in("challenge_id", challenges.map((c) => c.id))
    );
    const ids = [...new Set([...challenges.map((c) => c.sender), ...targets.map((t) => t.recipient)])];
    const profiles = check(await supabase.from("profiles").select("id, name, score, avatar_url").in("id", ids));
    const people = Object.fromEntries(profiles.map((p) => [p.id, toPerson(p)]));
    const withTargets = (c) => ({ ...c, targets: targets.filter((t) => t.challenge_id === c.id) });
    return {
      received: challenges.filter((c) => c.sender !== userId).map((c) => ({ ...c, mine: targets.find((t) => t.challenge_id === c.id && t.recipient === userId) })).filter((c) => c.mine),
      sent: challenges.filter((c) => c.sender === userId).map(withTargets),
      people,
    };
  },
  async createChallenge(title, details, hours, recipients) {
    return check(await supabase.rpc("create_challenge", { p_title: title, p_details: details, p_hours: hours, p_recipients: recipients }));
  },
  async respondChallenge(challengeId, accept) {
    return check(await supabase.rpc("respond_challenge", { p_challenge: challengeId, p_accept: accept }));
  },
  async claimChallenge(challengeId) {
    return check(await supabase.rpc("claim_challenge", { p_challenge: challengeId }));
  },
  async resolveChallenge(challengeId, recipientId, success) {
    return check(await supabase.rpc("resolve_challenge", { p_challenge: challengeId, p_recipient: recipientId, p_success: success }));
  },

  /* ---------- Juego ---------- */
  async submitRecord(mode, ms) {
    return check(await supabase.rpc("submit_record", { p_mode: mode, p_ms: Math.round(ms) }));
  },
  async submitDaily(userId, day, score, grid) {
    const { error } = await supabase.from("daily_results").insert({ user_id: userId, day, score, grid });
    if (error && error.code !== "23505") throw error; // 23505 = ya estaba guardado
  },
  async report(userId, target, reason = "post") {
    return check(await supabase.from("reports").insert({ reporter: userId, target, reason }));
  },
};
