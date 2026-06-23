/**
 * Text entry / exit motion presets (iMovie-inspired).
 *
 * Each motion is a function `m(progress) → { alpha, scale, x, y, blur, clipFrac }`
 * where `progress` is the animation completion 0..1.
 *
 *   For ENTRY: progress = clamp(localT / inDuration, 0, 1)
 *              progress 0 → fully animated state, 1 → identity
 *   For EXIT:  progress = clamp((clipDur - localT) / outDuration, 0, 1)
 *              progress 0 → fully animated state, 1 → identity
 *
 * If both windows overlap, the smaller `progress` wins (most animated state).
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

/* ── Motion presets ───────────────────────────────────────────────── */

export const TEXT_MOTIONS = [
  { id: 'none',   label: 'None',    sub: 'no animation' },
  { id: 'focus',  label: 'Focus',   sub: 'blur in / out' },
  { id: 'reveal', label: 'Reveal',  sub: 'horizontal wipe' },
  { id: 'expand', label: 'Expand',  sub: 'grow + fade' },
  { id: 'popup',  label: 'Pop Up',  sub: 'spring bounce' },
  { id: 'rise',   label: 'Rise',    sub: 'lift + fade' },
  { id: 'slide',  label: 'Slide',   sub: 'horizontal glide' }
];

/** Identity (no animation). */
const identity = () => ({ alpha: 1, scale: 1, x: 0, y: 0, blur: 0, clipFrac: 1 });

const motions = {
  none:   identity,
  focus:  (p) => ({
    alpha: easeInOutCubic(Math.max(0, p * 1.15)),
    scale: 1,
    x: 0, y: 0,
    blur: (1 - p) * 18,
    clipFrac: 1
  }),
  reveal: (p) => ({
    alpha: 1,
    scale: 1,
    x: 0, y: 0,
    blur: 0,
    clipFrac: easeOutCubic(p)
  }),
  expand: (p) => {
    const e = easeOutCubic(p);
    return { alpha: e, scale: 0.25 + 0.75 * e, x: 0, y: 0, blur: 0, clipFrac: 1 };
  },
  popup: (p) => {
    const e = easeOutBack(Math.max(0, Math.min(1, p)));
    return {
      alpha: Math.min(1, p * 1.6),
      scale: Math.max(0.1, e),
      x: 0,
      y: (1 - e) * 90,
      blur: 0,
      clipFrac: 1
    };
  },
  rise: (p) => {
    const e = easeOutCubic(p);
    return { alpha: e, scale: 1, x: 0, y: (1 - e) * 120, blur: 0, clipFrac: 1 };
  },
  slide: (p) => {
    const e = easeOutCubic(p);
    return { alpha: Math.min(1, p * 1.4), scale: 1, x: (1 - e) * -240, y: 0, blur: 0, clipFrac: 1 };
  }
};

/**
 * Resolve the effective motion state for a clip at `localT`.
 * Returns { alpha, scale, x, y, blur, clipFrac } or null if no motion configured.
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
