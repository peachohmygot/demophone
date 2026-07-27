// Client-side image compression.
// Shrinks each picture to roughly 300–500 KB while keeping enough detail
// to inspect cosmetic flaws, before it's uploaded to Supabase Storage.

const TARGET_MIN = 300 * 1024;   // 300 KB
const TARGET_MAX = 500 * 1024;   // 500 KB
const MAX_DIMENSION = 1600;      // longest edge, px — plenty for flaw inspection

export async function compressImage(file) {
  // Non-images (or tiny files) pass straight through.
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await loadBitmap(file);
  let { width, height } = fit(bitmap.width, bitmap.height, MAX_DIMENSION);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let quality = 0.92;
  let blob = await draw(canvas, ctx, bitmap, width, height, quality);

  // Too big → drop quality, then dimensions, until under the max.
  let guard = 0;
  while (blob.size > TARGET_MAX && guard++ < 12) {
    if (quality > 0.45) {
      quality -= 0.08;
    } else {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      quality = 0.7;
    }
    blob = await draw(canvas, ctx, bitmap, width, height, quality);
  }

  // Very small already? Nudge quality up once so we don't over-crush a photo
  // that had headroom (only helps when far below the min target).
  if (blob.size < TARGET_MIN && quality < 0.92) {
    const better = await draw(canvas, ctx, bitmap, width, height, Math.min(0.95, quality + 0.15));
    if (better.size <= TARGET_MAX) blob = better;
  }

  if (bitmap.close) bitmap.close();

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

function fit(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function draw(canvas, ctx, bitmap, w, h, quality) {
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
}

async function loadBitmap(file) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}
