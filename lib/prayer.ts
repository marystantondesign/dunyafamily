import { canRemove } from "./auth";
import { q } from "./db";
import { today } from "./home";
import { displayName } from "./names";
import { signGet } from "./r2";
import type { Session } from "./session";

export type Praying = { name: string; avatarUrl: string | null; me: boolean };
export type PrayerView = {
  id: number;
  forPerson: { id: number; name: string; avatarUrl: string | null } | null;
  forName: string | null;
  about: string; howToPray: string | null;
  from: string; createdAt: string;
  answeredAt: string | null; answerUpdate: string | null;
  praying: Praying[]; mine: boolean; canEdit: boolean;
};
export type Remembering = { personId: number; name: string; avatarUrl: string | null; pronoun: "her" | "him" | "them"; praying: Praying[]; mine: boolean };

const ANSWERED_SHOWN = 5;

type PrayRow = { prayer_request_id: number | null; remembrance_person_id: number | null; person_id: number | null; device: string | null; name: string | null; person_name: string | null; thumb_key: string | null };

/** Everyone praying, with "you" first. */
async function prayingList(rows: PrayRow[], s: Session | null): Promise<{ praying: Praying[]; mine: boolean }> {
  const isMe = (r: PrayRow) => (r.person_id != null && r.person_id === s?.pid) || (r.person_id == null && !!s && r.device === s.did);
  const praying = await Promise.all(rows.map(async (r) => ({
    name: displayName(r.person_name ?? r.name ?? "Someone"),
    avatarUrl: r.thumb_key ? await signGet(r.thumb_key) : null,
    me: isMe(r),
  })));
  praying.sort((a, b) => Number(b.me) - Number(a.me));
  return { praying, mine: praying.some((p) => p.me) };
}

const PRAY_SQL = `select pp.prayer_request_id, pp.remembrance_person_id, pp.person_id, pp.device, pp.name, pe.name as person_name, ph.thumb_key
  from prayer_praying pp
  left join people pe on pe.id = pp.person_id and pe.deleted_at is null
  left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null`;

/** The prayer requests page: who to remember today, requests people are praying for now, and answered ones. */
export async function prayerPage(s: Session | null, allAnswered = false) {
  const t = today();
  const [requests, praying, remember] = await Promise.all([
    q<{ id: number; for_person_id: number | null; for_name: string | null; about: string; how_to_pray: string | null; posted_by_device: string | null;
      posted_by_name: string | null; poster_name: string | null; created_at: string; answered_at: string | null; answer_update: string | null;
      fp_name: string | null; fp_thumb: string | null }>(
      `select r.id, r.for_person_id, r.for_name, r.about, r.how_to_pray, r.posted_by_device, r.posted_by_name, po.name as poster_name,
              r.created_at, r.answered_at, r.answer_update, fp.name as fp_name, fph.thumb_key as fp_thumb
         from prayer_requests r
         left join people po on po.id = r.posted_by_person_id and po.deleted_at is null
         left join people fp on fp.id = r.for_person_id and fp.deleted_at is null
         left join photos fph on fph.id = fp.avatar_photo_id and fph.deleted_at is null
        where r.deleted_at is null
        order by coalesce(r.answered_at, r.created_at) desc, r.id desc`),
    q<PrayRow>(`${PRAY_SQL} where pp.prayer_request_id is not null or (pp.remembrance_year = $1) order by pp.created_at`, [t.year]),
    q<{ id: number; name: string; gender: string | null; thumb_key: string | null }>(
      `select distinct on (pe.id) pe.id, pe.name, pe.gender, ph.thumb_key
         from person_dates d join people pe on pe.id = d.person_id and pe.deleted_at is null
         left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
        where d.kind = 'remembrance' and d.deleted_at is null and d.month = $1 and d.day = $2
        order by pe.id`, [t.month, t.day]),
  ]);

  const views: PrayerView[] = await Promise.all(requests.map(async (r) => ({
    id: r.id,
    forPerson: r.for_person_id && r.fp_name ? { id: r.for_person_id, name: displayName(r.fp_name), avatarUrl: r.fp_thumb ? await signGet(r.fp_thumb) : null } : null,
    forName: r.for_person_id && r.fp_name ? null : r.for_name,
    about: r.about, howToPray: r.how_to_pray,
    from: displayName(r.poster_name ?? r.posted_by_name ?? "Someone"), createdAt: r.created_at,
    answeredAt: r.answered_at, answerUpdate: r.answer_update,
    ...(await prayingList(praying.filter((p) => p.prayer_request_id === r.id), s)),
    canEdit: canRemove(s, r.posted_by_device),
  })));
  const answered = views.filter((v) => v.answeredAt);
  const remembering: Remembering[] = await Promise.all(remember.map(async (p) => ({
    personId: p.id, name: displayName(p.name), avatarUrl: p.thumb_key ? await signGet(p.thumb_key) : null,
    pronoun: p.gender === "female" ? "her" as const : p.gender === "male" ? "him" as const : "them" as const,
    ...(await prayingList(praying.filter((x) => x.remembrance_person_id === p.id), s)),
  })));
  return {
    remembering,
    active: views.filter((v) => !v.answeredAt),
    answered: allAnswered ? answered : answered.slice(0, ANSWERED_SHOWN),
    moreAnswered: allAnswered ? 0 : Math.max(0, answered.length - ANSWERED_SHOWN),
  };
}

export type PrayerInput = { forPersonId?: number | null; forName?: string | null; about?: string; howToPray?: string | null };

/** Check and tidy what was typed. Returns the fields to save, or what's wrong. */
async function clean(input: PrayerInput): Promise<{ forPersonId: number | null; forName: string | null; about: string; howToPray: string | null } | string> {
  const about = (input.about ?? "").trim().slice(0, 2000);
  if (!about) return "Say what's going on.";
  const howToPray = (input.howToPray ?? "").trim().slice(0, 2000) || null;
  let forPersonId = Number(input.forPersonId) || null;
  const forName = forPersonId ? null : (input.forName ?? "").trim().slice(0, 120) || null;
  if (forPersonId) {
    const [p] = await q(`select 1 from people where id = $1 and deleted_at is null`, [forPersonId]);
    if (!p) forPersonId = null;
  }
  return { forPersonId, forName, about, howToPray };
}

export async function addRequest(input: PrayerInput, s: Session): Promise<number | string> {
  const c = await clean(input);
  if (typeof c === "string") return c;
  const [row] = await q<{ id: number }>(
    `insert into prayer_requests (for_person_id, for_name, about, how_to_pray, posted_by_person_id, posted_by_device, posted_by_name)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`, [c.forPersonId, c.forName, c.about, c.howToPray, s.pid ?? null, s.did, s.name]);
  return row.id;
}

/** A request the poster (or the admin) may change. */
export async function editable(id: number, s: Session) {
  const [r] = await q<{ posted_by_device: string | null }>(`select posted_by_device from prayer_requests where id = $1 and deleted_at is null`, [id]);
  if (!r) return "missing" as const;
  return canRemove(s, r.posted_by_device) ? ("ok" as const) : ("forbidden" as const);
}

export async function editRequest(id: number, input: PrayerInput): Promise<string | null> {
  const c = await clean(input);
  if (typeof c === "string") return c;
  await q(`update prayer_requests set for_person_id = $2, for_name = $3, about = $4, how_to_pray = $5 where id = $1`, [id, c.forPersonId, c.forName, c.about, c.howToPray]);
  return null;
}

export async function setAnswered(id: number, answered: boolean, update?: string | null) {
  if (answered) await q(`update prayer_requests set answered_at = now(), answer_update = $2 where id = $1`, [id, (update ?? "").trim().slice(0, 2000) || null]);
  // Undoing keeps the update text, in case it's marked answered again.
  else await q(`update prayer_requests set answered_at = null where id = $1`, [id]);
}

export async function removeRequest(id: number, s: Session) {
  await q(`update prayer_requests set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s.name]);
}

/** I'm praying, or take it back. For a request, or for remembering someone today. */
export async function togglePraying(target: { requestId: number } | { rememberId: number }, s: Session) {
  const t = today();
  const [req, rem, year] = "requestId" in target ? [target.requestId, null, null] : [null, target.rememberId, t.year];
  const who = s.pid ? `person_id = $4` : `person_id is null and device = $4`;
  const gone = await q(
    `delete from prayer_praying where prayer_request_id is not distinct from $1 and remembrance_person_id is not distinct from $2
       and remembrance_year is not distinct from $3 and ${who} returning 1`, [req, rem, year, s.pid ?? s.did]);
  if (gone.length) return false;
  await q(`insert into prayer_praying (prayer_request_id, remembrance_person_id, remembrance_year, person_id, device, name) values ($1, $2, $3, $4, $5, $6) on conflict do nothing`,
    [req, rem, year, s.pid ?? null, s.did, s.name]);
  return true;
}

/** Is today this person's day of remembrance? Praying for them only counts then. */
export async function rememberedToday(personId: number) {
  const t = today();
  const [d] = await q(`select 1 from person_dates d join people pe on pe.id = d.person_id and pe.deleted_at is null
    where d.person_id = $1 and d.kind = 'remembrance' and d.deleted_at is null and d.month = $2 and d.day = $3`, [personId, t.month, t.day]);
  return !!d;
}
