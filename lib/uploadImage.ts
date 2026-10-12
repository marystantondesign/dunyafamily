"use client";

const MAX = 2000;

/** Shrink a photo to a JPEG no bigger than 2000px on a side. iPhone photos (HEIC) are converted too. */
async function toJpeg(file: File): Promise<Blob> {
  let src: Blob = file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(src, { imageOrientation: "from-image" });
  } catch {
    const { heicTo } = await import("heic-to");
    src = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    bitmap = await createImageBitmap(src, { imageOrientation: "from-image" });
  }
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that photo."))), "image/jpeg", 0.88));
}

/** Upload one photo straight to storage, the same way photos are added. Returns its storage key. */
export async function uploadImage(file: File): Promise<string> {
  let body: Blob;
  try { body = await toJpeg(file); } catch { throw new Error("This browser can't read that file type. Try saving it as JPEG."); }
  const res = await fetch("/api/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: [{ type: "image/jpeg" }] }) });
  if (!res.ok) throw new Error("The photo didn't upload. Try again.");
  const [s] = (await res.json()) as { originalKey: string; originalUrl: string }[];
  const put = await fetch(s.originalUrl, { method: "PUT", body, headers: { "Content-Type": "image/jpeg" } });
  if (!put.ok) throw new Error("The photo didn't upload. Try again.");
  return s.originalKey;
}
