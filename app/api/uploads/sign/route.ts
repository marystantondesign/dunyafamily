import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { signPut } from "@/lib/r2";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/gif": "gif" };

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const { files } = (await req.json()) as { files: { type: string }[] };
  if (!Array.isArray(files) || files.length === 0 || files.length > 300) return badRequest("Choose between 1 and 300 photos.");

  const out = await Promise.all(
    files.map(async (f) => {
      const type = EXT[f.type] ? f.type : "image/jpeg";
      const id = crypto.randomUUID();
      const originalKey = `originals/${id}.${EXT[type]}`;
      const thumbKey = `thumbs/${id}.jpg`;
      return {
        originalKey,
        thumbKey,
        contentType: type,
        originalUrl: await signPut(originalKey, type),
        thumbUrl: await signPut(thumbKey, "image/jpeg"),
      };
    }),
  );
  return NextResponse.json(out);
}
