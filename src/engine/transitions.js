/**
 * Transitions library — Professional Edition.
 *
 * Each transition is a pure function (ctx, fromCanvas, toCanvas, progress, w, h) -> void.
 * progress ∈ [0, 1].  `fromCanvas` is the outgoing layer, `toCanvas` is the incoming.
 *
 * 50+ transitions organized by group: Dissolve, Wipe, Slide, Zoom, 3D, Glitch, Creative.
 */

export const TRANSITIONS = [
  // ── Dissolve ──
  { id: 'crossDissolve',     label: 'Cross Dissolve',      group: 'Dissolve' },
  { id: 'additiveDissolve',  label: 'Additive Dissolve',   group: 'Dissolve' },
  { id: 'dipToBlack',        label: 'Dip to Black',        group: 'Dissolve' },
  { id: 'dipToWhite',        label: 'Dip to White',        group: 'Dissolve' },
  { id: 'filmDissolve',      label: 'Film Dissolve',       group: 'Dissolve' },
  { id: 'bloomDissolve',     label: 'Bloom Dissolve',      group: 'Dissolve' },
  { id: 'inkBleed',          label: 'Ink Bleed',           group: 'Dissolve' },
  // ── Wipe ──
  { id: 'wipeLeft',          label: 'Wipe Left',           group: 'Wipe' },
  { id: 'wipeRight',         label: 'Wipe Right',          group: 'Wipe' },
  { id: 'wipeUp',            label: 'Wipe Up',             group: 'Wipe' },
  { id: 'wipeDown',          label: 'Wipe Down',           group: 'Wipe' },
  { id: 'clockWipe',         label: 'Clock Wipe',          group: 'Wipe' },
  { id: 'barnDoor',          label: 'Barn Door',           group: 'Wipe' },
  { id: 'irisCircle',        label: 'Iris Circle',         group: 'Wipe' },
  { id: 'irisDiamond',       label: 'Iris Diamond',        group: 'Wipe' },
  { id: 'irisStar',          label: 'Iris Star',           group: 'Wipe' },
  { id: 'irisHeart',         label: 'Iris Heart',          group: 'Wipe' },
  { id: 'bandWipeH',         label: 'Band Wipe (H)',       group: 'Wipe' },
  { id: 'bandWipeV',         label: 'Band Wipe (V)',       group: 'Wipe' },
  // ── Slide ──
  { id: 'pushLeft',          label: 'Push Left',           group: 'Slide' },
  { id: 'pushRight',         label: 'Push Right',          group: 'Slide' },
  { id: 'pushUp',            label: 'Push Up',             group: 'Slide' },
  { id: 'pushDown',          label: 'Push Down',           group: 'Slide' },
  { id: 'coverLeft',         label: 'Cover Left',          group: 'Slide' },
  { id: 'coverRight',        label: 'Cover Right',         group: 'Slide' },
  { id: 'revealLeft',        label: 'Reveal Left',         group: 'Slide' },
  { id: 'revealRight',       label: 'Reveal Right',        group: 'Slide' },
  // ── Zoom ──
  { id: 'zoomIn',            label: 'Zoom In',             group: 'Zoom' },
  { id: 'zoomOut',           label: 'Zoom Out',            group: 'Zoom' },
  { id: 'zoomThrough',       label: 'Zoom Through',        group: 'Zoom' },
  { id: 'dollyZoom',         label: 'Dolly Zoom',          group: 'Zoom' },
  // ── 3D ──
  { id: 'cubeX',             label: 'Cube Rotate X',       group: '3D' },
  { id: 'cubeY',             label: 'Cube Rotate Y',       group: '3D' },
  { id: 'flipH',             label: 'Flip Horizontal',     group: '3D' },
  { id: 'flipV',             label: 'Flip Vertical',       group: '3D' },
  { id: 'pageCurl',          label: 'Page Curl',           group: '3D' },
  { id: 'doorway',           label: 'Doorway',             group: '3D' },
  // ── Glitch ──
  { id: 'digitalGlitch',     label: 'Digital Glitch',      group: 'Glitch' },
  { id: 'staticNoise',       label: 'Static Noise',        group: 'Glitch' },
  { id: 'channelShift',      label: 'Channel Shift',       group: 'Glitch' },
  // ── Creative ──
  { id: 'lumaFade',          label: 'Luma Fade',           group: 'Creative' },
  { id: 'spin',              label: 'Spin',                group: 'Creative' },
  { id: 'bounce',            label: 'Bounce',              group: 'Creative' },
  { id: 'pixelateTransition', label: 'Pixelate',           group: 'Creative' },
  { id: 'rippleDissolve',    label: 'Ripple Dissolve',     group: 'Creative' },
  { id: 'blinds',            label: 'Blinds',              group: 'Creative' }
];

const blit = (ctx, src, w, h) => ctx.drawImage(src, 0, 0, w, h);

// ═══════════════════════════════════════════════════════════
// Dissolve Group
// ═══════════════════════════════════════════════════════════

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

function filmDissolve(ctx, from, to, p, w, h) {
  crossDissolve(ctx, from, to, p, w, h);
  // Add film grain during transition
  const grainIntensity = Math.sin(p * Math.PI) * 0.15;
  if (grainIntensity > 0.01) {
    ctx.save();
    ctx.globalAlpha = grainIntensity;
    ctx.globalCompositeOperation = 'overlay';
    const imgData = ctx.createImageData(w >> 2, h >> 2);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
    const tmpCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w >> 2, h >> 2)
      : Object.assign(document.createElement('canvas'), { width: w >> 2, height: h >> 2 });
    tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmpCanvas, 0, 0, w, h);
    ctx.restore();
  }
}

function bloomDissolve(ctx, from, to, p, w, h) {
  if (p < 0.5) {
    blit(ctx, from, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = p * 2;
    ctx.filter = `blur(${p * 30}px) brightness(${1 + p * 2})`;
    blit(ctx, from, w, h);
    ctx.restore();
  } else {
    blit(ctx, to, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (1 - p) * 2;
    ctx.filter = `blur(${(1 - p) * 30}px) brightness(${1 + (1 - p) * 2})`;
    blit(ctx, to, w, h);
    ctx.restore();
  }
}

function inkBleed(ctx, from, to, p, w, h) {
  blit(ctx, from, w, h);
  ctx.save();
  // Organic blob expansion from center
  ctx.beginPath();
  const cx = w / 2, cy = h / 2;
  const maxR = Math.hypot(w, h) / 2;
  const numBlobs = 12;
  for (let i = 0; i < numBlobs; i++) {
    const angle = (i / numBlobs) * Math.PI * 2;
    const wobble = 0.6 + Math.sin(angle * 3 + p * 5) * 0.4;
    const r = maxR * p * wobble;
    const bx = cx + Math.cos(angle) * r * 0.3;
    const by = cy + Math.sin(angle) * r * 0.3;
    ctx.moveTo(bx + r, by);
    ctx.arc(bx, by, r, 0, Math.PI * 2);
  }
  ctx.clip();
  blit(ctx, to, w, h);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// Wipe Group
// ═══════════════════════════════════════════════════════════

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

function barnDoor(ctx, from, to, p, w, h) {
  blit(ctx, from, w, h);
  ctx.save();
  ctx.beginPath();
  const halfW = (w / 2) * p;
  ctx.rect(w / 2 - halfW, 0, halfW * 2, h);
  ctx.clip();
  blit(ctx, to, w, h);
  ctx.restore();
}

function irisShape(shapeFn) {
  return (ctx, from, to, p, w, h) => {
    blit(ctx, from, w, h);
    ctx.save();
    ctx.beginPath();
    shapeFn(ctx, p, w, h);
    ctx.clip();
    blit(ctx, to, w, h);
    ctx.restore();
  };
}

const irisCircle = irisShape((ctx, p, w, h) => {
  const r = Math.hypot(w, h) / 2 * p;
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
});

const irisDiamond = irisShape((ctx, p, w, h) => {
  const cx = w / 2, cy = h / 2;
  const size = Math.hypot(w, h) / 2 * p;
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
});

const irisStar = irisShape((ctx, p, w, h) => {
  const cx = w / 2, cy = h / 2;
  const outerR = Math.hypot(w, h) / 2 * p;
  const innerR = outerR * 0.4;
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
});

const irisHeart = irisShape((ctx, p, w, h) => {
  const cx = w / 2, cy = h / 2;
  const scale = Math.hypot(w, h) / 2 * p * 0.015;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.moveTo(0, -20);
  ctx.bezierCurveTo(-40, -60, -80, -10, 0, 40);
  ctx.moveTo(0, -20);
  ctx.bezierCurveTo(40, -60, 80, -10, 0, 40);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
});

function bandWipe(horizontal) {
  return (ctx, from, to, p, w, h) => {
    blit(ctx, from, w, h);
    ctx.save();
    ctx.beginPath();
    const bands = 6;
    if (horizontal) {
      const bandH = h / bands;
      for (let i = 0; i < bands; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const offset = dir > 0 ? 0 : w * (1 - p);
        ctx.rect(offset, i * bandH, w * p, bandH);
      }
    } else {
      const bandW = w / bands;
      for (let i = 0; i < bands; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const offset = dir > 0 ? 0 : h * (1 - p);
        ctx.rect(i * bandW, offset, bandW, h * p);
      }
    }
    ctx.clip();
    blit(ctx, to, w, h);
    ctx.restore();
  };
}

// ═══════════════════════════════════════════════════════════
// Slide Group
// ═══════════════════════════════════════════════════════════

function push(direction) {
  return (ctx, from, to, p, w, h) => {
    const horiz = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    if (horiz) {
      ctx.drawImage(from, sign * w * p, 0, w, h);
      ctx.drawImage(to, sign * w * p + (sign > 0 ? -w : w), 0, w, h);
    } else {
      ctx.drawImage(from, 0, sign * h * p, w, h);
      ctx.drawImage(to, 0, sign * h * p + (sign > 0 ? -h : h), w, h);
    }
  };
}

function cover(direction) {
  return (ctx, from, to, p, w, h) => {
    blit(ctx, from, w, h);
    const horiz = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    if (horiz) {
      ctx.drawImage(to, sign > 0 ? w * (1 - p) : -w * (1 - p), 0, w, h);
    } else {
      ctx.drawImage(to, 0, sign > 0 ? h * (1 - p) : -h * (1 - p), w, h);
    }
  };
}

function reveal(direction) {
  return (ctx, from, to, p, w, h) => {
    blit(ctx, to, w, h);
    const horiz = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    if (horiz) {
      ctx.drawImage(from, sign * w * p, 0, w, h);
    } else {
      ctx.drawImage(from, 0, sign * h * p, w, h);
    }
  };
}

// ═══════════════════════════════════════════════════════════
// Zoom Group
// ═══════════════════════════════════════════════════════════

function zoomIn(ctx, from, to, p, w, h) {
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

function zoomThrough(ctx, from, to, p, w, h) {
  if (p < 0.5) {
    const pp = p * 2;
    const s = 1 + pp * 3;
    ctx.save();
    ctx.globalAlpha = 1 - pp;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.drawImage(from, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    const pp = (p - 0.5) * 2;
    const s = 4 - pp * 3;
    ctx.save();
    ctx.globalAlpha = pp;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.drawImage(to, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function dollyZoom(ctx, from, to, p, w, h) {
  const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  ctx.save();
  ctx.globalAlpha = 1 - ep;
  const s1 = 1 + ep * 0.3;
  ctx.translate(w / 2, h / 2);
  ctx.scale(s1, 1 / s1);
  ctx.drawImage(from, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = ep;
  const s2 = 1 / (1 + (1 - ep) * 0.3);
  ctx.translate(w / 2, h / 2);
  ctx.scale(s2, 1 / s2);
  ctx.drawImage(to, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// 3D Group (simulated via 2D transforms)
// ═══════════════════════════════════════════════════════════

function cubeRotate(axis) {
  return (ctx, from, to, p, w, h) => {
    const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    if (ep < 0.5) {
      const scale = axis === 'x' ? 1 : Math.cos(ep * Math.PI);
      const scaleY = axis === 'x' ? Math.cos(ep * Math.PI) : 1;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(scale), Math.abs(scaleY));
      ctx.drawImage(from, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      const scale = axis === 'x' ? 1 : Math.cos((1 - ep) * Math.PI);
      const scaleY = axis === 'x' ? Math.cos((1 - ep) * Math.PI) : 1;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.abs(scale), Math.abs(scaleY));
      ctx.drawImage(to, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  };
}

function flip(horizontal) {
  return (ctx, from, to, p, w, h) => {
    const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    if (ep < 0.5) {
      const s = Math.cos(ep * Math.PI);
      if (horizontal) ctx.scale(s, 1);
      else ctx.scale(1, s);
      ctx.drawImage(from, -w / 2, -h / 2, w, h);
    } else {
      const s = Math.cos((1 - ep) * Math.PI);
      if (horizontal) ctx.scale(s, 1);
      else ctx.scale(1, s);
      ctx.drawImage(to, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  };
}

function pageCurl(ctx, from, to, p, w, h) {
  // Simplified page curl: diagonal wipe with shadow
  blit(ctx, to, w, h);
  const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w * (1 - ep), 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.lineTo(0, h * ep);
  ctx.closePath();
  ctx.clip();
  blit(ctx, from, w, h);
  // Shadow along the curl edge
  const grad = ctx.createLinearGradient(w * (1 - ep) - 30, 0, w * (1 - ep) + 10, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(w * (1 - ep) - 30, 0, 40, h);
  ctx.restore();
}

function doorway(ctx, from, to, p, w, h) {
  blit(ctx, to, w, h);
  const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  // Two "doors" opening from center
  ctx.save();
  // Left door
  ctx.beginPath();
  ctx.rect(0, 0, w / 2 * (1 - ep), h);
  ctx.clip();
  ctx.translate(-w / 2 * ep, 0);
  blit(ctx, from, w, h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 + w / 2 * ep, 0, w / 2 * (1 - ep), h);
  ctx.clip();
  ctx.translate(w / 2 * ep, 0);
  blit(ctx, from, w, h);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// Glitch Group
// ═══════════════════════════════════════════════════════════

function digitalGlitch(ctx, from, to, p, w, h) {
  crossDissolve(ctx, from, to, p, w, h);
  const intensity = Math.sin(p * Math.PI) * 0.8;
  if (intensity > 0.01) {
    ctx.save();
    // Random block displacement
    const blocks = 8 + Math.floor(intensity * 12);
    for (let i = 0; i < blocks; i++) {
      const blockH = 5 + Math.random() * 30;
      const y = Math.random() * h;
      const shift = (Math.random() - 0.5) * w * intensity * 0.3;
      ctx.drawImage(ctx.canvas, 0, y, w, blockH, shift, y, w, blockH);
    }
    ctx.restore();
  }
}

function staticNoise(ctx, from, to, p, w, h) {
  if (p < 0.3) {
    blit(ctx, from, w, h);
  } else if (p > 0.7) {
    blit(ctx, to, w, h);
  } else {
    // Full static between 0.3 and 0.7
    const noiseP = (p - 0.3) / 0.4;
    if (noiseP < 0.5) blit(ctx, from, w, h);
    else blit(ctx, to, w, h);
    ctx.save();
    ctx.globalAlpha = Math.sin(noiseP * Math.PI) * 0.7;
    const imgData = ctx.createImageData(w >> 3, h >> 3);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
    const tmpCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w >> 3, h >> 3)
      : Object.assign(document.createElement('canvas'), { width: w >> 3, height: h >> 3 });
    tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmpCanvas, 0, 0, w, h);
    ctx.restore();
  }
}

function channelShift(ctx, from, to, p, w, h) {
  const shift = Math.sin(p * Math.PI) * 20;
  ctx.globalAlpha = 1 - p;
  blit(ctx, from, w, h);
  ctx.globalAlpha = p;
  blit(ctx, to, w, h);
  ctx.globalAlpha = 1;
  // RGB channel offset
  if (shift > 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(ctx.canvas, shift, 0);
    ctx.drawImage(ctx.canvas, -shift, 0);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// Creative Group
// ═══════════════════════════════════════════════════════════

function lumaFade(ctx, from, to, p, w, h) {
  blit(ctx, from, w, h);
  ctx.save();
  ctx.globalAlpha = p;
  blit(ctx, to, w, h);
  ctx.restore();
  // Brighten / darken based on luminance
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.3;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function spin(ctx, from, to, p, w, h) {
  const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(ep * Math.PI * 2);
  const s = 1 - Math.abs(ep - 0.5) * 0.6;
  ctx.scale(s, s);
  if (ep < 0.5) {
    ctx.globalAlpha = 1 - ep * 2;
    ctx.drawImage(from, -w / 2, -h / 2, w, h);
  } else {
    ctx.globalAlpha = (ep - 0.5) * 2;
    ctx.drawImage(to, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

function bounce(ctx, from, to, p, w, h) {
  const ep = p;
  // Spring easing
  const spring = 1 + Math.sin(ep * Math.PI * 3) * (1 - ep) * 0.15;
  if (ep < 0.5) {
    blit(ctx, from, w, h);
    ctx.save();
    ctx.globalAlpha = ep * 2;
    ctx.translate(w / 2, h / 2);
    ctx.scale(spring * ep * 2, spring * ep * 2);
    ctx.drawImage(to, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(spring, spring);
    ctx.drawImage(to, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function pixelateTransition(ctx, from, to, p, w, h) {
  const blockSize = Math.max(1, Math.round((1 - Math.abs(p - 0.5) * 2) * 40 + 1));
  const src = p < 0.5 ? from : to;
  const sw = Math.max(1, Math.ceil(w / blockSize));
  const sh = Math.max(1, Math.ceil(h / blockSize));
  const tmpCanvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(sw, sh)
    : Object.assign(document.createElement('canvas'), { width: sw, height: sh });
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(src, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmpCanvas, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
}

function rippleDissolve(ctx, from, to, p, w, h) {
  crossDissolve(ctx, from, to, p, w, h);
  // Subtle ripple distortion
  const ripple = Math.sin(p * Math.PI) * 0.03;
  if (ripple > 0.001) {
    ctx.save();
    const offsetX = Math.sin(p * 20) * w * ripple;
    ctx.drawImage(ctx.canvas, offsetX, 0, w, h, 0, 0, w, h);
    ctx.restore();
  }
}

function blinds(ctx, from, to, p, w, h) {
  blit(ctx, from, w, h);
  const blindCount = 10;
  const blindH = h / blindCount;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < blindCount; i++) {
    const openH = blindH * p;
    ctx.rect(0, i * blindH, w, openH);
  }
  ctx.clip();
  blit(ctx, to, w, h);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════

const REGISTRY = {
  crossDissolve,
  additiveDissolve,
  dipToBlack: dipTo('#000'),
  dipToWhite: dipTo('#fff'),
  filmDissolve,
  bloomDissolve,
  inkBleed,
  wipeLeft: wipe('left'),
  wipeRight: wipe('right'),
  wipeUp: wipe('up'),
  wipeDown: wipe('down'),
  clockWipe,
  barnDoor,
  irisCircle,
  irisDiamond,
  irisStar,
  irisHeart,
  bandWipeH: bandWipe(true),
  bandWipeV: bandWipe(false),
  pushLeft: push('left'),
  pushRight: push('right'),
  pushUp: push('up'),
  pushDown: push('down'),
  coverLeft: cover('left'),
  coverRight: cover('right'),
  revealLeft: reveal('left'),
  revealRight: reveal('right'),
  zoomIn,
  zoomOut,
  zoomThrough,
  dollyZoom,
  cubeX: cubeRotate('x'),
  cubeY: cubeRotate('y'),
  flipH: flip(true),
  flipV: flip(false),
  pageCurl,
  doorway,
  digitalGlitch,
  staticNoise,
  channelShift,
  lumaFade,
  spin,
  bounce,
  pixelateTransition,
  rippleDissolve,
  blinds
};

export function runTransition(kind, ctx, from, to, progress, w, h) {
  const fn = REGISTRY[kind] ?? crossDissolve;
  fn(ctx, from, to, Math.max(0, Math.min(1, progress)), w, h);
}
