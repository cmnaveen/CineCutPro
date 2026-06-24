/**
 * CineCutPro — compositing pipeline.
 *
 * Architecture:
 *   - One offscreen canvas per timeline track, lazily created.
 *   - Per RAF tick: resolve active clips → sync each <video>/<audio> element →
 *     draw each track's clips onto its buffer (with optional per-pixel chroma
 *     key) → run any active transition → blit tracks bottom-up onto the
 *     program canvas.
 *   - Exposes `getActiveAudioMix(state)` to the audio engine so the mixer sees
 *     the same keyframed volume values the visual renderer is using.
 */

import { drawTitle, drawSubtitle } from './titleCompositor.js';
import { runTransition } from './transitions.js';
import { applyChromaKey } from './chromaKey.js';

const PROGRAM_W = 1920;
const PROGRAM_H = 1080;

// The renderer advances its own playback clock every RAF frame (smooth, and
// independent of React). It pushes that time back into React state only this
// often, so the whole component tree no longer re-renders once per frame.
const PUBLISH_INTERVAL = 1 / 20; // seconds (~20 Hz playhead updates to React)

// Keyframe easing curves. The TARGET keyframe's `easing` shapes the segment
// leading into it; 'hold' keeps the previous value until the target (step).
const EASE = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  hold: () => 0
};
const applyEase = (name, t) => (EASE[name] || EASE.linear)(t);

class MediaRenderer {
  constructor() {
    this.programCanvas = null;
    this.programCtx = null;
    this.trackBuffers = new Map();
    this.mediaElements = new Map();
    this.activeTransitionBuffers = null;
    this.chromaScratch = null;
    this.raf = null;
    this.tickHandlers = new Set();
    this.lastTime = performance.now();
    this.currentState = null;
    this.lastPlayhead = 0;
    this.localPlayhead = 0;  // renderer-owned playback clock (decoupled from React)
    this.duration = 60;      // timeline duration (seconds) for playback bounds
    this._publishAcc = 0;    // accumulator for throttled playhead publishing
    this.lastFrameStats = { drawCalls: 0, activeClips: 0, fps: 0 };
    this._fpsAcc = { frames: 0, time: 0 };
  }

  attachProgramCanvas(canvas) {
    this.programCanvas = canvas;
    if (canvas) {
      canvas.width = PROGRAM_W;
      canvas.height = PROGRAM_H;
      this.programCtx = canvas.getContext('2d', { alpha: false });
    } else {
      this.programCtx = null;
    }
  }

  registerMedia(id, element) {
    if (element) this.mediaElements.set(id, element);
    else this.mediaElements.delete(id);
  }

  getMediaElement(id) {
    return this.mediaElements.get(id);
  }

  onTick(handler) {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  setState(state) {
    const prevSeekId = this.currentState ? this.currentState.seekId : undefined;
    this.currentState = state;
    // Adopt React's playhead only on a genuine user seek (seekId changed) or
    // while paused; during playback the renderer's own clock is authoritative.
    if (!state.playing || state.seekId !== prevSeekId) {
      this.localPlayhead = state.playhead;
    }
  }

  start() {
    if (this.raf) return;
    this.lastTime = performance.now();
    const loop = (t) => {
      this.raf = requestAnimationFrame(loop);
      const dt = (t - this.lastTime) / 1000;
      this.lastTime = t;
      this._tick(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  // ---------------------------------------------------------------------
  _makeBuffer() {
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(PROGRAM_W, PROGRAM_H)
      : Object.assign(document.createElement('canvas'), { width: PROGRAM_W, height: PROGRAM_H });
    return { canvas, ctx: canvas.getContext('2d') };
  }

  _ensureTrackBuffer(trackId) {
    let buf = this.trackBuffers.get(trackId);
    if (!buf) {
      buf = this._makeBuffer();
      this.trackBuffers.set(trackId, buf);
    }
    return buf;
  }

  _ensureTransitionBuffers() {
    if (this.activeTransitionBuffers) return this.activeTransitionBuffers;
    this.activeTransitionBuffers = { from: this._makeBuffer(), to: this._makeBuffer() };
    return this.activeTransitionBuffers;
  }

  _ensureChromaScratch() {
    if (this.chromaScratch) return this.chromaScratch;
    this.chromaScratch = this._makeBuffer();
    return this.chromaScratch;
  }

  _filterFor(clip) {
    const f = clip.filters ?? {};
    return [
      `brightness(${f.brightness ?? 1})`,
      `contrast(${f.contrast ?? 1})`,
      `saturate(${f.saturation ?? 1})`,
      `hue-rotate(${f.hueRotate ?? 0}deg)`
    ].join(' ');
  }

  /** Interpolate a keyframed channel at clip-local time `localT`, honoring per-keyframe easing. */
  _keyframeValue(clip, channel, defaultValue, localT) {
    const kfs = (clip.keyframes ?? []).filter((k) => k.channel === channel);
    if (!kfs.length) return defaultValue;
    kfs.sort((a, b) => a.time - b.time);
    if (localT <= kfs[0].time) return kfs[0].value;
    if (localT >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    for (let i = 1; i < kfs.length; i++) {
      const a = kfs[i - 1];
      const b = kfs[i];
      if (localT >= a.time && localT <= b.time) {
        const raw = (localT - a.time) / (b.time - a.time || 1);
        const p = applyEase(b.easing, raw);
        return a.value + (b.value - a.value) * p;
      }
    }
    return defaultValue;
  }

  _syncVideoElement(element, mediaTime, playing, rate) {
    if (!element) return;
    try {
      if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
        const diff = mediaTime - element.currentTime; // Positive means video is lagging, negative means ahead
        
        if (!playing) {
          // Paused / Scrubbing: Sync immediately to show the correct frame if drift is noticeable
          element.playbackRate = Math.max(0.25, Math.min(4, Math.abs(rate || 1)));
          if (Math.abs(diff) > 0.03 && !element.seeking) {
            element.currentTime = Math.max(0, mediaTime);
          }
          if (!element.paused) {
            element.pause();
          }
        } else {
          // Playing
          if (rate > 0) {
            if (element.paused) {
              // When starting playback, seek to the current playhead first so it starts at the right spot.
              element.playbackRate = rate;
              if (Math.abs(diff) > 0.05 && !element.seeking) {
                element.currentTime = Math.max(0, mediaTime);
              }
              element.play().catch(() => {});
            } else {
              // Already playing: use dynamic playbackRate adjustments to sync smoothly without seeks!
              const absDiff = Math.abs(diff);
              if (absDiff > 1.5 && !element.seeking) {
                // Hard seek if drift is massive (e.g. > 1.5 seconds)
                element.currentTime = Math.max(0, mediaTime);
                element.playbackRate = rate;
              } else if (absDiff > 0.03) {
                // Micro-adjust playback rate to catch up or slow down
                if (diff > 0) {
                  // Video is lagging behind clock: speed up by 15% to catch up
                  element.playbackRate = Math.min(4, rate * 1.15);
                } else {
                  // Video is ahead of clock: slow down by 15% to let clock catch up
                  element.playbackRate = Math.max(0.25, rate * 0.85);
                }
              } else {
                // In sync (drift <= 30ms): play at target rate
                element.playbackRate = rate;
              }
            }
          } else {
            // Reverse playback or rate <= 0 (standard HTML5 video doesn't play backwards smoothly, so pause and seek)
            element.playbackRate = Math.max(0.25, Math.min(4, Math.abs(rate || 1)));
            if (!element.paused) {
              element.pause();
            }
            if (Math.abs(diff) > 0.03 && !element.seeking) {
              element.currentTime = Math.max(0, mediaTime);
            }
          }
        }
      }
    } catch (_) {}
  }

  /**
   * Draw a video frame with optional chroma key into the track buffer.
   * Chroma key requires a scratch canvas because getImageData has to run on
   * untransformed pixels.
   */
  _drawVideoFrame(ctx, clip, media, el, sw, sh, crop) {
    const cx = sw * crop.left;
    const cy = sh * crop.top;
    const cw = sw * (1 - crop.left - crop.right);
    const ch = sh * (1 - crop.top - crop.bottom);
    const targetAR = PROGRAM_W / PROGRAM_H;
    const srcAR = cw / ch;
    let dw = PROGRAM_W;
    let dh = PROGRAM_H;
    if (srcAR > targetAR) dh = PROGRAM_W / srcAR;
    else dw = PROGRAM_H * srcAR;

    const ck = clip.filters?.chromaKey;
    if (ck?.enabled) {
      const scratch = this._ensureChromaScratch();
      scratch.ctx.clearRect(0, 0, PROGRAM_W, PROGRAM_H);
      scratch.ctx.drawImage(el, cx, cy, cw, ch, (PROGRAM_W - dw) / 2, (PROGRAM_H - dh) / 2, dw, dh);
      applyChromaKey(scratch.ctx, PROGRAM_W, PROGRAM_H, ck);
      ctx.drawImage(scratch.canvas, -PROGRAM_W / 2, -PROGRAM_H / 2);
    } else {
      ctx.drawImage(el, cx, cy, cw, ch, -dw / 2, -dh / 2, dw, dh);
    }
  }

  _drawClipOnto(ctx, clip, media, localT) {
    const tr = clip.transform ?? {};
    const opacity = this._keyframeValue(clip, 'opacity', tr.opacity ?? 1, localT);
    const scale = this._keyframeValue(clip, 'scale', tr.scale ?? 1, localT);
    const rotation = this._keyframeValue(clip, 'rotation', tr.rotation ?? 0, localT);
    const x = this._keyframeValue(clip, 'x', tr.x ?? 0, localT);
    const y = this._keyframeValue(clip, 'y', tr.y ?? 0, localT);
    const crop = tr.crop ?? { top: 0, right: 0, bottom: 0, left: 0 };

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.filter = this._filterFor(clip);
    ctx.translate(PROGRAM_W / 2 + x, PROGRAM_H / 2 + y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    if (clip.kind === 'title' && clip.title) {
      ctx.translate(-PROGRAM_W / 2, -PROGRAM_H / 2);
      drawTitle(ctx, clip.title, this.programCanvas, localT, clip.end - clip.start);
    } else if (clip.kind === 'subtitle') {
      ctx.translate(-PROGRAM_W / 2, -PROGRAM_H / 2);
      drawSubtitle(ctx, clip.title ?? { text: '— subtitle —', valign: 'bottom' });
    } else if (media && media.kind === 'image') {
      const el = this.mediaElements.get(media.id);
      if (el) {
        const sw = el.naturalWidth || el.width || PROGRAM_W;
        const sh = el.naturalHeight || el.height || PROGRAM_H;
        const cx = sw * crop.left;
        const cy = sh * crop.top;
        const cw = sw * (1 - crop.left - crop.right);
        const ch = sh * (1 - crop.top - crop.bottom);
        ctx.drawImage(el, cx, cy, cw, ch, -PROGRAM_W / 2, -PROGRAM_H / 2, PROGRAM_W, PROGRAM_H);
      }
    } else if (media && media.kind === 'video') {
      const el = this.mediaElements.get(media.id);
      if (el) {
        const sw = el.videoWidth || PROGRAM_W;
        const sh = el.videoHeight || PROGRAM_H;
        this._drawVideoFrame(ctx, clip, media, el, sw, sh, crop);
      } else {
        ctx.fillStyle = '#1a2434';
        ctx.fillRect(-PROGRAM_W / 2, -PROGRAM_H / 2, PROGRAM_W, PROGRAM_H);
      }
    } else if (clip.kind === 'audio') {
      // Audio clips render no visual.
    }

    const vig = clip.filters?.vignette ?? 0;
    if (vig > 0.001) {
      ctx.filter = 'none';
      const g = ctx.createRadialGradient(0, 0, PROGRAM_W * 0.25, 0, 0, PROGRAM_W * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${vig})`);
      ctx.fillStyle = g;
      ctx.fillRect(-PROGRAM_W / 2, -PROGRAM_H / 2, PROGRAM_W, PROGRAM_H);
    }

    ctx.restore();
  }

  _transitionContext(state, c, t) {
    const out = c.transitions?.out;
    const incoming = state.clips.find(
      (x) =>
        x.id !== c.id &&
        x.trackId === c.trackId &&
        Math.abs(x.start - c.end) < 0.001 &&
        x.transitions?.in
    );
    if (out && incoming && t >= c.end - out.duration && t <= c.end) {
      return {
        kind: out.kind,
        duration: out.duration,
        fromClip: c,
        toClip: incoming,
        t0: c.end - out.duration
      };
    }
    return null;
  }

  /**
   * Snapshot the audio mix the renderer is currently producing — augments each
   * active clip with its current keyframed volume so the audio engine and the
   * inspector mixer can sample the same values.
   */
  getActiveAudioMix(state) {
    const t = state.playhead;
    const trackById = new Map(state.tracks.map((tr) => [tr.id, tr]));
    return state.clips
      .filter((c) => c.start <= t && c.end > t)
      .map((c) => {
        const local = (t - c.start) * (c.speed ?? 1);
        const kfVol = this._keyframeValue(c, 'volume', 1, local);
        const tr = trackById.get(c.trackId);
        return {
          ...c,
          keyframeVolume: kfVol,
          trackVolume: tr?.volume ?? 1,
          trackPan: tr?.pan ?? 0
        };
      });
  }

  _tick(dt) {
    const state = this.currentState;
    if (!state || !this.programCtx) return;
    const playing = state.playing;
    const rate = state.playbackRate ?? 1;

    // ----- Playback clock: advance our own time, decoupled from React -----
    let publish = false;
    let atEnd = false;
    if (playing) {
      this.localPlayhead += dt * rate;
      const dur = this.duration || 60;
      const loop = state.loop;
      const min = state.inPoint != null && loop ? state.inPoint : 0;
      const max = state.outPoint != null && loop ? state.outPoint : dur;
      if (this.localPlayhead <= min) { this.localPlayhead = loop ? max : min; if (!loop && rate < 0) atEnd = true; }
      if (this.localPlayhead >= max) { this.localPlayhead = loop ? min : max; if (!loop && rate > 0) atEnd = true; }
      this._publishAcc += dt;
      if (atEnd || this._publishAcc >= PUBLISH_INTERVAL) {
        this._publishAcc = 0;
        publish = true;
      }
    } else {
      this.localPlayhead = state.playhead;
      this._publishAcc = 0;
    }
    const t = this.localPlayhead;

    this._fpsAcc.frames++;
    this._fpsAcc.time += dt;
    if (this._fpsAcc.time >= 0.5) {
      this.lastFrameStats.fps = Math.round(this._fpsAcc.frames / this._fpsAcc.time);
      this._fpsAcc = { frames: 0, time: 0 };
    }

    for (const fn of this.tickHandlers) fn({ t, dt, playing, rate, publish, atEnd });

    this.programCtx.fillStyle = '#05080f';
    this.programCtx.fillRect(0, 0, PROGRAM_W, PROGRAM_H);

    const tracks = state.tracks.slice().reverse();
    const mediaById = new Map(state.media.map((m) => [m.id, m]));
    let drawCalls = 0;
    let activeCount = 0;

    for (const track of tracks) {
      if (!track.visible) continue;
      const buf = this._ensureTrackBuffer(track.id);
      buf.ctx.clearRect(0, 0, PROGRAM_W, PROGRAM_H);

      const clips = state.clips.filter((c) => c.trackId === track.id);
      const active = clips.filter((c) => c.start <= t && c.end > t);
      activeCount += active.length;

      for (const c of clips) {
        const media = mediaById.get(c.mediaId);
        if (!media) continue;
        if (media.kind !== 'video' && media.kind !== 'audio') continue;
        const el = this.mediaElements.get(media.id);
        if (!el) continue;
        if (c.start <= t && c.end > t) {
          const local = (t - c.start) * (c.speed ?? 1) + c.srcIn;
          this._syncVideoElement(el, local, playing && rate > 0, rate);
        } else if (!el.paused) {
          el.pause();
        }
      }

      for (const c of active) {
        const transition = this._transitionContext(state, c, t);
        const local = (t - c.start) * (c.speed ?? 1);
        if (transition) {
          const tb = this._ensureTransitionBuffers();
          tb.from.ctx.clearRect(0, 0, PROGRAM_W, PROGRAM_H);
          tb.to.ctx.clearRect(0, 0, PROGRAM_W, PROGRAM_H);
          this._drawClipOnto(tb.from.ctx, transition.fromClip, mediaById.get(transition.fromClip.mediaId), local);
          this._drawClipOnto(tb.to.ctx, transition.toClip, mediaById.get(transition.toClip.mediaId), 0);
          const p = (t - transition.t0) / transition.duration;
          runTransition(transition.kind, buf.ctx, tb.from.canvas, tb.to.canvas, p, PROGRAM_W, PROGRAM_H);
          drawCalls += 3;
        } else {
          this._drawClipOnto(buf.ctx, c, mediaById.get(c.mediaId), local);
          drawCalls++;
        }
      }

      this.programCtx.drawImage(buf.canvas, 0, 0, PROGRAM_W, PROGRAM_H);
    }

    this.lastFrameStats.drawCalls = drawCalls;
    this.lastFrameStats.activeClips = activeCount;
    this.lastPlayhead = t;
  }
}


export const mediaRenderer = new MediaRenderer();
export { PROGRAM_W, PROGRAM_H };
