import { getBytes } from "@/lib/r2";
import { previewImageKey } from "@/lib/sharePreview";

/** A shared photo link's preview picture. Public, at a random token, and only while its photo may still be shown. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const file = (await params).file;
  const key = file.endsWith(".jpg") ? await previewImageKey(file.slice(0, -4)) : null;
  if (!key) return new Response("Not found", { status: 404 });
  const body = await getBytes(key).catch(() => null);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
