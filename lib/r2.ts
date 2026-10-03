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
    });
  }
  return client;
}
const Bucket = () => process.env.R2_BUCKET ?? "";

/** Short-lived read link. The bucket itself is never public. */
export function signGet(key: string, expiresIn = 60 * 60) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: Bucket(), Key: key }), { expiresIn });
}

export function signPut(key: string, contentType: string) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: Bucket(), Key: key, ContentType: contentType }), {
    expiresIn: 60 * 15,
  });
}
