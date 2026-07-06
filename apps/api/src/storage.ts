import * as Minio from "minio";
import { env } from "./env";

/** S3-compatible client (MinIO locally). Used for the profile-pics bucket. */
export const minio = new Minio.Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL === "true",
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Issues a short-lived presigned PUT URL for a user's avatar and returns the
 * public URL the object will be served from once uploaded.
 */
export async function presignedAvatarUpload(
  userId: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; objectKey: string }> {
  const ext = EXT_BY_TYPE[contentType] ?? "bin";
  const objectKey = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await minio.presignedPutObject(
    env.MINIO_BUCKET_AVATARS,
    objectKey,
    60 * 5, // 5 min
  );
  const publicUrl = `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET_AVATARS}/${objectKey}`;
  return { uploadUrl, publicUrl, objectKey };
}
