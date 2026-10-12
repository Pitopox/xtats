/** Configuración del juego y datos de demostración. */
/* =========================================================================
   1. CONFIGURACIÓN
   ========================================================================= */
export const STORAGE_KEY = "xtats-v4";
export const LANG_KEY = "xtats-lang";
export const METRICS_KEY = "xtats-metrics";
export const PENDING_KEY = "xtats-pending-name"; // nombre elegido antes de ir a Google/Meta
export const SKIN_KEY = "xtats-skin";
export const DARE_HOURS = [1, 6, 24, 72, 168];
export const MAX_LOG = 20;
export const HISTORY_MAX = 40;
export const SOCIAL_MEMORY = 20;
export const MIN_AGE = 13;

export const T = { elite: 4.5, warning: 3.0, expensive: 2.5, locked: 1.5, prison: 0.1 };
export const CASCADE_MS = { normal: 1300, locked: 900 };
export const ANXIETY = { clicks: 8, windowMs: 1500, cooldownMs: 3000, penalty: 0.05 };

/** Reglas de cada modo de juego. */
export const MODES = {
  free: { start: 4.1, cascadeAt: 3.0, paranoia: [8000, 16000] },
  speedrun: { start: 4.1, cascadeAt: 3.0, paranoia: [8000, 16000] },
  climb: { start: 4.1, cascadeAt: 3.0, paranoia: [5000, 9000], limitMs: 120000 },
  survival: { start: 4.0, cascadeAt: 3.6, paranoia: [2500, 5000], harsh: true },
};
export const MODE_ORDER = ["free", "speedrun", "climb", "survival"];
export const RECORD_MODES = ["speedrun", "climb", "survival"];
export const LOWER_IS_BETTER = { speedrun: true, climb: true, survival: false };
export const MODE_ICON = { free: "🌸", speedrun: "⏱️", climb: "🥂", survival: "🧠" };

/**
 * Reto diario: lo que provoca cada opción. Alineado por índice con
 * I18N[lang].daily.scenarios. [estrellas recibidas, nivel de quien te califica]
 */
export const RATER_TIER = { vip: 4.8, mid: 3.8, avg: 2.5 };
export const DAILY_EFFECTS = [
  [[[5, "vip"], [4, "mid"], [1, "vip"]], [[5, "vip"], [2, "mid"], [3, "avg"]], [[5, "vip"], [3, "mid"], [1, "vip"]]],
  [[[5, "vip"], [3, "mid"], [1, "vip"]], [[4, "mid"], [1, "vip"], [3, "avg"]], [[5, "vip"], [2, "mid"], [1, "vip"]]],
  [[[4, "mid"], [2, "mid"], [1, "vip"]], [[5, "vip"], [3, "mid"], [3, "avg"]], [[4, "vip"], [3, "mid"], [2, "avg"]]],
  [[[4, "vip"], [2, "vip"], [1, "vip"]], [[5, "vip"], [1, "vip"], [4, "mid"]], [[5, "vip"], [3, "mid"], [2, "vip"]]],
  [[[3, "avg"], [4, "vip"], [2, "mid"]], [[3, "mid"], [4, "vip"], [3, "mid"]], [[5, "vip"], [1, "vip"], [3, "avg"]]],
];

/* =========================================================================
   2. DATOS MOCK
   ========================================================================= */
export const INITIAL_ME = { name: "Alex", handle: "@alex", avatar: "🧑🏼", gradient: "from-pink-200 to-rose-100", score: 4.1, weight: 12, votes: 312 };

export const person = (id, name, avatar, gradient, score) => ({ id, name, avatar, gradient, score, weight: 12, votes: 0 });
export const INITIAL_USERS = {
  valentina: person("valentina", "Valentina Ríos", "👩🏼", "from-pink-200 to-amber-50", 4.8),
  marta: person("marta", "Marta Vidal", "👩🏻", "from-violet-100 to-pink-200", 4.7),
  diego: person("diego", "Diego Ferraz", "🧔🏻", "from-sky-100 to-pink-100", 4.4),
  jules: person("jules", "Jules Carter", "👩🏽", "from-rose-100 to-orange-50", 3.9),
  nico: person("nico", "Nico Bauer", "🧑🏼", "from-slate-200 to-pink-100", 3.1),
  omar: person("omar", "Omar Haddad", "👨🏻", "from-slate-200 to-slate-100", 2.6),
  rosa: person("rosa", "Rosa Medina", "👵🏼", "from-stone-200 to-slate-100", 1.4),
};

export const POSTS = [
  { id: "p1", userId: "valentina", emoji: "☕", gradient: "from-amber-50 to-pink-100" },
  { id: "p2", userId: "marta", emoji: "🥐", gradient: "from-orange-50 to-rose-100" },
  { id: "p3", userId: "diego", emoji: "🏡", gradient: "from-sky-50 to-pink-100" },
  { id: "p4", userId: "jules", emoji: "🌷", gradient: "from-pink-50 to-violet-100" },
  { id: "p5", userId: "nico", emoji: "🍺", gradient: "from-slate-100 to-amber-50" },
  { id: "p6", userId: "omar", emoji: "💼", gradient: "from-slate-100 to-slate-200" },
  { id: "p7", userId: "rosa", emoji: "📵", gradient: "from-stone-100 to-sky-50" },
];

export const VIP_BOTS = [
  { key: "aspirational", score: 4.9 },
  { key: "influencer", score: 4.8 },
  { key: "committee", score: 4.7 },
  { key: "corporate", score: 4.6 },
];
export const RESENTFUL_BOTS = [
  { key: "resentful", score: 4.1 },
  { key: "classmate", score: 3.9 },
  { key: "envious", score: 3.7 },
  { key: "troll", score: 4.4 },
];
export const SYSTEM = { key: "system", score: 5 };
export const STRANGERS = ["airport", "cornerBarista", "rental", "coworker", "driver", "elevator"];

export const PARANOIA = [
  { key: "boss" },
  { key: "whisper" },
  { key: "office" },
  { key: "ex" },
  { key: "valentina" },
  { key: "stranger", rating: { rater: { key: "stranger", score: 3.8 }, stars: 2, reason: "uncharismatic" } },
  { key: "barista", rating: { rater: { key: "barista", score: 3.6 }, stars: 3, reason: "forcedSmile" } },
  { key: "neighbor", rating: { rater: { key: "neighbor", score: 4.1 }, stars: 5, reason: "greeting" } },
];

export const SERVICES = [
  { id: "cafe", icon: "☕", price: 4.5 },
  { id: "car", icon: "🚗", price: 85, restrictBelow: T.expensive },
  { id: "flight", icon: "✈️", price: 320, restrictBelow: T.warning },
  { id: "pearl", icon: "🏝️", price: 2400, eliteOnly: true },
];

/** Amigos simulados (se reemplazan por los reales al conectar el servidor). */
export const FRIENDS = [
  { id: "sofi", name: "Sofi", avatar: "👧🏻", gradient: "from-pink-200 to-violet-100", records: { speedrun: 38200, climb: 71400, survival: 64800 } },
  { id: "mati", name: "Mati", avatar: "🧑🏽", gradient: "from-sky-100 to-pink-100", records: { speedrun: 29500, climb: null, survival: 92300 } },
  { id: "vale", name: "Vale", avatar: "👩🏼", gradient: "from-amber-50 to-pink-200", records: { speedrun: 51700, climb: 58900, survival: 47100 } },
  { id: "tomi", name: "Tomi", avatar: "🧑🏻", gradient: "from-slate-200 to-pink-100", records: { speedrun: 44100, climb: 96200, survival: 121000 } },
  { id: "cami", name: "Cami", avatar: "👩🏽", gradient: "from-rose-100 to-orange-50", records: { speedrun: null, climb: 63300, survival: 38600 } },
];

export const HAPPY_WORDS = new Set([
  "feliz", "felices", "increible", "gracias", "amor", "genial", "perfecto", "perfecta", "maravilloso", "hermoso", "hermosa", "bendecida", "bendecido", "agradecida", "agradecido", "alegria",
  "happy", "amazing", "thanks", "thank", "grateful", "love", "blessed", "beautiful", "perfect", "wonderful", "awesome", "joy",
  "obrigada", "obrigado", "abencoada", "abencoado", "maravilhoso", "lindo", "linda", "incrivel", "amo", "gratidao", "perfeita", "alegria",
]);
export const NEGATIVE_WORDS = new Set([
  "odio", "sistema", "cansado", "cansada", "feo", "fea", "triste", "asco", "horrible", "injusto", "harta", "harto", "basura", "mentira",
  "hate", "system", "tired", "ugly", "sad", "disgusting", "unfair", "sick", "trash", "lie", "lies",
  "odeio", "cansei", "feio", "feia", "nojo", "horrivel", "injusto", "lixo", "mentira", "raiva",
]);
/** Moderación: insultos que se ocultan con puntos antes de publicar. */
export const INSULTS = new Set([
  "idiota", "estupido", "estupida", "imbecil", "tarado", "tarada", "pendejo", "pendeja", "weon", "weona", "huevon", "boludo", "boluda", "perdedor", "perdedora",
  "idiot", "stupid", "loser", "dumb", "moron", "freak",
  "burro", "burra", "otario", "otaria", "babaca", "trouxa",
]);
