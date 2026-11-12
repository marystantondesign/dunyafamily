import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;
function s3() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
      // Newer SDKs sign a checksum into presigned URLs. For a PUT that is the checksum of an empty body,
      // so R2 rejects the real upload. Only add checksums when an operation requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}
const Bucket = () => process.env.R2_BUCKET ?? "";

/** Short-lived read link. The bucket itself is never public. With `downloadAs`, the browser saves the file instead of showing it. */
export function signGet(key: string, expiresIn = 60 * 60, downloadAs?: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: Bucket(), Key: key, ...(downloadAs ? { ResponseContentDisposition: `attachment; filename="${downloadAs}"` } : {}) }),
    { expiresIn },
  );
}

/** Reads a whole object (a photo original, for making its link preview copy). */
export async function getBytes(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: Bucket(), Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

/** Writes an object from the server (a link preview copy). */
export async function putBytes(key: string, body: Buffer, contentType: string) {
  await s3().send(new PutObjectCommand({ Bucket: Bucket(), Key: key, Body: body, ContentType: contentType }));
}

export function signPut(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: Bucket(), Key: key, ContentType: contentType }), {
    expiresIn: 60 * 15,
  });
}
