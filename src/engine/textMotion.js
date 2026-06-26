/**
 * Text entry / exit motion presets (iMovie / CapCut / Premiere inspired).
 *
 * Each motion is a function `m(progress) → { alpha, scale, x, y, blur, clipFrac, rotation }`
 * where `progress` is the animation completion 0..1.
 *
 *   For ENTRY: progress = clamp(localT / inDuration, 0, 1)
 *              progress 0 → fully animated state, 1 → identity
 *   For EXIT:  progress = clamp((clipDur - localT) / outDuration, 0, 1)
 *              progress 0 → fully animated state, 1 → identity
 *
 * If both windows overlap, the smaller `progress` wins (most animated state).
 *
 * v2: Added bounce, wave, spinIn, glitch, typewriter, matrix, stagger motions.
 */

/* ── Easings ──────────────────────────────────────────────────────── */

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const easeOutBounce = (t) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

const easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
};

/* ── Motion presets ───────────────────────────────────────────────── */

export const TEXT_MOTIONS = [
  { id: 'none',       label: 'None',        sub: 'no animation' },
  { id: 'focus',      label: 'Focus',       sub: 'blur in / out' },
  { id: 'reveal',     label: 'Reveal',      sub: 'horizontal wipe' },
  { id: 'expand',     label: 'Expand',      sub: 'grow + fade' },
  { id: 'popup',      label: 'Pop Up',      sub: 'spring bounce' },
  { id: 'rise',       label: 'Rise',        sub: 'lift + fade' },
  { id: 'slide',      label: 'Slide',       sub: 'horizontal glide' },
  // v2 additions
  { id: 'bounce',     label: 'Bounce',      sub: 'spring physics' },
  { id: 'elastic',    label: 'Elastic',     sub: 'rubber band snap' },
  { id: 'spinIn',     label: 'Spin In',     sub: 'rotation entry' },
  { id: 'glitch',     label: 'Glitch',      sub: 'digital distortion' },
  { id: 'typewriter', label: 'Typewriter',  sub: 'character reveal' },
  { id: 'drop',       label: 'Drop',        sub: 'gravity fall + bounce' },
  { id: 'wave',       label: 'Wave',        sub: 'sinusoidal motion' },
  { id: 'flip',       label: 'Flip',        sub: 'card flip rotation' },
  { id: 'zoom',       label: 'Zoom',        sub: 'scale from far away' }
];

/** Identity (no animation). */
const identity = () => ({ alpha: 1, scale: 1, x: 0, y: 0, blur: 0, clipFrac: 1, rotation: 0 });

const motions = {
  none:   identity,
  focus:  (p) => ({
    alpha: easeInOutCubic(Math.max(0, p * 1.15)),
    scale: 1,
    x: 0, y: 0,
    blur: (1 - p) * 18,
    clipFrac: 1,
    rotation: 0
  }),
  reveal: (p) => ({
    alpha: 1,
    scale: 1,
    x: 0, y: 0,
    blur: 0,
    clipFrac: easeOutCubic(p),
    rotation: 0
  }),
  expand: (p) => {
    const e = easeOutCubic(p);
    return { alpha: e, scale: 0.25 + 0.75 * e, x: 0, y: 0, blur: 0, clipFrac: 1, rotation: 0 };
  },
  popup: (p) => {
    const e = easeOutBack(Math.max(0, Math.min(1, p)));
    return {
      alpha: Math.min(1, p * 1.6),
      scale: Math.max(0.1, e),
      x: 0,
      y: (1 - e) * 90,
      blur: 0,
      clipFrac: 1,
      rotation: 0
    };
  },
  rise: (p) => {
    const e = easeOutCubic(p);
    return { alpha: e, scale: 1, x: 0, y: (1 - e) * 120, blur: 0, clipFrac: 1, rotation: 0 };
  },
  slide: (p) => {
    const e = easeOutCubic(p);
    return { alpha: Math.min(1, p * 1.4), scale: 1, x: (1 - e) * -240, y: 0, blur: 0, clipFrac: 1, rotation: 0 };
  },

  // ── New motions ────────────────────────────────────────────

  bounce: (p) => {
    const e = easeOutBounce(p);
    return {
      alpha: Math.min(1, p * 2),
      scale: 1,
      x: 0,
      y: (1 - e) * -200,
      blur: 0,
      clipFrac: 1,
      rotation: 0
    };
  },

  elastic: (p) => {
    const e = easeOutElastic(p);
    return {
      alpha: Math.min(1, p * 1.5),
      scale: Math.max(0.01, e),
      x: 0,
      y: 0,
      blur: 0,
      clipFrac: 1,
      rotation: 0
    };
  },

  spinIn: (p) => {
    const e = easeOutCubic(p);
    return {
      alpha: e,
      scale: 0.2 + 0.8 * e,
      x: 0,
      y: 0,
      blur: (1 - p) * 8,
      clipFrac: 1,
      rotation: (1 - e) * 360
    };
  },

  glitch: (p) => {
    const e = easeOutCubic(p);
    // Random-ish offsets that settle as p → 1
    const jitter = (1 - p);
    const xOff = Math.sin(p * 30) * 40 * jitter;
    const yOff = Math.cos(p * 25) * 20 * jitter;
    return {
      alpha: p < 0.3 ? p * 3.33 : 1,
      scale: 1 + Math.sin(p * 40) * 0.1 * jitter,
      x: xOff,
      y: yOff,
      blur: 0,
      clipFrac: e,
      rotation: 0
    };
  },

  typewriter: (p) => ({
    alpha: 1,
    scale: 1,
    x: 0,
    y: 0,
    blur: 0,
    // clipFrac controls horizontal reveal — typewriter reveals character by character
    clipFrac: Math.min(1, p),
    rotation: 0
  }),

  drop: (p) => {
    // Gravity drop with bounce
    const e = easeOutBounce(p);
    return {
      alpha: Math.min(1, p * 3),
      scale: 1,
      x: 0,
      y: (1 - e) * -400,
      blur: 0,
      clipFrac: 1,
      rotation: (1 - p) * 15 * Math.sin(p * 8)
    };
  },

  wave: (p) => {
    const e = easeOutCubic(p);
    return {
      alpha: e,
      scale: 1,
      x: Math.sin(p * Math.PI * 4) * 30 * (1 - p),
      y: Math.cos(p * Math.PI * 3) * 20 * (1 - p),
      blur: 0,
      clipFrac: 1,
      rotation: Math.sin(p * Math.PI * 3) * 5 * (1 - p)
    };
  },

  flip: (p) => {
    // Card flip effect (via scale.x simulating 3D rotation)
    const scaleX = Math.abs(Math.cos((1 - p) * Math.PI));
    return {
      alpha: p < 0.5 ? p * 2 : 1,
      scale: Math.max(0.01, scaleX),
      x: 0,
      y: 0,
      blur: 0,
      clipFrac: 1,
      rotation: 0
    };
  },

  zoom: (p) => {
    const e = easeOutCubic(p);
    return {
      alpha: e,
      scale: 0.01 + 0.99 * e,
      x: 0,
      y: 0,
      blur: (1 - p) * 15,
      clipFrac: 1,
      rotation: 0
    };
  }
};

/**
 * Resolve the effective motion state for a clip at `localT`.
 * Returns { alpha, scale, x, y, blur, clipFrac, rotation } or null if no motion configured.
 */
export function resolveMotion(motion, localT, clipDur) {
  if (!motion) return null;
  const inId = motion.in && motion.in !== 'none' ? motion.in : null;
  const outId = motion.out && motion.out !== 'none' ? motion.out : null;
  if (!inId && !outId) return null;

  const inDur = Math.max(0.05, motion.inDuration ?? 0.6);
  const outDur = Math.max(0.05, motion.outDuration ?? 0.6);

  const pIn = inId ? Math.max(0, Math.min(1, localT / inDur)) : 1;
  const pOut = outId ? Math.max(0, Math.min(1, (clipDur - localT) / outDur)) : 1;

  // Whichever side is more "animated" (smaller p) wins.
  const useExit = pOut < pIn;
  const which = useExit ? outId : inId;
  const p = useExit ? pOut : pIn;
  const fn = motions[which] ?? identity;
  return fn(p);
}
