import { randomBytes } from "crypto";
import { q } from "./db";
import { getBytes, putBytes } from "./r2";

/**
 * Shared photo link previews. Link preview bots (iMessage, WhatsApp, Slack) can't sign in, so a signed-out visit to
 * /photos/:id gets a public stand-in with just the preview tags, and the picture is a resized copy of that one photo
 * at an unguessable URL. Nothing else about the photo (names, dates, captions, comments) is ever public.
 */
const SETTING = "share_photo_previews";
const LONG_EDGE = 1200;

/** On unless Mary turned it off. */
export async function previewsOn() {
  const [row] = await q<{ value: string | null }>(`select value from settings where key = $1`, [SETTING]).catch(() => []);
  return row?.value !== "0";
}

export async function setPreviewsOn(on: boolean) {
  await q(`insert into settings (key, value, updated_at) values ($1, $2, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`, [SETTING, on ? "1" : "0"]);
}

/**
 * A photo that may show in a preview: still on the site, hidden from no one, and with no removal request waiting
 * for Mary. Anything else gets the generic card.
 */
async function eligible(id: number) {
  const [row] = await q<{ ok: boolean }>(
    `select (p.deleted_at is null
        and not exists (select 1 from photo_hidden h where h.photo_id = p.id)
        and not exists (select 1 from photo_removal_requests r where r.photo_id = p.id and r.status = 'pending')) as ok
     from photos p where p.id = $1`, [id]).catch(() => []);
  return !!row?.ok;
}

export type Preview = { token: string; width: number; height: number };

/** The preview picture for a photo, made (and kept) the first time its link is opened signed out. Null: generic card. */
export async function photoPreview(id: number): Promise<Preview | null> {
  if (!Number.isInteger(id) || !(await previewsOn()) || !(await eligible(id))) return null;
  const [have] = await q<Preview>(`select token, width, height from share_previews where photo_id = $1`, [id]);
  if (have) return have;
  const [photo] = await q<{ original_key: string; thumb_key: string }>(`select original_key, thumb_key from photos where id = $1`, [id]);
  if (!photo) return null;
  try {
    const sharp = (await import("sharp")).default;
    let out: { data: Buffer; info: { width: number; height: number } } | null = null;
    // The original first; the thumbnail if the original can't be read here (an iPhone HEIC original, say).
    for (const key of [photo.original_key, photo.thumb_key]) {
      try {
        out = await sharp(await getBytes(key)).rotate()
          .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
        break;
      } catch { /* try the next */ }
    }
    if (!out) return null;
    const token = randomBytes(18).toString("base64url");
    const key = `previews/${token}.jpg`;
    await putBytes(key, out.data, "image/jpeg");
    await q(`insert into share_previews (photo_id, token, image_key, width, height) values ($1, $2, $3, $4, $5)
      on conflict (photo_id) do nothing`, [id, token, key, out.info.width, out.info.height]);
    // Two first visits at once: both keep whichever was saved first.
    const [row] = await q<Preview>(`select token, width, height from share_previews where photo_id = $1`, [id]);
    return row ?? null;
  } catch {
    return null;
  }
}

/** The stored preview picture for a token, only while its photo may still be shown. */
export async function previewImageKey(token: string) {
  if (!/^[\w-]{20,40}$/.test(token) || !(await previewsOn())) return null;
  const [row] = await q<{ photo_id: number; image_key: string }>(`select photo_id, image_key from share_previews where token = $1`, [token]);
  if (!row || !(await eligible(row.photo_id))) return null;
  return row.image_key;
}
