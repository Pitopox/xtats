/**
 * XTATS · conexión con Supabase.
 * Si VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY no están definidas,
 * `remote.enabled` es false y la app funciona en modo demo (todo local).
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

const AVATARS = ["👧🏻", "🧑🏽", "👩🏼", "🧑🏻", "👩🏽", "🧑🏾", "👱🏼", "🧑🏼"];
const GRADIENTS = ["from-pink-200 to-violet-100", "from-sky-100 to-pink-100", "from-amber-50 to-pink-200", "from-slate-200 to-pink-100", "from-rose-100 to-orange-50"];
const pickBy = (arr, id) => arr[[...id].reduce((a, c) => (a + c.charCodeAt(0)) % 997, 0) % arr.length];

/** Lanza un error legible si Supabase respondió con error. */
function check({ data, error }) {
  if (error) throw error;
  return data;
}

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
    return check(await supabase.from("profiles").select("id, name, invite_code").eq("id", userId).maybeSingle());
  },
  async createProfile(userId, name) {
    return check(await supabase.from("profiles").upsert({ id: userId, name, age_verified: true }).select("id, name, invite_code").single());
  },

  /* ---------- Amigos ---------- */
  async addFriend(code) {
    return check(await supabase.rpc("add_friend", { code }));
  },
  /** Amigos con sus récords y su reto del día, en el formato que usa la app. */
  async loadFriends(userId, day) {
    const links = check(await supabase.from("friendships").select("friend_id").eq("user_id", userId));
    const ids = links.map((l) => l.friend_id);
    if (!ids.length) return [];
    const [profiles, records, dailies] = await Promise.all([
      supabase.from("profiles").select("id, name").in("id", ids).then(check),
      supabase.from("records").select("user_id, mode, ms").in("user_id", ids).then(check),
      supabase.from("daily_results").select("user_id, score").eq("day", day).in("user_id", ids).then(check),
    ]);
    return profiles.map((p) => {
      const rec = { speedrun: null, climb: null, survival: null };
      records.filter((r) => r.user_id === p.id).forEach((r) => (rec[r.mode] = r.ms));
      const d = dailies.find((x) => x.user_id === p.id);
      return { id: p.id, name: p.name, avatar: pickBy(AVATARS, p.id), gradient: pickBy(GRADIENTS, p.id), records: rec, score: d ? Number(d.score) : null };
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
