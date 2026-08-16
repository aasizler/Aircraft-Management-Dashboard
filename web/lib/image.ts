// Shared client-side image prep for the two vision paths (meter-ocr and
// receipt-scan).
//
// Sizing: Anthropic downscales any image whose long edge exceeds 1568px before
// the model ever sees it, so sending a full 12MP phone photo costs upload time
// and tokens while adding exactly zero accuracy. We do that resize locally
// instead — same pixels reach the model, a fraction of the bytes.
//
// Quality: 0.92 rather than the 0.8 v1 used. These photos are read for small
// digits (a Hobbs tenths drum, a receipt total); JPEG ringing around thin
// strokes is precisely the artifact that turns an 8 into a 3, and the byte
// saving from 0.92 → 0.8 is not worth that risk.
//
// Orientation: decoded via createImageBitmap({imageOrientation:"from-image"})
// so EXIF-rotated phone photos are baked upright. A sideways meter is markedly
// harder for the model to read.

/** Long-edge cap — matches the API's own downscale threshold. */
const MAX_EDGE = 1568;
/** JPEG quality, tuned for digit legibility rather than file size. */
const QUALITY = 0.92;

/** Image types the Anthropic vision API accepts. */
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export type PreparedImage = {
  /** Base64 payload, no data-URL prefix. */
  data: string;
  /** The mime that `data` actually is — never a guess. */
  mime: string;
  /** Data URL of exactly what the model receives, for the confirm view. */
  preview: string;
  /** Encoded byte count, for reporting the saving. */
  bytes: number;
  /** Original byte count. */
  originalBytes: number;
  /** False when the browser could not decode the file and we passed it through. */
  processed: boolean;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

/** Approximate decoded size of a base64 string, without materialising it. */
function base64Bytes(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

type Decoded = { src: CanvasImageSource; width: number; height: number };

/**
 * Decode to something drawable, preferring createImageBitmap so EXIF rotation
 * is applied. Falls back to an <img>, and returns null when neither can read
 * the file (HEIC in Chrome, mainly).
 */
async function decode(file: File, dataUrl: string): Promise<Decoded | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // Older Safari rejects the options bag — retry bare before giving up.
      try {
        const bmp = await createImageBitmap(file);
        return { src: bmp, width: bmp.width, height: bmp.height };
      } catch {
        /* fall through to <img> */
      }
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ src: img, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Downscale, orient and re-encode `file` for a vision call.
 *
 * Never upscales: a photo already under the cap is re-encoded in place (which
 * still normalises orientation and strips EXIF), not stretched.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const dataUrl = await readAsDataUrl(file);
  const originalBytes = file.size;
  const decoded = await decode(file, dataUrl);

  // Undecodable: hand back the original bytes under their true mime so the
  // caller can reject it clearly instead of mislabelling it as JPEG.
  if (!decoded || !decoded.width || !decoded.height) {
    const data = dataUrl.split(",")[1] ?? "";
    return {
      data,
      mime: file.type || "application/octet-stream",
      preview: dataUrl,
      bytes: base64Bytes(data),
      originalBytes,
      processed: false,
    };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const data = dataUrl.split(",")[1] ?? "";
    return {
      data,
      mime: file.type || "application/octet-stream",
      preview: dataUrl,
      bytes: base64Bytes(data),
      originalBytes,
      processed: false,
    };
  }

  // Smooth downsampling — the default nearest-ish path aliases digit edges.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Photos have no transparency, but a PNG screenshot might; flatten onto white
  // so alpha doesn't turn black under JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(decoded.src, 0, 0, canvas.width, canvas.height);

  if (typeof ImageBitmap !== "undefined" && decoded.src instanceof ImageBitmap) {
    decoded.src.close();
  }

  const out = canvas.toDataURL("image/jpeg", QUALITY);
  const data = out.split(",")[1] ?? "";
  return {
    data,
    mime: "image/jpeg",
    preview: out,
    bytes: base64Bytes(data),
    originalBytes,
    processed: true,
  };
}

/** Normalised region of an image, 0..1. */
export type Box = { x: number; y: number; w: number; h: number };

/**
 * One piece of a tiled image: the grid position it came from, and where it sits
 * in the source. `box` lets the confirm view jump straight to the region a
 * reading actually came from.
 */
export type Tile = PreparedImage & { id: string; box: Box };

/** Smallest box containing all of `boxes`, or null for an empty list. */
function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const b2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: b2 - y };
}

/**
 * Where a value actually sits, given the tiles that reported it.
 *
 * Tiles overlap, so when two of them independently read the same number, the
 * number can only be in their intersection — which is a far tighter region than
 * either tile, and tight enough to zoom to usefully. Falls back to the union
 * when the tiles don't overlap (or there is only one).
 */
export function locateFromTiles(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.max(...boxes.map((b) => b.x));
  const y = Math.max(...boxes.map((b) => b.y));
  const r = Math.min(...boxes.map((b) => b.x + b.w));
  const b2 = Math.min(...boxes.map((b) => b.y + b.h));
  if (r - x > 0.02 && b2 - y > 0.02) return { x, y, w: r - x, h: b2 - y };
  return unionBox(boxes);
}

/** Fraction of a tile's size that overlaps its neighbour. */
const TILE_OVERLAP = 0.18;
/** Cost ceiling — each tile is one vision call. */
const MAX_TILES = 9;

/**
 * Split `file` into overlapping tiles that are each at (or near) native
 * resolution.
 *
 * Why tiles rather than one downscaled frame: the API caps the long edge at
 * 1568px, so a whole-panel photo shrinks the hours text below what the model
 * can resolve — a real G3X photo misread 5905.3 as 5505.3 on every attempt.
 * Reading native-resolution pieces fixes that, and because neighbouring tiles
 * overlap, the same number usually lands in two tiles: agreement between them
 * is an independent check rather than one unverified guess.
 *
 * Locating the digits first and cropping to them was tried and abandoned — the
 * model's bounding boxes were badly off (it put the hours a third of the frame
 * too low), and a wrong box silently reads the wrong part of the photo.
 *
 * The grid is derived from the image size, so a tight close-up costs a single
 * call and only a full 12MP panel shot pays for six.
 */
export async function tileImage(file: File): Promise<Tile[] | null> {
  const dataUrl = await readAsDataUrl(file);
  const decoded = await decode(file, dataUrl);
  if (!decoded || !decoded.width || !decoded.height) return null;

  const { width: W, height: H } = decoded;
  let cols = Math.max(1, Math.ceil(W / MAX_EDGE));
  let rows = Math.max(1, Math.ceil(H / MAX_EDGE));
  while (cols * rows > MAX_TILES) {
    // Shed a division from whichever axis is currently finer.
    if (cols >= rows) cols--;
    else rows--;
  }

  const tw = (W / cols) * (1 + TILE_OVERLAP);
  const th = (H / rows) * (1 + TILE_OVERLAP);
  const scale = Math.min(1, MAX_EDGE / Math.max(tw, th));

  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = Math.max(0, Math.min(W - tw, (c * W) / cols - ((W / cols) * TILE_OVERLAP) / 2));
      const sy = Math.max(0, Math.min(H - th, (r * H) / rows - ((H / rows) * TILE_OVERLAP) / 2));

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(tw * scale));
      canvas.height = Math.max(1, Math.round(th * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(decoded.src, sx, sy, tw, th, 0, 0, canvas.width, canvas.height);

      const out = canvas.toDataURL("image/jpeg", QUALITY);
      const data = out.split(",")[1] ?? "";
      tiles.push({
        id: `r${r}c${c}`,
        box: { x: sx / W, y: sy / H, w: tw / W, h: th / H },
        data,
        mime: "image/jpeg",
        preview: out,
        bytes: base64Bytes(data),
        originalBytes: file.size,
        processed: true,
      });
    }
  }

  if (typeof ImageBitmap !== "undefined" && decoded.src instanceof ImageBitmap) {
    decoded.src.close();
  }
  return tiles.length ? tiles : null;
}

/** "4.2 MB → 380 KB" style summary for the confirm view. */
export function describeSize(p: PreparedImage): string {
  const fmt = (n: number) =>
    n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  if (!p.processed || p.bytes >= p.originalBytes) return fmt(p.originalBytes);
  return `${fmt(p.originalBytes)} → ${fmt(p.bytes)}`;
}
