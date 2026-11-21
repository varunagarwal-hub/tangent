/**
 * Client-side image compression: downscale to ≤1600px on the long edge and
 * re-encode as JPEG, lowering quality until the file is under the size limit.
 * Rough work stays legible at this size for Gemini vision.
 */
export async function compressImage(file: Blob, maxBytes = 3.5 * 1024 * 1024, maxEdge = 1600): Promise<Blob> {
  if (typeof window === "undefined") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff"; // flatten transparency (scratchpad PNGs)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("Couldn't compress the image under 4MB. Try a smaller photo.");
}
