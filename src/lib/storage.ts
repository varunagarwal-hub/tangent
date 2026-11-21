import "server-only";
import { put } from "@vercel/blob";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export class UploadRejected extends Error {}

/** Validates type/size. Throws UploadRejected on bad input. */
export function assertValidImage(file: Blob) {
  if (!ALLOWED_TYPES.has(file.type)) throw new UploadRejected(`Unsupported image type: ${file.type || "unknown"}`);
  if (file.size > MAX_IMAGE_BYTES) throw new UploadRejected("Image is larger than 4MB");
}

/**
 * Upload a rough-work photo/scratchpad PNG to Vercel Blob.
 * Returns the public URL, or null when BLOB_READ_WRITE_TOKEN is missing — callers then
 * send the image straight to Gemini, save only the transcription, and store
 * work_image_url = null. Upload failures also return null (never crash a submit).
 */
export async function uploadRoughWork(file: Blob, studentId = "anon"): Promise<string | null> {
  assertValidImage(file);
  if (!hasBlobStorage()) return null;
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const safeStudent = studentId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40) || "anon";
  try {
    const blob = await put(`rough-work/${safeStudent}/${Date.now()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    console.error("[storage] upload failed", err);
    return null;
  }
}

/** base64 (no data: prefix) for sending an image to Gemini. */
export async function toBase64(file: Blob) {
  return Buffer.from(await file.arrayBuffer()).toString("base64");
}
