/**
 * Resize an image File to fit within maxSide (longest edge) and return
 * a base64 data URL suitable for sending to Groq vision.
 * Keeps aspect ratio. Uses JPEG at given quality.
 */
export async function resizeImageToDataURL(
  file: File,
  maxSide = 1600,
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", quality);
}
