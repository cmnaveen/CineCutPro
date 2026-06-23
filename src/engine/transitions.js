/**
 * Transitions library.
 *
 * Each transition is a pure function (ctx, fromCanvas, toCanvas, progress, w, h) -> void.
 * progress ∈ [0, 1].  `fromCanvas` is the outgoing layer, `toCanvas` is the incoming.
 */

export const TRANSITIONS = [
  { id: 'crossDissolve',   label: 'Cross Dissolve',  group: 'Dissolve' },
  { id: 'additiveDissolve', label: 'Additive Dissolve', group: 'Dissolve' },
  { id: 'dipToBlack',      label: 'Dip to Black',    group: 'Dissolve' },
  { id: 'dipToWhite',      label: 'Dip to White',    group: 'Dissolve' },
  { id: 'wipeLeft',        label: 'Wipe Left',       group: 'Wipe' },
  { id: 'wipeRight',       label: 'Wipe Right',      group: 'Wipe' },
  { id: 'wipeUp',          label: 'Wipe Up',         group: 'Wipe' },
  { id: 'wipeDown',        label: 'Wipe Down',       group: 'Wipe' },
  { id: 'clockWipe',       label: 'Clock Wipe',      group: 'Wipe' },
  { id: 'pushLeft',        label: 'Push Left',       group: 'Slide' },
  { id: 'pushRight',       label: 'Push Right',      group: 'Slide' },
  { id: 'zoomIn',          label: 'Zoom In',         group: 'Zoom' },
  { id: 'zoomOut',         label: 'Zoom Out',        group: 'Zoom' }
];

const blit = (ctx, src, w, h) => ctx.drawImage(src, 0, 0, w, h);

function crossDissolve(ctx, from, to, p, w, h) {
  ctx.globalAlpha = 1 - p;
  blit(ctx, from, w, h);
  ctx.globalAlpha = p;
  blit(ctx, to, w, h);
  ctx.globalAlpha = 1;
}

function additiveDissolve(ctx, from, to, p, w, h) {
  blit(ctx, from, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = p;
  blit(ctx, to, w, h);
  ctx.restore();
}

function dipTo(color) {
  return (ctx, from, to, p, w, h) => {
    if (p < 0.5) {
      ctx.globalAlpha = 1;
      blit(ctx, from, w, h);
      ctx.fillStyle = color;
      ctx.globalAlpha = p * 2;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.globalAlpha = 1;
      blit(ctx, to, w, h);
      ctx.fillStyle = color;
      ctx.globalAlpha = (1 - p) * 2;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  };
}

function wipe(direction) {
  return (ctx, from, to, p, w, h) => {
    blit(ctx, from, w, h);
    ctx.save();
    ctx.beginPath();
    if (direction === 'left') ctx.rect(w - w * p, 0, w * p, h);
    if (direction === 'right') ctx.rect(0, 0, w * p, h);
    if (direction === 'up') ctx.rect(0, h - h * p, w, h * p);
    if (direction === 'down') ctx.rect(0, 0, w, h * p);
    ctx.clip();
    blit(ctx, to, w, h);
    ctx.restore();
  };
}

function clockWipe(ctx, from, to, p, w, h) {
  blit(ctx, from, w, h);
  ctx.save();
  ctx.beginPath();
  const cx = w / 2;
  const cy = h / 2;
  ctx.moveTo(cx, cy);
  const r = Math.hypot(w, h);
  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * p;
  ctx.arc(cx, cy, r, start, end);
  ctx.closePath();
  ctx.clip();
  blit(ctx, to, w, h);
  ctx.restore();
}

function push(direction) {
  return (ctx, from, to, p, w, h) => {
    const dx = direction === 'left' ? -w * p : w * p;
    ctx.drawImage(from, dx, 0, w, h);
    ctx.drawImage(to, dx + (direction === 'left' ? w : -w), 0, w, h);
  };
}

function zoomIn(ctx, from, to, p, w, h) {
  // outgoing zooms out, fading; incoming scales from 1.2 → 1 fading in.
  ctx.save();
  ctx.globalAlpha = 1 - p;
  const s1 = 1 + p * 0.4;
  ctx.translate(w / 2, h / 2);
  ctx.scale(s1, s1);
  ctx.drawImage(from, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = p;
  const s2 = 1.2 - p * 0.2;
  ctx.translate(w / 2, h / 2);
  ctx.scale(s2, s2);
  ctx.drawImage(to, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function zoomOut(ctx, from, to, p, w, h) {
  ctx.save();
  ctx.globalAlpha = 1 - p;
  const s1 = 1 - p * 0.2;
  ctx.translate(w / 2, h / 2);
  ctx.scale(s1, s1);
  ctx.drawImage(from, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = p;
  const s2 = 0.6 + p * 0.4;
  ctx.translate(w / 2, h / 2);
  ctx.scale(s2, s2);
  ctx.drawImage(to, -w / 2, -h / 2, w, h);
  ctx.restore();
}

const REGISTRY = {
  crossDissolve,
  additiveDissolve,
  dipToBlack: dipTo('#000'),
  dipToWhite: dipTo('#fff'),
  wipeLeft: wipe('left'),
  wipeRight: wipe('right'),
  wipeUp: wipe('up'),
  wipeDown: wipe('down'),
  clockWipe,
  pushLeft: push('left'),
  pushRight: push('right'),
  zoomIn,
  zoomOut
};

export function runTransition(kind, ctx, from, to, progress, w, h) {
  const fn = REGISTRY[kind] ?? crossDissolve;
  fn(ctx, from, to, Math.max(0, Math.min(1, progress)), w, h);
}
