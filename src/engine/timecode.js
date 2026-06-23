/**
 * Timecode utilities — drop-frame agnostic SMPTE-like formatting.
 */

import { FPS } from '../state/initialState.js';
export { FPS };

export const toFrames = (seconds, fps = FPS) => Math.round(seconds * fps);
export const fromFrames = (frames, fps = FPS) => frames / fps;

export const formatTC = (seconds, fps = FPS) => {
  if (!Number.isFinite(seconds)) return '00:00:00:00';
  const total = Math.max(0, Math.round(seconds * fps));
  const f = total % fps;
  const s = Math.floor(total / fps) % 60;
  const m = Math.floor(total / (fps * 60)) % 60;
  const h = Math.floor(total / (fps * 3600));
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)}:${p2(f)}`;
};

export const formatHMS = (seconds) => {
  const t = Math.max(0, Math.round(seconds));
  const s = t % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  const p2 = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p2(m)}:${p2(s)}` : `${p2(m)}:${p2(s)}`;
};
