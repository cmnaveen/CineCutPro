/**
 * CineCutPro — Web Audio playback engine.
 *
 * Real audio routing using MediaElementAudioSourceNode.  Each media element
 * (video or audio) is wrapped in a Source → Gain → Pan → Master chain so the
 * timeline mixer can apply clip volume, track volume, pan, mute/solo, master
 * volume, and keyframed volume curves to the actual audio signal.
 *
 * AudioContext can only be constructed in response to a user gesture; until
 * then, elements register into a pending queue and are wired on first
 * ensure()/resume() call (which the keyboard hook triggers on first Space/L/J).
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    /** mediaId -> { source, gain, pan, element } */
    this.voices = new Map();
    /** mediaId -> element waiting for ensure() */
    this.pending = new Map();
    /** trackId -> meter envelope 0..1 (set by sync, polled by UI) */
    this.meters = new Map();
    /** trackId -> peak envelope (decays toward meter for "peak hold" look) */
    this.peaks = new Map();
    this._exportDest = null; // lazily-created MediaStreamDestination for export
  }

  /** Idempotent — returns true if the AudioContext is alive. */
  ensure() {
    if (this.ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    // Drain anything that registered before the user gesture.
    for (const [id, el] of this.pending) this._wire(id, el);
    this.pending.clear();
    return true;
  }

  resume() {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  /** Called by the renderer for each media item entering / leaving the bin. */
  registerElement(id, element) {
    if (!element) {
      this._unwire(id);
      this.pending.delete(id);
      return;
    }
    if (this.ctx) this._wire(id, element);
    else this.pending.set(id, element);
  }

  _wire(id, element) {
    if (this.voices.has(id)) return;
    if (!this.ctx) return;
    try {
      const source = this.ctx.createMediaElementSource(element);
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      let pan = null;
      if (this.ctx.createStereoPanner) {
        pan = this.ctx.createStereoPanner();
        source.connect(gain).connect(pan).connect(this.master);
      } else {
        source.connect(gain).connect(this.master);
      }
      // Once Web Audio owns the signal, the element should NOT also play
      // through default output — but un-muting is required so MESN sees data.
      element.muted = false;
      this.voices.set(id, { source, gain, pan, element });
    } catch (_e) {
      // A given element can only be wrapped once. Subsequent calls will throw.
      // React strict-mode double-mount can hit this — silently keep the first.
    }
  }

  _unwire(id) {
    const v = this.voices.get(id);
    if (!v) return;
    try {
      v.source.disconnect();
      v.gain.disconnect();
      if (v.pan) v.pan.disconnect();
    } catch (_) {}
    if (v.element) v.element.muted = true;
    this.voices.delete(id);
  }

  setMasterVolume(v) {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, 0.02);
  }

  /** A MediaStream carrying the live master mix, so MediaRecorder can mux audio. */
  getExportStream() {
    this.ensure();
    if (!this.ctx || !this.master) return null;
    if (!this._exportDest) {
      this._exportDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this._exportDest);
    }
    return this._exportDest.stream;
  }

  /**
   * Apply the current mix state to every wired voice.
   * `activeClips` items are augmented with: trackVolume, trackPan, keyframeVolume.
   */
  sync({ activeClips, mute, soloed, masterVolume, playing }) {
    if (!this.ctx) return;
    this.setMasterVolume(playing ? masterVolume : 0);

    const anySolo = soloed.size > 0;
    /** mediaId -> { gain, pan, trackId } chosen for this frame */
    const desired = new Map();
    /** trackId -> summed gain (for meters) */
    const trackEnv = new Map();

    for (const c of activeClips) {
      if (!c.mediaId) continue;
      const audible =
        !mute.has(c.trackId) && (!anySolo || soloed.has(c.trackId)) && !c.audio?.muted;
      if (!audible) continue;
      const kf = c.keyframeVolume ?? 1;
      const gain = (c.audio?.volume ?? 1) * (c.trackVolume ?? 1) * kf;
      const pan = c.audio?.pan ?? c.trackPan ?? 0;
      // If multiple active clips share media, keep the louder one.
      const prev = desired.get(c.mediaId);
      if (!prev || prev.gain < gain) desired.set(c.mediaId, { gain, pan, trackId: c.trackId });
      trackEnv.set(c.trackId, (trackEnv.get(c.trackId) ?? 0) + gain);
    }

    for (const [id, voice] of this.voices) {
      const d = desired.get(id) ?? { gain: 0, pan: 0 };
      voice.gain.gain.setTargetAtTime(d.gain, this.ctx.currentTime, 0.04);
      if (voice.pan) voice.pan.pan.setTargetAtTime(d.pan, this.ctx.currentTime, 0.04);
    }

    // Meters: ballistic envelope (fast attack / slow decay) for VU feel.
    for (const [trackId, env] of trackEnv) {
      const cur = this.meters.get(trackId) ?? 0;
      const next = env >= cur ? env : cur * 0.92 + env * 0.08;
      this.meters.set(trackId, next * (playing ? 1 : 0.5));
      const peakCur = this.peaks.get(trackId) ?? 0;
      this.peaks.set(trackId, Math.max(next, peakCur * 0.985));
    }
    // Decay tracks not currently producing audio.
    for (const trackId of this.meters.keys()) {
      if (!trackEnv.has(trackId)) {
        this.meters.set(trackId, (this.meters.get(trackId) ?? 0) * 0.85);
        this.peaks.set(trackId, (this.peaks.get(trackId) ?? 0) * 0.97);
      }
    }
  }

  getMeter(trackId) {
    return this.meters.get(trackId) ?? 0;
  }
  getPeak(trackId) {
    return this.peaks.get(trackId) ?? 0;
  }
}

export const audioEngine = new AudioEngine();
