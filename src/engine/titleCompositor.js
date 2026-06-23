/**
 * CineCutPro — Title / Text compositor.
 *
 * Signature: drawTitle(ctx, opts, bg, time)
 *   - ctx  : 2D context (track buffer)
 *   - opts : title spec (text, preset, font, weight, size, align, valign, color, ...)
 *   - bg   : program canvas (used by glass preset to fake refraction)
 *   - time : clip-local seconds; animated presets drive their motion from here
 *
 * Each preset is a pure function — same args → same pixels.  Animated presets
 * use stable hashes (text + index) so motion stays consistent across renders.
 */

import { resolveMotion } from './textMotion.js';

export const TITLE_PRESETS = [
  /* Static presets */
  { id: 'glass',    label: 'Apple Glass',       sub: 'refractive glassmorphism', kind: 'static' },
  { id: 'neon',     label: 'Neon Glow',         sub: 'vibrant outer/inner glow', kind: 'static' },
  { id: 'silver',   label: 'Liquid Silver',     sub: 'chrome reflection bevel',  kind: 'static' },
  { id: 'retro3d',  label: 'Retro 3D',          sub: 'sunset extrusion',         kind: 'static' },
  { id: 'glitch',   label: 'Glitch / Cyberpunk', sub: 'rgb split + scanlines',    kind: 'static' },
  { id: 'gold',     label: 'Golden Luxury',     sub: 'bronze halo bevel',        kind: 'static' },
  { id: 'grunge',   label: 'Grunge Stencil',    sub: 'sandblasted weathering',   kind: 'static' },
  /* Kinetic / elemental presets */
  { id: 'fire',     label: 'Fire',              sub: 'flame · embers · heat',    kind: 'kinetic' },
  { id: 'rock',     label: 'Rock',              sub: 'stone · crack · dust',     kind: 'kinetic' },
  { id: 'ground',   label: 'Ground',            sub: 'earth · roots · leaves',   kind: 'kinetic' },
  { id: 'air',      label: 'Air',               sub: 'wind · mist · ripple',     kind: 'kinetic' }
];

const DEFAULT_OPTS = {
  text: 'CineCutPro',
  preset: 'glass',
  font: 'Inter',
  weight: 800,
  size: 96,
  align: 'center',
  valign: 'middle',
  color: '#ffffff',
  letterSpacing: 0
};

const fontString = (o) => `${o.weight} ${o.size}px "${o.font}", system-ui, sans-serif`;

const measure = (ctx, text, font) => {
  ctx.font = font;
  const m = ctx.measureText(text);
  const width = m.width;
  const ascent = m.actualBoundingBoxAscent || parseFloat(font) * 0.8;
  const descent = m.actualBoundingBoxDescent || parseFloat(font) * 0.2;
  const height = ascent + descent || parseFloat(font);
  return { width, height, ascent, descent };
};

/** Compute glyph baseline x/y given align + valign. */
function placeText(ctx, text, opts) {
  const font = fontString(opts);
  const m = measure(ctx, text, font);
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  let x;
  if (opts.align === 'left')       x = cw * 0.08;
  else if (opts.align === 'right') x = cw * 0.92 - m.width;
  else                              x = cw / 2 - m.width / 2;

  let y;
  if (opts.valign === 'top')         y = ch * 0.10 + m.ascent;
  else if (opts.valign === 'bottom') y = ch * 0.90;
  else                                y = ch / 2 + m.ascent / 2;

  return { font, x, y, ...m };
}

/** Box around the glyphs in canvas coordinates. */
export function titleBounds(opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  // Use an offscreen canvas at 1920x1080 — matches the render target.
  const c = document.createElement('canvas');
  c.width = 1920;
  c.height = 1080;
  const ctx = c.getContext('2d');
  const p = placeText(ctx, o.text, o);
  return {
    x: p.x,
    y: p.y - p.ascent,
    w: p.width,
    h: p.height,
    cx: p.x + p.width / 2,
    cy: p.y - p.ascent + p.height / 2
  };
}

/* ─────────────────────────────────────────────────────────── */
/*  Helpers                                                     */
/* ─────────────────────────────────────────────────────────── */

function hashSeed(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Deterministic pseudo-random in [0,1) from a numeric seed. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/* ─────────────────────────────────────────────────────────── */
/*  Static presets (carried over)                              */
/* ─────────────────────────────────────────────────────────── */

function drawGlass(ctx, opts, bg) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, height, ascent } = placeText(ctx, o.text, o);
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const padX = o.size * 0.12;
  const padY = o.size * 0.10;
  const bx = x - padX;
  const by = y - ascent - padY;
  const bw = width + padX * 2;
  const bh = height + padY * 2;
  const radius = Math.min(bh, bw) * 0.28;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = bh * 0.5;
  ctx.shadowOffsetY = bh * 0.15;
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  roundRect(ctx, bx, by, bw, bh, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, bx, by, bw, bh, radius);
  ctx.clip();
  const zoom = 1.18;
  const off = o.size * 0.05;
  if (bg) {
    const sx = (bx + bw / 2 - (bw * zoom) / 2 + off) / cw;
    const sy = (by + bh / 2 - (bh * zoom) / 2) / ch;
    ctx.drawImage(
      bg,
      Math.max(0, sx * cw),
      Math.max(0, sy * ch),
      Math.min(cw, bw * zoom),
      Math.min(ch, bh * zoom),
      bx, by, bw, bh
    );
  }
  const film = ctx.createLinearGradient(0, by, 0, by + bh);
  film.addColorStop(0, 'rgba(255,255,255,0.20)');
  film.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = film;
  ctx.fillRect(bx, by, bw, bh);

  const bevelTop = ctx.createLinearGradient(0, by, 0, by + bh * 0.45);
  bevelTop.addColorStop(0, 'rgba(255,255,255,0.85)');
  bevelTop.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bevelTop;
  ctx.fillRect(bx, by, bw, bh * 0.45);

  const bevelBottom = ctx.createLinearGradient(0, by + bh * 0.55, 0, by + bh);
  bevelBottom.addColorStop(0, 'rgba(0,0,0,0)');
  bevelBottom.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = bevelBottom;
  ctx.fillRect(bx, by + bh * 0.55, bw, bh * 0.45);

  const gloss = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  gloss.addColorStop(0.15, 'rgba(255,255,255,0)');
  gloss.addColorStop(0.32, 'rgba(255,255,255,0.42)');
  gloss.addColorStop(0.50, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,80,120,0.55)';
  ctx.fillText(o.text, x - 2.2, y);
  ctx.fillStyle = 'rgba(80,220,255,0.55)';
  ctx.fillText(o.text, x + 2.2, y);
  ctx.restore();

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  const fill = ctx.createLinearGradient(0, y - ascent, 0, y);
  fill.addColorStop(0, 'rgba(255,255,255,0.95)');
  fill.addColorStop(1, 'rgba(220,230,250,0.85)');
  ctx.fillStyle = fill;
  ctx.fillText(o.text, x, y);
  ctx.restore();

  ctx.save();
  ctx.lineWidth = Math.max(1, o.size * 0.018);
  const rim = ctx.createLinearGradient(0, by, 0, by + bh);
  rim.addColorStop(0, 'rgba(255,255,255,0.9)');
  rim.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  rim.addColorStop(1, 'rgba(255,255,255,0.7)');
  ctx.strokeStyle = rim;
  roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, radius);
  ctx.stroke();
  ctx.restore();
}

function drawNeon(ctx, opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const passes = [
    { blur: 48, color: 'rgba(255,40,200,0.55)' },
    { blur: 28, color: 'rgba(120,80,255,0.7)' },
    { blur: 14, color: 'rgba(80,200,255,0.95)' }
  ];
  ctx.save();
  for (const p of passes) {
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.blur;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(o.text, x, y);
  }
  ctx.restore();
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(o.text, x, y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeText(o.text, x, y);
  ctx.restore();
}

function drawSilver(ctx, opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, ascent, height } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(0, y - ascent, 0, y + height * 0.2);
  grad.addColorStop(0.00, '#f8fbff');
  grad.addColorStop(0.35, '#9fb6cf');
  grad.addColorStop(0.50, '#2f3a4a');
  grad.addColorStop(0.55, '#1c2330');
  grad.addColorStop(0.70, '#7a8aa0');
  grad.addColorStop(1.00, '#e8eef7');
  ctx.fillStyle = grad;
  ctx.fillText(o.text, x, y);
  const spec = ctx.createLinearGradient(0, y - ascent * 0.95, 0, y - ascent * 0.55);
  spec.addColorStop(0, 'rgba(255,255,255,0.95)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = spec;
  ctx.fillText(o.text, x, y);
  ctx.restore();
  ctx.lineWidth = Math.max(2, o.size * 0.04);
  ctx.strokeStyle = '#0b0d12';
  ctx.strokeText(o.text, x, y);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(o.text, x, y);
}

function drawRetro3D(ctx, opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const depth = Math.max(6, o.size * 0.18);
  for (let i = depth; i > 0; i--) {
    const t = i / depth;
    const r = Math.round(60 + 80 * (1 - t));
    const g = Math.round(20 + 30 * (1 - t));
    const b = Math.round(40 + 40 * (1 - t));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillText(o.text, x + i * 0.6, y + i * 0.85);
  }
  const sunset = ctx.createLinearGradient(0, y - ascent, 0, y);
  sunset.addColorStop(0, '#ffd166');
  sunset.addColorStop(0.45, '#ef476f');
  sunset.addColorStop(1, '#7a2c8f');
  ctx.fillStyle = sunset;
  ctx.fillText(o.text, x, y);
  ctx.lineWidth = Math.max(2, o.size * 0.035);
  ctx.strokeStyle = '#1a0a1f';
  ctx.strokeText(o.text, x, y);
}

function drawGlitch(ctx, opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.fillStyle = 'rgba(255,40,140,0.18)';
  const bars = 3;
  for (let i = 0; i < bars; i++) {
    const by = y - ascent + Math.random() * ascent;
    ctx.fillRect(x - 8, by, width + 16, Math.max(2, ascent * 0.05));
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,30,180,0.95)';
  ctx.fillText(o.text, x - Math.max(4, o.size * 0.04), y);
  ctx.fillStyle = 'rgba(30,220,255,0.95)';
  ctx.fillText(o.text, x + Math.max(4, o.size * 0.04), y);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(o.text, x, y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - ascent - 4, width + 8, ascent + 12);
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  for (let yy = y - ascent; yy < y; yy += 3) {
    ctx.fillRect(x - 4, yy, width + 8, 1);
  }
  ctx.restore();
}

function drawGold(ctx, opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.shadowColor = 'rgba(255,190,60,0.85)';
  ctx.shadowBlur = 38;
  ctx.fillStyle = 'rgba(255,210,120,0.0)';
  ctx.fillText(o.text, x, y);
  ctx.shadowBlur = 22;
  ctx.shadowColor = 'rgba(255,140,30,0.7)';
  ctx.fillText(o.text, x, y);
  ctx.restore();
  const grad = ctx.createLinearGradient(0, y - ascent, 0, y);
  grad.addColorStop(0.00, '#fff6cf');
  grad.addColorStop(0.30, '#f7c44b');
  grad.addColorStop(0.55, '#8a5a1b');
  grad.addColorStop(0.80, '#d99a3a');
  grad.addColorStop(1.00, '#ffeaa3');
  ctx.fillStyle = grad;
  ctx.fillText(o.text, x, y);
  ctx.lineWidth = Math.max(1, o.size * 0.022);
  ctx.strokeStyle = '#3a1f05';
  ctx.strokeText(o.text, x, y);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,235,160,0.95)';
  ctx.strokeText(o.text, x, y);
}

function drawGrunge(ctx, opts) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.lineWidth = Math.max(2, o.size * 0.05);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#e9e4dc';
  ctx.strokeText(o.text, x, y);
  ctx.setLineDash([]);
  ctx.fillStyle = '#dcd6c6';
  ctx.fillText(o.text, x, y);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 6, y - ascent - 8, width + 12, ascent + 16);
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,18,10,0.4)';
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    const sy = y - ascent + Math.random() * ascent;
    const sx = x + Math.random() * width;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() * 60 - 30), sy + (Math.random() * 2 - 1));
    ctx.lineWidth = Math.random() * 1.6 + 0.3;
    ctx.stroke();
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(20,18,10,${Math.random() * 0.5})`;
    const px = x + Math.random() * width;
    const py = y - ascent + Math.random() * ascent;
    ctx.fillRect(px, py, Math.random() * 2, Math.random() * 2);
  }
  ctx.restore();
}

/* ─────────────────────────────────────────────────────────── */
/*  Kinetic / elemental presets                                */
/* ─────────────────────────────────────────────────────────── */

/**
 * Fire — hot text fill, heat-shimmer ghost copies, layered glow, rising embers.
 */
function drawFire(ctx, opts, _bg, time = 0) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const flicker = 1 + Math.sin(time * 14) * 0.08 + Math.sin(time * 7.3) * 0.05;

  // Aura — broad outer glow that breathes
  ctx.save();
  ctx.shadowColor = `rgba(255,${100 + 40 * Math.sin(time * 9)},20,0.85)`;
  ctx.shadowBlur = 60 * flicker;
  ctx.fillStyle = 'rgba(255,90,10,0.0)';
  ctx.fillText(o.text, x, y);
  ctx.shadowColor = 'rgba(255,200,80,0.95)';
  ctx.shadowBlur = 32 * flicker;
  ctx.fillText(o.text, x, y);
  ctx.restore();

  // Heat shimmer — 3 displaced ghosts
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const dy = Math.sin(time * 11 + i * 1.7) * 2;
    const dx = Math.sin(time * 9 + i * 2.4) * 1.5;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ff9b3b';
    ctx.fillText(o.text, x + dx, y + dy);
  }
  ctx.restore();

  // Main text — vertical hot gradient
  const grad = ctx.createLinearGradient(0, y - ascent, 0, y + ascent * 0.2);
  grad.addColorStop(0.00, '#fff0a8');
  grad.addColorStop(0.30, '#ffd166');
  grad.addColorStop(0.55, '#ff6b1f');
  grad.addColorStop(0.85, '#c41e1e');
  grad.addColorStop(1.00, '#5a0e0e');
  ctx.fillStyle = grad;
  ctx.fillText(o.text, x, y);

  // Bright inner core
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createLinearGradient(0, y - ascent * 0.95, 0, y - ascent * 0.45);
  core.addColorStop(0, 'rgba(255,255,210,0.85)');
  core.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = core;
  ctx.fillText(o.text, x, y);
  ctx.restore();

  // Embers — particles rising above the text
  const seed = hashSeed(o.text + 'fire');
  const N = 36;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const r = rng(seed + i * 31);
    const ox = r();
    const oy = r();
    const speed = 22 + r() * 60;
    const px = x + ox * width;
    const lifetime = 2 + r() * 1.5;
    const phase = (time + oy * lifetime) % lifetime;
    const py = y - phase * speed;
    const alpha = Math.max(0, 1 - phase / lifetime);
    const sz = 1.5 + r() * 2.5;
    ctx.fillStyle = `rgba(255,${160 + r() * 90 | 0},${40 + r() * 60 | 0},${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(px + Math.sin(time * 6 + i) * 4, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Rock — heavy 3D stone with crack lines + slow settling dust.
 */
function drawRock(ctx, opts, _bg, time = 0) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  // Depth
  const depth = Math.max(6, o.size * 0.16);
  for (let i = depth; i > 0; i--) {
    const t = i / depth;
    const v = Math.round(48 + 28 * (1 - t));
    ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    ctx.fillText(o.text, x + i * 0.5, y + i * 0.7);
  }
  // Stone face
  const stone = ctx.createLinearGradient(0, y - ascent, 0, y);
  stone.addColorStop(0.00, '#c9c4bd');
  stone.addColorStop(0.35, '#8c8479');
  stone.addColorStop(0.65, '#5d574f');
  stone.addColorStop(1.00, '#3d3933');
  ctx.fillStyle = stone;
  ctx.fillText(o.text, x, y);

  // Top-light bevel
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hl = ctx.createLinearGradient(0, y - ascent, 0, y - ascent * 0.55);
  hl.addColorStop(0, 'rgba(255,255,255,0.4)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillText(o.text, x, y);
  ctx.restore();

  // Outline
  ctx.lineWidth = Math.max(2, o.size * 0.035);
  ctx.strokeStyle = '#1a1612';
  ctx.strokeText(o.text, x, y);

  // Crack lines clipped to glyph fill
  const seed = hashSeed(o.text + 'rock');
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  // Use the text path as clip — Path2D not available everywhere, approximate
  // with the glyph bounding box.
  ctx.rect(x - 4, y - ascent - 4, width + 8, ascent + 12);
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const sx = x + r() * width;
    const sy = y - ascent + r() * ascent;
    let cx = sx;
    let cy = sy;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const segs = 4 + (r() * 4) | 0;
    for (let j = 0; j < segs; j++) {
      cx += (r() - 0.5) * 30;
      cy += (r() - 0.5) * 20;
      ctx.lineTo(cx, cy);
    }
    ctx.strokeStyle = `rgba(20,15,10,${0.45 + r() * 0.35})`;
    ctx.lineWidth = 0.6 + r() * 1.2;
    ctx.stroke();
  }
  ctx.restore();

  // Settling dust falling slowly
  const N = 28;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const rr = rng(seed + i * 41);
    const ox = rr();
    const speed = 8 + rr() * 14;
    const lifetime = 4 + rr() * 3;
    const phase = (time + rr() * lifetime) % lifetime;
    const py = (y - ascent) + phase * speed * 4;
    const px = x + ox * width + Math.sin(time * 1.2 + i) * 3;
    const alpha = Math.max(0, 0.6 - phase / lifetime);
    ctx.fillStyle = `rgba(220,210,196,${alpha})`;
    ctx.fillRect(px, py, 1.5 + rr() * 1.5, 1 + rr());
  }
  ctx.restore();
}

/**
 * Ground — earth-tone fill, mossy baseline, floating leaves / pollen.
 */
function drawGround(ctx, opts, _bg, time = 0) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  // Subtle horizontal sway via per-letter offset
  ctx.save();
  const sway = Math.sin(time * 1.2) * 1.4;
  ctx.translate(sway, 0);

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(20,30,10,0.6)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#2a3d18';
  ctx.fillText(o.text, x, y);
  ctx.restore();

  // Earth gradient
  const earth = ctx.createLinearGradient(0, y - ascent, 0, y);
  earth.addColorStop(0.00, '#6b8a3d');
  earth.addColorStop(0.45, '#52672b');
  earth.addColorStop(0.75, '#6b4a25');
  earth.addColorStop(1.00, '#3d2a15');
  ctx.fillStyle = earth;
  ctx.fillText(o.text, x, y);

  // Inner shadow
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const sh = ctx.createLinearGradient(0, y - ascent * 0.6, 0, y);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(40,25,12,0.7)');
  ctx.fillStyle = sh;
  ctx.fillText(o.text, x, y);
  ctx.restore();

  // Outline
  ctx.lineWidth = Math.max(1.5, o.size * 0.025);
  ctx.strokeStyle = '#1f1408';
  ctx.strokeText(o.text, x, y);

  // Mossy baseline tufts
  const seed = hashSeed(o.text + 'ground');
  const r = rng(seed);
  const baseY = y + 2;
  for (let i = 0; i < Math.floor(width / 7); i++) {
    const px = x + i * 7 + r() * 2;
    const h = 3 + r() * 8;
    const w = 2 + r() * 2;
    ctx.fillStyle = `rgb(${80 + (r() * 50) | 0}, ${130 + (r() * 50) | 0}, ${40 + (r() * 30) | 0})`;
    ctx.beginPath();
    ctx.moveTo(px, baseY);
    ctx.lineTo(px - w / 2, baseY - h);
    ctx.lineTo(px + w / 2, baseY - h);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // Floating pollen / leaves drifting up-right
  const N = 24;
  ctx.save();
  for (let i = 0; i < N; i++) {
    const rr = rng(seed + i * 53);
    const ox = rr();
    const oy = rr();
    const phase = (time * (0.6 + rr() * 0.5) + oy * 8) % 8;
    const px = x + ((ox * width + phase * 40) % (width + 80)) - 40;
    const py = y - ascent + (oy * ascent) - Math.sin(time + i) * 6;
    const alpha = 0.4 + rr() * 0.4;
    const sz = 2 + rr() * 3;
    ctx.fillStyle = `rgba(${180 + (rr() * 60) | 0}, ${200 + (rr() * 40) | 0}, ${80 + (rr() * 60) | 0}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Air — translucent cool-tone text, wind streaks, drifting mist particles.
 */
function drawAir(ctx, opts, _bg, time = 0) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const { font, x, y, width, ascent } = placeText(ctx, o.text, o);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  // Soft cloud halo
  ctx.save();
  ctx.shadowColor = 'rgba(200,225,255,0.85)';
  ctx.shadowBlur = 36;
  ctx.fillStyle = 'rgba(220,235,255,0.0)';
  ctx.fillText(o.text, x, y);
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(255,255,255,0.7)';
  ctx.fillText(o.text, x, y);
  ctx.restore();

  // Wind streaks before the text — horizontal lines that scroll
  const seed = hashSeed(o.text + 'air');
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 60, y - ascent - 20, width + 120, ascent + 40);
  ctx.clip();
  for (let i = 0; i < 18; i++) {
    const rowY = y - ascent + r() * ascent;
    const speed = 60 + r() * 80;
    const streakX = ((time * speed) + r() * 800) % (width + 240) - 120;
    const len = 40 + r() * 100;
    const alpha = 0.15 + r() * 0.35;
    const g = ctx.createLinearGradient(x + streakX, rowY, x + streakX + len, rowY);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x + streakX, rowY, len, 1.2);
  }
  ctx.restore();

  // Main translucent text — vertical pale gradient
  const grad = ctx.createLinearGradient(0, y - ascent, 0, y);
  grad.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(220,235,255,0.85)');
  grad.addColorStop(1.00, 'rgba(180,210,245,0.65)');
  ctx.fillStyle = grad;
  ctx.fillText(o.text, x, y);

  // Subtle horizontal wave per-letter (skip if too narrow)
  // (Already implicit via shadow blur; keep clean.)

  // Outline — thin sky-blue
  ctx.lineWidth = Math.max(1, o.size * 0.012);
  ctx.strokeStyle = 'rgba(150,190,235,0.65)';
  ctx.strokeText(o.text, x, y);

  // Drifting mist particles
  const N = 32;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const rr = rng(seed + i * 23);
    const ox = rr();
    const oy = rr();
    const lifetime = 3 + rr() * 2;
    const speed = 30 + rr() * 60;
    const phase = (time + oy * lifetime) % lifetime;
    const px = x + ox * width + phase * speed;
    const py = y - ascent + oy * ascent + Math.sin(time * 1.5 + i) * 8;
    const sz = 6 + rr() * 16;
    const alpha = Math.max(0, 0.4 - phase / lifetime) * 0.5;
    const g = ctx.createRadialGradient(px, py, 0, px, py, sz);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ─────────────────────────────────────────────────────────── */
/*  Subtitle helper                                            */
/* ─────────────────────────────────────────────────────────── */

/**
 * Subtitle caption — wraps text to ~80% width, draws a scrim under each line,
 * then strokes + fills.  Honors valign (top/middle/bottom; default bottom).
 */
export function drawSubtitle(ctx, opts) {
  const o = { valign: 'bottom', ...opts };
  const text = o.text ?? '';
  if (!text) return;
  const size = o.size ?? 64;
  const font = `${o.weight ?? 600} ${size}px "${o.font ?? 'Inter'}", system-ui, sans-serif`;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  const maxW = W * 0.8;
  const lines = wrap(ctx, text, maxW);
  const lh = size * 1.25;
  const totalH = lines.length * lh;

  let baseY;
  if (o.valign === 'top')          baseY = H * 0.12 + size;
  else if (o.valign === 'middle')  baseY = H / 2 + size / 2 - totalH / 2 + size;
  else                              baseY = H - H * 0.12 - (lines.length - 1) * lh;

  const padX = size * 0.5;
  const padY = size * 0.25;
  for (let i = 0; i < lines.length; i++) {
    const m = ctx.measureText(lines[i]);
    const x = W / 2;
    const y = baseY + i * lh;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - m.width / 2 - padX, y - size + padY * 0.3, m.width + padX * 2, size + padY);
  }
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = o.color ?? '#ffffff';
  for (let i = 0; i < lines.length; i++) {
    const x = W / 2;
    const y = baseY + i * lh;
    ctx.strokeText(lines[i], x, y);
    ctx.fillText(lines[i], x, y);
  }
  ctx.restore();
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width > maxW && line) {
      out.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) out.push(line);
  return out;
}

/* ─────────────────────────────────────────────────────────── */
/*  Public dispatch                                            */
/* ─────────────────────────────────────────────────────────── */

const PRESET_FN = {
  glass: drawGlass,
  neon: drawNeon,
  silver: drawSilver,
  retro3d: drawRetro3D,
  glitch: drawGlitch,
  gold: drawGold,
  grunge: drawGrunge,
  fire: drawFire,
  rock: drawRock,
  ground: drawGround,
  air: drawAir
};
/**
 * Apply entry/exit motion deltas, then draw the preset.
 * Motion deltas:
 *   alpha    → multiplies globalAlpha
 *   scale    → wraps the draw in a center-anchored scale
 *   x, y     → translates (canvas units)
 *   blur     → composed onto ctx.filter
 *   clipFrac → horizontal reveal wipe (0 invisible → 1 fully shown)
 */
export function drawTitle(ctx, opts, bg, time = 0, clipDur = 0) {
  const fn = PRESET_FN[opts?.preset] ?? drawGlass;
  const m = clipDur > 0 ? resolveMotion(opts?.motion, time, clipDur) : null;
  if (!m) {
    fn(ctx, opts, bg, time);
    return;
  }
  ctx.save();
  ctx.globalAlpha *= m.alpha ?? 1;
  if (m.blur && m.blur > 0.01) {
    const existing = ctx.filter && ctx.filter !== 'none' ? ctx.filter : '';
    ctx.filter = `${existing} blur(${m.blur}px)`.trim();
  }
  if ((m.x && m.x !== 0) || (m.y && m.y !== 0)) {
    ctx.translate(m.x ?? 0, m.y ?? 0);
  }
  if (m.scale != null && m.scale !== 1) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.translate(W / 2, H / 2);
    ctx.scale(m.scale, m.scale);
    ctx.translate(-W / 2, -H / 2);
  }
  if (m.clipFrac != null && m.clipFrac < 1) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.beginPath();
    ctx.rect(0, 0, W * Math.max(0, m.clipFrac), H);
    ctx.clip();
  }
  fn(ctx, opts, bg, time);
  ctx.restore();
}
