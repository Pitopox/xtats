/** Amigos: grupo, récords, reto de hoy y bloqueados. Con sesión usa Supabase; sin ella, datos de demo. */
import { useMemo, useState } from "react";
import { remote } from "../backend.js";
import { INITIAL_ME, INITIAL_USERS, LOWER_IS_BETTER, RECORD_MODES } from "../game/config.js";
import { cx, dateKey, fmtTime } from "../game/engine.js";
import { demo } from "../game/state.js";
import { GroupsSection } from "./challenges.jsx";
import { Avatar, ProviderButton, S, ScorePill, useApp } from "./common.jsx";

export function FriendsTab({ state, dispatch }) {
  const { t, track, pushToast, userId, cloud, reloadCloud, login, logout, myPhoto } = useApp();
  const [mode, setMode] = useState("speedrun");
  const [code, setCode] = useState("");
  const live = !!userId;
  const key = dateKey();
  const myDaily = state.daily[key];
  const demoToday = useMemo(() => demo.getFriendsDaily(key), [key]);
  const friends = live ? cloud.friends : demo.getFriends();
  const today = live ? cloud.friends.filter((f) => f.score != null) : demoToday;
  const inviteCode = live ? cloud.profile?.invite_code ?? "…" : state.inviteCode;

  const rows = [...friends.map((f) => ({ ...f, value: f.records[mode] })), { id: "me", name: t.friends.you, avatar: "⭐", gradient: "from-pink-200 to-rose-100", photo: myPhoto, value: state.records[mode], me: true }].sort((a, b) => {
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return LOWER_IS_BETTER[mode] ? a.value - b.value : b.value - a.value;
  });

  const copyInvite = () => {
    navigator.clipboard
      ?.writeText(t.friends.inviteText(inviteCode))
      .then(() => {
        track("invites");
        pushToast("toast", "copied", "good");
      })
      .catch(() => pushToast("toast", "copyFailed", "danger"));
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      await remote.addFriend(code.trim());
      setCode("");
      pushToast("toast", "friendAdded", "good");
      reloadCloud();
    } catch {
      pushToast("toast", "friendFailed", "danger");
    }
  };

  return (
    <div className="space-y-4">
      <section className={cx(S.card, "space-y-3 p-4")}>
        <p className={S.label}>{t.friends.group}</p>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50/60 px-4 py-3">
          <div>
            <p className="text-[10px] text-slate-400">{t.friends.code}</p>
            <p className="select-all font-mono text-lg tracking-widest text-slate-700">{inviteCode}</p>
          </div>
          <button onClick={copyInvite} className="rounded-full bg-pink-300 px-3 py-1.5 text-xs font-medium text-white">
            {t.friends.copyInvite}
          </button>
        </div>
        {live ? (
          <>
            <form onSubmit={addFriend} className="flex gap-2">
              <label htmlFor="xt-friend-code" className="sr-only">
                {t.friends.addLabel}
              </label>
              <input id="xt-friend-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t.friends.addPh} className={cx(S.field, "min-w-0 flex-1 px-3 py-2 font-mono")} />
              <button type="submit" disabled={!code.trim()} className={cx(S.btn, S.btnPrimary, "w-auto px-4 py-2")}>
                {t.friends.add}
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{t.friends.connectedAs(cloud.profile?.name ?? "…")}</span>
              <button onClick={logout} className="text-pink-400 hover:text-pink-600">
                {t.friends.signOut}
              </button>
            </div>
          </>
        ) : remote.enabled ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t.friends.connect}</p>
            <div className="grid grid-cols-2 gap-2">
              <ProviderButton provider="google" label="Google" compact onClick={() => login("google", state.profile?.name ?? INITIAL_ME.name)} />
              <ProviderButton provider="facebook" label="Facebook" compact onClick={() => login("facebook", state.profile?.name ?? INITIAL_ME.name)} />
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400">{t.friends.demo}</p>
        )}
      </section>

      {live && <GroupsSection friends={friends} />}

      <section className={cx(S.card, "space-y-3 p-4")}>
        <p className={S.label}>{t.friends.leaderboard}</p>
        <div className="flex flex-wrap gap-1.5" role="group">
          {RECORD_MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cx(S.seg, mode === m ? "bg-pink-300 text-white" : "bg-rose-50 text-slate-500")}>
              {t.modes[m].name}
            </button>
          ))}
        </div>
        {live && friends.length === 0 && <p className={S.muted}>{t.friends.empty}</p>}
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-1.5", r.me ? "bg-pink-50 ring-1 ring-pink-200" : "")}>
              <span className="w-4 text-xs tabular-nums text-slate-400">{r.value == null ? "–" : i + 1}</span>
              <Avatar person={r} size="h-7 w-7 text-sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{r.name}</span>
              <span className="font-mono text-xs tabular-nums text-slate-500">{fmtTime(r.value)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cx(S.card, "space-y-2 p-4")}>
        <p className={S.label}>{t.friends.today}</p>
        {!myDaily?.done && <p className={S.muted}>{t.friends.notPlayed}</p>}
        <ul className="space-y-1.5">
          {[...today, ...(myDaily?.done ? [{ id: "me", name: t.friends.you, avatar: "⭐", gradient: "from-pink-200 to-rose-100", photo: myPhoto, score: myDaily.score, me: true }] : [])]
            .sort((a, b) => b.score - a.score)
            .map((f) => (
              <li key={f.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-1.5", f.me ? "bg-pink-50 ring-1 ring-pink-200" : "")}>
                <Avatar person={f} size="h-7 w-7 text-sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{f.name}</span>
                <ScorePill score={f.score} />
              </li>
            ))}
        </ul>
      </section>

      <section className={cx(S.card, "space-y-2 p-4")}>
        <p className={S.label}>{t.friends.blocked}</p>
        {state.blocked.length === 0 ? (
          <p className={S.muted}>{t.friends.noneBlocked}</p>
        ) : (
          <ul className="space-y-1.5">
            {state.blocked.map((id) => {
              const u = state.users[id] ?? INITIAL_USERS[id];
              if (!u) return null;
              return (
                <li key={id} className="flex items-center gap-3">
                  <Avatar person={u} size="h-7 w-7 text-sm" />
                  <span className="flex-1 text-sm text-slate-500">{u.name}</span>
                  <button onClick={() => dispatch({ type: "UNBLOCK", userId: id })} className="text-xs text-pink-400 hover:text-pink-600">
                    {t.friends.unblock}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
