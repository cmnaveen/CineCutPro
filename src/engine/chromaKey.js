/**
 * Per-pixel chroma key.
 *
 * Distance is measured in YCbCr chroma space (Cb, Cr) so luminance variation
 * inside the keyed colour does not punch the matte unevenly.  Each pixel:
 *
 *   1. Convert RGB → Cb, Cr.
 *   2. Compute Euclidean distance to the key's Cb,Cr.
 *   3. If distance < tolerance · maxRange → alpha 0 (knocked out).
 *      If distance in [tolerance, tolerance+softness] → linear feather.
 *      Else                                            → keep original alpha.
 *
 * This is a JS hot loop. We avoid allocations and short-circuit cheaply so a
 * 1080p frame can be processed in a single tick (≈ 8 MB to walk).
 */

const hexToRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const rgbToCbCr = (r, g, b) => {
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
  const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
  return [cb, cr];
};

export function applyChromaKey(ctx, w, h, opts) {
  if (!opts?.enabled) return;
  const { color = '#00ff00', tolerance = 0.35, softness = 0.1 } = opts;
  const key = hexToRgb(color);
  const [kCb, kCr] = rgbToCbCr(key.r, key.g, key.b);

  // Chroma plane is roughly 0..255 each — max distance ≈ 360.
  const maxRange = 180;
  const tolPx = tolerance * maxRange;
  const softPx = Math.max(0.0001, softness * maxRange);

  let img;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch (_) {
    return; // tainted canvas; skip silently
  }
  const data = img.data;
  const N = data.length;

  for (let i = 0; i < N; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
    const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
    const dCb = cb - kCb;
    const dCr = cr - kCr;
    const dist = Math.sqrt(dCb * dCb + dCr * dCr);
    if (dist < tolPx) {
      data[i + 3] = 0;
    } else if (dist < tolPx + softPx) {
      const t = (dist - tolPx) / softPx;
      data[i + 3] = (data[i + 3] * t) | 0;
      // Spill suppression: desaturate toward grey near the matte edge.
      const lift = (1 - t) * 0.4;
      data[i] = r * (1 - lift) + ((r + g + b) / 3) * lift;
      data[i + 1] = g * (1 - lift) + ((r + g + b) / 3) * lift;
      data[i + 2] = b * (1 - lift) + ((r + g + b) / 3) * lift;
    }
  }
  ctx.putImageData(img, 0, 0);
}
