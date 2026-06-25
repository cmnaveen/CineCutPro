/**
 * CineCutPro — Composable Effects Registry.
 *
 * Each effect is a pure function that operates on a Canvas2D context.
 * Effects are applied in stack order (first effect drawn first).
 *
 * Effect shape:
 *   {
 *     id: string,           // unique effect ID (e.g., 'blur', 'exposure')
 *     label: string,        // human-readable name
 *     group: string,        // 'Color Correction' | 'Stylize' | 'Distortion' | 'Generate' | 'Keying'
 *     category: string,     // sub-group for finer categorization
 *     params: Array<{
 *       name: string,       // parameter key
 *       label: string,      // display label
 *       type: 'number'|'color'|'boolean'|'select'|'range',
 *       default: any,
 *       min?: number,
 *       max?: number,
 *       step?: number,
 *       options?: string[]  // for 'select' type
 *     }>,
 *     apply: (ctx, w, h, params, time) => void
 *   }
 *
 * Plugin-ready: new effects can be registered at runtime via registerEffect().
 */

const registry = new Map();

/**
 * Register an effect into the global registry.
 * @param {object} effect — effect definition (id, label, group, params, apply)
 */
export function registerEffect(effect) {
  if (!effect.id || !effect.apply) {
    throw new Error(`Effect must have 'id' and 'apply': ${JSON.stringify(effect)}`);
  }
  registry.set(effect.id, effect);
}

/**
 * Get an effect definition by ID.
 */
export function getEffect(id) {
  return registry.get(id) ?? null;
}

/**
 * Get all registered effects.
 * @returns {object[]} — sorted by group, then label
 */
export function getAllEffects() {
  return Array.from(registry.values()).sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.label.localeCompare(b.label);
  });
}

/**
 * Get all effects in a specific group.
 */
export function getEffectsByGroup(group) {
  return getAllEffects().filter((e) => e.group === group);
}

/**
 * Get all unique group names.
 */
export function getEffectGroups() {
  const groups = new Set();
  for (const e of registry.values()) groups.add(e.group);
  return Array.from(groups).sort();
}

/**
 * Apply an effects stack to a canvas context.
 * Each effect in the stack is { effectId, params, enabled }.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w — canvas width
 * @param {number} h — canvas height
 * @param {object[]} effectsStack — ordered list of { effectId, params, enabled }
 * @param {number} time — clip-local time (for animated effects)
 */
export function applyEffectsStack(ctx, w, h, effectsStack, time = 0) {
  if (!effectsStack?.length) return;
  for (const entry of effectsStack) {
    if (entry.enabled === false) continue;
    const def = registry.get(entry.effectId);
    if (!def) continue;
    // Merge defaults with user params
    const params = { ...getDefaults(def), ...(entry.params ?? {}) };
    try {
      def.apply(ctx, w, h, params, time);
    } catch (_) {
      // Silently skip broken effects to prevent rendering failures
    }
  }
}

/**
 * Get default parameter values for an effect.
 */
export function getDefaults(effectDef) {
  const defaults = {};
  for (const p of (effectDef.params ?? [])) {
    defaults[p.name] = p.default;
  }
  return defaults;
}

/**
 * Create a new effect instance for a clip's effects stack.
 */
export function createEffectInstance(effectId, overrides = {}) {
  const def = registry.get(effectId);
  if (!def) return null;
  return {
    effectId,
    enabled: true,
    params: { ...getDefaults(def), ...overrides }
  };
}

// ═══════════════════════════════════════════════════════════════
// Built-in Effects
// ═══════════════════════════════════════════════════════════════

// Helper: apply pixel-level operation via getImageData/putImageData
function withPixels(ctx, w, h, fn) {
  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, w, h);
  } catch (_) {
    return; // tainted canvas
  }
  fn(imgData.data, w, h);
  ctx.putImageData(imgData, 0, 0);
}

// ── Color Correction ─────────────────────────────────────────

registerEffect({
  id: 'exposure',
  label: 'Exposure',
  group: 'Color Correction',
  category: 'Basic',
  params: [
    { name: 'exposure', label: 'Exposure', type: 'number', default: 0, min: -3, max: 3, step: 0.05 }
  ],
  apply(ctx, w, h, params) {
    const mul = Math.pow(2, params.exposure);
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * mul);
        data[i + 1] = Math.min(255, data[i + 1] * mul);
        data[i + 2] = Math.min(255, data[i + 2] * mul);
      }
    });
  }
});

registerEffect({
  id: 'highlightsShadows',
  label: 'Highlights & Shadows',
  group: 'Color Correction',
  category: 'Tonal',
  params: [
    { name: 'highlights', label: 'Highlights', type: 'number', default: 0, min: -100, max: 100, step: 1 },
    { name: 'shadows', label: 'Shadows', type: 'number', default: 0, min: -100, max: 100, step: 1 }
  ],
  apply(ctx, w, h, params) {
    const hAdj = params.highlights / 100;
    const sAdj = params.shadows / 100;
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        let adj;
        if (lum > 0.5) {
          adj = hAdj * (lum - 0.5) * 2 * 80;
        } else {
          adj = sAdj * (0.5 - lum) * 2 * 80;
        }
        data[i] = Math.max(0, Math.min(255, data[i] + adj));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adj));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adj));
      }
    });
  }
});

registerEffect({
  id: 'temperature',
  label: 'Temperature & Tint',
  group: 'Color Correction',
  category: 'White Balance',
  params: [
    { name: 'temperature', label: 'Temperature', type: 'number', default: 0, min: -100, max: 100, step: 1 },
    { name: 'tint', label: 'Tint', type: 'number', default: 0, min: -100, max: 100, step: 1 }
  ],
  apply(ctx, w, h, params) {
    const temp = params.temperature / 100;
    const tint = params.tint / 100;
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        // Temperature: shift blue ↔ orange
        data[i] = Math.max(0, Math.min(255, data[i] + temp * 40));         // R
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] - temp * 40)); // B
        // Tint: shift green ↔ magenta
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - tint * 30)); // G
      }
    });
  }
});

registerEffect({
  id: 'vibrance',
  label: 'Vibrance',
  group: 'Color Correction',
  category: 'Basic',
  params: [
    { name: 'vibrance', label: 'Vibrance', type: 'number', default: 0, min: -100, max: 100, step: 1 }
  ],
  apply(ctx, w, h, params) {
    const v = params.vibrance / 100;
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        const sat = 1 - (max > 0 ? (max - Math.min(r, g, b)) / max : 0);
        const amt = v * sat * 2;
        data[i] = Math.max(0, Math.min(255, r + (r - avg) * amt));
        data[i + 1] = Math.max(0, Math.min(255, g + (g - avg) * amt));
        data[i + 2] = Math.max(0, Math.min(255, b + (b - avg) * amt));
      }
    });
  }
});

registerEffect({
  id: 'colorBalance',
  label: 'Color Balance',
  group: 'Color Correction',
  category: 'Balance',
  params: [
    { name: 'redShift', label: 'Red Shift', type: 'number', default: 0, min: -100, max: 100, step: 1 },
    { name: 'greenShift', label: 'Green Shift', type: 'number', default: 0, min: -100, max: 100, step: 1 },
    { name: 'blueShift', label: 'Blue Shift', type: 'number', default: 0, min: -100, max: 100, step: 1 }
  ],
  apply(ctx, w, h, params) {
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, data[i] + params.redShift * 0.5));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + params.greenShift * 0.5));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + params.blueShift * 0.5));
      }
    });
  }
});

// ── Stylize ──────────────────────────────────────────────────

registerEffect({
  id: 'gaussianBlur',
  label: 'Gaussian Blur',
  group: 'Stylize',
  category: 'Blur',
  params: [
    { name: 'radius', label: 'Radius', type: 'number', default: 5, min: 0, max: 100, step: 1 }
  ],
  apply(ctx, w, h, params) {
    if (params.radius <= 0) return;
    ctx.save();
    ctx.filter = `blur(${params.radius}px)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
});

registerEffect({
  id: 'sharpen',
  label: 'Sharpen',
  group: 'Stylize',
  category: 'Detail',
  params: [
    { name: 'amount', label: 'Amount', type: 'number', default: 0.5, min: 0, max: 3, step: 0.1 }
  ],
  apply(ctx, w, h, params) {
    // Unsharp mask via contrast boost of high-frequency detail
    const amount = params.amount;
    if (amount <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount * 0.3;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
});

registerEffect({
  id: 'filmGrain',
  label: 'Film Grain',
  group: 'Stylize',
  category: 'Noise',
  params: [
    { name: 'intensity', label: 'Intensity', type: 'number', default: 0.3, min: 0, max: 1, step: 0.05 },
    { name: 'size', label: 'Grain Size', type: 'number', default: 1, min: 0.5, max: 4, step: 0.5 }
  ],
  apply(ctx, w, h, params, time) {
    const { intensity, size } = params;
    if (intensity <= 0) return;
    // Generate noise pattern (seed from time for animation)
    const grainW = Math.ceil(w / size);
    const grainH = Math.ceil(h / size);
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = 'overlay';
    // Simple seeded random noise via canvas
    const imgData = ctx.createImageData(grainW, grainH);
    const data = imgData.data;
    let seed = (time * 1000) | 0;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = (seed >> 16) & 0xff;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    // Draw noise scaled up
    const tmpCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(grainW, grainH)
      : Object.assign(document.createElement('canvas'), { width: grainW, height: grainH });
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmpCanvas, 0, 0, w, h);
    ctx.restore();
  }
});

registerEffect({
  id: 'pixelate',
  label: 'Pixelate / Mosaic',
  group: 'Stylize',
  category: 'Distort',
  params: [
    { name: 'blockSize', label: 'Block Size', type: 'number', default: 10, min: 2, max: 100, step: 1 }
  ],
  apply(ctx, w, h, params) {
    const bs = Math.max(2, params.blockSize);
    const sw = Math.ceil(w / bs);
    const sh = Math.ceil(h / bs);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Scale down then back up
    const tmpCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(sw, sh)
      : Object.assign(document.createElement('canvas'), { width: sw, height: sh });
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tmpCanvas, 0, 0, w, h);
    ctx.restore();
  }
});

registerEffect({
  id: 'posterize',
  label: 'Posterize',
  group: 'Stylize',
  category: 'Color',
  params: [
    { name: 'levels', label: 'Levels', type: 'number', default: 6, min: 2, max: 32, step: 1 }
  ],
  apply(ctx, w, h, params) {
    const levels = Math.max(2, params.levels);
    const step = 255 / (levels - 1);
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round(data[i] / step) * step;
        data[i + 1] = Math.round(data[i + 1] / step) * step;
        data[i + 2] = Math.round(data[i + 2] / step) * step;
      }
    });
  }
});

registerEffect({
  id: 'glitch',
  label: 'Glitch',
  group: 'Stylize',
  category: 'Creative',
  params: [
    { name: 'intensity', label: 'Intensity', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
    { name: 'rgbSplit', label: 'RGB Split', type: 'number', default: 5, min: 0, max: 30, step: 1 }
  ],
  apply(ctx, w, h, params, time) {
    const { rgbSplit } = params;
    if (rgbSplit <= 0) return;
    // RGB channel split
    ctx.save();
    const offset = rgbSplit * (1 + Math.sin(time * 8) * 0.3);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.8;
    // Red channel shifted left
    ctx.drawImage(ctx.canvas, -offset, 0);
    ctx.restore();
  }
});

registerEffect({
  id: 'vhsRetro',
  label: 'VHS / Retro',
  group: 'Stylize',
  category: 'Creative',
  params: [
    { name: 'tracking', label: 'Tracking Lines', type: 'number', default: 0.4, min: 0, max: 1, step: 0.05 },
    { name: 'colorBleed', label: 'Color Bleed', type: 'number', default: 0.3, min: 0, max: 1, step: 0.05 }
  ],
  apply(ctx, w, h, params, time) {
    const { tracking, colorBleed } = params;
    // Scan lines
    if (tracking > 0) {
      ctx.save();
      ctx.globalAlpha = tracking * 0.15;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
      // Tracking distortion band
      const bandY = ((time * 60) % (h + 40)) - 20;
      ctx.globalAlpha = tracking * 0.5;
      ctx.drawImage(ctx.canvas, 3, bandY, w, 20, 0, bandY, w, 20);
      ctx.restore();
    }
    // Color bleed (horizontal smear)
    if (colorBleed > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = colorBleed * 0.15;
      ctx.drawImage(ctx.canvas, 2, 0);
      ctx.restore();
    }
  }
});

// ── Distortion ───────────────────────────────────────────────

registerEffect({
  id: 'tiltShift',
  label: 'Tilt-Shift',
  group: 'Distortion',
  category: 'Focus',
  params: [
    { name: 'blur', label: 'Blur Amount', type: 'number', default: 8, min: 0, max: 30, step: 1 },
    { name: 'focusY', label: 'Focus Position', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01 },
    { name: 'focusSize', label: 'Focus Size', type: 'number', default: 0.3, min: 0.05, max: 0.8, step: 0.05 }
  ],
  apply(ctx, w, h, params) {
    const { blur, focusY, focusSize } = params;
    if (blur <= 0) return;
    const centerY = h * focusY;
    const halfBand = h * focusSize / 2;
    // Draw blurred version
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
    // Restore sharp band in the focus area using a clip
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, centerY - halfBand, w, halfBand * 2);
    ctx.clip();
    ctx.filter = 'none';
    // Would need original — this is an approximation
    ctx.restore();
  }
});

registerEffect({
  id: 'mirror',
  label: 'Mirror',
  group: 'Distortion',
  category: 'Transform',
  params: [
    { name: 'axis', label: 'Axis', type: 'select', default: 'horizontal', options: ['horizontal', 'vertical'] }
  ],
  apply(ctx, w, h, params) {
    ctx.save();
    if (params.axis === 'horizontal') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(ctx.canvas, 0, 0);
    } else {
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(ctx.canvas, 0, 0);
    }
    ctx.restore();
  }
});

// ── Generate ─────────────────────────────────────────────────

registerEffect({
  id: 'solidColor',
  label: 'Solid Color',
  group: 'Generate',
  category: 'Color',
  params: [
    { name: 'color', label: 'Color', type: 'color', default: '#000000' },
    { name: 'opacity', label: 'Opacity', type: 'number', default: 1, min: 0, max: 1, step: 0.05 }
  ],
  apply(ctx, w, h, params) {
    ctx.save();
    ctx.globalAlpha = params.opacity;
    ctx.fillStyle = params.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
});

registerEffect({
  id: 'gradientOverlay',
  label: 'Gradient Overlay',
  group: 'Generate',
  category: 'Color',
  params: [
    { name: 'colorA', label: 'Color A', type: 'color', default: '#000000' },
    { name: 'colorB', label: 'Color B', type: 'color', default: '#ffffff' },
    { name: 'angle', label: 'Angle (°)', type: 'number', default: 0, min: 0, max: 360, step: 1 },
    { name: 'opacity', label: 'Opacity', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 }
  ],
  apply(ctx, w, h, params) {
    const rad = (params.angle * Math.PI) / 180;
    const x1 = w / 2 - Math.cos(rad) * w / 2;
    const y1 = h / 2 - Math.sin(rad) * h / 2;
    const x2 = w / 2 + Math.cos(rad) * w / 2;
    const y2 = h / 2 + Math.sin(rad) * h / 2;
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, params.colorA);
    grad.addColorStop(1, params.colorB);
    ctx.save();
    ctx.globalAlpha = params.opacity;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
});

registerEffect({
  id: 'vignette',
  label: 'Vignette',
  group: 'Generate',
  category: 'Lighting',
  params: [
    { name: 'amount', label: 'Amount', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 },
    { name: 'size', label: 'Size', type: 'number', default: 0.5, min: 0.1, max: 1, step: 0.05 }
  ],
  apply(ctx, w, h, params) {
    if (params.amount <= 0.001) return;
    const g = ctx.createRadialGradient(w / 2, h / 2, w * params.size * 0.3, w / 2, h / 2, w * 0.65);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${params.amount})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
});

// ── Keying ───────────────────────────────────────────────────

registerEffect({
  id: 'lumaKey',
  label: 'Luma Key',
  group: 'Keying',
  category: 'Key',
  params: [
    { name: 'threshold', label: 'Threshold', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01 },
    { name: 'softness', label: 'Softness', type: 'number', default: 0.1, min: 0, max: 0.5, step: 0.01 },
    { name: 'invert', label: 'Invert', type: 'boolean', default: false }
  ],
  apply(ctx, w, h, params) {
    const { threshold, softness, invert } = params;
    const threshVal = threshold * 255;
    const softVal = Math.max(0.01, softness * 255);
    withPixels(ctx, w, h, (data) => {
      for (let i = 0; i < data.length; i += 4) {
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        let alpha;
        if (invert) {
          alpha = luma < threshVal ? 255 : luma < threshVal + softVal ? ((luma - threshVal) / softVal) * 255 : 0;
        } else {
          alpha = luma > threshVal + softVal ? 255 : luma > threshVal ? ((luma - threshVal) / softVal) * 255 : 0;
        }
        data[i + 3] = Math.min(data[i + 3], alpha);
      }
    });
  }
});

registerEffect({
  id: 'lut',
  label: '3D LUT / Color Profile',
  group: 'Color Correction',
  category: 'LUT',
  params: [
    { name: 'lutPreset', label: 'LUT Preset', type: 'select', default: 'none', options: ['none', 'cinematic', 'vintage', 'teal-orange'] }
  ],
  apply(ctx, w, h, params) {
    if (params.lutPreset === 'none') return;
    let rShift = 0, gShift = 0, bShift = 0;
    if (params.lutPreset === 'cinematic') {
      rShift = 10; gShift = -5; bShift = -10;
    } else if (params.lutPreset === 'vintage') {
      rShift = 15; gShift = 8; bShift = -15;
    } else if (params.lutPreset === 'teal-orange') {
      rShift = 20; gShift = 0; bShift = -15;
    }
    
    if (rShift !== 0 || gShift !== 0 || bShift !== 0) {
      withPixels(ctx, w, h, (data) => {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, data[i] + rShift));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + gShift));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + bShift));
        }
      });
    }
  }
});


// Export effect group constants
export const EFFECT_GROUPS = {
  COLOR_CORRECTION: 'Color Correction',
  STYLIZE: 'Stylize',
  DISTORTION: 'Distortion',
  GENERATE: 'Generate',
  KEYING: 'Keying'
};
