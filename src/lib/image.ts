// Convert an image File to a compressed base64 data URL.
// Avoids Supabase Storage (which is unavailable on this backend) by
// encoding images inline. Resizes to a max dimension and re-encodes as
// JPEG to keep payloads reasonable.
export async function fileToDataUrl(
  file: File,
  { maxDim = 1600, quality = 0.82 }: { maxDim?: number; quality?: number } = {},
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("Failed to read file"));
    r.readAsDataURL(file);
  });

  // GIFs lose animation if re-encoded; pass through.
  if (file.type === "image/gif") return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not decode image"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
