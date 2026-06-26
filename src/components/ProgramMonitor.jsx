import { useEffect, useMemo, useRef } from 'react';
import { useEditor } from '../state/EditorContext.jsx';
import { Icon } from './icons/IconSet.jsx';
import { formatTC } from '../engine/timecode.js';
import { mediaRenderer } from '../engine/mediaRenderer.js';
import { audioEngine } from '../engine/audioEngine.js';
import { EmptyHero } from './EmptyHero.jsx';
import { CanvasOverlay } from './CanvasOverlay.jsx';

/**
 * Program Monitor — composited output of the timeline.
 *
 * The bulk of the work happens in mediaRenderer; this component owns:
 *  - the program <canvas>
 *  - the hidden pool of <video>/<img> elements (one per video/image media item)
 *  - the per-frame state push into the renderer
 *  - the safe-zones + volume overlays
 *  - advancing the timeline playhead during playback
 */
export function ProgramMonitor() {
  const { state, dispatch, duration } = useEditor();
  const canvasRef = useRef(null);
  const mediaElsRef = useRef(new Map());

  // Attach canvas + start the RAF loop
  useEffect(() => {
    mediaRenderer.attachProgramCanvas(canvasRef.current);
    mediaRenderer.start();
    return () => {
      mediaRenderer.stop();
      mediaRenderer.attachProgramCanvas(null);
    };
  }, []);

  // Push current state into the renderer every render
  useEffect(() => {
    mediaRenderer.setState(state);
    mediaRenderer.duration = duration;
  });

  // The renderer owns the playback clock (it advances time in its own RAF, fully
  // decoupled from React) and pushes the playhead back here — throttled — so the
  // component tree no longer re-renders every frame during playback.
  useEffect(() => {
    return mediaRenderer.onTick(({ publish, atEnd, t }) => {
      if (atEnd) {
        dispatch({ type: 'playback/tickPlayhead', t });
        dispatch({ type: 'playback/pause' });
      } else if (publish) {
        dispatch({ type: 'playback/tickPlayhead', t });
      }
    });
  }, [dispatch]);

  // Drive audio engine from active clips — sample keyframed volume via the renderer.
  useEffect(() => {
    audioEngine.ensure();
    const enriched = mediaRenderer.getActiveAudioMix(state);
    const muted = new Set(state.tracks.filter((t) => t.muted).map((t) => t.id));
    const soloed = new Set(state.tracks.filter((t) => t.solo).map((t) => t.id));
    audioEngine.sync({
      activeClips: enriched,
      mute: muted,
      soloed,
      masterVolume: state.master.volume,
      playing: state.playing
    });
  }, [state]);

  // Maintain a pool of off-DOM video/image elements that the renderer samples.
  // We register them with mediaRenderer when they enter the bin and tear down
  // when they leave.
  useEffect(() => {
    const current = mediaElsRef.current;
    const seen = new Set();
    for (const m of state.media) {
      seen.add(m.id);
      const targetSrc = (state.project.proxyMode && m.proxyUrl) ? m.proxyUrl : m.src;

      if (current.has(m.id)) {
        const el = current.get(m.id);
        if (el.tagName === 'VIDEO' && el.src !== targetSrc) {
          el.src = targetSrc;
          el.load();
        }
        continue;
      }

      if (m.kind === 'video') {
        const v = document.createElement('video');
        v.src = targetSrc;
        v.playsInline = true;
        v.preload = 'auto';
        v.crossOrigin = 'anonymous';
        v.muted = true; // audioEngine flips this once Web Audio wraps the element
        v.load();
        current.set(m.id, v);
        mediaRenderer.registerMedia(m.id, v);
        audioEngine.registerElement(m.id, v);
      } else if (m.kind === 'audio') {
        const a = document.createElement('audio');
        a.src = m.src;
        a.preload = 'auto';
        a.crossOrigin = 'anonymous';
        a.muted = true;
        a.load();
        current.set(m.id, a);
        mediaRenderer.registerMedia(m.id, a);
        audioEngine.registerElement(m.id, a);
      } else if (m.kind === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = m.src;
        current.set(m.id, img);
        mediaRenderer.registerMedia(m.id, img);
      }
    }
    for (const id of Array.from(current.keys())) {
      if (!seen.has(id)) {
        mediaRenderer.registerMedia(id, null);
        audioEngine.registerElement(id, null);
        current.delete(id);
      }
    }
  }, [state.media, state.project.proxyMode]);

  const playheadDur = useMemo(() => duration, [duration]);

  return (
    <section className="cc-monitor cc-monitor--program">
      <header className="cc-monitor__header">
        <span className="cc-monitor__label">Program</span>
        <span className="cc-monitor__name">{state.project.name}</span>
        <span className="cc-monitor__tc">{formatTC(state.playhead)}</span>
      </header>

      <div className="cc-monitor__stage cc-monitor__stage--program">
        <canvas ref={canvasRef} className="cc-program-canvas" />
        {state.master.safeZones && (
          <div className="cc-safezones">
            <div className="cc-safezones__action" />
            <div className="cc-safezones__title" />
            <div className="cc-safezones__center cc-safezones__center--v" />
            <div className="cc-safezones__center cc-safezones__center--h" />
          </div>
        )}
        <EmptyHero visible={state.clips.length === 0} />
        <CanvasOverlay />
      </div>

      <footer className="cc-monitor__controls">
        <div className="cc-monitor__buttons">
          <button
            className={`cc-icon-btn ${state.master.safeZones ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'master/toggleSafeZones' })}
            title="Toggle safe zones"
          >
            <Icon.Target size={15} /> 🎯
          </button>
          <button
            className={`cc-icon-btn ${state.loop ? 'is-on' : ''}`}
            onClick={() => dispatch({ type: 'playback/toggleLoop' })}
            title="Loop In→Out"
          >
            <Icon.Loop size={15} />
          </button>
          <span className="cc-transport__divider" />
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/markIn' })}
            title="Mark In (I)"
          >
            <Icon.In size={15} />
          </button>
          <button
            className="cc-icon-btn"
            onClick={() => dispatch({ type: 'playback/markOut' })}
            title="Mark Out (O)"
          >
            <Icon.Out size={15} />
          </button>
          <span className="cc-transport__divider" />
          <div className="cc-master-vol">
            <Icon.Volume size={14} />
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={state.master.volume}
              onChange={(e) => dispatch({ type: 'master/setVolume', v: parseFloat(e.target.value) })}
            />
            <span>{Math.round(state.master.volume * 100)}%</span>
          </div>
        </div>

        <div className="cc-monitor__tape">
          <div
            className="cc-monitor__playhead"
            style={{ left: `${(state.playhead / Math.max(0.001, playheadDur)) * 100}%` }}
          />
          {state.inPoint != null && state.outPoint != null && (
            <div
              className="cc-monitor__range"
              style={{
                left: `${(state.inPoint / playheadDur) * 100}%`,
                width: `${((state.outPoint - state.inPoint) / playheadDur) * 100}%`
              }}
            />
          )}
        </div>
      </footer>
    </section>
  );
}
