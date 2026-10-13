/** Retos entre amigos y grupos. */
import { useEffect, useRef, useState } from "react";
import { remote } from "../backend.js";
import { DARE_HOURS } from "../game/config.js";
import { cx, fmt } from "../game/engine.js";
import { I18N } from "../i18n.js";
import { fileToJpegBlob, fmtLeft } from "../lib/cards.js";
import { Avatar, ProviderButton, S, Sheet, StarRating, useApp } from "./common.jsx";

/* ---------- Retos personalizados ---------- */
export const STATUS_TONE = {
  pending: "bg-amber-50 text-amber-600",
  accepted: "bg-pink-100 text-pink-600",
  awaiting: "bg-sky-100 text-sky-700",
  rate: "bg-pink-300 text-white",
  rated: "bg-pink-300 text-white",
  declined: "bg-slate-100 text-slate-400",
  expired: "bg-slate-100 text-slate-400",
  unrated: "bg-slate-100 text-slate-500",
};
export const UNKNOWN_PERSON = { name: "…", avatar: "?", gradient: "from-slate-100 to-slate-200" };
export const RATE_WINDOW_MS = 3 * 24 * 3600000;

/** Estado visible de un destinatario según su estado guardado y el plazo. */
export function dareState(target, deadline, asSender) {
  const ended = new Date(deadline).getTime() <= Date.now();
  switch (target.status) {
    case "pending":
      return ended ? "expired" : "pending";
    case "accepted":
    case "claimed":
      return ended ? (asSender ? "rate" : "awaiting") : "accepted";
    case "completed":
      return target.stars ? "rated" : "awaiting";
    case "expired":
      return target.accepted_at ? "unrated" : "expired";
    default:
      return "declined";
  }
}

export function TimeLeft({ deadline }) {
  const { t } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(deadline).getTime() - now;
  return <span className={cx("text-[11px] tabular-nums", ms > 0 && ms < 3600000 ? "text-rose-500" : "text-slate-400")}>{ms <= 0 ? t.challenges.ended : t.challenges.left(fmtLeft(ms))}</span>;
}

/** Estrellas fijas (solo lectura). */
export function StarsShown({ n, size = "text-lg" }) {
  const { t } = useApp();
  return (
    <span className={cx("tracking-tight", size)} role="img" aria-label={t.challenges.starsAria(n)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "text-pink-400" : "text-slate-200"}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Lista de publicaciones del reto (texto y foto). */
export function DarePosts({ posts, canDelete, onDelete }) {
  const { t, lang } = useApp();
  if (!posts?.length) return <p className="text-[11px] text-slate-400">{t.challenges.noPosts}</p>;
  return (
    <ul className="space-y-2">
      {posts.map((p) => (
        <li key={p.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
          {p.photo && <img src={p.photo} alt="" loading="lazy" className="max-h-72 w-full bg-slate-50 object-cover" />}
          {(p.body || canDelete) && (
            <div className="flex items-start gap-2 px-3 py-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-slate-600">{p.body}</p>
              {canDelete && (
                <button onClick={() => onDelete(p)} className="shrink-0 text-[11px] text-slate-400 hover:text-rose-500">
                  {t.challenges.actions.delete}
                </button>
              )}
            </div>
          )}
          <p className="px-3 pb-2 text-[10px] text-slate-400">{new Date(p.created_at).toLocaleString(I18N[lang].locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        </li>
      ))}
    </ul>
  );
}

/** Formulario para publicar una prueba: texto y/o foto. */
export function DareComposer({ challengeId, onPost }) {
  const { t } = useApp();
  const C = t.challenges;
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await fileToJpegBlob(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      /* imagen no válida */
    }
  };
  const ready = (body.trim() || photo) && !busy;
  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    const ok = await onPost(challengeId, body.trim(), photo?.blob ?? null);
    setBusy(false);
    if (ok) {
      setBody("");
      setPhoto(null);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl bg-rose-50/40 p-2">
      <textarea value={body} maxLength={280} rows={2} onChange={(e) => setBody(e.target.value)} placeholder={C.postPh} className={cx(S.field, "resize-none p-3")} />
      {photo && (
        <div className="relative">
          <img src={photo.url} alt="" className="max-h-56 w-full rounded-2xl object-cover" />
          <button type="button" onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] text-slate-600 shadow">
            {C.actions.removePhoto}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
        <button type="button" onClick={() => fileRef.current?.click()} className={cx(S.btn, S.btnGhost, "w-auto px-4 py-2")}>
          📷 {C.actions.addPhoto}
        </button>
        <button type="submit" disabled={!ready} className={cx(S.btn, S.btnPrimary, "py-2")}>
          {busy ? "…" : C.actions.post}
        </button>
      </div>
    </form>
  );
}

export function ReceivedCard({ c, sender = UNKNOWN_PERSON, onAction, onPost, onDeletePost, onShare }) {
  const { t } = useApp();
  const C = t.challenges;
  const mine = c.mine;
  const st = dareState(mine, c.deadline, false);
  return (
    <article className={cx(S.card, "space-y-3 p-4")}>
      <header className="flex items-start gap-3">
        <Avatar person={sender} size="h-9 w-9 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-slate-400">
            {C.from(sender.name)}
            {sender.xscore != null && ` · ★ ${fmt(sender.xscore)}`}
          </p>
          <h3 className="break-words text-sm font-semibold text-slate-700">{c.title}</h3>
        </div>
        <span className={cx(S.pill, "shrink-0", STATUS_TONE[st])}>{C.status[st]}</span>
      </header>
      {c.details && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{c.details}</p>}
      {st !== "rated" && <TimeLeft deadline={c.deadline} />}

      {st === "pending" && (
        <>
          <p className="text-[11px] text-slate-400">{C.acceptHint}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onAction("accept", c.id)} className={cx(S.btn, S.btnPrimary, "py-2")}>
              {C.actions.accept}
            </button>
            <button onClick={() => onAction("decline", c.id)} className={cx(S.btn, S.btnGhost, "py-2")}>
              {C.actions.decline}
            </button>
          </div>
        </>
      )}

      {st === "accepted" && (
        <div className="space-y-2">
          <p className={S.label}>{C.postsLabel}</p>
          {mine.posts.length > 0 && <DarePosts posts={mine.posts} canDelete onDelete={onDeletePost} />}
          {mine.posts.length < 10 && <DareComposer challengeId={c.id} onPost={onPost} />}
          <p className="text-[11px] text-slate-400">{C.postHint(sender.name)}</p>
        </div>
      )}

      {st === "awaiting" && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">{C.awaitingHint(sender.name)}</p>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer select-none">{C.postsCount(mine.posts.length)}</summary>
            <div className="pt-2">
              <DarePosts posts={mine.posts} />
            </div>
          </details>
        </div>
      )}

      {st === "rated" && (
        <div className="space-y-3 rounded-2xl bg-rose-50/50 p-3 text-center">
          <p className="text-[11px] text-slate-500">{C.ratedBy(sender.name)}</p>
          <StarsShown n={mine.stars} size="text-3xl" />
          {mine.score_after != null && (
            <p className="text-sm tabular-nums text-slate-600">
              XTATS {fmt(mine.score_before)} → <span className="font-semibold text-pink-500">{fmt(mine.score_after)}</span>
            </p>
          )}
          <button onClick={() => onShare(c, sender)} className={cx(S.btn, S.btnPrimary, "py-2")}>
            ⇪ {C.actions.share}
          </button>
          {mine.shared_at && <p className="text-[11px] text-slate-400">✓ {C.sharedInApp}</p>}
        </div>
      )}

      {st === "unrated" && <p className="text-[11px] text-slate-400">{C.unratedHint}</p>}
    </article>
  );
}

/** Calificación de una persona retada: ve sus publicaciones y elige de 1 a 5★. */
export function RateTarget({ c, tg, person, onRate }) {
  const { t } = useApp();
  const C = t.challenges;
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);
  const left = new Date(c.deadline).getTime() + RATE_WINDOW_MS - Date.now();
  const send = async () => {
    setBusy(true);
    await onRate(c.id, tg.recipient, stars);
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <p className={S.label}>{C.postsOf(person.name)}</p>
      <DarePosts posts={tg.posts} />
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-pink-100">
        <StarRating value={stars} onRate={setStars} disabled={busy} />
        <button onClick={send} disabled={!stars || busy} className={cx(S.btn, S.btnPrimary, "py-2")}>
          {busy ? "…" : C.actions.rate}
        </button>
        {left > 0 && <p className="text-center text-[10px] text-slate-400">{C.rateWindow(fmtLeft(left))}</p>}
      </div>
    </div>
  );
}

export function SentCard({ c, people, onRate }) {
  const { t } = useApp();
  const C = t.challenges;
  return (
    <article className={cx(S.card, "space-y-3 p-4")}>
      <header className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-sm font-semibold text-slate-700">{c.title}</h3>
        <TimeLeft deadline={c.deadline} />
      </header>
      {c.details && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{c.details}</p>}
      <ul className="space-y-2">
        {c.targets.map((tg) => {
          const p = people[tg.recipient] ?? UNKNOWN_PERSON;
          const st = dareState(tg, c.deadline, true);
          return (
            <li key={tg.recipient} className="space-y-2 rounded-2xl bg-rose-50/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Avatar person={p} size="h-7 w-7 text-sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{p.name}</span>
                <span className={cx(S.pill, "shrink-0", STATUS_TONE[st])}>{C.status[st]}</span>
              </div>
              {st === "accepted" && <p className="text-[11px] text-slate-400">{C.hiddenUntilEnd}</p>}
              {st === "rate" && <RateTarget c={c} tg={tg} person={p} onRate={onRate} />}
              {st === "rated" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      {C.youGave} <StarsShown n={tg.stars} size="text-sm" />
                    </span>
                    {tg.score_after != null && (
                      <span className="text-[11px] tabular-nums text-slate-400">
                        ★ {fmt(tg.score_before)} → {fmt(tg.score_after)}
                      </span>
                    )}
                  </div>
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer select-none">{C.postsCount(tg.posts.length)}</summary>
                    <div className="pt-2">
                      <DarePosts posts={tg.posts} />
                    </div>
                  </details>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** Formulario de nuevo reto: título, detalles, plazo y destinatarios (amigos o grupos). */
export function NewChallengeSheet({ myName, onClose, onSent }) {
  const { t, cloud, pushToast } = useApp();
  const C = t.challenges;
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [hours, setHours] = useState(24);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const friends = cloud.friends;
  const groups = (cloud.groups ?? []).map((g) => ({ ...g, members: g.members.filter((id) => friends.some((f) => f.id === id)) }));
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const toggleGroup = (g) => {
    const all = g.members.length > 0 && g.members.every((id) => sel.includes(id));
    setSel((x) => (all ? x.filter((y) => !g.members.includes(y)) : [...new Set([...x, ...g.members])]));
  };
  const ready = title.trim().length >= 3 && sel.length > 0 && !busy;
  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await remote.createChallenge(title.trim(), details.trim(), hours, sel);
      pushToast("toast", "dareSent", "good");
      onSent();
    } catch (err) {
      pushToast("toast", String(err?.message ?? "").includes("rate_limited") ? "dareLimit" : "dareFailed", "danger");
    } finally {
      setBusy(false);
    }
  };
  const chip = (on) => cx("flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs ring-1 transition", on ? "bg-pink-300 text-white ring-pink-300" : "bg-white text-slate-500 ring-slate-200 hover:ring-pink-200");
  return (
    <Sheet title={C.new} onClose={onClose} z="z-[58]">
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1">
          <span className={S.label}>{C.form.title}</span>
          <input id="xt-dare-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={C.form.titlePh} className={cx(S.field, "px-4 py-3")} />
        </label>
        <label className="block space-y-1">
          <span className={S.label}>{C.form.details}</span>
          <textarea id="xt-dare-details" value={details} maxLength={280} rows={2} onChange={(e) => setDetails(e.target.value)} placeholder={C.form.detailsPh} className={cx(S.field, "resize-none p-3")} />
        </label>
        <div className="space-y-1.5">
          <p className={S.label}>{C.form.deadline}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={C.form.deadline}>
            {DARE_HOURS.map((h) => (
              <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={cx(S.seg, hours === h ? "bg-pink-300 text-white" : "bg-rose-50 text-slate-500")}>
                {C.hours[h]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className={S.label}>{C.form.to}</p>
            <span className={S.muted}>{C.form.selected(sel.length)}</span>
          </div>
          {groups.length > 0 && (
            <>
              <p className="text-[11px] text-slate-400">{C.form.groups}</p>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const on = g.members.length > 0 && g.members.every((id) => sel.includes(id));
                  return (
                    <button key={g.id} type="button" aria-pressed={on} disabled={!g.members.length} onClick={() => toggleGroup(g)} className={cx(chip(on), "pl-3 disabled:opacity-40")}>
                      #{g.name} · {g.members.length}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-[11px] text-slate-400">{C.form.friends}</p>
          <div className="flex flex-wrap gap-1.5">
            {friends.map((f) => {
              const on = sel.includes(f.id);
              return (
                <button key={f.id} type="button" aria-pressed={on} onClick={() => toggle(f.id)} className={chip(on)}>
                  <Avatar person={f} size="h-5 w-5 text-[10px]" />
                  {f.name}
                  {f.xscore != null && <span className="opacity-70">★{fmt(f.xscore, 1)}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <p className="rounded-2xl bg-rose-50/60 p-3 text-xs leading-relaxed text-slate-500">{C.form.stakes(myName)}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className={cx(S.btn, S.btnGhost)}>
            {C.form.cancel}
          </button>
          <button type="submit" disabled={!ready} className={cx(S.btn, S.btnPrimary)}>
            {busy ? "…" : C.form.send}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** Pestaña Retos: puntaje social, recibidos y enviados. */
export function ChallengesTab({ data, shares, myName, onNew, onAction, onPost, onDeletePost, onRate, onShare }) {
  const { t, userId, cloud, login } = useApp();
  const C = t.challenges;
  if (!userId) {
    return (
      <section className={cx(S.card, "space-y-3 p-5 text-center")}>
        <p className="text-3xl text-pink-400">⚑</p>
        <h2 className="text-base font-medium text-slate-700">{C.title}</h2>
        <p className="text-sm text-slate-500">{C.intro}</p>
        <p className={S.muted}>{remote.enabled ? C.needLogin : C.demo}</p>
        {remote.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <ProviderButton provider="google" label="Google" compact onClick={() => login("google", myName)} />
            <ProviderButton provider="facebook" label="Facebook" compact onClick={() => login("facebook", myName)} />
          </div>
        )}
      </section>
    );
  }
  const score = cloud.profile?.score;
  const hasFriends = cloud.friends.length > 0;
  return (
    <div className="space-y-4">
      <section className={cx(S.card, "space-y-2 p-5")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={S.label}>{t.social.label}</p>
            <p className="text-5xl font-extralight tabular-nums text-pink-400">{score != null ? fmt(score) : "—"}</p>
          </div>
          <button onClick={onNew} disabled={!hasFriends} className={cx(S.btn, S.btnPrimary, "w-auto px-5")}>
            {C.new}
          </button>
        </div>
        <p className="text-xs text-slate-500">{t.social.hint}</p>
        <p className="text-xs text-slate-400">{hasFriends ? C.intro : C.needFriends}</p>
      </section>

      <section className="space-y-2">
        <p className={cx(S.label, "px-1")}>{C.feed}</p>
        {shares.length === 0 ? (
          <p className={cx(S.muted, "px-1")}>{C.feedEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((r) => (
              <li key={`${r.challenge_id}-${r.recipient}`} className={cx(S.card, "flex items-center gap-3 p-3")}>
                <Avatar person={r.person} size="h-10 w-10 text-base" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{r.recipient_name}</p>
                  <p className="truncate text-[11px] text-slate-400">{C.feedLine(r.sender_name, r.title)}</p>
                  <StarsShown n={r.stars} size="text-base" />
                </div>
                {r.score_after != null && <span className="shrink-0 text-lg font-light tabular-nums text-pink-500">{fmt(r.score_after)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <p className={cx(S.label, "px-1")}>{C.received}</p>
        {data.received.length === 0 ? <p className={cx(S.muted, "px-1")}>{C.emptyReceived}</p> : data.received.map((c) => <ReceivedCard key={c.id} c={c} sender={data.people[c.sender]} onAction={onAction} onPost={onPost} onDeletePost={onDeletePost} onShare={onShare} />)}
      </section>

      <section className="space-y-3">
        <p className={cx(S.label, "px-1")}>{C.sent}</p>
        {data.sent.length === 0 ? <p className={cx(S.muted, "px-1")}>{C.emptySent}</p> : data.sent.map((c) => <SentCard key={c.id} c={c} people={data.people} onRate={onRate} />)}
      </section>
    </div>
  );
}

/** Grupos de amigos con etiquetas (solo con sesión). */
export function GroupsSection({ friends }) {
  const { t, cloud, userId, reloadCloud, pushToast } = useApp();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const groups = cloud.groups ?? [];
  const fail = () => pushToast("toast", "groupFailed", "danger");
  const create = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      const g = await remote.createGroup(userId, n);
      setName("");
      setOpen(g.id);
      await reloadCloud();
    } catch {
      fail();
    }
  };
  const toggle = async (g, fid) => {
    try {
      await remote.setGroupMember(g.id, fid, !g.members.includes(fid));
      await reloadCloud();
    } catch {
      fail();
    }
  };
  const remove = async (g) => {
    if (confirm !== g.id) return setConfirm(g.id);
    try {
      await remote.deleteGroup(g.id);
      setConfirm(null);
      await reloadCloud();
    } catch {
      fail();
    }
  };
  return (
    <section className={cx(S.card, "space-y-3 p-4")}>
      <p className={S.label}>{t.groups.label}</p>
      <p className={S.muted}>{t.groups.desc}</p>
      {friends.length === 0 ? (
        <p className={S.muted}>{t.groups.needFriends}</p>
      ) : (
        <>
          <form onSubmit={create} className="flex gap-2">
            <label htmlFor="xt-group-name" className="sr-only">
              {t.groups.newPh}
            </label>
            <input id="xt-group-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t.groups.newPh} className={cx(S.field, "min-w-0 flex-1 px-3 py-2")} />
            <button type="submit" disabled={!name.trim()} className={cx(S.btn, S.btnPrimary, "w-auto px-4 py-2")}>
              {t.groups.create}
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {t.groups.suggestions
              .filter((sg) => !groups.some((g) => g.name.toLowerCase() === sg.toLowerCase()))
              .map((sg) => (
                <button key={sg} type="button" onClick={() => setName(sg)} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-pink-100 hover:text-pink-500">
                  #{sg}
                </button>
              ))}
          </div>
          {groups.length === 0 && <p className={S.muted}>{t.groups.empty}</p>}
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="rounded-2xl bg-rose-50/50 p-3 ring-1 ring-pink-100">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} className="min-w-0 flex-1 text-left">
                    <span className="text-sm font-medium text-slate-700">#{g.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{t.groups.members(g.members.length)}</span>
                  </button>
                  <div className="flex -space-x-2">
                    {g.members.slice(0, 4).map((id) => {
                      const f = friends.find((x) => x.id === id);
                      return f ? <Avatar key={id} person={f} size="h-6 w-6 text-[10px]" /> : null;
                    })}
                  </div>
                  <button type="button" onClick={() => remove(g)} className={cx("text-xs", confirm === g.id ? "font-semibold text-rose-500" : "text-slate-400 hover:text-rose-500")}>
                    {confirm === g.id ? t.groups.confirmRemove : t.groups.remove}
                  </button>
                </div>
                {open === g.id && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {friends.map((f) => {
                      const on = g.members.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(g, f.id)}
                          className={cx("flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs ring-1 transition", on ? "bg-pink-300 text-white ring-pink-300" : "bg-white text-slate-500 ring-slate-200")}
                        >
                          <Avatar person={f} size="h-5 w-5 text-[10px]" />
                          {f.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
