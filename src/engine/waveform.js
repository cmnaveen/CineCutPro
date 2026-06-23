/**
 * Audio waveform peak extractor.
 *
 * Given a URL to an audio (or video) file, fetch the bytes, decode via
 * AudioContext.decodeAudioData, and return a Float32Array of `bins` absolute
 * peaks suitable for drawing a static waveform.
 *
 * Results are cached by URL so a clip dragged onto multiple tracks decodes once.
 */

const CACHE = new Map(); // url -> Promise<Float32Array>

let sharedCtx = null;
const ctx = () => {
  if (sharedCtx) return sharedCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  // OfflineAudioContext would be cheaper but decodeAudioData needs a regular ctx.
  sharedCtx = new Ctx();
  return sharedCtx;
};

export function extractPeaks(url, bins = 256) {
  const key = `${url}@${bins}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const promise = (async () => {
    const c = ctx();
    if (!c) return new Float32Array(bins);
    try {
      const buf = await fetch(url).then((r) => r.arrayBuffer());
      const audio = await c.decodeAudioData(buf.slice(0));
      // Take channel 0 (mono mixdown would be more accurate but slower).
      const channel = audio.getChannelData(0);
      const out = new Float32Array(bins);
      const step = channel.length / bins;
      for (let i = 0; i < bins; i++) {
        let max = 0;
        const start = Math.floor(i * step);
        const end = Math.min(channel.length, Math.floor((i + 1) * step));
        for (let j = start; j < end; j++) {
          const v = Math.abs(channel[j]);
          if (v > max) max = v;
        }
        out[i] = max;
      }
      return out;
    } catch (_) {
      // Decode failures (CORS, codec) — return zeros so callers can render gracefully.
      return new Float32Array(bins);
    }
  })();

  CACHE.set(key, promise);
  return promise;
}

export function clearWaveformCache() {
  CACHE.clear();
}
